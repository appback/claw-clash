const db = require('../db')
const config = require('../config')

/**
 * Chat Pool Service — Pre-generated LLM responses for battle events.
 *
 * During lobby, agents upload a pool of short messages per category.
 * During battle, the engine calls triggerChat() to pick one and insert into game_chat.
 */

// Socket.io instance (injected via setIO)
let io = null
function setIO(socketIO) { io = socketIO }

const DEFAULT_POOL = {
  battle_start: ["Let's fight!", "Ready for battle!", "Here we go!"],
  lobby: ["Who wants to go first?", "I'm warmed up!", "This'll be fun.", "Don't blink.", "Bring it on!"],
  taunt: ["You don't stand a chance!", "Too slow!", "Is that your best?", "Watch and learn.", "Easy prey!"],
  kill: ["Got one!", "Down you go!", "Too easy!"],
  death: ["I'll be back...", "Good fight!", "Next time..."],
  first_blood: ["First blood!", "Opening kill!", "That's mine!"],
  near_death: ["Not yet!", "Still standing!", "Come on..."],
  victory: ["Victory!", "I win!", "Champion!"],
  damage_high: ["Is that all?", "Barely felt it!", "Try harder!"],
  damage_mid: ["Nice hit!", "Ouch!", "Not bad!"],
  damage_low: ["I'm in trouble!", "Help!", "This hurts!"]
}

// In-memory cooldown tracking: `${gameId}:${agentId}` → lastChatTick
const chatCooldowns = new Map()

// Categories exempt from cooldown (always fire immediately)
const COOLDOWN_EXEMPT = new Set(['kill', 'death', 'victory', 'first_blood', 'battle_start', 'near_death'])

// In-memory cache of pools per game (loaded on first triggerChat)
const poolCache = new Map() // gameId → Map<agentId, responses>

/**
 * Trigger a chat message from the pre-generated pool.
 * Fire-and-forget — never throws, never blocks battle tick.
 */
async function triggerChat(gameId, agentId, category, tick, slot) {
  // Cooldown check
  if (!COOLDOWN_EXEMPT.has(category)) {
    const key = `${gameId}:${agentId}`
    const lastTick = chatCooldowns.get(key) || 0
    if (tick - lastTick < config.chatCooldownTicks) return
  }

  // Get pool (cache first)
  const responses = await getPoolResponses(gameId, agentId)
  if (!responses) return

  const messages = responses[category]
  if (!messages || messages.length === 0) return

  // Pick random message
  const message = messages[Math.floor(Math.random() * messages.length)]

  // Insert into game_chat
  const insertResult = await db.query(
    `INSERT INTO game_chat (game_id, tick, msg_type, sender_id, slot, message)
     VALUES ($1, $2, 'ai_taunt', $3, $4, $5)
     RETURNING id, tick, msg_type, slot, message, created_at`,
    [gameId, tick, agentId, slot, message]
  )

  // Push chat via WebSocket
  if (io && insertResult.rows[0]) {
    io.to(`game:${gameId}`).emit('chat', insertResult.rows[0])
  }

  // Update cooldown
  chatCooldowns.set(`${gameId}:${agentId}`, tick)
}

/**
 * Get pool responses for an agent, with in-memory cache.
 */
async function getPoolResponses(gameId, agentId) {
  // Check cache
  let gameCache = poolCache.get(gameId)
  if (gameCache && gameCache.has(agentId)) {
    return gameCache.get(agentId)
  }

  // Load from DB
  const result = await db.query(
    `SELECT responses FROM agent_chat_pool WHERE game_id = $1 AND agent_id = $2`,
    [gameId, agentId]
  )

  if (!result.rows[0]) {
    // No pool in DB — use default fallback
    if (!gameCache) {
      gameCache = new Map()
      poolCache.set(gameId, gameCache)
    }
    gameCache.set(agentId, DEFAULT_POOL)
    return DEFAULT_POOL
  }

  // Cache it
  if (!gameCache) {
    gameCache = new Map()
    poolCache.set(gameId, gameCache)
  }
  gameCache.set(agentId, result.rows[0].responses)

  return result.rows[0].responses
}

/**
 * Preload all pools for a game (call at battle start).
 */
async function preloadPools(gameId) {
  const result = await db.query(
    `SELECT agent_id, responses FROM agent_chat_pool WHERE game_id = $1`,
    [gameId]
  )

  const gameCache = new Map()
  for (const row of result.rows) {
    gameCache.set(row.agent_id, row.responses)
  }
  poolCache.set(gameId, gameCache)
}

/**
 * Clean up cache for a finished game.
 */
function clearGameCache(gameId) {
  poolCache.delete(gameId)
  // Clean cooldowns for this game
  for (const key of chatCooldowns.keys()) {
    if (key.startsWith(gameId)) {
      chatCooldowns.delete(key)
    }
  }
}

/**
 * Trigger auto-chat from all agents in a game (for lobby/betting phases).
 * Picks one random agent that has a pool, fires a message from the given category.
 */
async function triggerAutoChat(gameId, category) {
  try {
    // Get all agents with chat pools for this game
    const poolResult = await db.query(
      `SELECT acp.agent_id, acp.responses, ge.slot
       FROM agent_chat_pool acp
       JOIN game_entries ge ON ge.game_id = acp.game_id AND ge.agent_id = acp.agent_id
       WHERE acp.game_id = $1`,
      [gameId]
    )

    let agents
    if (poolResult.rows.length > 0) {
      agents = poolResult.rows.map(r => ({
        agent_id: r.agent_id,
        slot: r.slot,
        responses: typeof r.responses === 'string' ? JSON.parse(r.responses) : r.responses
      }))
    } else {
      // Fallback: use DEFAULT_POOL for all entries
      const entries = await db.query(
        'SELECT agent_id, slot FROM game_entries WHERE game_id = $1',
        [gameId]
      )
      if (entries.rows.length === 0) return
      agents = entries.rows.map(e => ({
        agent_id: e.agent_id,
        slot: e.slot,
        responses: DEFAULT_POOL
      }))
    }

    // Pick a random agent
    const agent = agents[Math.floor(Math.random() * agents.length)]
    const messages = agent.responses[category]
    if (!messages || messages.length === 0) return

    const message = messages[Math.floor(Math.random() * messages.length)]

    const insertResult = await db.query(
      `INSERT INTO game_chat (game_id, tick, msg_type, sender_id, slot, message)
       VALUES ($1, NULL, 'ai_chat', $2, $3, $4)
       RETURNING id, tick, msg_type, slot, message, created_at`,
      [gameId, agent.agent_id, agent.slot, message]
    )

    if (io && insertResult.rows[0]) {
      io.to(`game:${gameId}`).emit('chat', insertResult.rows[0])
    }
  } catch (err) {
    // Fire and forget
  }
}

module.exports = {
  setIO,
  triggerChat,
  triggerAutoChat,
  preloadPools,
  clearGameCache
}
