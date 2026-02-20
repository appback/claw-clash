const db = require('../../db')
const { generateAgentToken, hashToken } = require('../../utils/token')
const { parsePagination, formatPaginatedResponse } = require('../../utils/pagination')
const { ValidationError, NotFoundError } = require('../../utils/errors')
const config = require('../../config')

/**
 * POST /api/v1/agents/register - Self-service agent registration
 */
const VALID_PERSONALITIES = ['aggressive', 'confident', 'friendly', 'cautious', 'troll']

async function selfRegister(req, res, next) {
  try {
    const { name, model_name, description, personality } = req.body

    const agentName = (name && String(name).trim() !== '')
      ? String(name).trim()
      : `crab-${require('crypto').randomBytes(4).toString('hex')}`

    const agentPersonality = (personality && VALID_PERSONALITIES.includes(personality))
      ? personality
      : 'friendly'

    const rawToken = generateAgentToken()
    const tokenHash = hashToken(rawToken)

    const result = await db.query(
      `INSERT INTO agents (name, api_token, is_active, personality, meta)
       VALUES ($1, $2, true, $3, $4)
       RETURNING id, name, personality, balance_cache, created_at`,
      [
        agentName,
        tokenHash,
        agentPersonality,
        model_name ? JSON.stringify({ model_name, description: description || '' }) : '{}'
      ]
    )

    const agent = result.rows[0]

    // Award registration bonus
    await db.query(
      `UPDATE agents SET balance_cache = balance_cache + $1 WHERE id = $2`,
      [config.rewards.registration, agent.id]
    ).catch(err => console.error('[Agents] Registration bonus failed:', err.message))

    res.status(201).json({
      agent_id: agent.id,
      api_token: rawToken,
      name: agent.name,
      personality: agent.personality,
      balance: parseInt(agent.balance_cache) + config.rewards.registration,
      created_at: agent.created_at
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/agents/me - Agent self-info
 */
async function me(req, res, next) {
  try {
    const agent = req.agent
    const stats = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'finished') AS completed_races,
         COUNT(*) FILTER (WHERE final_rank = 1) AS wins,
         COUNT(*) FILTER (WHERE final_rank <= 3) AS podiums,
         COALESCE(SUM(prize_earned), 0) AS total_prizes
       FROM race_entries WHERE agent_id = $1`,
      [agent.id]
    )

    const s = stats.rows[0]
    res.json({
      id: agent.id,
      name: agent.name,
      personality: agent.personality || 'friendly',
      balance: parseInt(agent.balance_cache),
      wins: parseInt(s.wins),
      podiums: parseInt(s.podiums),
      battles_count: parseInt(s.completed_races),
      total_prizes: parseInt(s.total_prizes),
      meta: agent.meta,
      created_at: agent.created_at
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/agents/me/history - Agent race history
 */
async function history(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query)

    const countResult = await db.query(
      'SELECT COUNT(*) AS total FROM race_entries WHERE agent_id = $1',
      [req.agent.id]
    )
    const total = parseInt(countResult.rows[0].total, 10)

    const result = await db.query(
      `SELECT re.race_id, r.title, r.track_type, r.state,
              re.total_score, re.final_rank, re.prize_earned, re.status, re.created_at
       FROM race_entries re
       JOIN races r ON r.id = re.race_id
       WHERE re.agent_id = $1
       ORDER BY re.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.agent.id, limit, offset]
    )

    res.json(formatPaginatedResponse(result.rows, total, page, limit))
  } catch (err) {
    next(err)
  }
}

module.exports = { selfRegister, me, history }
