const db = require('../../db')
const { parsePagination, formatPaginatedResponse } = require('../../utils/pagination')
const { ValidationError, NotFoundError, ConflictError, BadRequestError } = require('../../utils/errors')
const config = require('../../config')
const gameStateManager = require('../../services/gameStateManager')
const battleEngine = require('../../services/battleEngine')

// ==========================================
// Public Endpoints
// ==========================================

/**
 * GET /api/v1/games - List games (public, filterable by state)
 */
async function list(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { state } = req.query

    let where = ''
    const params = []
    if (state) {
      where = 'WHERE g.state = $1'
      params.push(state)
    }

    const countResult = await db.query(
      `SELECT COUNT(*) AS total FROM games g ${where}`, params
    )
    const total = parseInt(countResult.rows[0].total, 10)

    const result = await db.query(
      `SELECT g.id, g.title, g.state, g.entry_fee, g.max_entries,
              g.prize_pool, g.max_ticks,
              g.lobby_start, g.betting_start, g.battle_start, g.battle_end,
              g.created_at,
              a.slug AS arena_slug, a.name AS arena_name,
              (SELECT COUNT(*) FROM game_entries ge WHERE ge.game_id = g.id) AS entry_count
       FROM games g
       JOIN arenas a ON a.id = g.arena_id
       ${where}
       ORDER BY g.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    )

    const resp = formatPaginatedResponse(result.rows, total, page, limit)
    resp.server_time = new Date().toISOString()
    res.json(resp)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/games/:id - Game detail (public)
 * In ended state, reveals agent identities.
 */
async function get(req, res, next) {
  try {
    const { id } = req.params

    const gameResult = await db.query(
      `SELECT g.*, a.slug AS arena_slug, a.name AS arena_name,
              a.grid_width, a.grid_height,
              (SELECT COUNT(*) FROM game_entries ge WHERE ge.game_id = g.id) AS entry_count
       FROM games g
       JOIN arenas a ON a.id = g.arena_id
       WHERE g.id = $1`,
      [id]
    )
    if (gameResult.rows.length === 0) {
      throw new NotFoundError('Game not found')
    }

    const game = gameResult.rows[0]
    const revealIdentity = ['ended', 'archived'].includes(game.state)

    // Get entries with weapon + armor info
    const entries = await db.query(
      `SELECT ge.slot, ge.status, ge.final_rank, ge.total_score,
              ge.kills, ge.damage_dealt, ge.damage_taken, ge.survived_ticks,
              ge.bonus_hp, ge.bonus_damage,
              w.slug AS weapon_slug, w.name AS weapon_name, w.damage AS weapon_damage,
              w.range AS weapon_range,
              ar.slug AS armor_slug, ar.name AS armor_name,
              ar.dmg_reduction AS armor_dmg_reduction, ar.evasion AS armor_evasion,
              ar.emoji AS armor_emoji,
              ${revealIdentity ? "ge.agent_id, ag.name AS agent_name, ag.meta," : ""}
              ge.created_at
       FROM game_entries ge
       JOIN weapons w ON w.id = ge.weapon_id
       LEFT JOIN armors ar ON ar.id = ge.armor_id
       ${revealIdentity ? "JOIN agents ag ON ag.id = ge.agent_id" : ""}
       WHERE ge.game_id = $1
       ORDER BY ge.final_rank NULLS LAST, ge.slot`,
      [id]
    )

    // Get sponsorship totals per slot
    const sponsorships = await db.query(
      `SELECT slot,
              SUM(CASE WHEN boost_type = 'weapon_boost' THEN effect_value ELSE 0 END) AS weapon_boost,
              SUM(CASE WHEN boost_type = 'hp_boost' THEN effect_value ELSE 0 END) AS hp_boost,
              COUNT(DISTINCT user_id) AS sponsor_count
       FROM sponsorships WHERE game_id = $1
       GROUP BY slot`,
      [id]
    )

    const sponsorMap = {}
    for (const s of sponsorships.rows) {
      sponsorMap[s.slot] = {
        weapon_boost: parseInt(s.weapon_boost) || 0,
        hp_boost: parseInt(s.hp_boost) || 0,
        sponsor_count: parseInt(s.sponsor_count) || 0
      }
    }

    res.json({
      ...game,
      server_time: new Date().toISOString(),
      entries: entries.rows.map(e => ({
        ...e,
        sponsorship: sponsorMap[e.slot] || { weapon_boost: 0, hp_boost: 0, sponsor_count: 0 }
      }))
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/games/:id/state - Live game state (agent view or spectator view)
 */
async function getState(req, res, next) {
  try {
    const { id } = req.params

    // If agent auth, return agent-specific view
    if (req.agent) {
      const view = battleEngine.getAgentView(id, req.agent.id)
      if (!view) {
        const game = await db.query('SELECT state FROM games WHERE id = $1', [id])
        if (!game.rows.length) throw new NotFoundError('Game not found')
        throw new BadRequestError(`Game not currently in battle (state: ${game.rows[0].state})`)
      }
      return res.json(view)
    }

    // Spectator view (public subset of state)
    const state = gameStateManager.getState(id)
    if (!state) {
      const game = await db.query('SELECT state FROM games WHERE id = $1', [id])
      if (!game.rows.length) throw new NotFoundError('Game not found')
      throw new BadRequestError(`Game not currently in battle (state: ${game.rows[0].state})`)
    }
    const tick = state.tick || 0
    const maxTicks = state.maxTicks
    const pct = tick / maxTicks
    const shrinkPhase = pct >= 0.8 ? 2 : pct >= 0.6 ? 1 : 0

    res.json({
      game_id: id,
      tick,
      max_ticks: maxTicks,
      shrink_phase: shrinkPhase,
      arena: {
        width: state.arena.grid_width,
        height: state.arena.grid_height,
        terrain: state.arena.terrain
      },
      agents: state.agents.map(a => ({
        slot: a.slot, hp: a.hp, maxHp: a.maxHp, x: a.x, y: a.y,
        weapon: a.weapon.slug, alive: a.alive, score: a.score,
        armor: a.armor ? a.armor.slug : 'no_armor',
        buffs: (a.buffs || []).map(b => b.type)
      })),
      powerups: (state.powerups || []).map(p => ({ type: p.type, x: p.x, y: p.y })),
      events: state.events || []
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/games/:id/replay - Full tick replay data
 */
async function replay(req, res, next) {
  try {
    const { id } = req.params

    const gameResult = await db.query('SELECT * FROM games WHERE id = $1', [id])
    if (gameResult.rows.length === 0) throw new NotFoundError('Game not found')

    const game = gameResult.rows[0]
    if (!['ended', 'archived'].includes(game.state)) {
      throw new BadRequestError('Replay not available yet')
    }

    const ticks = await db.query(
      'SELECT tick, state FROM battle_ticks WHERE game_id = $1 ORDER BY tick',
      [id]
    )

    const entries = await db.query(
      `SELECT ge.slot, ge.agent_id, ge.final_rank, ge.total_score,
              ge.kills, ge.damage_dealt, ge.damage_taken, ge.survived_ticks,
              ge.bonus_hp, ge.bonus_damage,
              a.name AS agent_name, a.meta,
              w.slug AS weapon_slug, w.name AS weapon_name,
              ar.slug AS armor_slug, ar.name AS armor_name, ar.emoji AS armor_emoji
       FROM game_entries ge
       JOIN agents a ON a.id = ge.agent_id
       JOIN weapons w ON w.id = ge.weapon_id
       LEFT JOIN armors ar ON ar.id = ge.armor_id
       WHERE ge.game_id = $1
       ORDER BY ge.final_rank NULLS LAST`,
      [id]
    )

    // Fetch arena for terrain data
    const arenaResult = await db.query(
      'SELECT grid_width, grid_height, terrain FROM arenas WHERE id = $1',
      [game.arena_id]
    )
    const arena = arenaResult.rows[0] || { grid_width: 8, grid_height: 8, terrain: [] }

    // Fetch chat messages for replay
    const chatMessages = await db.query(
      `SELECT tick, msg_type, slot, message, created_at
       FROM game_chat
       WHERE game_id = $1 AND tick IS NOT NULL
       ORDER BY tick ASC, created_at ASC`,
      [id]
    )

    res.json({
      game_id: id,
      title: game.title,
      max_ticks: game.max_ticks,
      results: game.results,
      arena: {
        width: arena.grid_width,
        height: arena.grid_height,
        terrain: typeof arena.terrain === 'string' ? JSON.parse(arena.terrain) : arena.terrain
      },
      entries: entries.rows,
      ticks: ticks.rows.map(t => t.state),
      chat: chatMessages.rows
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/games/:id/chat - Chat messages
 */
async function getChat(req, res, next) {
  try {
    const { id } = req.params
    const { after } = req.query // tick number to get messages after

    let where = 'WHERE game_id = $1'
    const params = [id]
    if (after) {
      where += ' AND tick > $2'
      params.push(parseInt(after))
    }

    const messages = await db.query(
      `SELECT gc.id, gc.tick, gc.msg_type, gc.slot, gc.message, gc.is_anonymous, gc.created_at,
              CASE WHEN gc.msg_type = 'human_chat' AND gc.is_anonymous = false
                   THEN u.display_name ELSE NULL END AS sender_name
       FROM game_chat gc
       LEFT JOIN users u ON u.id = gc.sender_id
       ${where.replace('game_id', 'gc.game_id').replace('tick', 'gc.tick')}
       ORDER BY gc.created_at ASC
       LIMIT 200`,
      params
    )

    res.json({ messages: messages.rows })
  } catch (err) {
    next(err)
  }
}

const VALID_EMOTIONS = new Set(['confident', 'friendly', 'intimidating', 'cautious', 'victorious', 'defeated'])

/**
 * POST /api/v1/games/:id/chat - Send chat message (user JWT or agent token)
 */
async function sendChat(req, res, next) {
  try {
    const { id } = req.params
    const { message, emotion, anonymous } = req.body
    const isAgent = !!req.agent
    const isAnonymous = !isAgent && !!anonymous

    if (!message || message.length > 200) {
      throw new ValidationError('Message required (max 200 characters)')
    }

    if (emotion && !VALID_EMOTIONS.has(emotion)) {
      throw new ValidationError(`Invalid emotion. Valid: ${[...VALID_EMOTIONS].join(', ')}`)
    }

    // Verify game exists and is in an allowed state
    const game = await db.query('SELECT state FROM games WHERE id = $1', [id])
    if (game.rows.length === 0) throw new NotFoundError('Game not found')

    const allowedStates = isAgent
      ? ['lobby', 'betting', 'battle', 'ended']
      : ['lobby', 'betting', 'battle']
    if (!allowedStates.includes(game.rows[0].state)) {
      throw new BadRequestError('Chat not available for this game state')
    }

    // Get current tick if in battle
    const state = gameStateManager.getState(id)
    const tick = state ? state.tick : null

    const msgType = isAgent ? 'ai_chat' : 'human_chat'
    const senderId = isAgent ? req.agent.id : req.user.userId

    const result = await db.query(
      `INSERT INTO game_chat (game_id, tick, msg_type, sender_id, message, emotion, is_anonymous)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, tick, msg_type, slot, message, emotion, is_anonymous, created_at`,
      [id, tick, msgType, senderId, message, emotion || null, isAnonymous]
    )

    // Look up slot for agent messages, name for human messages
    let emitData = result.rows[0]
    if (isAgent) {
      const entryResult = await db.query(
        'SELECT slot FROM game_entries WHERE game_id = $1 AND agent_id = $2',
        [id, req.agent.id]
      )
      if (entryResult.rows[0]) {
        emitData = { ...emitData, slot: entryResult.rows[0].slot }
      }
    } else if (!isAnonymous) {
      const userResult = await db.query(
        'SELECT display_name FROM users WHERE id = $1',
        [req.user.userId]
      )
      if (userResult.rows[0]) {
        emitData = { ...emitData, sender_name: userResult.rows[0].display_name }
      }
    }

    // Push chat via WebSocket
    const io = req.app.get('io')
    if (io) io.to(`game:${id}`).emit('chat', emitData)

    res.status(201).json(emitData)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/games/:id/chat-pool - Upload pre-generated chat responses (agent)
 */
async function uploadChatPool(req, res, next) {
  try {
    const { id } = req.params
    const agent = req.agent
    const { responses } = req.body

    // Validate game exists and is in lobby/betting
    const game = await db.query('SELECT state FROM games WHERE id = $1', [id])
    if (game.rows.length === 0) throw new NotFoundError('Game not found')
    if (!['lobby', 'betting'].includes(game.rows[0].state)) {
      throw new BadRequestError('Chat pool upload only during lobby or betting')
    }

    // Verify agent is in this game
    const entry = await db.query(
      'SELECT id FROM game_entries WHERE game_id = $1 AND agent_id = $2',
      [id, agent.id]
    )
    if (entry.rows.length === 0) {
      throw new BadRequestError('Agent is not a participant in this game')
    }

    // Validate responses structure
    if (!responses || typeof responses !== 'object' || Array.isArray(responses)) {
      throw new ValidationError('responses object required')
    }

    const categories = Object.keys(responses)
    if (categories.length > config.chatPoolMaxCategories) {
      throw new ValidationError(`Max ${config.chatPoolMaxCategories} categories`)
    }

    let totalMessages = 0
    for (const [cat, msgs] of Object.entries(responses)) {
      if (!Array.isArray(msgs)) {
        throw new ValidationError(`Category "${cat}" must be an array`)
      }
      if (msgs.length > config.chatPoolMaxPerCategory) {
        throw new ValidationError(`Max ${config.chatPoolMaxPerCategory} messages per category`)
      }
      for (const msg of msgs) {
        if (typeof msg !== 'string' || msg.length === 0 || msg.length > config.chatPoolMaxMessageLength) {
          throw new ValidationError(`Each message must be 1-${config.chatPoolMaxMessageLength} characters`)
        }
      }
      totalMessages += msgs.length
    }

    // Upsert (allow re-upload during lobby/betting)
    await db.query(
      `INSERT INTO agent_chat_pool (game_id, agent_id, responses)
       VALUES ($1, $2, $3)
       ON CONFLICT (game_id, agent_id) DO UPDATE SET responses = $3, created_at = now()`,
      [id, agent.id, JSON.stringify(responses)]
    )

    res.status(201).json({ success: true, categories: categories.length, total_messages: totalMessages })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/games/:id/chat-pool - Check if agent has uploaded a chat pool
 */
async function getChatPoolStatus(req, res, next) {
  try {
    const { id } = req.params
    const agent = req.agent

    const result = await db.query(
      'SELECT responses FROM agent_chat_pool WHERE game_id = $1 AND agent_id = $2',
      [id, agent.id]
    )

    if (result.rows.length === 0) {
      return res.json({ has_pool: false, categories: 0, total_messages: 0 })
    }

    const responses = result.rows[0].responses
    const categories = Object.keys(responses).length
    const totalMessages = Object.values(responses).reduce((sum, msgs) => sum + msgs.length, 0)

    res.json({ has_pool: true, categories, total_messages: totalMessages })
  } catch (err) {
    next(err)
  }
}

// ==========================================
// Agent Endpoints
// ==========================================

/**
 * POST /api/v1/games/:id/join - Agent joins game (lobby phase)
 */
async function join(req, res, next) {
  try {
    const { id } = req.params
    const agent = req.agent
    const { weapon, armor } = req.body // weapon slug, armor slug

    const gameResult = await db.query(
      'SELECT g.*, a.max_players FROM games g JOIN arenas a ON a.id = g.arena_id WHERE g.id = $1',
      [id]
    )
    if (gameResult.rows.length === 0) throw new NotFoundError('Game not found')

    const game = gameResult.rows[0]
    if (game.state !== 'lobby') {
      throw new BadRequestError(`Game is not accepting entries (state: ${game.state})`)
    }

    // Get weapon
    const weaponSlug = weapon || 'sword' // default to sword
    const weaponResult = await db.query(
      'SELECT * FROM weapons WHERE slug = $1 AND is_active = true',
      [weaponSlug]
    )
    if (weaponResult.rows.length === 0) {
      throw new NotFoundError(`Weapon '${weaponSlug}' not found`)
    }
    const weaponRow = weaponResult.rows[0]

    // Get armor
    const armorSlug = armor || 'no_armor'
    const armorResult = await db.query(
      'SELECT * FROM armors WHERE slug = $1 AND is_active = true',
      [armorSlug]
    )
    if (armorResult.rows.length === 0) {
      throw new NotFoundError(`Armor '${armorSlug}' not found`)
    }
    const armorRow = armorResult.rows[0]

    // Weapon-armor compatibility check
    const allowedArmors = weaponRow.allowed_armors || ['heavy', 'light', 'cloth', 'none']
    if (!allowedArmors.includes(armorRow.category)) {
      throw new BadRequestError(`Weapon '${weaponSlug}' cannot be used with armor category '${armorRow.category}'. Allowed: ${allowedArmors.join(', ')}`)
    }

    // Check max entries
    const entries = await db.query(
      'SELECT slot FROM game_entries WHERE game_id = $1 ORDER BY slot',
      [id]
    )
    if (entries.rows.length >= game.max_entries) {
      throw new ConflictError('Game is full')
    }

    // Check duplicate
    const existing = await db.query(
      'SELECT id FROM game_entries WHERE game_id = $1 AND agent_id = $2',
      [id, agent.id]
    )
    if (existing.rows.length > 0) {
      throw new ConflictError('Agent already joined this game')
    }

    // Assign next available slot
    const usedSlots = new Set(entries.rows.map(e => e.slot))
    let slot = 0
    while (usedSlots.has(slot)) slot++

    // Debit entry fee
    if (game.entry_fee > 0) {
      if (agent.balance_cache < game.entry_fee) {
        throw new BadRequestError(`Insufficient balance. Need ${game.entry_fee}, have ${agent.balance_cache}`)
      }
      await db.query(
        'UPDATE agents SET balance_cache = balance_cache - $1 WHERE id = $2',
        [game.entry_fee, agent.id]
      )
    }

    // Default strategy
    const defaultStrategy = { mode: 'balanced', target_priority: 'nearest', flee_threshold: config.defaultFleeThreshold || 15 }

    await db.query(
      `INSERT INTO game_entries (game_id, agent_id, slot, weapon_id, armor_id, initial_strategy, entry_fee_paid)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, agent.id, slot, weaponRow.id, armorRow.id, JSON.stringify(defaultStrategy), game.entry_fee]
    )

    // Update prize pool
    if (game.entry_fee > 0) {
      await db.query(
        'UPDATE games SET prize_pool = prize_pool + $1, updated_at = now() WHERE id = $2',
        [game.entry_fee, id]
      )
    }

    // Lobby full → fast-forward to betting in min(remaining, 30s)
    const newCount = entries.rows.length + 1
    if (newCount >= game.max_entries) {
      const now = Date.now()
      const currentBetting = new Date(game.betting_start).getTime()
      const remaining = currentBetting - now
      const fastForwardMs = Math.min(remaining, 30000)
      if (fastForwardMs < remaining) {
        const newBettingStart = new Date(now + fastForwardMs)
        const bettingDuration = new Date(game.battle_start).getTime() - currentBetting
        const newBattleStart = new Date(newBettingStart.getTime() + bettingDuration)
        await db.query(
          'UPDATE games SET betting_start = $1, battle_start = $2, updated_at = now() WHERE id = $3',
          [newBettingStart.toISOString(), newBattleStart.toISOString(), id]
        )
        console.log(`[Games] Lobby full for ${id}, fast-forwarding to betting in ${Math.round(fastForwardMs / 1000)}s`)
        const io = req.app.get('io')
        if (io) io.to(`game:${id}`).emit('lobby_full', {
          betting_start: newBettingStart.toISOString(),
          battle_start: newBattleStart.toISOString()
        })
      }
    }

    res.status(201).json({
      game_id: id,
      slot,
      weapon: weaponSlug,
      armor: armorSlug,
      strategy: defaultStrategy,
      message: 'Successfully joined the game'
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/games/:id/strategy - Submit/update strategy (lobby or battle)
 */
async function submitStrategy(req, res, next) {
  try {
    const { id } = req.params
    const agent = req.agent
    const { mode, target_priority, flee_threshold, message } = req.body

    // Validate fields
    const validModes = ['aggressive', 'defensive', 'balanced']
    const validPriorities = ['nearest', 'lowest_hp', 'highest_hp', 'weakest_weapon', 'random']

    if (mode && !validModes.includes(mode)) {
      throw new ValidationError(`Invalid mode. Options: ${validModes.join(', ')}`)
    }
    if (target_priority && !validPriorities.includes(target_priority)) {
      throw new ValidationError(`Invalid target_priority. Options: ${validPriorities.join(', ')}`)
    }
    if (flee_threshold !== undefined && (flee_threshold < 0 || flee_threshold > 100)) {
      throw new ValidationError('flee_threshold must be 0-100')
    }
    if (message && message.length > 200) {
      throw new ValidationError('message max 200 characters')
    }

    // Get entry
    const entry = await db.query(
      'SELECT ge.slot, ge.initial_strategy FROM game_entries ge WHERE ge.game_id = $1 AND ge.agent_id = $2',
      [id, agent.id]
    )
    if (entry.rows.length === 0) throw new NotFoundError('Agent not in this game')

    const slot = entry.rows[0].slot
    const game = await db.query('SELECT state FROM games WHERE id = $1', [id])
    const state = game.rows[0].state

    const newStrategy = {}
    if (mode) newStrategy.mode = mode
    if (target_priority) newStrategy.target_priority = target_priority
    if (flee_threshold !== undefined) newStrategy.flee_threshold = flee_threshold

    if (state === 'lobby') {
      // In lobby: update initial_strategy in DB
      const current = entry.rows[0].initial_strategy || {}
      const merged = { ...current, ...newStrategy }

      await db.query(
        'UPDATE game_entries SET initial_strategy = $1 WHERE game_id = $2 AND agent_id = $3',
        [JSON.stringify(merged), id, agent.id]
      )

      res.json({ strategy: merged, phase: 'lobby' })
    } else if (state === 'battle') {
      // In battle: update via battleEngine (with cooldown)
      const result = battleEngine.updateStrategy(id, agent.id, newStrategy)
      if (result.error) {
        if (result.error === 'STRATEGY_COOLDOWN') {
          throw new BadRequestError(`Strategy on cooldown (${result.remaining} ticks remaining)`)
        }
        if (result.error === 'MAX_STRATEGY_CHANGES') {
          throw new BadRequestError('Maximum strategy changes reached for this game')
        }
        throw new BadRequestError(`Cannot update strategy: ${result.error}`)
      }

      // Log strategy change
      const gameState = gameStateManager.getState(id)
      const tick = gameState ? gameState.tick : 0
      await db.query(
        `INSERT INTO strategy_logs (game_id, agent_id, tick, strategy, message)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, agent.id, tick, JSON.stringify(result.strategy), message || null]
      )

      // Post AI message to chat if provided
      if (message) {
        await db.query(
          `INSERT INTO game_chat (game_id, tick, msg_type, sender_id, slot, message)
           VALUES ($1, $2, 'ai_strategy', $3, $4, $5)`,
          [id, tick, agent.id, slot, message]
        )
      }

      res.json({ strategy: result.strategy, phase: 'battle', tick })
    } else {
      throw new BadRequestError(`Cannot change strategy in '${state}' phase`)
    }
  } catch (err) {
    next(err)
  }
}

// ==========================================
// Sponsorship Endpoint
// ==========================================

/**
 * POST /api/v1/games/:id/sponsor - Sponsor a slot (lobby only, user auth)
 */
async function sponsor(req, res, next) {
  try {
    const { id } = req.params
    const { slot, boost_type } = req.body

    if (slot === undefined || slot === null) throw new ValidationError('slot is required')
    if (!['weapon_boost', 'hp_boost'].includes(boost_type)) {
      throw new ValidationError('boost_type must be weapon_boost or hp_boost')
    }

    // Verify game is in lobby
    const game = await db.query('SELECT state FROM games WHERE id = $1', [id])
    if (game.rows.length === 0) throw new NotFoundError('Game not found')
    if (game.rows[0].state !== 'lobby') {
      throw new BadRequestError('Sponsorship only available during lobby phase')
    }

    // Verify slot exists
    const entry = await db.query(
      'SELECT id FROM game_entries WHERE game_id = $1 AND slot = $2',
      [id, slot]
    )
    if (entry.rows.length === 0) throw new NotFoundError('No agent in this slot')

    // Check stack limit
    const existing = await db.query(
      `SELECT COUNT(*) AS cnt FROM sponsorships
       WHERE game_id = $1 AND slot = $2 AND boost_type = $3`,
      [id, slot, boost_type]
    )
    if (parseInt(existing.rows[0].cnt) >= config.maxBoostsPerSlot) {
      throw new BadRequestError(`Maximum ${config.maxBoostsPerSlot} ${boost_type} stacks reached for this slot`)
    }

    // For MVP, sponsorship is free/point-based. Will integrate claw-wallet in Phase 3.
    const cost = config.sponsorCostPerBoost
    const effectValue = boost_type === 'weapon_boost'
      ? config.weaponBoostValue
      : config.hpBoostValue

    // Record sponsorship
    await db.query(
      `INSERT INTO sponsorships (game_id, user_id, slot, boost_type, cost, effect_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, req.user.userId, slot, boost_type, cost, effectValue]
    )

    // Update entry bonus columns
    const bonusCol = boost_type === 'weapon_boost' ? 'bonus_damage' : 'bonus_hp'
    await db.query(
      `UPDATE game_entries SET ${bonusCol} = ${bonusCol} + $1 WHERE game_id = $2 AND slot = $3`,
      [effectValue, id, slot]
    )

    // Get updated totals for response
    const totals = await db.query(
      `SELECT
        SUM(CASE WHEN boost_type = 'weapon_boost' THEN effect_value ELSE 0 END) AS weapon_boost,
        SUM(CASE WHEN boost_type = 'hp_boost' THEN effect_value ELSE 0 END) AS hp_boost
       FROM sponsorships WHERE game_id = $1 AND slot = $2`,
      [id, slot]
    )

    res.status(201).json({
      slot,
      boost_type,
      total_weapon_boost: parseInt(totals.rows[0].weapon_boost) || 0,
      total_hp_boost: parseInt(totals.rows[0].hp_boost) || 0
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/games/:id/sponsorships - Sponsorship totals per slot (public)
 */
async function getSponsorships(req, res, next) {
  try {
    const { id } = req.params

    const game = await db.query('SELECT max_entries FROM games WHERE id = $1', [id])
    if (game.rows.length === 0) throw new NotFoundError('Game not found')

    const result = await db.query(
      `SELECT slot,
              SUM(CASE WHEN boost_type = 'weapon_boost' THEN effect_value ELSE 0 END) AS weapon_boost,
              SUM(CASE WHEN boost_type = 'hp_boost' THEN effect_value ELSE 0 END) AS hp_boost,
              COUNT(DISTINCT user_id) AS sponsor_count
       FROM sponsorships WHERE game_id = $1
       GROUP BY slot ORDER BY slot`,
      [id]
    )

    // Build full slots array
    const slots = []
    const sponsorMap = {}
    for (const r of result.rows) {
      sponsorMap[r.slot] = {
        slot: r.slot,
        weapon_boost: parseInt(r.weapon_boost) || 0,
        hp_boost: parseInt(r.hp_boost) || 0,
        sponsor_count: parseInt(r.sponsor_count) || 0
      }
    }

    const maxEntries = game.rows[0].max_entries
    for (let i = 0; i < maxEntries; i++) {
      slots.push(sponsorMap[i] || { slot: i, weapon_boost: 0, hp_boost: 0, sponsor_count: 0 })
    }

    res.json({ slots })
  } catch (err) {
    next(err)
  }
}

// ==========================================
// Admin Endpoints
// ==========================================

/**
 * POST /api/v1/admin/games - Create game (admin)
 */
async function create(req, res, next) {
  try {
    const { title, arena_slug, entry_fee, max_entries, max_ticks, lobby_start } = req.body

    if (!title) throw new ValidationError('title is required')

    // Get arena
    const arenaSlug = arena_slug || 'the_pit'
    const arena = await db.query(
      'SELECT * FROM arenas WHERE slug = $1 AND is_active = true',
      [arenaSlug]
    )
    if (arena.rows.length === 0) throw new NotFoundError(`Arena '${arenaSlug}' not found`)

    const arenaRow = arena.rows[0]
    const me = max_entries || arenaRow.max_players
    const mt = max_ticks || config.defaultMaxTicks

    const now = Date.now()
    const lStart = lobby_start || new Date(now + 2 * 60000).toISOString()
    const bStart = new Date(new Date(lStart).getTime() + config.lobbyDurationMin * 60000).toISOString()
    const btStart = new Date(new Date(bStart).getTime() + config.bettingDurationSec * 1000).toISOString()

    const result = await db.query(
      `INSERT INTO games (title, arena_id, state, max_entries, entry_fee, max_ticks,
                          lobby_start, betting_start, battle_start, created_by)
       VALUES ($1, $2, 'created', $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [title, arenaRow.id, me, entry_fee || 0, mt, lStart, bStart, btStart, req.user.userId]
    )

    res.status(201).json(result.rows[0])
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /api/v1/admin/games/:id - Update game (admin)
 */
async function update(req, res, next) {
  try {
    const { id } = req.params
    const { title, state, lobby_start, betting_start, battle_start } = req.body

    const existing = await db.query('SELECT id, state FROM games WHERE id = $1', [id])
    if (existing.rows.length === 0) throw new NotFoundError('Game not found')

    const updates = []
    const params = []
    let idx = 1

    if (title !== undefined) { updates.push(`title = $${idx++}`); params.push(title) }
    if (state !== undefined) { updates.push(`state = $${idx++}`); params.push(state) }
    if (lobby_start !== undefined) { updates.push(`lobby_start = $${idx++}`); params.push(lobby_start) }
    if (betting_start !== undefined) { updates.push(`betting_start = $${idx++}`); params.push(betting_start) }
    if (battle_start !== undefined) { updates.push(`battle_start = $${idx++}`); params.push(battle_start) }

    if (updates.length === 0) throw new ValidationError('No fields to update')

    updates.push(`updated_at = now()`)
    params.push(id)

    const result = await db.query(
      `UPDATE games SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    )

    const game = result.rows[0]

    // If admin forced state to 'battle', start the battle engine
    if (state === 'battle' && existing.rows[0].state !== 'battle') {
      const arena = await db.query('SELECT * FROM arenas WHERE id = $1', [game.arena_id])
      const entries = await db.query(
        `SELECT ge.slot, ge.agent_id, ge.initial_strategy, ge.bonus_hp, ge.bonus_damage,
                w.slug AS weapon_slug, w.damage AS weapon_damage,
                w.damage_min AS weapon_damage_min, w.damage_max AS weapon_damage_max,
                w.range AS weapon_range,
                w.cooldown AS weapon_cooldown, w.aoe_radius AS weapon_aoe_radius, w.skill AS weapon_skill,
                w.atk_speed AS weapon_atk_speed, w.move_speed AS weapon_move_speed,
                ar.slug AS armor_slug, ar.dmg_reduction AS armor_dmg_reduction,
                ar.evasion AS armor_evasion, ar.move_mod AS armor_move_mod,
                ar.atk_mod AS armor_atk_mod, ar.emoji AS armor_emoji
         FROM game_entries ge
         JOIN weapons w ON w.id = ge.weapon_id
         LEFT JOIN armors ar ON ar.id = ge.armor_id
         WHERE ge.game_id = $1
         ORDER BY ge.slot`,
        [id]
      )

      if (entries.rows.length < 2) {
        throw new BadRequestError('Cannot start battle with fewer than 2 entries')
      }

      await db.query(
        `UPDATE game_entries SET status = 'fighting' WHERE game_id = $1 AND status = 'joined'`,
        [id]
      )

      console.log(`[Admin] Starting battle for game '${game.title}' (${id})`)
      battleEngine.startBattle(game, arena.rows[0], entries.rows)
    }

    res.json(game)
  } catch (err) {
    next(err)
  }
}

// ==========================================
// Arena & Weapon endpoints
// ==========================================

/**
 * GET /api/v1/arenas - List arenas (public)
 */
async function listArenas(req, res, next) {
  try {
    const result = await db.query(
      'SELECT id, slug, name, grid_width, grid_height, max_players, description, is_active FROM arenas WHERE is_active = true ORDER BY name'
    )
    res.json({ arenas: result.rows })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/weapons - List weapons (public)
 */
async function listWeapons(req, res, next) {
  try {
    const result = await db.query(
      `SELECT id, slug, name, category, damage, damage_min, damage_max, range, cooldown,
              aoe_radius, skill, atk_speed, move_speed, allowed_armors, description, is_active
       FROM weapons WHERE is_active = true ORDER BY name`
    )
    res.json({ weapons: result.rows })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/armors - List armors (public)
 */
async function listArmors(req, res, next) {
  try {
    const result = await db.query(
      `SELECT id, slug, name, category, dmg_reduction, evasion, move_mod, atk_mod, emoji, description
       FROM armors WHERE is_active = true ORDER BY name`
    )
    res.json({ armors: result.rows })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/admin/arenas - Add arena (admin)
 */
async function createArena(req, res, next) {
  try {
    const { slug, name, grid_width, grid_height, max_players, terrain, spawn_points, description } = req.body
    if (!slug || !name) throw new ValidationError('slug and name are required')

    const result = await db.query(
      `INSERT INTO arenas (slug, name, grid_width, grid_height, max_players, terrain, spawn_points, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [slug, name, grid_width || 8, grid_height || 8, max_players || 8,
       JSON.stringify(terrain || []), JSON.stringify(spawn_points || []), description || '']
    )

    res.status(201).json(result.rows[0])
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/admin/weapons - Add weapon (admin)
 */
async function createWeapon(req, res, next) {
  try {
    const { slug, name, category, damage, range, cooldown, aoe_radius, skill, description } = req.body
    if (!slug || !name) throw new ValidationError('slug and name are required')

    const result = await db.query(
      `INSERT INTO weapons (slug, name, category, damage, range, cooldown, aoe_radius, skill, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [slug, name, category || 'melee', damage || 10, range || 1, cooldown || 0,
       aoe_radius || 0, skill ? JSON.stringify(skill) : null, description || '']
    )

    res.status(201).json(result.rows[0])
  } catch (err) {
    next(err)
  }
}

// ==========================================
// Betting Endpoints
// ==========================================

/**
 * POST /api/v1/games/:id/bet - Place a bet on a slot (betting phase)
 * Logged-in users: amount 1/10/100 (deducts points)
 * Anonymous: amount=0 (free bet, count only, max 5 per game)
 */
async function placeBet(req, res, next) {
  try {
    const { id } = req.params
    const { slot, amount } = req.body
    const userId = req.user ? req.user.userId : null
    const isAnon = !userId

    if (slot === undefined || slot === null) throw new ValidationError('slot is required')

    // Verify game is in betting phase
    const game = await db.query('SELECT state, max_entries FROM games WHERE id = $1', [id])
    if (game.rows.length === 0) throw new NotFoundError('Game not found')
    if (game.rows[0].state !== 'betting') {
      throw new BadRequestError('Bets are only accepted during betting phase')
    }

    // Verify slot has an entry
    const entry = await db.query(
      'SELECT id FROM game_entries WHERE game_id = $1 AND slot = $2',
      [id, slot]
    )
    if (entry.rows.length === 0) throw new NotFoundError('No agent in this slot')

    if (isAnon) {
      // Anonymous bet: amount=0, use IP as anon_id, max 5 per game
      const anonId = req.ip || req.headers['x-forwarded-for'] || 'unknown'
      const existing = await db.query(
        'SELECT COUNT(*) AS cnt FROM game_bets WHERE game_id = $1 AND anon_id = $2',
        [id, anonId]
      )
      if (parseInt(existing.rows[0].cnt) >= 5) {
        throw new BadRequestError('Maximum 5 free bets per game')
      }

      await db.query(
        'INSERT INTO game_bets (game_id, user_id, slot, amount, anon_id) VALUES ($1, NULL, $2, 0, $3)',
        [id, slot, anonId]
      )

      res.status(201).json({ slot, amount: 0, remaining_points: null })
    } else {
      // Logged-in bet: amount 1/10/100
      if (!config.betAmounts.includes(amount)) {
        throw new ValidationError(`amount must be one of: ${config.betAmounts.join(', ')}`)
      }

      const client = await db.getClient()
      try {
        await client.query('BEGIN')

        // Check available balance: points minus all unsettled bet holds
        const userResult = await client.query(
          'SELECT points FROM users WHERE id = $1 FOR UPDATE',
          [userId]
        )
        const currentPoints = parseInt(userResult.rows[0].points)

        const holdResult = await client.query(
          'SELECT COALESCE(SUM(amount), 0) AS held FROM game_bets WHERE user_id = $1 AND settled_at IS NULL',
          [userId]
        )
        const heldAmount = parseInt(holdResult.rows[0].held)
        const available = currentPoints - heldAmount

        if (available < amount) {
          throw new BadRequestError(`Insufficient points. Available ${available} (${currentPoints} - ${heldAmount} held), need ${amount}`)
        }

        await client.query(
          'INSERT INTO game_bets (game_id, user_id, slot, amount) VALUES ($1, $2, $3, $4)',
          [id, userId, slot, amount]
        )

        await client.query('COMMIT')

        const remainingAvailable = available - amount
        res.status(201).json({ slot, amount, remaining_points: remainingAvailable })
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    }
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/games/:id/bets - Get bet counts per slot (public) + my bets (if logged in)
 */
async function getBetCounts(req, res, next) {
  try {
    const { id } = req.params

    const game = await db.query('SELECT max_entries FROM games WHERE id = $1', [id])
    if (game.rows.length === 0) throw new NotFoundError('Game not found')

    // Bet counts per slot (public info — count only, no amounts)
    const counts = await db.query(
      `SELECT slot, COUNT(*) AS count FROM game_bets WHERE game_id = $1 GROUP BY slot ORDER BY slot`,
      [id]
    )
    const countMap = {}
    for (const r of counts.rows) {
      countMap[r.slot] = parseInt(r.count)
    }

    const bets = []
    for (let i = 0; i < game.rows[0].max_entries; i++) {
      bets.push({ slot: i, count: countMap[i] || 0 })
    }

    const result = { bets }

    // If logged in, include user's own bets
    if (req.user) {
      const myBets = await db.query(
        `SELECT slot, amount, payout, settled_at FROM game_bets WHERE game_id = $1 AND user_id = $2 ORDER BY created_at`,
        [id, req.user.userId]
      )
      result.my_bets = myBets.rows.map(b => ({
        slot: b.slot,
        amount: parseInt(b.amount),
        payout: parseInt(b.payout),
        settled: !!b.settled_at
      }))
    } else {
      // Guest: return bets by anon_id (IP)
      const anonId = req.ip || req.headers['x-forwarded-for'] || 'unknown'
      const guestBets = await db.query(
        `SELECT slot, amount, payout, settled_at FROM game_bets WHERE game_id = $1 AND anon_id = $2 ORDER BY created_at`,
        [id, anonId]
      )
      if (guestBets.rows.length > 0) {
        result.my_bets = guestBets.rows.map(b => ({
          slot: b.slot,
          amount: parseInt(b.amount),
          payout: parseInt(b.payout),
          settled: !!b.settled_at
        }))
        result.is_guest = true
      }
    }

    res.json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/users/me - Get current user profile (points etc.)
 */
async function getUserProfile(req, res, next) {
  try {
    const result = await db.query(
      'SELECT id, email, display_name, role, points FROM users WHERE id = $1',
      [req.user.userId]
    )
    if (result.rows.length === 0) throw new NotFoundError('User not found')

    const user = result.rows[0]
    res.json({
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      points: parseInt(user.points)
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  list, get, getState, replay, getChat, sendChat,
  join, submitStrategy,
  uploadChatPool, getChatPoolStatus,
  sponsor, getSponsorships,
  placeBet, getBetCounts, getUserProfile,
  create, update,
  listArenas, listWeapons, listArmors, createArena, createWeapon
}
