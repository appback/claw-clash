const db = require('../../db')
const { parsePagination, formatPaginatedResponse } = require('../../utils/pagination')
const { ValidationError, NotFoundError } = require('../../utils/errors')

/**
 * GET /api/v1/users/me - Profile with stats
 */
async function getProfile(req, res, next) {
  try {
    const userId = req.user.userId

    const userResult = await db.query(
      `SELECT id, email, display_name, role, points, hub_user_id, created_at
       FROM users WHERE id = $1`,
      [userId]
    )
    if (userResult.rows.length === 0) throw new NotFoundError('User not found')

    const user = userResult.rows[0]

    const statsResult = await db.query(
      `SELECT
         COALESCE(COUNT(gb.id), 0) AS bets_count,
         COALESCE(COUNT(gb.id) FILTER (WHERE gb.payout > 0), 0) AS bets_won,
         COALESCE(SUM(gb.amount), 0) AS total_wagered,
         COALESCE(SUM(gb.payout), 0) AS total_payout,
         (SELECT COUNT(*) FROM sponsorships s WHERE s.user_id = $1) AS sponsors_count
       FROM game_bets gb
       WHERE gb.user_id = $1`,
      [userId]
    )

    const stats = statsResult.rows[0]

    res.json({
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      points: parseInt(user.points),
      hub_connected: !!user.hub_user_id,
      created_at: user.created_at,
      stats: {
        bets_count: parseInt(stats.bets_count),
        bets_won: parseInt(stats.bets_won),
        total_wagered: parseInt(stats.total_wagered),
        total_payout: parseInt(stats.total_payout),
        sponsors_count: parseInt(stats.sponsors_count)
      }
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/v1/users/me/profile - Update display name
 */
async function updateProfile(req, res, next) {
  try {
    const userId = req.user.userId
    const { display_name } = req.body

    if (display_name === undefined) {
      throw new ValidationError('display_name is required')
    }

    const trimmed = String(display_name).trim()
    if (trimmed.length < 2 || trimmed.length > 20) {
      throw new ValidationError('display_name must be 2-20 characters')
    }

    const result = await db.query(
      `UPDATE users SET display_name = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, email, display_name, role, points`,
      [trimmed, userId]
    )
    if (result.rows.length === 0) throw new NotFoundError('User not found')

    const user = result.rows[0]

    // Update localStorage-compatible response
    res.json({
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      points: parseInt(user.points)
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/users/me/bets - Bet history with pagination
 */
async function getBetHistory(req, res, next) {
  try {
    const userId = req.user.userId
    const { page, limit, offset } = parsePagination(req.query)

    const countResult = await db.query(
      'SELECT COUNT(*) AS total FROM game_bets WHERE user_id = $1',
      [userId]
    )
    const total = parseInt(countResult.rows[0].total, 10)

    const result = await db.query(
      `SELECT gb.id, gb.game_id, g.title AS game_title, gb.slot, gb.amount,
              gb.payout, gb.settled_at, gb.created_at,
              CASE WHEN gb.settled_at IS NULL THEN 'pending'
                   WHEN gb.payout > 0 THEN 'won'
                   ELSE 'lost' END AS result
       FROM game_bets gb
       JOIN games g ON g.id = gb.game_id
       WHERE gb.user_id = $1
       ORDER BY gb.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    )

    res.json(formatPaginatedResponse(result.rows, total, page, limit))
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/users/me/sponsors - Sponsorship history with pagination
 */
async function getSponsorHistory(req, res, next) {
  try {
    const userId = req.user.userId
    const { page, limit, offset } = parsePagination(req.query)

    const countResult = await db.query(
      'SELECT COUNT(*) AS total FROM sponsorships WHERE user_id = $1',
      [userId]
    )
    const total = parseInt(countResult.rows[0].total, 10)

    const result = await db.query(
      `SELECT s.id, s.game_id, g.title AS game_title, s.slot, s.boost_type,
              s.cost, s.effect_value, s.payout, s.created_at,
              CASE WHEN g.state IN ('ended', 'archived') AND s.payout > 0 THEN 'won'
                   WHEN g.state IN ('ended', 'archived') THEN 'lost'
                   ELSE 'pending' END AS result
       FROM sponsorships s
       JOIN games g ON g.id = s.game_id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    )

    res.json(formatPaginatedResponse(result.rows, total, page, limit))
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/users/me/wallet - Hub wallet balances (proxy)
 */
async function getHubWallet(req, res, next) {
  try {
    const userId = req.user.userId

    const userResult = await db.query(
      'SELECT hub_token FROM users WHERE id = $1',
      [userId]
    )
    if (userResult.rows.length === 0) throw new NotFoundError('User not found')

    const { hub_token } = userResult.rows[0]
    if (!hub_token) {
      return res.json({ hub_connected: false, balances: [] })
    }

    const hubUrl = process.env.HUB_API_URL || 'https://appback.app/api/v1'
    const https = require('https')
    const hubResult = await new Promise((resolve, reject) => {
      const urlObj = new URL(`${hubUrl}/user/wallet/balances`)
      const req = https.request({
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${hub_token}` }
      }, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) })
          } catch {
            reject(new Error('Invalid Hub response'))
          }
        })
      })
      req.on('error', reject)
      req.end()
    })

    if (hubResult.status === 401) {
      return res.json({ hub_connected: false, balances: [], error: 'Hub token expired' })
    }
    if (hubResult.status !== 200) {
      return res.json({ hub_connected: true, balances: [], error: 'Hub unavailable' })
    }

    const balances = (hubResult.body.balances || []).map(b => ({
      currency_code: b.currency_code || b.code,
      balance: b.balance
    }))
    res.json({ hub_connected: true, balances })
  } catch (err) {
    next(err)
  }
}

module.exports = { getProfile, updateProfile, getBetHistory, getSponsorHistory, getHubWallet }
