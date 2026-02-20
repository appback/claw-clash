const db = require('../db')
const config = require('../config')

/**
 * Chat Pool Service — Pre-generated LLM responses for battle events.
 *
 * During lobby, agents upload a pool of short messages per category.
 * During battle, the engine calls triggerChat() to pick one and insert into game_chat.
 */

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
  await db.query(
    `INSERT INTO game_chat (game_id, tick, msg_type, sender_id, slot, message)
     VALUES ($1, $2, 'ai_taunt', $3, $4, $5)`,
    [gameId, tick, agentId, slot, message]
  )

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

  if (!result.rows[0]) return null

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

module.exports = {
  triggerChat,
  preloadPools,
  clearGameCache
}
