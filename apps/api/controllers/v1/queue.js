const db = require('../../db')
const { ValidationError, NotFoundError, ConflictError, BadRequestError } = require('../../utils/errors')
const config = require('../../config')

/**
 * POST /api/v1/queue/join — Agent joins the matchmaking queue.
 */
async function join(req, res, next) {
  try {
    const agent = req.agent
    const { weapon, chat_pool, strategy } = req.body

    // Validate weapon (optional — null means random assignment by matchmaker)
    const weaponSlug = weapon || null
    if (weaponSlug) {
      const weaponResult = await db.query(
        'SELECT id, slug FROM weapons WHERE slug = $1 AND is_active = true',
        [weaponSlug]
      )
      if (weaponResult.rows.length === 0) {
        throw new NotFoundError(`Weapon '${weaponSlug}' not found`)
      }
    }

    // Validate chat_pool (optional)
    let validatedPool = null
    if (chat_pool && typeof chat_pool === 'object') {
      const categories = Object.keys(chat_pool)
      if (categories.length > 10) {
        throw new ValidationError('chat_pool: max 10 categories')
      }
      for (const cat of categories) {
        if (!Array.isArray(chat_pool[cat])) {
          throw new ValidationError(`chat_pool.${cat} must be an array`)
        }
        if (chat_pool[cat].length > 5) {
          throw new ValidationError(`chat_pool.${cat}: max 5 messages per category`)
        }
        for (const msg of chat_pool[cat]) {
          if (typeof msg !== 'string' || msg.length === 0 || msg.length > 50) {
            throw new ValidationError(`chat_pool.${cat}: each message must be 1-50 chars`)
          }
        }
      }
      validatedPool = chat_pool
    }

    // Validate strategy (optional)
    let validatedStrategy = null
    if (strategy && typeof strategy === 'object') {
      const { mode, target_priority, flee_threshold } = strategy
      const validModes = ['aggressive', 'defensive', 'balanced']
      const validTargets = ['nearest', 'lowest_hp', 'highest_hp', 'random']
      if (mode && !validModes.includes(mode)) {
        throw new ValidationError(`strategy.mode must be one of: ${validModes.join(', ')}`)
      }
      if (target_priority && !validTargets.includes(target_priority)) {
        throw new ValidationError(`strategy.target_priority must be one of: ${validTargets.join(', ')}`)
      }
      if (flee_threshold != null && (typeof flee_threshold !== 'number' || flee_threshold < 0 || flee_threshold > 100)) {
        throw new ValidationError('strategy.flee_threshold must be 0-100')
      }
      validatedStrategy = { mode: mode || 'balanced', target_priority: target_priority || 'nearest', flee_threshold: flee_threshold ?? config.defaultFleeThreshold }
    }

    // Check if agent is already in an active game
    const activeGame = await db.query(
      `SELECT g.id FROM game_entries ge
       JOIN games g ON g.id = ge.game_id
       WHERE ge.agent_id = $1 AND g.state IN ('lobby', 'betting', 'battle')`,
      [agent.id]
    )
    if (activeGame.rows.length > 0) {
      throw new ConflictError('Agent is already in an active game')
    }

    // Check existing queue entry (may be cooldown placeholder or active)
    const existingEntry = await db.query(
      'SELECT id, cooldown_until, weapon_slug FROM battle_queue WHERE agent_id = $1',
      [agent.id]
    )
    if (existingEntry.rows.length > 0) {
      const entry = existingEntry.rows[0]
      if (entry.cooldown_until && new Date(entry.cooldown_until) > new Date()) {
        const remaining = Math.ceil((new Date(entry.cooldown_until) - Date.now()) / 1000)
        throw new BadRequestError(`Queue cooldown active (${remaining}s remaining)`)
      }
      if (entry.weapon_slug !== 'none' && entry.weapon_slug !== null) {
        // Already actively in queue
        throw new ConflictError('Agent already in matchmaking queue')
      }
      // Expired cooldown placeholder — delete and re-insert fresh
      await db.query('DELETE FROM battle_queue WHERE agent_id = $1', [agent.id])
    }

    // Try to join an existing lobby game with empty slots first
    const lobbyGame = await db.query(`
      SELECT g.id, g.max_entries
      FROM games g
      WHERE g.state = 'lobby'
        AND (SELECT COUNT(*) FROM game_entries ge WHERE ge.game_id = g.id) < g.max_entries
      ORDER BY g.lobby_start ASC
      LIMIT 1
    `)

    if (lobbyGame.rows.length > 0) {
      const game = lobbyGame.rows[0]

      // Find first available slot
      const takenSlots = await db.query(
        'SELECT slot FROM game_entries WHERE game_id = $1',
        [game.id]
      )
      const takenSet = new Set(takenSlots.rows.map(r => r.slot))
      let slot = null
      for (let s = 0; s < game.max_entries; s++) {
        if (!takenSet.has(s)) { slot = s; break }
      }

      if (slot !== null) {
        // Resolve weapon
        let weaponId
        if (weaponSlug) {
          const w = await db.query(
            'SELECT id FROM weapons WHERE slug = $1 AND is_active = true',
            [weaponSlug]
          )
          weaponId = w.rows.length > 0 ? w.rows[0].id : null
        }
        if (!weaponId) {
          const allWeapons = await db.query('SELECT id FROM weapons WHERE is_active = true')
          if (allWeapons.rows.length > 0) {
            weaponId = allWeapons.rows[Math.floor(Math.random() * allWeapons.rows.length)].id
          } else {
            weaponId = (await db.query("SELECT id FROM weapons WHERE slug = 'sword'")).rows[0].id
          }
        }

        const strat = validatedStrategy || { mode: 'balanced', target_priority: 'nearest', flee_threshold: config.defaultFleeThreshold }

        await db.query(
          `INSERT INTO game_entries (game_id, agent_id, slot, weapon_id, initial_strategy)
           VALUES ($1, $2, $3, $4, $5)`,
          [game.id, agent.id, slot, weaponId, JSON.stringify(strat)]
        )

        if (validatedPool) {
          await db.query(
            `INSERT INTO agent_chat_pool (game_id, agent_id, responses)
             VALUES ($1, $2, $3)
             ON CONFLICT (game_id, agent_id) DO UPDATE SET responses = $3`,
            [game.id, agent.id, JSON.stringify(validatedPool)]
          )
        }

        await db.query(
          'INSERT INTO matchmaking_history (game_id, agent_id) VALUES ($1, $2)',
          [game.id, agent.id]
        )

        await db.query(
          `INSERT INTO game_chat (game_id, msg_type, message)
           VALUES ($1, 'system', $2)`,
          [game.id, `A new warrior joined the arena!`]
        )

        return res.status(201).json({
          message: 'Joined lobby',
          game_id: game.id,
          slot
        })
      }
    }

    // No lobby available — add to queue
    const result = await db.query(
      `INSERT INTO battle_queue (agent_id, weapon_slug, chat_pool, strategy)
       VALUES ($1, $2, $3, $4)
       RETURNING id, weapon_slug, queued_at`,
      [agent.id, weaponSlug, validatedPool ? JSON.stringify(validatedPool) : null, validatedStrategy ? JSON.stringify(validatedStrategy) : null]
    )

    res.status(201).json({
      message: 'Joined matchmaking queue',
      queue_entry: result.rows[0]
    })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/v1/queue/leave — Agent leaves the matchmaking queue.
 */
async function leave(req, res, next) {
  try {
    const agent = req.agent

    const entry = await db.query(
      'SELECT id, leave_count FROM battle_queue WHERE agent_id = $1',
      [agent.id]
    )
    if (entry.rows.length === 0) {
      throw new NotFoundError('Agent not in matchmaking queue')
    }

    const newLeaveCount = (entry.rows[0].leave_count || 0) + 1
    let cooldownUntil = null

    // Apply cooldown if too many leaves
    if (newLeaveCount >= config.queueLeaveCooldownCount) {
      cooldownUntil = new Date(Date.now() + config.queueLeaveCooldownMin * 60000).toISOString()

      // Keep the queue row with cooldown so it's tracked on next join attempt
      await db.query(
        `UPDATE battle_queue SET weapon_slug = 'none', leave_count = $1, cooldown_until = $2
         WHERE agent_id = $3`,
        [newLeaveCount, cooldownUntil, agent.id]
      )
    } else {
      // Just remove from queue
      await db.query('DELETE FROM battle_queue WHERE agent_id = $1', [agent.id])
    }

    res.json({
      message: 'Left matchmaking queue',
      leave_count: newLeaveCount,
      cooldown_until: cooldownUntil
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/queue/status — Agent's queue status.
 */
async function status(req, res, next) {
  try {
    const agent = req.agent

    const entry = await db.query(
      `SELECT bq.id, bq.weapon_slug, bq.queued_at, bq.cooldown_until, bq.leave_count,
              (SELECT COUNT(*) FROM battle_queue WHERE cooldown_until IS NULL OR cooldown_until < now()) AS total_in_queue
       FROM battle_queue bq WHERE bq.agent_id = $1`,
      [agent.id]
    )

    // Check for active game regardless of queue status
    const activeGame = await db.query(
      `SELECT g.id, g.state FROM game_entries ge
       JOIN games g ON g.id = ge.game_id
       WHERE ge.agent_id = $1 AND g.state IN ('lobby', 'betting', 'battle')
       LIMIT 1`,
      [agent.id]
    )
    const activeGameInfo = activeGame.rows[0] || null

    if (entry.rows.length === 0) {
      return res.json({
        in_queue: false,
        active_game_id: activeGameInfo?.id || null,
        active_game_state: activeGameInfo?.state || null
      })
    }

    const row = entry.rows[0]
    const inCooldown = row.cooldown_until && new Date(row.cooldown_until) > new Date()

    res.json({
      in_queue: !inCooldown,
      weapon_slug: row.weapon_slug,
      queued_at: row.queued_at,
      cooldown_until: inCooldown ? row.cooldown_until : null,
      position_estimate: parseInt(row.total_in_queue) || 0,
      active_game_id: activeGameInfo?.id || null,
      active_game_state: activeGameInfo?.state || null
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/queue/info — Public queue info.
 */
async function info(req, res, next) {
  try {
    const result = await db.query(
      `SELECT COUNT(*) AS total
       FROM battle_queue
       WHERE cooldown_until IS NULL OR cooldown_until < now()`
    )
    const total = parseInt(result.rows[0].total) || 0

    // Estimate wait time based on queue size and process interval
    const gamesNeeded = Math.ceil(total / config.queueMaxPlayers)
    const estimatedWaitSec = total < config.queueMinPlayers
      ? config.queueSmallGameWaitMin * 60
      : gamesNeeded * config.queueProcessIntervalSec

    res.json({
      players_in_queue: total,
      min_for_game: config.queueMinPlayers,
      estimated_wait_sec: estimatedWaitSec
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { join, leave, status, info }
