const db = require('../db')
const config = require('../config')

/**
 * Settle game bets after battle ends.
 * Winners who bet on the 1st-place slot share the pool proportionally.
 * House edge is deducted before distribution.
 *
 * @param {string} gameId - Game UUID
 * @param {Array} results - Battle results [{ slot, rank, ... }]
 */
async function settle(gameId, results) {
  // Find the winning slot (rank 1)
  const winner = results.find(r => r.rank === 1)
  if (!winner) {
    console.log(`[BetSettler] Game ${gameId}: No rank-1 winner found, skipping settlement`)
    return
  }

  const winnerSlot = winner.slot

  // Get all unsettled bets for this game
  const betsResult = await db.query(
    'SELECT id, user_id, slot, amount FROM game_bets WHERE game_id = $1 AND settled_at IS NULL',
    [gameId]
  )

  const bets = betsResult.rows
  if (bets.length === 0) {
    console.log(`[BetSettler] Game ${gameId}: No bets to settle`)
    return
  }

  // Separate registered user bets from guest bets
  const userBets = bets.filter(b => b.user_id != null)
  const guestBets = bets.filter(b => b.user_id == null)

  const totalPool = userBets.reduce((sum, b) => sum + parseInt(b.amount), 0)
  const houseEdge = config.betHouseEdge
  const winPool = Math.floor(totalPool * (1 - houseEdge))

  // Registered user winners
  const winners = userBets.filter(b => b.slot === winnerSlot)
  const winnerStakeTotal = winners.reduce((sum, b) => sum + parseInt(b.amount), 0)

  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    // Settle registered user bets (hold pattern: deduct bet + credit payout at settlement)
    // Aggregate net change per user to minimize UPDATE queries
    const userNetMap = {}  // userId → net points change
    for (const bet of userBets) {
      const isWinner = bet.slot === winnerSlot
      const betAmount = parseInt(bet.amount)
      let payout = 0

      if (isWinner && winnerStakeTotal > 0) {
        payout = Math.floor((betAmount / winnerStakeTotal) * winPool)
      }

      await client.query(
        'UPDATE game_bets SET payout = $1, settled_at = now() WHERE id = $2',
        [payout, bet.id]
      )

      // Net = payout - betAmount (negative for losers, positive for big winners)
      if (!userNetMap[bet.user_id]) userNetMap[bet.user_id] = 0
      userNetMap[bet.user_id] += payout - betAmount
    }

    // Apply net point changes per user
    for (const [userId, net] of Object.entries(userNetMap)) {
      if (net !== 0) {
        await client.query(
          'UPDATE users SET points = points + $1 WHERE id = $2',
          [net, userId]
        )
      }
    }

    // Settle guest bets (flat 2 pts per correct pick, record-only)
    if (guestBets.length > 0) {
      const guestWinners = guestBets.filter(b => b.slot === winnerSlot)
      const guestLosers = guestBets.filter(b => b.slot !== winnerSlot)

      if (guestWinners.length > 0) {
        const guestWinIds = guestWinners.map(b => b.id)
        await client.query(
          `UPDATE game_bets SET payout = 2, settled_at = now() WHERE id = ANY($1)`,
          [guestWinIds]
        )
      }
      if (guestLosers.length > 0) {
        const guestLoseIds = guestLosers.map(b => b.id)
        await client.query(
          `UPDATE game_bets SET payout = 0, settled_at = now() WHERE id = ANY($1)`,
          [guestLoseIds]
        )
      }
    }

    await client.query('COMMIT')

    const guestWinCount = guestBets.filter(b => b.slot === winnerSlot).length
    console.log(`[BetSettler] Game ${gameId}: Settled ${bets.length} bets (${userBets.length} user, ${guestBets.length} guest). Pool=${totalPool}, WinPool=${winPool}, Winners=${winners.length}, GuestWins=${guestWinCount}, WinnerSlot=${winnerSlot}`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(`[BetSettler] Game ${gameId}: Settlement error:`, err)
  } finally {
    client.release()
  }
}

module.exports = { settle }
