const db = require('../../db')
const { parsePagination, formatPaginatedResponse } = require('../../utils/pagination')

/**
 * GET /api/v1/leaderboard - Agent leaderboard (public)
 */
async function agents(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query)

    const countResult = await db.query(
      'SELECT COUNT(*) AS total FROM agents WHERE is_active AND battles_count > 0'
    )
    const total = parseInt(countResult.rows[0].total, 10)

    const result = await db.query(
      `SELECT id, name, wins, podiums, battles_count, total_score, meta, created_at,
              CASE WHEN battles_count > 0 THEN ROUND(wins::numeric / battles_count * 100, 1) ELSE 0 END AS win_rate
       FROM agents
       WHERE is_active AND battles_count > 0
       ORDER BY wins DESC, total_score DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )

    res.json(formatPaginatedResponse(result.rows, total, page, limit))
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/leaderboard/predictors - Predictor leaderboard (public)
 */
async function predictors(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query)

    const countResult = await db.query(
      `SELECT COUNT(DISTINCT user_id) AS total FROM predictions WHERE user_id IS NOT NULL AND settled_at IS NOT NULL`
    )
    const total = parseInt(countResult.rows[0].total, 10)

    const result = await db.query(
      `SELECT u.id, u.display_name,
              COUNT(*) AS total_predictions,
              COUNT(*) FILTER (WHERE p.is_correct) AS correct_predictions,
              COALESCE(SUM(p.payout), 0) AS total_winnings,
              ROUND(COUNT(*) FILTER (WHERE p.is_correct)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS accuracy
       FROM predictions p
       JOIN users u ON u.id = p.user_id
       WHERE p.settled_at IS NOT NULL
       GROUP BY u.id, u.display_name
       ORDER BY total_winnings DESC, accuracy DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )

    res.json(formatPaginatedResponse(result.rows, total, page, limit))
  } catch (err) {
    next(err)
  }
}

module.exports = { agents, predictors }
