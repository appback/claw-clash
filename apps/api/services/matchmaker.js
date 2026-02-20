const db = require('../db')
const config = require('../config')

/**
 * Matchmaker Service — Weighted random matchmaking with anti-abuse.
 *
 * Runs on a cron (every 30s). Pulls from battle_queue,
 * applies weighting rules, creates games with source='queue'.
 */

/**
 * Main entry point: process the matchmaking queue.
 */
async function processQueue() {
  // Get eligible agents (not in cooldown)
  const queue = await db.query(
    `SELECT bq.id, bq.agent_id, bq.weapon_slug, bq.queued_at,
            a.name AS agent_name, a.meta
     FROM battle_queue bq
     JOIN agents a ON a.id = bq.agent_id
     WHERE (bq.cooldown_until IS NULL OR bq.cooldown_until < now())
     ORDER BY bq.queued_at ASC`
  )

  const eligible = queue.rows
  if (eligible.length < config.queueSmallGameMinPlayers) return

  // Check if we have enough for a standard game
  const canRunStandard = eligible.length >= config.queueMinPlayers

  // Check if long-waiters qualify for a small game
  if (!canRunStandard) {
    const oldestQueuedAt = new Date(eligible[0].queued_at)
    const waitMinutes = (Date.now() - oldestQueuedAt.getTime()) / 60000
    if (waitMinutes < config.queueSmallGameWaitMin) return
    // Proceed with small game
  }

  // Select agents via weighted random
  const maxPlayers = Math.min(eligible.length, config.queueMaxPlayers)
  const selected = await weightedSelect(eligible, maxPlayers)
  if (selected.length < config.queueSmallGameMinPlayers) return

  // Create game
  await createQueueGame(selected)
}

/**
 * Weighted random selection with anti-abuse rules.
 */
async function weightedSelect(eligible, maxPlayers) {
  // Get agent owners (for same-owner detection)
  const agentIds = eligible.map(e => e.agent_id)
  const ownerResult = await db.query(
    `SELECT a.id, a.meta FROM agents a WHERE a.id = ANY($1)`,
    [agentIds]
  )
  const ownerMap = {}
  for (const row of ownerResult.rows) {
    const meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : (row.meta || {})
    ownerMap[row.id] = meta.owner || meta.registered_by || row.id
  }

  // Get recent matchmaking history (last N games per agent)
  const historyResult = await db.query(
    `SELECT agent_id, game_id FROM (
       SELECT agent_id, game_id,
              ROW_NUMBER() OVER (PARTITION BY agent_id ORDER BY matched_at DESC) AS rn
       FROM matchmaking_history
       WHERE agent_id = ANY($1)
     ) sub WHERE rn <= $2`,
    [agentIds, config.queueRecentGameCount]
  )

  // Build per-agent recent opponents map
  const recentGames = {}
  for (const h of historyResult.rows) {
    if (!recentGames[h.agent_id]) recentGames[h.agent_id] = new Set()
    recentGames[h.agent_id].add(h.game_id)
  }

  // Calculate weights
  const weighted = eligible.map(e => {
    let weight = 1.0

    // Long wait bonus
    const waitMin = (Date.now() - new Date(e.queued_at).getTime()) / 60000
    if (waitMin >= config.queueLongWaitMinutes) {
      weight *= config.queueLongWaitWeight
    }

    return { ...e, weight, owner: ownerMap[e.agent_id] }
  })

  // Select players one by one with dynamic weight adjustment
  const selected = []
  const selectedOwners = {}
  const remaining = [...weighted]

  while (selected.length < maxPlayers && remaining.length > 0) {
    // Adjust weights for anti-abuse
    for (const candidate of remaining) {
      let w = candidate.weight

      // Same owner penalty
      const ownerCount = selectedOwners[candidate.owner] || 0
      if (ownerCount > 0) {
        w *= Math.pow(config.queueSameOwnerWeight, ownerCount)
      }

      // Recent opponent penalty
      if (recentGames[candidate.agent_id]) {
        const recentWithSelected = selected.filter(s =>
          recentGames[candidate.agent_id].has(s.agent_id) ||
          (recentGames[s.agent_id] && recentGames[s.agent_id].has(candidate.agent_id))
        )
        if (recentWithSelected.length > 0) {
          w *= config.queueRecentOpponentWeight
        }
      }

      candidate._effectiveWeight = Math.max(w, 0.01)
    }

    // Weighted random pick
    const totalWeight = remaining.reduce((sum, c) => sum + c._effectiveWeight, 0)
    let roll = Math.random() * totalWeight
    let picked = remaining[0]

    for (const c of remaining) {
      roll -= c._effectiveWeight
      if (roll <= 0) {
        picked = c
        break
      }
    }

    selected.push(picked)
    selectedOwners[picked.owner] = (selectedOwners[picked.owner] || 0) + 1

    // Remove picked from remaining
    const idx = remaining.indexOf(picked)
    remaining.splice(idx, 1)
  }

  return selected
}

/**
 * Create a game from queue-matched agents.
 */
async function createQueueGame(agents) {
  const client = await db.getClient()

  try {
    await client.query('BEGIN')

    // Get default arena
    const arena = await client.query(
      "SELECT * FROM arenas WHERE is_active = true ORDER BY slug = 'the_pit' DESC LIMIT 1"
    )
    if (arena.rows.length === 0) {
      throw new Error('No active arena available')
    }
    const arenaRow = arena.rows[0]

    const now = Date.now()
    const lobbyStart = new Date(now).toISOString()
    const bettingStart = new Date(now + config.lobbyDurationMin * 60000).toISOString()
    const battleStart = new Date(now + config.lobbyDurationMin * 60000 + config.bettingDurationSec * 1000).toISOString()

    const title = `Arena Battle #${Date.now().toString(36).toUpperCase()}`

    // Create game
    const gameResult = await client.query(
      `INSERT INTO games (title, arena_id, state, max_entries, entry_fee, max_ticks,
                          lobby_start, betting_start, battle_start, source)
       VALUES ($1, $2, 'lobby', $3, 0, $4, $5, $6, $7, 'queue')
       RETURNING id`,
      [title, arenaRow.id, arenaRow.max_players, config.defaultMaxTicks,
       lobbyStart, bettingStart, battleStart]
    )
    const gameId = gameResult.rows[0].id

    // Pre-assign agents (shuffled slots)
    const slots = Array.from({ length: agents.length }, (_, i) => i)
    shuffleArray(slots)

    // Fetch all active weapons for random assignment
    const allWeapons = await client.query(
      'SELECT id, slug FROM weapons WHERE is_active = true'
    )

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i]
      const slot = slots[i]

      // Get weapon: use requested slug, or assign random
      let weaponId
      if (agent.weapon_slug) {
        const weapon = await client.query(
          'SELECT id FROM weapons WHERE slug = $1 AND is_active = true',
          [agent.weapon_slug]
        )
        weaponId = weapon.rows.length > 0 ? weapon.rows[0].id : null
      }
      if (!weaponId && allWeapons.rows.length > 0) {
        const randomWeapon = allWeapons.rows[Math.floor(Math.random() * allWeapons.rows.length)]
        weaponId = randomWeapon.id
      }
      if (!weaponId) {
        weaponId = (await client.query("SELECT id FROM weapons WHERE slug = 'sword'")).rows[0].id
      }

      const defaultStrategy = { mode: 'balanced', target_priority: 'nearest', flee_threshold: config.defaultFleeThreshold }

      await client.query(
        `INSERT INTO game_entries (game_id, agent_id, slot, weapon_id, initial_strategy)
         VALUES ($1, $2, $3, $4, $5)`,
        [gameId, agent.agent_id, slot, weaponId, JSON.stringify(defaultStrategy)]
      )

      // Record matchmaking history
      await client.query(
        'INSERT INTO matchmaking_history (game_id, agent_id) VALUES ($1, $2)',
        [gameId, agent.agent_id]
      )

      // Remove from queue
      await client.query('DELETE FROM battle_queue WHERE agent_id = $1', [agent.agent_id])
    }

    // System chat: game created from queue
    await client.query(
      `INSERT INTO game_chat (game_id, msg_type, message)
       VALUES ($1, 'system', $2)`,
      [gameId, `Matchmaking complete! ${agents.length} warriors enter the arena.`]
    )

    await client.query('COMMIT')

    console.log(`[Matchmaker] Created queue game '${title}' (${gameId}) with ${agents.length} agents`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[Matchmaker] Failed to create queue game:', err)
  } finally {
    client.release()
  }
}

/**
 * Fisher-Yates shuffle.
 */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

module.exports = { processQueue }
