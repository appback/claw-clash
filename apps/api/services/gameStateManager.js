/**
 * In-Memory Game State Manager
 * Holds active battle state for low-latency tick processing.
 * Accumulates tick snapshots and flushes to DB in batches.
 */

const db = require('../db')
const config = require('../config')

// gameId → { state: gameState, tickBuffer: tickSnapshot[], tick: number }
const activeGames = new Map()

module.exports = {
  /**
   * Initialize a game with full state (agents, arena, etc).
   */
  initGame(gameId, state) {
    activeGames.set(gameId, {
      state,
      tickBuffer: [],
      tick: 0
    })
  },

  /**
   * Get full game state (agents are mutated in place by battleEngine).
   */
  getState(gameId) {
    const entry = activeGames.get(gameId)
    return entry ? entry.state : null
  },

  /**
   * Record a tick snapshot for replay.
   */
  updateTick(gameId, tickSnapshot) {
    const entry = activeGames.get(gameId)
    if (!entry) return
    entry.tick = tickSnapshot.tick
    entry.tickBuffer.push(tickSnapshot)
  },

  /**
   * Check if tick buffer should be flushed to DB.
   */
  shouldFlush(gameId) {
    const entry = activeGames.get(gameId)
    if (!entry) return false
    return entry.tickBuffer.length >= (config.batchFlushInterval || 10)
  },

  /**
   * Flush tick buffer to battle_ticks table.
   */
  async flushTicks(gameId) {
    const entry = activeGames.get(gameId)
    if (!entry || entry.tickBuffer.length === 0) return

    const ticks = entry.tickBuffer.splice(0)
    const values = []
    const params = []
    let idx = 1

    for (const t of ticks) {
      values.push(`($${idx++}, $${idx++}, $${idx++})`)
      params.push(gameId, t.tick, JSON.stringify(t))
    }

    await db.query(
      `INSERT INTO battle_ticks (game_id, tick, state) VALUES ${values.join(',')}
       ON CONFLICT (game_id, tick) DO NOTHING`,
      params
    )
  },

  /**
   * End game: flush remaining ticks, return final state, clean up memory.
   */
  async endGame(gameId) {
    const entry = activeGames.get(gameId)
    if (!entry) return null

    // Flush remaining ticks
    if (entry.tickBuffer.length > 0) {
      await this.flushTicks(gameId)
    }

    const finalState = entry.state
    activeGames.delete(gameId)
    return finalState
  },

  activeCount() {
    return activeGames.size
  },

  activeGameIds() {
    return [...activeGames.keys()]
  }
}
