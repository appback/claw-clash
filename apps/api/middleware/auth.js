const { v4: uuidv4 } = require('uuid')
const { verifyJWT, AGENT_TOKEN_PREFIX } = require('../utils/token')

/**
 * Global auth middleware.
 * Assigns anonymous predictorId via cookie.
 * Parses JWT from Authorization header if present (non-agent tokens).
 */
function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      if (!token.startsWith(AGENT_TOKEN_PREFIX)) {
        try {
          const decoded = verifyJWT(token)
          req.user = { userId: decoded.userId, role: decoded.role }
        } catch (e) {
          // JWT invalid - continue without user
        }
      }
    }

    // Cookie-based predictorId for anonymous spectators
    const cookie = req.cookies && req.cookies['predictorId']
    if (cookie) {
      req.predictorId = cookie
      return next()
    }
    const id = uuidv4()
    res.cookie('predictorId', id, { httpOnly: true, sameSite: 'lax', maxAge: 365 * 24 * 60 * 60 * 1000 })
    req.predictorId = id
    next()
  } catch (e) {
    next()
  }
}

/**
 * JWT required middleware.
 */
function jwtAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' })
    }
    const token = authHeader.slice(7)
    if (token.startsWith(AGENT_TOKEN_PREFIX)) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'JWT token required, agent token not accepted' })
    }
    const decoded = verifyJWT(token)
    req.user = { userId: decoded.userId, role: decoded.role }
    next()
  } catch (e) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' })
  }
}

/**
 * Optional JWT middleware (parses JWT if present, always provides predictorId).
 */
function optionalJwtAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      if (!token.startsWith(AGENT_TOKEN_PREFIX)) {
        try {
          const decoded = verifyJWT(token)
          req.user = { userId: decoded.userId, role: decoded.role }
        } catch (e) {}
      }
    }
    if (!req.predictorId) {
      const cookie = req.cookies && req.cookies['predictorId']
      if (cookie) {
        req.predictorId = cookie
      } else {
        const id = uuidv4()
        res.cookie('predictorId', id, { httpOnly: true, sameSite: 'lax', maxAge: 365 * 24 * 60 * 60 * 1000 })
        req.predictorId = id
      }
    }
    next()
  } catch (e) {
    next()
  }
}

module.exports = auth
module.exports.auth = auth
module.exports.jwtAuth = jwtAuth
module.exports.optionalJwtAuth = optionalJwtAuth
