const db = require('../db')
const { hashToken, AGENT_TOKEN_PREFIX } = require('../utils/token')

/**
 * Authenticate requests using agent API tokens (cr_agent_*).
 * Sets req.agent on success.
 */
async function agentAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Agent API token required' })
    }

    const token = authHeader.slice(7)
    if (!token.startsWith(AGENT_TOKEN_PREFIX)) {
      return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Invalid agent token format' })
    }

    const tokenHash = hashToken(token)
    const result = await db.query(
      `SELECT id, name, api_token, balance_cache, wins, battles_count, is_active, meta, external_ids, created_at
       FROM agents WHERE api_token = $1`,
      [tokenHash]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Invalid agent token' })
    }

    const agent = result.rows[0]
    if (!agent.is_active) {
      return res.status(403).json({ error: 'AGENT_INACTIVE', message: 'This agent has been deactivated' })
    }

    req.agent = agent
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * Optional agent auth: parses agent token if present, continues without it.
 */
async function optionalAgentAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      if (token.startsWith(AGENT_TOKEN_PREFIX)) {
        const tokenHash = hashToken(token)
        const result = await db.query(
          `SELECT id, name, api_token, balance_cache, wins, battles_count, is_active, meta, external_ids, created_at
           FROM agents WHERE api_token = $1`,
          [tokenHash]
        )
        if (result.rows.length > 0 && result.rows[0].is_active) {
          req.agent = result.rows[0]
        }
      }
    }
    next()
  } catch (err) {
    next()
  }
}

module.exports = agentAuth
module.exports.agentAuth = agentAuth
module.exports.optionalAgentAuth = optionalAgentAuth
