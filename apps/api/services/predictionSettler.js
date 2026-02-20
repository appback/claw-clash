const config = require('../config')

/**
 * Settle predictions for a finished race.
 * @param {object} client - DB client (within transaction)
 * @param {string} raceId - Race UUID
 * @param {string} winnerId - Winning agent UUID
 * @param {string[]} podiumIds - Podium agent UUIDs (top 3)
 */
async function settle(client, raceId, winnerId, podiumIds) {
  // Get all unsettled predictions for this race
  const predictions = await client.query(
    `SELECT id, user_id, prediction_type, predicted_agent_id, stake
     FROM predictions
     WHERE race_id = $1 AND settled_at IS NULL`,
    [raceId]
  )

  if (predictions.rows.length === 0) return

  // Calculate total stake pool
  const totalStake = predictions.rows.reduce((sum, p) => sum + parseInt(p.stake || 0), 0)
  const houseEdge = config.houseEdge
  const winPool = Math.floor(totalStake * (1 - houseEdge))

  // Determine winners
  const winners = []
  const losers = []

  for (const pred of predictions.rows) {
    let isCorrect = false

    switch (pred.prediction_type) {
      case 'win':
        isCorrect = pred.predicted_agent_id === winnerId
        break
      case 'podium':
        isCorrect = podiumIds.includes(pred.predicted_agent_id)
        break
      case 'head_to_head':
        isCorrect = pred.predicted_agent_id === winnerId
        break
    }

    if (isCorrect) {
      winners.push(pred)
    } else {
      losers.push(pred)
    }
  }

  // Calculate payouts
  const winnerTotalStake = winners.reduce((sum, p) => sum + parseInt(p.stake || 0), 0)

  for (const pred of predictions.rows) {
    const isCorrect = winners.some(w => w.id === pred.id)
    let payout = 0

    if (isCorrect && parseInt(pred.stake) > 0 && winnerTotalStake > 0) {
      // Proportional payout from win pool
      payout = Math.floor((parseInt(pred.stake) / winnerTotalStake) * winPool)
    } else if (isCorrect && parseInt(pred.stake) === 0) {
      // Free prediction - just mark correct, no payout
      payout = 0
    }

    await client.query(
      `UPDATE predictions SET is_correct = $1, payout = $2, settled_at = now() WHERE id = $3`,
      [isCorrect, payout, pred.id]
    )

    // Credit user if they won staked prediction
    if (payout > 0 && pred.user_id) {
      // For now, just log it. claw-wallet integration comes in Phase 3.
      console.log(`[PredictionSettler] User ${pred.user_id} won ${payout} on race ${raceId}`)
    }
  }

  console.log(`[PredictionSettler] Race ${raceId}: ${winners.length} correct, ${losers.length} incorrect, pool ${winPool}`)
}

module.exports = { settle }
