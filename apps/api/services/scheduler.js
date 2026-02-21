const cron = require('node-cron')
const db = require('../db')
const config = require('../config')
const rewardDistributor = require('./rewardDistributor')
const predictionSettler = require('./predictionSettler')
const questionBank = require('./questionBank')
const battleEngine = require('./battleEngine')
const gameStateManager = require('./gameStateManager')
const matchmaker = require('./matchmaker')
const chatPoolService = require('./chatPoolService')
const betSettler = require('./betSettler')

// Socket.io instance (set by startScheduler)
let io = null

/**
 * Start the race + game lifecycle scheduler.
 * @param {import('socket.io').Server} socketIO - Socket.io server instance
 */
function startScheduler(socketIO) {
  io = socketIO || null
  // Inject io into services
  if (io) {
    battleEngine.setIO(io)
    chatPoolService.setIO(io)
    matchmaker.setIo(io)
  }
  // Recover stuck battles from previous crash/restart
  recoverStuckBattles().catch(err => {
    console.error('[Scheduler] Error recovering stuck battles:', err)
  })
  // === Phase 1: Race transitions (every 1 minute) ===
  console.log('[Scheduler] Starting race automation (every 1 minute)')
  cron.schedule('* * * * *', async () => {
    try {
      await processRaceTransitions()
    } catch (err) {
      console.error('[Scheduler] Error in race transition:', err)
    }
  })

  // Auto-create races every N hours
  console.log(`[Scheduler] Auto-race creation every ${config.autoRaceIntervalHours} hours`)
  cron.schedule(`0 */${config.autoRaceIntervalHours} * * *`, async () => {
    try {
      await autoCreateRace()
    } catch (err) {
      console.error('[Scheduler] Error in auto-race creation:', err)
    }
  })

  // === Phase 2: Game transitions (every 30 seconds, safety net) ===
  console.log('[Scheduler] Starting game automation (every 30 seconds, safety net)')
  cron.schedule('*/30 * * * * *', async () => {
    try {
      await processGameTransitions()
    } catch (err) {
      console.error('[Scheduler] Error in game transition:', err)
    }
  })

  // Auto-chat during lobby and betting phases (every 20 seconds)
  console.log('[Scheduler] Lobby/betting auto-chat (every 20 seconds)')
  cron.schedule('0,20,40 * * * * *', async () => {
    try {
      // Get all games in lobby or betting state
      const games = await db.query(
        "SELECT id FROM games WHERE state IN ('lobby', 'betting')"
      )
      const LOBBY_CATEGORIES = ['lobby', 'taunt', 'battle_start']
      for (const game of games.rows) {
        const cat = LOBBY_CATEGORIES[Math.floor(Math.random() * LOBBY_CATEGORIES.length)]
        await chatPoolService.triggerAutoChat(game.id, cat)
      }
    } catch (err) {
      console.error('[Scheduler] Error in auto-chat:', err)
    }
  })

  // Matchmaking queue (every 30 seconds, offset by 15s)
  console.log(`[Scheduler] Matchmaking queue processor (every ${config.queueProcessIntervalSec}s)`)
  cron.schedule('15,45 * * * * *', async () => {
    try {
      await matchmaker.processQueue()
      // Broadcast queue update after matchmaking
      if (io) {
        const qResult = await db.query('SELECT COUNT(*) AS cnt FROM battle_queue')
        io.emit('queue_update', { players_in_queue: parseInt(qResult.rows[0].cnt) })
      }
    } catch (err) {
      console.error('[Scheduler] Error in matchmaker processQueue:', err)
    }
  })

  // Games are created ONLY by matchmaker when enough agents are in queue.
  // No auto-create — removed to prevent empty scheduled games.

  // Register battle-end callback
  battleEngine.onBattleEnd(handleBattleEnd)
}

// ==========================================
// Phase 2: Game State Transitions
// ==========================================

async function processGameTransitions() {
  const now = new Date().toISOString()

  // 1. created → lobby (lobby_start reached)
  const toLobby = await db.query(
    `UPDATE games SET state = 'lobby', updated_at = now()
     WHERE state = 'created'
       AND lobby_start IS NOT NULL
       AND lobby_start <= $1
     RETURNING id, title`,
    [now]
  )
  for (const g of toLobby.rows) {
    console.log(`[Scheduler] Game '${g.title}' (${g.id}): created → lobby`)
    if (io) io.to(`game:${g.id}`).emit('game_state', { state: 'lobby' })
  }

  // 2. lobby → betting (betting_start reached, need >= 2 entries)
  const toBetting = await db.query(
    `UPDATE games SET state = 'betting', updated_at = now()
     WHERE state = 'lobby'
       AND betting_start IS NOT NULL
       AND betting_start <= $1
       AND (SELECT COUNT(*) FROM game_entries ge WHERE ge.game_id = games.id) >= 2
     RETURNING id, title`,
    [now]
  )
  for (const g of toBetting.rows) {
    console.log(`[Scheduler] Game '${g.title}' (${g.id}): lobby → betting`)
    if (io) io.to(`game:${g.id}`).emit('game_state', { state: 'betting' })
  }

  // Cancel games that didn't get enough entries by betting time
  const toCancelled = await db.query(
    `UPDATE games SET state = 'archived', updated_at = now()
     WHERE state = 'lobby'
       AND betting_start IS NOT NULL
       AND betting_start <= $1
       AND (SELECT COUNT(*) FROM game_entries ge WHERE ge.game_id = games.id) < 2
     RETURNING id, title`,
    [now]
  )
  for (const g of toCancelled.rows) {
    console.log(`[Scheduler] Game '${g.title}' (${g.id}): cancelled (< 2 entries), refunding`)
    await refundGameEntries(g.id)
  }

  // 3. betting → battle (battle_start reached) — START THE ENGINE
  const toBattle = await db.query(
    `SELECT g.*, a.grid_width, a.grid_height, a.terrain, a.spawn_points, a.max_players,
            a.slug AS arena_slug, a.name AS arena_name
     FROM games g
     JOIN arenas a ON a.id = g.arena_id
     WHERE g.state = 'betting'
       AND g.battle_start IS NOT NULL
       AND g.battle_start <= $1`,
    [now]
  )

  for (const game of toBattle.rows) {
    // Get entries with weapon info
    const entries = await db.query(
      `SELECT ge.slot, ge.agent_id, ge.initial_strategy, ge.bonus_hp, ge.bonus_damage,
              ag.personality,
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
       JOIN agents ag ON ag.id = ge.agent_id
       LEFT JOIN armors ar ON ar.id = ge.armor_id
       WHERE ge.game_id = $1
       ORDER BY ge.slot`,
      [game.id]
    )

    if (entries.rows.length < 2) {
      console.log(`[Scheduler] Game '${game.title}' (${game.id}): < 2 entries at battle time, cancelling`)
      await db.query(
        "UPDATE games SET state = 'archived', updated_at = now() WHERE id = $1",
        [game.id]
      )
      await refundGameEntries(game.id)
      continue
    }

    // Transition to battle state
    await db.query(
      "UPDATE games SET state = 'battle', updated_at = now() WHERE id = $1",
      [game.id]
    )

    // Mark entries as fighting
    await db.query(
      "UPDATE game_entries SET status = 'fighting' WHERE game_id = $1 AND status = 'joined'",
      [game.id]
    )

    console.log(`[Scheduler] Game '${game.title}' (${game.id}): betting → battle (${entries.rows.length} fighters)`)
    if (io) io.to(`game:${game.id}`).emit('game_state', { state: 'battle' })

    // Preload chat pools into memory for 0ms battle chat
    await chatPoolService.preloadPools(game.id)

    // Build arena object for battleEngine
    const arena = {
      grid_width: game.grid_width,
      grid_height: game.grid_height,
      terrain: game.terrain,
      spawn_points: game.spawn_points,
      max_players: game.max_players
    }

    battleEngine.startBattle(game, arena, entries.rows)
  }

  // 4. ended → archived (30 days)
  const toArchived = await db.query(
    `UPDATE games SET state = 'archived', updated_at = now()
     WHERE state = 'ended' AND updated_at < now() - interval '30 days'
     RETURNING id, title`
  )
  for (const g of toArchived.rows) {
    console.log(`[Scheduler] Game '${g.title}' (${g.id}): ended → archived`)
  }
}

/**
 * Handle battle end callback from battleEngine.
 */
async function handleBattleEnd(gameId, results, reason) {
  console.log(`[Scheduler] Battle ended for game ${gameId}: ${reason}, ${results.length} agents ranked`)

  // Settle game bets
  try {
    await betSettler.settle(gameId, results)
  } catch (err) {
    console.error(`[Scheduler] Bet settlement error for ${gameId}:`, err)
  }

  // Distribute sponsor returns
  try {
    await distributeSponsorship(gameId, results)
  } catch (err) {
    console.error(`[Scheduler] Sponsor distribution error for ${gameId}:`, err)
  }
}

/**
 * Distribute sponsorship returns based on final ranks.
 */
async function distributeSponsorship(gameId, results) {
  const sponsorships = await db.query(
    'SELECT user_id, slot, boost_type, cost FROM sponsorships WHERE game_id = $1',
    [gameId]
  )
  if (sponsorships.rows.length === 0) return

  // Build rank map: slot → rank
  const rankMap = {}
  for (const r of results) {
    rankMap[r.slot] = r.rank
  }

  for (const s of sponsorships.rows) {
    const rank = rankMap[s.slot]
    const multiplier = config.sponsorReturns[rank] || 0
    if (multiplier <= 0 || s.cost <= 0) continue

    const payout = Math.floor(s.cost * multiplier)
    // TODO: Credit to user wallet when claw-wallet integration is ready
    console.log(`[Scheduler] Sponsor ${s.user_id}: slot ${s.slot} rank ${rank}, payout ${payout} (${multiplier}x)`)
  }
}

/**
 * Refund entry fees for cancelled games.
 */
async function refundGameEntries(gameId) {
  const entries = await db.query(
    'SELECT agent_id, entry_fee_paid FROM game_entries WHERE game_id = $1 AND entry_fee_paid > 0',
    [gameId]
  )
  for (const entry of entries.rows) {
    await db.query(
      'UPDATE agents SET balance_cache = balance_cache + $1 WHERE id = $2',
      [entry.entry_fee_paid, entry.agent_id]
    )
  }
  // Release bet holds (no points were deducted, just mark as cancelled)
  await cancelGameBets(gameId)
}

/**
 * Cancel unsettled bets for a game (hold pattern: no refund needed, just release holds).
 */
async function cancelGameBets(gameId) {
  const result = await db.query(
    `UPDATE game_bets SET payout = 0, settled_at = now()
     WHERE game_id = $1 AND settled_at IS NULL
     RETURNING id`,
    [gameId]
  )
  if (result.rows.length > 0) {
    console.log(`[Scheduler] Released ${result.rows.length} bet holds for cancelled game ${gameId}`)
  }
}

// ==========================================
// Phase 1: Race State Transitions (legacy)
// ==========================================

async function processRaceTransitions() {
  const now = new Date().toISOString()

  // 1. scheduled → registration
  const toRegistration = await db.query(
    `UPDATE races SET state = 'registration', updated_at = now()
     WHERE state = 'scheduled'
       AND registration_start IS NOT NULL
       AND registration_start <= $1
     RETURNING id, title`,
    [now]
  )
  for (const r of toRegistration.rows) {
    console.log(`[Scheduler] Race '${r.title}' (${r.id}): scheduled → registration`)
  }

  // 2. registration → racing
  const toRacing = await db.query(
    `UPDATE races SET state = 'racing', updated_at = now()
     WHERE state = 'registration'
       AND race_start IS NOT NULL
       AND race_start <= $1
       AND (SELECT COUNT(*) FROM race_entries re WHERE re.race_id = races.id) >= 2
     RETURNING id, title`,
    [now]
  )
  for (const r of toRacing.rows) {
    console.log(`[Scheduler] Race '${r.title}' (${r.id}): registration → racing`)
    await db.query(
      `UPDATE race_entries SET status = 'racing' WHERE race_id = $1 AND status = 'registered'`,
      [r.id]
    )
  }

  // Cancel races with insufficient entries
  const toCancelled = await db.query(
    `UPDATE races SET state = 'archived', updated_at = now()
     WHERE state = 'registration'
       AND race_start IS NOT NULL
       AND race_start <= $1
       AND (SELECT COUNT(*) FROM race_entries re WHERE re.race_id = races.id) < 2
     RETURNING id, title`,
    [now]
  )
  for (const r of toCancelled.rows) {
    console.log(`[Scheduler] Race '${r.title}' (${r.id}): cancelled (< 2 entries), refunding`)
    await refundRaceEntries(r.id)
  }

  // 3. racing → scoring
  const racingRaces = await db.query(
    `SELECT r.id, r.title, r.challenge_count, r.race_start, r.time_limit_per_challenge
     FROM races r WHERE r.state = 'racing'`
  )

  for (const race of racingRaces.rows) {
    const timeLimitMs = (race.time_limit_per_challenge || 60) * race.challenge_count * 1000
    const raceStartTime = new Date(race.race_start).getTime()
    const elapsed = Date.now() - raceStartTime

    const completion = await db.query(
      `SELECT re.agent_id,
              (SELECT COUNT(*) FROM challenge_submissions cs WHERE cs.race_id = $1 AND cs.agent_id = re.agent_id) AS submitted
       FROM race_entries re WHERE re.race_id = $1`,
      [race.id]
    )

    const allComplete = completion.rows.every(e => parseInt(e.submitted) >= race.challenge_count)
    const timeUp = elapsed > timeLimitMs

    if (allComplete || timeUp) {
      console.log(`[Scheduler] Race '${race.title}' (${race.id}): racing → scoring (${allComplete ? 'all complete' : 'time up'})`)

      await db.query(
        `UPDATE races SET state = 'scoring', race_end = now(), updated_at = now() WHERE id = $1`,
        [race.id]
      )

      if (timeUp && !allComplete) {
        for (const e of completion.rows) {
          if (parseInt(e.submitted) < race.challenge_count) {
            await db.query(
              `UPDATE race_entries SET status = 'dnf' WHERE race_id = $1 AND agent_id = $2`,
              [race.id, e.agent_id]
            )
          }
        }
      }

      await processScoring(race.id)
    }
  }

  // 4. stale scoring cleanup
  const staleScoringRaces = await db.query(
    `SELECT id, title FROM races
     WHERE state = 'scoring' AND updated_at < now() - interval '5 minutes'`
  )
  for (const r of staleScoringRaces.rows) {
    console.log(`[Scheduler] Race '${r.title}' (${r.id}): stale scoring → finishing`)
    await processScoring(r.id)
  }

  // 5. finished → archived (30 days)
  const toArchived = await db.query(
    `UPDATE races SET state = 'archived', updated_at = now()
     WHERE state = 'finished' AND updated_at < now() - interval '30 days'
     RETURNING id, title`
  )
  for (const r of toArchived.rows) {
    console.log(`[Scheduler] Race '${r.title}' (${r.id}): finished → archived`)
  }
}

/**
 * Process scoring for a race.
 */
async function processScoring(raceId) {
  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    const entries = await client.query(
      `SELECT re.id, re.agent_id, re.total_score, re.status
       FROM race_entries re
       WHERE re.race_id = $1
       ORDER BY re.total_score DESC, re.created_at ASC`,
      [raceId]
    )

    const results = []
    for (let i = 0; i < entries.rows.length; i++) {
      const rank = i + 1
      const entry = entries.rows[i]

      await client.query(
        `UPDATE race_entries SET final_rank = $1, status = 'finished' WHERE id = $2`,
        [rank, entry.id]
      )

      results.push({ agent_id: entry.agent_id, rank, score: entry.total_score })
    }

    const prizes = await rewardDistributor.distribute(client, raceId, results)

    const resultsWithPrizes = results.map(r => {
      const prize = prizes.find(p => p.agent_id === r.agent_id)
      return { ...r, prize: prize ? prize.amount : 0 }
    })

    await client.query(
      `UPDATE races SET state = 'finished', results = $1, updated_at = now() WHERE id = $2`,
      [JSON.stringify(resultsWithPrizes), raceId]
    )

    const winner = results.find(r => r.rank === 1)
    const podium = results.filter(r => r.rank <= 3).map(r => r.agent_id)
    if (winner) {
      await predictionSettler.settle(client, raceId, winner.agent_id, podium)
    }

    for (const r of results) {
      await client.query(
        `UPDATE agents SET
           battles_count = battles_count + 1,
           total_score = total_score + $1,
           wins = wins + $2,
           podiums = podiums + $3,
           updated_at = now()
         WHERE id = $4`,
        [r.score, r.rank === 1 ? 1 : 0, r.rank <= 3 ? 1 : 0, r.agent_id]
      )
    }

    await client.query('COMMIT')
    console.log(`[Scheduler] Race ${raceId} scoring complete: ${results.length} entries ranked`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(`[Scheduler] Scoring failed for race ${raceId}:`, err)
  } finally {
    client.release()
  }
}

async function refundRaceEntries(raceId) {
  const entries = await db.query(
    'SELECT agent_id, entry_fee_paid FROM race_entries WHERE race_id = $1 AND entry_fee_paid > 0',
    [raceId]
  )
  for (const entry of entries.rows) {
    await db.query(
      'UPDATE agents SET balance_cache = balance_cache + $1 WHERE id = $2',
      [entry.entry_fee_paid, entry.agent_id]
    )
  }
}

async function autoCreateRace() {
  const now = new Date()
  const regStart = new Date(now.getTime() + 5 * 60000)
  const raceStart = new Date(now.getTime() + config.registrationDurationMin * 60000)

  const title = `Race #${Date.now().toString(36).toUpperCase()}`

  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    const raceResult = await client.query(
      `INSERT INTO races (title, track_type, state, entry_fee, max_entries, challenge_count,
                          registration_start, race_start)
       VALUES ($1, 'trivia', 'scheduled', 0, $2, $3, $4, $5)
       RETURNING id, title`,
      [title, config.defaultMaxEntries, config.defaultChallengeCount, regStart.toISOString(), raceStart.toISOString()]
    )

    const race = raceResult.rows[0]

    const questions = await questionBank.selectQuestions(client, 'trivia', config.defaultChallengeCount)
    for (let i = 0; i < questions.length; i++) {
      await client.query(
        `INSERT INTO race_challenges (race_id, seq, challenge_type, question, answer, max_score, time_limit_sec)
         VALUES ($1, $2, 'trivia', $3, $4, 100, $5)`,
        [race.id, i + 1, JSON.stringify(questions[i].question), JSON.stringify(questions[i].answer), config.defaultTimeLimitSec]
      )
    }

    await client.query('COMMIT')
    console.log(`[Scheduler] Auto-created race '${race.title}' (${race.id})`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[Scheduler] Auto-race creation failed:', err)
  } finally {
    client.release()
  }
}

/**
 * Clean up games from previous server lifecycle on restart.
 * - battle state with no in-memory state → ended
 * - lobby/betting/created → cancelled (no live server to process them)
 */
async function recoverStuckBattles() {
  // 1. Battle games with no in-memory state → ended
  const battles = await db.query("SELECT id, title FROM games WHERE state = 'battle'")
  for (const row of battles.rows) {
    if (!gameStateManager.getState(row.id)) {
      await db.query("UPDATE games SET state = 'ended', updated_at = now() WHERE id = $1", [row.id])
      await db.query(
        "UPDATE game_entries SET status = 'eliminated' WHERE game_id = $1 AND status = 'fighting'",
        [row.id]
      )
      await cancelGameBets(row.id)
      console.log(`[Scheduler] Recovered stuck battle: ${row.title} (${row.id})`)
    }
  }

  // 2. Lobby/betting/created games → cancelled (server restarted, these can't proceed)
  const stale = await db.query(
    "SELECT id, title, state FROM games WHERE state IN ('created', 'lobby', 'betting')"
  )
  for (const row of stale.rows) {
    await db.query("UPDATE games SET state = 'cancelled', updated_at = now() WHERE id = $1", [row.id])
    await refundGameEntries(row.id)
    console.log(`[Scheduler] Cancelled stale ${row.state} game on restart: ${row.title} (${row.id})`)
  }

  // 3. Clear battle queue (stale entries from previous lifecycle)
  const cleared = await db.query('DELETE FROM battle_queue RETURNING id')
  if (cleared.rows.length > 0) {
    console.log(`[Scheduler] Cleared ${cleared.rows.length} stale queue entries on restart`)
  }

  const total = battles.rows.length + stale.rows.length
  if (total > 0) {
    console.log(`[Scheduler] Startup cleanup: ${battles.rows.length} battles, ${stale.rows.length} lobby/betting/created games processed`)
  }
}

module.exports = { startScheduler, processRaceTransitions, processGameTransitions }
