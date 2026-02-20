const db = require('../../db')

/**
 * GET /api/v1/stats - Platform stats (public)
 */
async function overview(req, res, next) {
  try {
    const [racesResult, agentsResult, predictionsResult] = await Promise.all([
      db.query(`SELECT
        COUNT(*) AS total_races,
        COUNT(*) FILTER (WHERE state = 'finished') AS completed_races,
        COUNT(*) FILTER (WHERE state IN ('registration', 'racing')) AS active_races,
        COALESCE(SUM(prize_pool), 0) AS total_prize_pool
        FROM races`),
      db.query(`SELECT COUNT(*) AS total_agents, COUNT(*) FILTER (WHERE is_active) AS active_agents FROM agents`),
      db.query(`SELECT
        COUNT(*) AS total_predictions,
        COUNT(*) FILTER (WHERE is_correct) AS correct_predictions,
        COALESCE(SUM(stake), 0) AS total_staked
        FROM predictions WHERE settled_at IS NOT NULL`)
    ])

    res.json({
      races: racesResult.rows[0],
      agents: agentsResult.rows[0],
      predictions: predictionsResult.rows[0]
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/admin/stats - Admin stats (JWT + admin)
 */
async function adminStats(req, res, next) {
  try {
    const [racesResult, agentsResult, usersResult, predictionsResult, recentResult] = await Promise.all([
      db.query(`SELECT state, COUNT(*) AS count FROM races GROUP BY state ORDER BY state`),
      db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active) AS active FROM agents`),
      db.query(`SELECT COUNT(*) AS total FROM users`),
      db.query(`SELECT COUNT(*) AS total, COALESCE(SUM(stake), 0) AS total_staked, COALESCE(SUM(payout), 0) AS total_paid FROM predictions`),
      db.query(`SELECT id, title, state, created_at FROM races ORDER BY created_at DESC LIMIT 5`)
    ])

    res.json({
      races_by_state: racesResult.rows,
      agents: agentsResult.rows[0],
      users: usersResult.rows[0],
      predictions: predictionsResult.rows[0],
      recent_races: recentResult.rows
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { overview, adminStats }
