const db = require('../db')
const config = require('../config')
const gameStateManager = require('./gameStateManager')
const chatPoolService = require('./chatPoolService')

/**
 * Battle Engine v2.5 — Turn-Based Sub-Tick System
 *
 * Key changes from v2:
 * - 200ms ticks (was 1000ms)
 * - Initiative-based turns: only 1 agent acts per tick
 * - Weapon speed stat determines turn frequency
 * - No simultaneous movement = no collision issues
 * - Passive effects (terrain, ring, buffs) every 5 ticks (=1s)
 * - AI seeks ALL nearby powerups (not just heal_pack when low HP)
 */

// Active battle intervals: gameId → intervalId
const battleIntervals = new Map()

// Socket.io instance (injected via setIO)
let io = null
function setIO(socketIO) { io = socketIO }

// =========================================
// Public API
// =========================================

function startBattle(game, arena, entries) {
  const gameId = game.id
  const terrain = parseTerrain(arena)

  const spawnPoints = typeof arena.spawn_points === 'string'
    ? JSON.parse(arena.spawn_points)
    : arena.spawn_points

  const agents = entries.map((entry, i) => {
    const spawn = spawnPoints[i] || [0, 0]
    return {
      slot: entry.slot,
      agentId: entry.agent_id,
      hp: config.startingHp + (entry.bonus_hp || 0),
      maxHp: config.startingHp + (entry.bonus_hp || 0),
      x: spawn[0],
      y: spawn[1],
      weapon: {
        slug: entry.weapon_slug,
        damage: entry.weapon_damage + (entry.bonus_damage || 0),
        baseDamage: entry.weapon_damage,
        damageMin: entry.weapon_damage_min || null,
        damageMax: entry.weapon_damage_max || null,
        range: entry.weapon_range,
        cooldown: entry.weapon_cooldown,
        aoeRadius: entry.weapon_aoe_radius || 0,
        skill: entry.weapon_skill || null,
        speed: entry.weapon_speed || 3
      },
      cooldown: 0,
      initiative: 0,
      score: 0,
      kills: 0,
      damageDealt: 0,
      damageTaken: 0,
      survivedTicks: 0,
      alive: true,
      action: null,
      personality: entry.personality || 'friendly',
      strategy: entry.initial_strategy || { mode: 'balanced', target_priority: 'nearest', flee_threshold: config.defaultFleeThreshold },
      strategyCooldown: 0,
      strategyChanges: 0,
      consecutiveHits: 0,
      consecutiveFleeTicks: 0,
      nearDeathTriggered: false,
      buffs: []
    }
  })

  const initialState = {
    arena: {
      grid_width: arena.grid_width,
      grid_height: arena.grid_height,
      terrain: terrain
    },
    agents,
    tick: 0,
    maxTicks: game.max_ticks || config.defaultMaxTicks,
    events: [],
    eliminations: [],
    powerups: [],
    firstBlood: false
  }

  gameStateManager.initGame(gameId, initialState)

  const intervalId = setInterval(() => {
    try {
      processTick(gameId)
    } catch (err) {
      console.error(`[BattleEngine] Tick error for game ${gameId}:`, err)
      stopBattle(gameId)
    }
  }, config.tickIntervalMs)

  battleIntervals.set(gameId, intervalId)
  console.log(`[BattleEngine] Battle started: ${gameId} (${agents.length} agents, ${initialState.maxTicks} ticks, ${config.tickIntervalMs}ms/tick)`)

  return { gameId }
}

function stopBattle(gameId) {
  const intervalId = battleIntervals.get(gameId)
  if (intervalId) {
    clearInterval(intervalId)
    battleIntervals.delete(gameId)
  }
}

let onBattleEndCallback = null
function onBattleEnd(callback) {
  onBattleEndCallback = callback
}

// =========================================
// Core Tick Processing (Turn-Based)
// =========================================

function processTick(gameId) {
  const game = gameStateManager.getState(gameId)
  if (!game) {
    stopBattle(gameId)
    return
  }

  const tick = game.tick + 1
  const events = []
  const livingAgents = game.agents.filter(a => a.alive)

  // Calculate shrink phase
  const shrinkPhase = getShrinkPhase(tick, game.maxTicks)

  // === Passive effects (every passiveTickInterval ticks = 1 real second) ===
  const isPassiveTick = (tick % config.passiveTickInterval === 0)

  if (isPassiveTick) {
    // Power-up spawning
    if (tick % config.powerupSpawnInterval === 0 && game.powerups.length < config.powerupMaxActive) {
      spawnPowerup(game, tick, shrinkPhase, events)
    }

    // Remove power-ups in danger zone
    game.powerups = game.powerups.filter(p => {
      if (isInDangerZone(p.x, p.y, shrinkPhase, game.arena.grid_width, game.arena.grid_height)) {
        events.push({ type: 'powerup_destroyed', powerup: p.type, x: p.x, y: p.y })
        return false
      }
      return true
    })

    // Tick down buffs
    for (const agent of livingAgents) {
      agent.buffs = agent.buffs.filter(b => {
        b.remaining--
        return b.remaining > 0
      })
    }

    // Apply terrain effects
    applyTerrain(livingAgents, game.arena.terrain, events)

    // Apply shrink zone damage
    applyShrinkDamage(livingAgents, shrinkPhase, game.arena.grid_width, game.arena.grid_height, events, tick)

    // Update survival ticks
    for (const agent of game.agents.filter(a => a.alive)) {
      agent.survivedTicks++
    }
  }

  // === TURN-BASED: Find acting agent via initiative system ===
  const actor = getActingAgent(livingAgents)

  if (actor) {
    // Decrement cooldown at start of agent's turn
    if (actor.cooldown > 0) actor.cooldown--
    if (actor.strategyCooldown > 0) actor.strategyCooldown--

    // Decide action
    actor.action = decideAction(actor, game, shrinkPhase)

    // Resolve action (single agent — no collision possible)
    if (actor.action.type === 'move') {
      resolveSingleMove(actor, game.arena, events)
      collectPowerupsForAgent(actor, game, events)
    } else if (actor.action.type === 'attack') {
      resolveSingleAttack(actor, game, events)
    }

    events.push({ type: 'turn', slot: actor.slot, action: actor.action.type })
  }

  // Check eliminations
  for (const agent of livingAgents) {
    if (agent.hp <= 0) {
      agent.hp = 0
      agent.alive = false
      events.push({ type: 'elimination', slot: agent.slot, tick })
    }
  }

  // Fire-and-forget chat triggers from pre-generated pool
  triggerChatEvents(gameId, game, tick, events)

  // Record tick state
  const tickState = {
    tick,
    shrinkPhase,
    actorSlot: actor ? actor.slot : null,
    agents: game.agents.map(a => ({
      slot: a.slot,
      hp: a.hp,
      maxHp: a.maxHp,
      x: a.x,
      y: a.y,
      action: a.action ? a.action.type : null,
      target_slot: a.action && a.action.targetSlot != null ? a.action.targetSlot : undefined,
      direction: a.action && a.action.direction ? a.action.direction : undefined,
      cooldown: a.cooldown,
      alive: a.alive,
      score: a.score,
      buffs: a.buffs.map(b => b.type)
    })),
    powerups: game.powerups.map(p => ({ type: p.type, x: p.x, y: p.y })),
    events,
    eliminations: game.agents.filter(a => !a.alive && a.hp <= 0).map(a => a.slot)
  }

  game.tick = tick
  game.events = events
  gameStateManager.updateTick(gameId, tickState)

  // Push tick via WebSocket
  if (io) io.to(`game:${gameId}`).emit('tick', tickState)

  // Batch flush
  if (gameStateManager.shouldFlush(gameId)) {
    gameStateManager.flushTicks(gameId).catch(err => {
      console.error(`[BattleEngine] Flush error for game ${gameId}:`, err.message)
    })
  }

  // Check end conditions
  const aliveCount = game.agents.filter(a => a.alive).length
  if (aliveCount <= 1 || tick >= game.maxTicks) {
    finalizeBattle(gameId, tick, aliveCount <= 1 ? 'last_standing' : 'time_up')
  }
}

// =========================================
// Initiative System (Turn Order)
// =========================================

/**
 * Each tick, all agents accumulate initiative by their weapon speed.
 * Agent with highest initiative >= threshold takes their turn.
 * Returns the acting agent or null.
 */
function getActingAgent(agents) {
  const threshold = config.turnThreshold || 10

  // Increment initiative for all alive agents
  for (const agent of agents) {
    if (!agent.alive) continue
    agent.initiative += agent.weapon.speed
  }

  // Find agent with highest initiative >= threshold
  let best = null
  let bestInit = 0
  for (const agent of agents) {
    if (!agent.alive) continue
    if (agent.initiative >= threshold) {
      if (agent.initiative > bestInit || (agent.initiative === bestInit && Math.random() > 0.5)) {
        bestInit = agent.initiative
        best = agent
      }
    }
  }

  if (best) {
    best.initiative -= threshold
  }

  return best
}

// =========================================
// Shrink Zone (Ring of Death)
// =========================================

function getShrinkPhase(tick, maxTicks) {
  const pct = tick / maxTicks
  if (pct >= config.shrinkPhase2Pct) return 2
  if (pct >= config.shrinkPhase1Pct) return 1
  return 0
}

function isInDangerZone(x, y, phase, gridW, gridH) {
  if (phase === 0) return false
  return x < phase || x >= gridW - phase || y < phase || y >= gridH - phase
}

function applyShrinkDamage(agents, shrinkPhase, gridW, gridH, events, tick) {
  if (shrinkPhase === 0) return
  for (const agent of agents) {
    if (!agent.alive) continue
    if (isInDangerZone(agent.x, agent.y, shrinkPhase, gridW, gridH)) {
      const dmg = config.ringDamagePerTick
      agent.hp -= dmg
      agent.damageTaken += dmg
      events.push({ type: 'ring_damage', slot: agent.slot, damage: dmg, tick })
    }
  }
}

// =========================================
// Power-ups
// =========================================

const POWERUP_TYPES = ['heal_pack', 'damage_boost', 'speed_boost']

function spawnPowerup(game, tick, shrinkPhase, events) {
  const { grid_width: w, grid_height: h } = game.arena
  const occupied = new Set()
  for (const a of game.agents) {
    if (a.alive) occupied.add(`${a.x},${a.y}`)
  }
  for (const p of game.powerups) {
    occupied.add(`${p.x},${p.y}`)
  }

  const candidates = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isInDangerZone(x, y, shrinkPhase, w, h)) continue
      if (getTerrain(game.arena.terrain, x, y) === 1) continue
      if (occupied.has(`${x},${y}`)) continue
      candidates.push({ x, y })
    }
  }

  if (candidates.length === 0) return

  const pos = candidates[Math.floor(Math.random() * candidates.length)]
  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]

  game.powerups.push({ type, x: pos.x, y: pos.y, spawnTick: tick })
  events.push({ type: 'powerup_spawn', powerup: type, x: pos.x, y: pos.y })
}

function collectPowerupsForAgent(agent, game, events) {
  if (!agent.alive) return

  const idx = game.powerups.findIndex(p => p.x === agent.x && p.y === agent.y)
  if (idx === -1) return

  const powerup = game.powerups.splice(idx, 1)[0]
  applyPowerup(agent, powerup, events)
  agent.score += config.scorePowerupCollect
}

function applyPowerup(agent, powerup, events) {
  switch (powerup.type) {
    case 'heal_pack': {
      const heal = Math.min(config.healPackAmount, agent.maxHp - agent.hp)
      agent.hp += heal
      events.push({ type: 'powerup_collect', slot: agent.slot, powerup: 'heal_pack', value: heal })
      break
    }
    case 'damage_boost':
      agent.buffs.push({ type: 'damage_boost', value: config.damageBoostMultiplier, remaining: config.damageBoostDuration })
      events.push({ type: 'powerup_collect', slot: agent.slot, powerup: 'damage_boost', value: config.damageBoostDuration })
      break
    case 'speed_boost':
      agent.buffs.push({ type: 'speed_boost', value: 2, remaining: config.speedBoostDuration })
      events.push({ type: 'powerup_collect', slot: agent.slot, powerup: 'speed_boost', value: config.speedBoostDuration })
      break
  }
}

// =========================================
// Action Decision (Rule Engine v3.0 — Personality-Aware)
// =========================================

/**
 * Personality modifiers:
 *   aggressive — flee_threshold ×0 (never flee), always chase
 *   confident  — flee_threshold ×0.5, balanced flee at HP < 15%
 *   friendly   — no modifier (default), uses strategy as-is
 *   cautious   — flee_threshold ×1.5, balanced flee at HP < 50%
 *   troll      — 20% random action, flee_threshold fluctuates
 */
function getPersonalityModifiers(personality) {
  switch (personality) {
    case 'aggressive': return { fleeMultiplier: 0, balancedFleeHpPct: 0, randomChance: 0 }
    case 'confident':  return { fleeMultiplier: 0.5, balancedFleeHpPct: 0.15, randomChance: 0 }
    case 'cautious':   return { fleeMultiplier: 1.5, balancedFleeHpPct: 0.5, randomChance: 0 }
    case 'troll':      return { fleeMultiplier: Math.random() * 2, balancedFleeHpPct: 0.3, randomChance: 0.2 }
    case 'friendly':
    default:           return { fleeMultiplier: 1.0, balancedFleeHpPct: 0.3, randomChance: 0 }
  }
}

function decideAction(agent, game, shrinkPhase) {
  const strategy = agent.strategy
  const personality = getPersonalityModifiers(agent.personality)
  const enemies = game.agents
    .filter(a => a.alive && a.slot !== agent.slot)
    .sort((a, b) => manhattanDist(agent, a) - manhattanDist(agent, b))

  if (enemies.length === 0) return { type: 'stay' }

  // Troll: random action chance
  if (personality.randomChance > 0 && Math.random() < personality.randomChance) {
    const actions = ['attack', 'move', 'stay']
    const pick = actions[Math.floor(Math.random() * actions.length)]
    if (pick === 'attack' && enemies.length > 0) {
      const rTarget = enemies[Math.floor(Math.random() * enemies.length)]
      const d = manhattanDist(agent, rTarget)
      if (d <= agent.weapon.range && agent.cooldown === 0) {
        return { type: 'attack', targetSlot: rTarget.slot }
      }
    }
    if (pick === 'move') {
      const dirs = ['up', 'down', 'left', 'right']
      return { type: 'move', direction: dirs[Math.floor(Math.random() * dirs.length)] }
    }
    // fall through to normal logic if random action didn't work
  }

  // Priority 1: Escape danger zone
  if (isInDangerZone(agent.x, agent.y, shrinkPhase, game.arena.grid_width, game.arena.grid_height)) {
    return moveToSafeZone(agent, shrinkPhase, game.arena)
  }

  // Priority 2: Opportunistic powerup collection (ANY type, ANY HP level)
  if (game.powerups.length > 0) {
    const nearestPowerup = findNearestPowerup(agent, game, null)
    if (nearestPowerup) {
      const puDist = manhattanDist(agent, nearestPowerup)

      // Very close powerup (1-2 tiles) — always grab it
      if (puDist <= 2) {
        return moveToward(agent, nearestPowerup, game.arena)
      }

      // Heal pack when HP < 70% — go for it if within 4 tiles
      if (nearestPowerup.type === 'heal_pack' && agent.hp < agent.maxHp * 0.7 && puDist <= 4) {
        return moveToward(agent, nearestPowerup, game.arena)
      }

      // Any powerup closer than nearest enemy — divert to collect
      const nearestEnemy = enemies[0]
      if (nearestEnemy && puDist < manhattanDist(agent, nearestEnemy)) {
        return moveToward(agent, nearestPowerup, game.arena)
      }
    }
  }

  // Anti-deadlock: if fleeing too long (>50 consecutive ticks = 10s), force engagement
  const forceEngage = agent.consecutiveFleeTicks >= 50

  // Priority 3: Flee threshold (personality-adjusted)
  const baseFleeThreshold = strategy.flee_threshold != null ? strategy.flee_threshold : config.defaultFleeThreshold
  const fleeThreshold = Math.floor(baseFleeThreshold * personality.fleeMultiplier)

  if (!forceEngage && fleeThreshold > 0 && agent.hp <= fleeThreshold) {
    const nearest = enemies[0]

    // Try to flee, but if cornered → fight back
    const fleeAction = moveAwayFrom(agent, nearest, game.arena)
    if (fleeAction.type === 'stay') {
      const dist = manhattanDist(agent, nearest)
      if (dist <= agent.weapon.range && agent.cooldown === 0) {
        agent.consecutiveFleeTicks = 0
        return { type: 'attack', targetSlot: nearest.slot }
      }
    }
    agent.consecutiveFleeTicks++
    return fleeAction
  }

  // Select target
  const target = selectTarget(enemies, strategy.target_priority)
  if (!target) return { type: 'stay' }

  // Attack if in range and not on cooldown
  const dist = manhattanDist(agent, target)
  if (dist <= agent.weapon.range && agent.cooldown === 0) {
    agent.consecutiveFleeTicks = 0
    return { type: 'attack', targetSlot: target.slot }
  }

  // Movement based on mode (personality affects balanced flee threshold)
  const effectiveMode = agent.personality === 'aggressive' ? 'aggressive' : strategy.mode

  switch (effectiveMode) {
    case 'aggressive':
      agent.consecutiveFleeTicks = 0
      return moveToward(agent, target, game.arena)
    case 'defensive':
      return { type: 'stay' }
    case 'balanced':
    default:
      if (forceEngage || agent.hp > agent.maxHp * personality.balancedFleeHpPct) {
        agent.consecutiveFleeTicks = 0
        return moveToward(agent, target, game.arena)
      } else {
        const fleeAction = moveAwayFrom(agent, enemies[0], game.arena)
        if (fleeAction.type === 'stay') {
          const d = manhattanDist(agent, enemies[0])
          if (d <= agent.weapon.range && agent.cooldown === 0) {
            agent.consecutiveFleeTicks = 0
            return { type: 'attack', targetSlot: enemies[0].slot }
          }
        }
        agent.consecutiveFleeTicks++
        return fleeAction
      }
  }
}

function findNearestPowerup(agent, game, type) {
  let best = null
  let bestDist = Infinity
  for (const p of game.powerups) {
    if (type && p.type !== type) continue
    const d = manhattanDist(agent, p)
    if (d < bestDist) {
      bestDist = d
      best = p
    }
  }
  return best
}

function selectTarget(enemies, priority) {
  if (enemies.length === 0) return null

  switch (priority) {
    case 'lowest_hp':
      return enemies.reduce((a, b) => a.hp <= b.hp ? a : b)
    case 'highest_hp':
      return enemies.reduce((a, b) => a.hp >= b.hp ? a : b)
    case 'weakest_weapon':
      return enemies.reduce((a, b) => a.weapon.damage <= b.weapon.damage ? a : b)
    case 'random':
      return enemies[Math.floor(Math.random() * enemies.length)]
    case 'nearest':
    default:
      return enemies[0]
  }
}

// =========================================
// Single-Agent Movement (No Collisions)
// =========================================

function resolveSingleMove(agent, arena, events) {
  const dir = agent.action.direction
  if (!dir) return

  const hasSpeedBoost = agent.buffs.some(b => b.type === 'speed_boost')
  const steps = hasSpeedBoost ? 2 : 1
  let nx = agent.x
  let ny = agent.y

  for (let s = 0; s < steps; s++) {
    const cx = nx + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0)
    const cy = ny + (dir === 'down' ? 1 : dir === 'up' ? -1 : 0)

    if (cx < 0 || cx >= arena.grid_width || cy < 0 || cy >= arena.grid_height) break
    const t = getTerrain(arena.terrain, cx, cy)
    if (t === 1 || t === 2) break  // wall and bush block movement

    nx = cx
    ny = cy
  }

  if (nx !== agent.x || ny !== agent.y) {
    events.push({
      type: 'move',
      slot: agent.slot,
      from: [agent.x, agent.y],
      to: [nx, ny]
    })
    agent.x = nx
    agent.y = ny
  }
}

// =========================================
// Single-Agent Attack (No Simultaneous)
// =========================================

function resolveSingleAttack(agent, game, events) {
  const target = game.agents.find(a => a.slot === agent.action.targetSlot && a.alive)
  if (!target) return

  const dist = manhattanDist(agent, target)
  if (dist > agent.weapon.range) {
    events.push({ type: 'attack_miss', slot: agent.slot, reason: 'out_of_range' })
    return
  }

  // Ranged: require straight line (same row or column) and clear LOS
  if (agent.weapon.range > 1) {
    if (agent.x !== target.x && agent.y !== target.y) {
      events.push({ type: 'attack_miss', slot: agent.slot, reason: 'not_in_line' })
      return
    }
    if (!hasLineOfSight(agent, target, game.arena.terrain)) {
      events.push({ type: 'attack_miss', slot: agent.slot, reason: 'blocked' })
      agent.cooldown = agent.weapon.cooldown
      return
    }
  }

  // Roll damage
  let damage = rollDamage(agent.weapon)

  // Damage boost buff
  const dmgBuff = agent.buffs.find(b => b.type === 'damage_boost')
  if (dmgBuff) {
    damage = Math.floor(damage * dmgBuff.value)
  }

  let isSkill = false

  // Weapon skill
  const skillResult = applyWeaponSkill(agent, target, damage, game)
  if (skillResult) {
    damage = skillResult.damage
    isSkill = skillResult.isSkill
  }

  // Stay defense reduction
  if (target.action && target.action.type === 'stay') {
    damage = Math.floor(damage * (1 - config.stayDamageReduction))
  }

  // Apply damage
  target.hp -= damage
  target.damageTaken += damage
  agent.damageDealt += damage
  agent.score += damage * config.scorePerDamage

  if (isSkill) {
    agent.score += config.scoreSkillHit
  }

  events.push({
    type: 'damage',
    from_slot: agent.slot,
    to_slot: target.slot,
    damage,
    is_skill: isSkill
  })

  // AOE damage
  if (agent.weapon.aoeRadius > 0) {
    for (const other of game.agents) {
      if (!other.alive || other.slot === agent.slot || other.slot === target.slot) continue
      if (manhattanDist(target, other) <= agent.weapon.aoeRadius) {
        const aoeDmg = Math.floor(damage * 0.5)
        other.hp -= aoeDmg
        other.damageTaken += aoeDmg
        agent.damageDealt += aoeDmg
        agent.score += aoeDmg * config.scorePerDamage
        events.push({
          type: 'damage',
          from_slot: agent.slot,
          to_slot: other.slot,
          damage: aoeDmg,
          is_skill: false
        })
      }
    }
  }

  // Set cooldown
  agent.cooldown = agent.weapon.cooldown
  agent.consecutiveHits = (agent.consecutiveHits || 0) + 1

  // Check kill
  if (target.hp <= 0 && target.alive) {
    agent.kills++
    agent.score += config.scorePerKill

    if (!game.firstBlood) {
      game.firstBlood = true
      agent.score += config.scoreFirstBlood
      events.push({ type: 'first_blood', killer_slot: agent.slot, victim_slot: target.slot })
    }

    events.push({ type: 'kill', killer_slot: agent.slot, victim_slot: target.slot })
  }

  // Lifesteal
  if (agent.weapon.skill && agent.weapon.skill.effect === 'lifesteal') {
    const heal = Math.floor(damage * agent.weapon.skill.value)
    agent.hp = Math.min(agent.maxHp, agent.hp + heal)
    events.push({ type: 'lifesteal', slot: agent.slot, amount: heal })
  }
}

function rollDamage(weapon) {
  const min = weapon.damageMin || weapon.damage
  const max = weapon.damageMax || weapon.damage
  if (min === max) return min
  return min + Math.floor(Math.random() * (max - min + 1))
}

// =========================================
// Weapon Skills
// =========================================

function applyWeaponSkill(attacker, target, baseDamage, game) {
  const skill = attacker.weapon.skill
  if (!skill) return null

  switch (skill.trigger) {
    case 'hp_below':
      if (attacker.hp <= (skill.threshold || 30)) {
        return { damage: Math.floor(baseDamage * (skill.value || 2)), isSkill: true }
      }
      break
    case 'on_hit':
      return { damage: baseDamage, isSkill: false }
    case 'consecutive_hits':
      if ((attacker.consecutiveHits || 0) >= (skill.threshold || 3)) {
        attacker.consecutiveHits = 0
        return { damage: Math.floor(baseDamage * (skill.value || 2)), isSkill: true }
      }
      break
  }

  return null
}

// =========================================
// Terrain Effects
// =========================================

function applyTerrain(agents, terrain, events) {
  for (const agent of agents) {
    if (!agent.alive) continue

    const tile = getTerrain(terrain, agent.x, agent.y)

    if (tile === 3) {
      agent.hp -= 5
      agent.damageTaken += 5
      events.push({ type: 'terrain_damage', slot: agent.slot, terrain: 'lava', damage: 5 })
    }

    if (tile === 4) {
      const heal = Math.min(3, agent.maxHp - agent.hp)
      if (heal > 0) {
        agent.hp += heal
        events.push({ type: 'terrain_heal', slot: agent.slot, terrain: 'heal_zone', heal })
      }
    }
  }
}

// =========================================
// Battle Finalization
// =========================================

async function finalizeBattle(gameId, finalTick, reason) {
  stopBattle(gameId)

  const game = gameStateManager.getState(gameId)
  if (!game) return

  const survivors = game.agents.filter(a => a.alive)
  if (survivors.length === 1) {
    survivors[0].score += config.scoreLastStanding
  }

  const ranked = [...game.agents].sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1
    if (a.alive) return b.score - a.score
    if (a.survivedTicks !== b.survivedTicks) return b.survivedTicks - a.survivedTicks
    return b.score - a.score
  })

  const results = ranked.map((agent, i) => ({
    slot: agent.slot,
    agent_id: agent.agentId,
    rank: i + 1,
    score: agent.score,
    kills: agent.kills,
    damage_dealt: agent.damageDealt,
    damage_taken: agent.damageTaken,
    survived_ticks: agent.survivedTicks,
    alive: agent.alive
  }))

  // Victory chat for winner
  if (ranked[0] && ranked[0].alive) {
    fireChat(gameId, ranked[0].agentId, 'victory', finalTick, ranked[0].slot)
  }

  // Clean up chat pool cache
  chatPoolService.clearGameCache(gameId)

  await gameStateManager.endGame(gameId)

  // Push battle_ended via WebSocket
  if (io) io.to(`game:${gameId}`).emit('battle_ended', { reason, rankings: results })

  const durationSec = Math.round(finalTick * config.tickIntervalMs / 1000)
  console.log(`[BattleEngine] Battle ended: ${gameId} (${reason}, tick ${finalTick}, ${durationSec}s, winner: slot ${results[0]?.slot})`)

  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    for (const r of results) {
      const status = r.alive ? 'survived' : 'eliminated'
      await client.query(
        `UPDATE game_entries SET
           final_rank = $1, total_score = $2, kills = $3,
           damage_dealt = $4, damage_taken = $5, survived_ticks = $6,
           status = $7
         WHERE game_id = $8 AND slot = $9`,
        [r.rank, r.score, r.kills, r.damage_dealt, r.damage_taken, r.survived_ticks, status, gameId, r.slot]
      )

      await client.query(
        `UPDATE agents SET
           battles_count = battles_count + 1,
           total_score = COALESCE(total_score, 0) + $1,
           wins = wins + $2,
           podiums = podiums + $3,
           updated_at = now()
         WHERE id = $4`,
        [r.score, r.rank === 1 ? 1 : 0, r.rank <= 3 ? 1 : 0, r.agent_id]
      )
    }

    await client.query(
      `UPDATE games SET state = 'ended', battle_end = now(), results = $1, updated_at = now()
       WHERE id = $2`,
      [JSON.stringify(results), gameId]
    )

    const winner = results[0]
    await client.query(
      `INSERT INTO game_chat (game_id, tick, msg_type, message)
       VALUES ($1, $2, 'system', $3)`,
      [gameId, finalTick, `Battle ended! Winner: Slot ${winner?.slot ?? '?'} with ${winner?.score ?? 0} points! (${durationSec}s)`]
    )

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(`[BattleEngine] finalizeBattle DB error (${gameId}):`, err)
  } finally {
    client.release()
  }

  if (onBattleEndCallback) {
    try {
      await onBattleEndCallback(gameId, results, reason)
    } catch (err) {
      console.error(`[BattleEngine] onBattleEnd callback error:`, err)
    }
  }
}

// =========================================
// Chat Pool Integration (Fire-and-Forget)
// =========================================

function fireChat(gameId, agentId, category, tick, slot) {
  chatPoolService.triggerChat(gameId, agentId, category, tick, slot).catch(() => {})
}

function triggerChatEvents(gameId, game, tick, events) {
  // Battle start (tick 1 only)
  if (tick === 1) {
    for (const agent of game.agents) {
      if (agent.alive) fireChat(gameId, agent.agentId, 'battle_start', tick, agent.slot)
    }
  }

  // Event-driven triggers
  for (const evt of events) {
    if (evt.type === 'damage') {
      const target = game.agents.find(a => a.slot === evt.to_slot)
      if (target) {
        const hpPct = target.maxHp > 0 ? target.hp / target.maxHp : 0
        const cat = hpPct > 0.7 ? 'damage_high' : hpPct > 0.3 ? 'damage_mid' : 'damage_low'
        fireChat(gameId, target.agentId, cat, tick, target.slot)
      }
    }
    if (evt.type === 'kill') {
      const killer = game.agents.find(a => a.slot === evt.killer_slot)
      const victim = game.agents.find(a => a.slot === evt.victim_slot)
      if (killer) fireChat(gameId, killer.agentId, 'kill', tick, killer.slot)
      if (victim) fireChat(gameId, victim.agentId, 'death', tick, victim.slot)
    }
    if (evt.type === 'first_blood') {
      const killer = game.agents.find(a => a.slot === evt.killer_slot)
      if (killer) fireChat(gameId, killer.agentId, 'first_blood', tick, killer.slot)
    }
  }

  // Near-death (once per agent per game, HP < 15 but still alive)
  for (const agent of game.agents) {
    if (agent.alive && agent.hp > 0 && agent.hp < 15 && !agent.nearDeathTriggered) {
      agent.nearDeathTriggered = true
      fireChat(gameId, agent.agentId, 'near_death', tick, agent.slot)
    }
  }
}

// =========================================
// Utility Functions
// =========================================

function manhattanDist(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

/**
 * Line-of-sight check for ranged attacks.
 * Requires attacker and target on same row or column.
 * Returns false if any wall(1) or bush(2) is between them.
 */
function hasLineOfSight(attacker, target, terrain) {
  if (attacker.x === target.x) {
    // Same column — check vertical
    const minY = Math.min(attacker.y, target.y) + 1
    const maxY = Math.max(attacker.y, target.y)
    for (let y = minY; y < maxY; y++) {
      const t = getTerrain(terrain, attacker.x, y)
      if (t === 1 || t === 2) return false
    }
  } else if (attacker.y === target.y) {
    // Same row — check horizontal
    const minX = Math.min(attacker.x, target.x) + 1
    const maxX = Math.max(attacker.x, target.x)
    for (let x = minX; x < maxX; x++) {
      const t = getTerrain(terrain, x, attacker.y)
      if (t === 1 || t === 2) return false
    }
  }
  return true
}

function moveToward(agent, target, arena) {
  const dx = target.x - agent.x
  const dy = target.y - agent.y

  const directions = []
  if (dx > 0) directions.push({ dir: 'right', dist: Math.abs(dx) })
  if (dx < 0) directions.push({ dir: 'left', dist: Math.abs(dx) })
  if (dy > 0) directions.push({ dir: 'down', dist: Math.abs(dy) })
  if (dy < 0) directions.push({ dir: 'up', dist: Math.abs(dy) })

  directions.sort((a, b) => b.dist - a.dist)

  for (const d of directions) {
    const nx = agent.x + (d.dir === 'right' ? 1 : d.dir === 'left' ? -1 : 0)
    const ny = agent.y + (d.dir === 'down' ? 1 : d.dir === 'up' ? -1 : 0)

    if (nx >= 0 && nx < arena.grid_width && ny >= 0 && ny < arena.grid_height) {
      const t = getTerrain(arena.terrain, nx, ny)
      if (t !== 1 && t !== 2) {
        return { type: 'move', direction: d.dir }
      }
    }
  }

  return { type: 'stay' }
}

function moveAwayFrom(agent, threat, arena) {
  const dx = agent.x - threat.x
  const dy = agent.y - threat.y

  const directions = []
  if (dx >= 0) directions.push({ dir: 'right', dist: dx })
  if (dx <= 0) directions.push({ dir: 'left', dist: -dx })
  if (dy >= 0) directions.push({ dir: 'down', dist: dy })
  if (dy <= 0) directions.push({ dir: 'up', dist: -dy })

  directions.sort((a, b) => b.dist - a.dist)

  for (const d of directions) {
    const nx = agent.x + (d.dir === 'right' ? 1 : d.dir === 'left' ? -1 : 0)
    const ny = agent.y + (d.dir === 'down' ? 1 : d.dir === 'up' ? -1 : 0)

    if (nx >= 0 && nx < arena.grid_width && ny >= 0 && ny < arena.grid_height) {
      const t = getTerrain(arena.terrain, nx, ny)
      if (t !== 1 && t !== 2) {
        return { type: 'move', direction: d.dir }
      }
    }
  }

  return { type: 'stay' }
}

function moveToSafeZone(agent, shrinkPhase, arena) {
  const centerX = Math.floor(arena.grid_width / 2)
  const centerY = Math.floor(arena.grid_height / 2)
  return moveToward(agent, { x: centerX, y: centerY }, arena)
}

function parseTerrain(arena) {
  const raw = typeof arena.terrain === 'string' ? JSON.parse(arena.terrain) : arena.terrain
  if (!Array.isArray(raw) || raw.length === 0) {
    const grid = []
    for (let y = 0; y < arena.grid_height; y++) {
      grid.push(new Array(arena.grid_width).fill(0))
    }
    return grid
  }
  return raw
}

function getTerrain(terrain, x, y) {
  if (!terrain || !terrain[y]) return 0
  return terrain[y][x] || 0
}

// =========================================
// Monitoring
// =========================================

function activeBattleCount() {
  return battleIntervals.size
}

// =========================================
// Strategy Update (mid-battle)
// =========================================

function updateStrategy(gameId, agentId, newStrategy) {
  const state = gameStateManager.getState(gameId)
  if (!state) return { error: 'GAME_NOT_ACTIVE' }

  const agent = state.agents.find(a => a.agentId === agentId && a.alive)
  if (!agent) return { error: 'AGENT_NOT_IN_GAME' }

  if (agent.strategyCooldown > 0) {
    return { error: 'STRATEGY_COOLDOWN', remaining: agent.strategyCooldown }
  }

  if (agent.strategyChanges >= config.maxStrategyChanges) {
    return { error: 'MAX_STRATEGY_CHANGES' }
  }

  const valid = ['aggressive', 'defensive', 'balanced']
  const validTargets = ['nearest', 'lowest_hp', 'highest_hp', 'weakest_weapon', 'random']

  if (newStrategy.mode && !valid.includes(newStrategy.mode)) {
    return { error: 'INVALID_MODE' }
  }
  if (newStrategy.target_priority && !validTargets.includes(newStrategy.target_priority)) {
    return { error: 'INVALID_TARGET_PRIORITY' }
  }

  agent.strategy = {
    mode: newStrategy.mode || agent.strategy.mode,
    target_priority: newStrategy.target_priority || agent.strategy.target_priority,
    flee_threshold: newStrategy.flee_threshold != null ? newStrategy.flee_threshold : agent.strategy.flee_threshold
  }
  agent.strategyCooldown = config.strategyCooldownTicks
  agent.strategyChanges++

  return {
    ok: true,
    strategy: agent.strategy,
    changes_left: config.maxStrategyChanges - agent.strategyChanges
  }
}

// =========================================
// Agent Game View (for polling)
// =========================================

function getAgentView(gameId, agentId) {
  const state = gameStateManager.getState(gameId)
  if (!state) return null

  const me = state.agents.find(a => a.agentId === agentId)
  if (!me) return null

  return {
    game_id: gameId,
    tick: state.tick || 0,
    max_ticks: state.maxTicks,
    shrink_phase: getShrinkPhase(state.tick || 0, state.maxTicks),
    arena: {
      width: state.arena.grid_width,
      height: state.arena.grid_height,
      terrain: state.arena.terrain
    },
    me: {
      slot: me.slot,
      hp: me.hp,
      max_hp: me.maxHp,
      x: me.x,
      y: me.y,
      personality: me.personality,
      weapon: me.weapon.slug,
      weapon_speed: me.weapon.speed,
      cooldown: me.cooldown,
      score: me.score,
      alive: me.alive,
      buffs: me.buffs.map(b => ({ type: b.type, remaining: b.remaining })),
      current_strategy: me.strategy,
      strategy_cooldown_remaining: me.strategyCooldown,
      strategy_changes_left: config.maxStrategyChanges - me.strategyChanges
    },
    opponents: state.agents
      .filter(a => a.slot !== me.slot)
      .map(a => ({
        slot: a.slot,
        hp: a.hp,
        x: a.x,
        y: a.y,
        personality: a.personality,
        weapon: a.weapon.slug,
        weapon_speed: a.weapon.speed,
        cooldown: a.cooldown,
        alive: a.alive
      })),
    powerups: state.powerups.map(p => ({ type: p.type, x: p.x, y: p.y })),
    last_events: state.events || []
  }
}

module.exports = {
  setIO,
  startBattle,
  stopBattle,
  onBattleEnd,
  updateStrategy,
  getAgentView,
  activeBattleCount
}
