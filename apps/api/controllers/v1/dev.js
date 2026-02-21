const db = require('../../db')
const config = require('../../config')
const { generateAgentToken, hashToken } = require('../../utils/token')

const BOT_NAMES = [
  'Alpha Crab', 'Beta Crab', 'Gamma Crab', 'Delta Crab',
  'Epsilon Crab', 'Zeta Crab', 'Eta Crab', 'Theta Crab'
]

const PERSONALITIES = ['aggressive', 'confident', 'friendly', 'cautious', 'troll']

const STRATEGIES = [
  { mode: 'aggressive', target_priority: 'lowest_hp', flee_threshold: 10 },
  { mode: 'balanced', target_priority: 'nearest', flee_threshold: 20 },
  { mode: 'aggressive', target_priority: 'nearest', flee_threshold: 15 },
  { mode: 'aggressive', target_priority: 'random', flee_threshold: 5 },
  { mode: 'balanced', target_priority: 'highest_hp', flee_threshold: 20 },
  { mode: 'aggressive', target_priority: 'lowest_hp', flee_threshold: 10 },
  { mode: 'balanced', target_priority: 'nearest', flee_threshold: 15 },
  { mode: 'aggressive', target_priority: 'random', flee_threshold: 10 }
]

/**
 * POST /api/v1/dev/test-game?bots=8&fast=true
 *
 * Creates a test game with N bots instantly in lobby state.
 * fast=true: lobby 15s, betting 10s (battle in ~25s)
 * fast=false: uses normal config timers
 *
 * Only available when NODE_ENV !== 'production'.
 */
async function testGame(req, res, next) {
  try {
    const botCount = Math.min(Math.max(parseInt(req.query.bots) || 8, 2), 8)
    const fast = req.query.fast === 'true'

    // 1. Get or create test bots
    const botIds = []
    for (let i = 0; i < botCount; i++) {
      const name = BOT_NAMES[i]
      const existing = await db.query('SELECT id FROM agents WHERE name = $1', [name])

      if (existing.rows.length > 0) {
        botIds.push(existing.rows[0].id)
      } else {
        const token = generateAgentToken()
        const result = await db.query(
          `INSERT INTO agents (name, api_token, is_active, personality, meta)
           VALUES ($1, $2, true, $3, $4)
           RETURNING id`,
          [name, hashToken(token), PERSONALITIES[i % PERSONALITIES.length],
           JSON.stringify({ model_name: 'test-bot', description: `Test bot ${i}` })]
        )
        botIds.push(result.rows[0].id)
      }
    }

    // 2. Ensure bots aren't in active games
    for (const botId of botIds) {
      await db.query(
        `DELETE FROM game_entries WHERE agent_id = $1
         AND game_id IN (SELECT id FROM games WHERE state IN ('lobby', 'betting'))`,
        [botId]
      )
      await db.query('DELETE FROM battle_queue WHERE agent_id = $1', [botId])
    }

    // 3. Get arena and weapons
    const arena = await db.query(
      "SELECT * FROM arenas WHERE is_active = true ORDER BY slug = 'the_pit' DESC LIMIT 1"
    )
    if (arena.rows.length === 0) {
      return res.status(500).json({ error: 'No active arena' })
    }

    const weapons = await db.query('SELECT id, slug FROM weapons WHERE is_active = true')
    if (weapons.rows.length === 0) {
      return res.status(500).json({ error: 'No active weapons' })
    }

    // 4. Create game
    const now = Date.now()
    const lobbyMs = fast ? 15000 : config.lobbyDurationMin * 60000
    const bettingMs = fast ? 10000 : config.bettingDurationSec * 1000

    const lobbyStart = new Date(now).toISOString()
    const bettingStart = new Date(now + lobbyMs).toISOString()
    const battleStart = new Date(now + lobbyMs + bettingMs).toISOString()

    const title = `Test Battle #${Date.now().toString(36).toUpperCase()}`

    const gameResult = await db.query(
      `INSERT INTO games (title, arena_id, state, max_entries, entry_fee, max_ticks,
                          lobby_start, betting_start, battle_start, source)
       VALUES ($1, $2, 'lobby', $3, 0, $4, $5, $6, $7, 'admin')
       RETURNING id`,
      [title, arena.rows[0].id, arena.rows[0].max_players, config.defaultMaxTicks,
       lobbyStart, bettingStart, battleStart]
    )
    const gameId = gameResult.rows[0].id

    // 5. Assign bots to slots with varied weapons
    for (let i = 0; i < botIds.length; i++) {
      const weaponId = weapons.rows[i % weapons.rows.length].id
      const strategy = STRATEGIES[i % STRATEGIES.length]

      await db.query(
        `INSERT INTO game_entries (game_id, agent_id, slot, weapon_id, initial_strategy)
         VALUES ($1, $2, $3, $4, $5)`,
        [gameId, botIds[i], i, weaponId, JSON.stringify(strategy)]
      )
    }

    // 6. System chat
    await db.query(
      `INSERT INTO game_chat (game_id, msg_type, message)
       VALUES ($1, 'system', $2)`,
      [gameId, `Test battle: ${botCount} bots ready to fight!`]
    )

    // 6.5. Lobby full → fast-forward to betting in 30s
    if (botCount >= arena.rows[0].max_players) {
      const nowMs = Date.now()
      const currentBettingMs = new Date(bettingStart).getTime()
      const remaining = currentBettingMs - nowMs
      const fastMs = Math.min(remaining, 30000)
      if (fastMs < remaining) {
        const newBettingStart = new Date(nowMs + fastMs).toISOString()
        const bettingDuration = new Date(battleStart).getTime() - currentBettingMs
        const newBattleStart = new Date(nowMs + fastMs + bettingDuration).toISOString()
        await db.query(
          'UPDATE games SET betting_start = $1, battle_start = $2, updated_at = now() WHERE id = $3',
          [newBettingStart, newBattleStart, gameId]
        )
        console.log(`[Dev] Lobby full, fast-forwarding to betting in ${Math.round(fastMs / 1000)}s`)
        const io = req.app.get('io')
        if (io) io.to(`game:${gameId}`).emit('lobby_full', {
          betting_start: newBettingStart,
          battle_start: newBattleStart
        })
        // Override for transition scheduling
        var effectiveBettingStart = newBettingStart
        var effectiveBattleStart = newBattleStart
      }
    }

    // 7. Schedule precise transitions
    const bettingDelay = new Date(effectiveBettingStart || bettingStart).getTime() - Date.now()
    const battleDelay = new Date(effectiveBattleStart || battleStart).getTime() - Date.now()

    setTimeout(() => {
      const { processGameTransitions } = require('../../services/scheduler')
      processGameTransitions().catch(err =>
        console.error('[Dev] Betting transition failed:', err)
      )
    }, bettingDelay + 500)

    setTimeout(() => {
      const { processGameTransitions } = require('../../services/scheduler')
      processGameTransitions().catch(err =>
        console.error('[Dev] Battle transition failed:', err)
      )
    }, battleDelay + 500)

    // 8. Notify FE
    const io = req.app.get('io')
    if (io) {
      io.emit('game_created', { game_id: gameId, title })
    }

    console.log(`[Dev] Test game '${title}' (${gameId}): ${botCount} bots, fast=${fast}`)

    res.status(201).json({
      game_id: gameId,
      title,
      bots: botCount,
      fast,
      lobby_sec: lobbyMs / 1000,
      betting_sec: bettingMs / 1000,
      battle_start: battleStart,
      url: `/game/${gameId}`
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { testGame }
