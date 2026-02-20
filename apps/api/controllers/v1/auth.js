const bcrypt = require('bcryptjs')
const db = require('../../db')
const { generateJWT } = require('../../utils/token')
const { ValidationError, UnauthorizedError, ConflictError } = require('../../utils/errors')

/**
 * POST /api/v1/auth/register - Spectator registration
 */
async function register(req, res, next) {
  try {
    const { email, password, display_name } = req.body

    if (!email || !password) {
      throw new ValidationError('email and password are required')
    }
    if (password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters')
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
    if (existing.rows.length > 0) {
      throw new ConflictError('Email already registered')
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const result = await db.query(
      `INSERT INTO users (email, password_hash, display_name, role, predictor_token)
       VALUES ($1, $2, $3, 'spectator', $4)
       RETURNING id, email, display_name, role, created_at`,
      [email.toLowerCase(), passwordHash, display_name || null, req.predictorId || null]
    )

    const user = result.rows[0]
    const token = generateJWT({ userId: user.id, role: user.role })

    res.status(201).json({
      user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role },
      token
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/auth/login - Admin or spectator login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      throw new ValidationError('email and password are required')
    }

    const result = await db.query(
      'SELECT id, email, password_hash, display_name, role FROM users WHERE email = $1',
      [email.toLowerCase()]
    )

    if (result.rows.length === 0) {
      throw new UnauthorizedError('Invalid email or password')
    }

    const user = result.rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password')
    }

    const token = generateJWT({ userId: user.id, role: user.role })

    res.json({
      user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role },
      token
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { register, login }
