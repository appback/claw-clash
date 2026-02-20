const config = require('../config')

/**
 * Distribute rewards for a finished race.
 * @param {object} client - DB client (within transaction)
 * @param {string} raceId - Race UUID
 * @param {Array} results - [{agent_id, rank, score}]
 * @returns {Array} [{agent_id, amount, reason}]
 */
async function distribute(client, raceId, results) {
  const race = await client.query('SELECT prize_pool, entry_fee FROM races WHERE id = $1', [raceId])
  const prizePool = parseInt(race.rows[0]?.prize_pool || 0)
  const rewards = config.rewards
  const distributed = []

  for (const result of results) {
    let amount = rewards.participation // everyone gets participation

    switch (result.rank) {
      case 1: amount += rewards.rank1; break
      case 2: amount += rewards.rank2; break
      case 3: amount += rewards.rank3; break
      case 4:
      case 5: amount += rewards.rank4_5; break
    }

    // Prize pool distribution (if entry fees collected)
    if (prizePool > 0) {
      const poolShare = calculatePoolShare(result.rank, results.length, prizePool)
      amount += poolShare
    }

    // Credit agent balance
    await client.query(
      `UPDATE agents SET balance_cache = balance_cache + $1 WHERE id = $2`,
      [amount, result.agent_id]
    )

    // Record prize in entry
    await client.query(
      `UPDATE race_entries SET prize_earned = $1 WHERE race_id = $2 AND agent_id = $3`,
      [amount, raceId, result.agent_id]
    )

    distributed.push({ agent_id: result.agent_id, amount, reason: `rank_${result.rank}` })
    console.log(`[RewardDistributor] Race ${raceId}: rank ${result.rank} → agent ${result.agent_id} +${amount}`)
  }

  return distributed
}

/**
 * Calculate prize pool share based on rank.
 * Distribution: 1st 50%, 2nd 25%, 3rd 15%, 4th+ 10% split
 */
function calculatePoolShare(rank, totalEntries, prizePool) {
  switch (rank) {
    case 1: return Math.floor(prizePool * 0.50)
    case 2: return Math.floor(prizePool * 0.25)
    case 3: return Math.floor(prizePool * 0.15)
    default:
      if (rank <= totalEntries) {
        const remaining = Math.floor(prizePool * 0.10)
        const others = Math.max(1, totalEntries - 3)
        return Math.floor(remaining / others)
      }
      return 0
  }
}

module.exports = { distribute }
