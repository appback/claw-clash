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
       RETURNING id, email, display_name, role, points, created_at`,
      [email.toLowerCase(), passwordHash, display_name || null, req.predictorId || null]
    )

    const user = result.rows[0]
    const token = generateJWT({ userId: user.id, role: user.role })

    res.status(201).json({
      user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role, points: parseInt(user.points) },
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
      'SELECT id, email, password_hash, display_name, role, points FROM users WHERE email = $1',
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
      user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role, points: parseInt(user.points) },
      token
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/auth/hub-login - Login via Hub token verification
 * Hub이 인증 authority. CC는 Hub에 토큰 검증만 요청.
 */
async function hubLogin(req, res, next) {
  try {
    const { token: hubToken } = req.body
    if (!hubToken) {
      throw new ValidationError('token is required')
    }

    // Hub에 토큰 검증 요청
    const hubUrl = process.env.HUB_API_URL || 'https://appback.app/api/v1'
    const https = require('https')
    const hubResult = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({ token: hubToken })
      const urlObj = new URL(`${hubUrl}/auth/verify`)
      const req = https.request({
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch { reject(new Error('Invalid Hub response')) }
        })
      })
      req.on('error', reject)
      req.write(postData)
      req.end()
    })

    if (!hubResult.valid) {
      throw new UnauthorizedError('Invalid Hub token')
    }

    // Hub 유저로 CC 로컬 유저 찾기/생성
    const hubUserId = hubResult.userId
    const hubDisplayName = hubResult.displayName || (hubResult.email ? hubResult.email.split('@')[0] : 'Player')
    let user

    const existing = await db.query('SELECT * FROM users WHERE hub_user_id = $1', [hubUserId])
    if (existing.rows.length > 0) {
      user = existing.rows[0]
      // display_name 동기화 (없으면 Hub 것으로 업데이트)
      if (!user.display_name || (hubResult.displayName && hubResult.displayName !== user.display_name)) {
        const newName = hubResult.displayName || hubDisplayName
        await db.query('UPDATE users SET display_name = $1, updated_at = NOW() WHERE id = $2', [newName, user.id])
        user.display_name = newName
      }
    } else {
      // 이메일로 기존 계정 매칭 시도
      if (hubResult.email) {
        const emailMatch = await db.query('SELECT * FROM users WHERE email = $1', [hubResult.email])
        if (emailMatch.rows.length > 0) {
          user = emailMatch.rows[0]
          await db.query('UPDATE users SET hub_user_id = $1, display_name = COALESCE(display_name, $2), updated_at = NOW() WHERE id = $3',
            [hubUserId, hubDisplayName, user.id])
          user.hub_user_id = hubUserId
          if (!user.display_name) user.display_name = hubDisplayName
        }
      }

      if (!user) {
        // 신규 유저 생성 (password 없음)
        const result = await db.query(
          `INSERT INTO users (email, display_name, role, hub_user_id, predictor_token)
           VALUES ($1, $2, 'spectator', $3, $4)
           RETURNING *`,
          [hubResult.email, hubDisplayName, hubUserId, req.predictorId || null]
        )
        user = result.rows[0]
      }
    }

    // CC 자체 JWT 발급
    const ccToken = generateJWT({ userId: user.id, role: user.role })

    res.json({
      user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role, points: parseInt(user.points || 1000) },
      token: ccToken
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { register, login, hubLogin }
