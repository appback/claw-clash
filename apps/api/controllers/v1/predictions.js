const db = require('../../db')
const { ValidationError, NotFoundError, BadRequestError, ConflictError } = require('../../utils/errors')
const config = require('../../config')

/**
 * POST /api/v1/races/:id/predict - Make a prediction
 * Supports both anonymous (cookie) and authenticated (JWT) users.
 */
async function predict(req, res, next) {
  try {
    const { id } = req.params
    const { predicted_agent_id, prediction_type, stake } = req.body

    if (!predicted_agent_id) {
      throw new ValidationError('predicted_agent_id is required')
    }

    const pType = prediction_type || 'win'
    if (!['win', 'podium', 'head_to_head'].includes(pType)) {
      throw new ValidationError('prediction_type must be win, podium, or head_to_head')
    }

    // Verify race exists and is in registration state
    const race = await db.query('SELECT * FROM races WHERE id = $1', [id])
    if (race.rows.length === 0) throw new NotFoundError('Race not found')
    if (!['registration', 'scheduled'].includes(race.rows[0].state)) {
      throw new BadRequestError('Predictions are closed for this race')
    }

    // Verify agent is entered in the race
    const entry = await db.query(
      'SELECT id FROM race_entries WHERE race_id = $1 AND agent_id = $2',
      [id, predicted_agent_id]
    )
    if (entry.rows.length === 0) {
      throw new NotFoundError('Agent is not entered in this race')
    }

    const userId = req.user ? req.user.userId : null
    const predictorToken = req.predictorId || null
    let stakeAmount = 0

    if (stake && stake > 0) {
      // Paid prediction requires login
      if (!userId) {
        throw new BadRequestError('Login required for staked predictions')
      }
      stakeAmount = Math.min(Math.max(parseInt(stake), config.minStake), config.maxStake)
    } else {
      // Free prediction - check daily limit
      if (!userId) {
        const today = new Date().toISOString().split('T')[0]
        const freePredictions = await db.query(
          `SELECT COUNT(*) AS cnt FROM predictions
           WHERE predictor_token = $1 AND stake = 0 AND created_at::date = $2::date`,
          [predictorToken, today]
        )
        if (parseInt(freePredictions.rows[0].cnt) >= config.freePredictionsPerDay) {
          throw new BadRequestError(`Daily free prediction limit reached (${config.freePredictionsPerDay})`)
        }
      }
    }

    // Check duplicate prediction for same race
    const existingQuery = userId
      ? await db.query('SELECT id FROM predictions WHERE race_id = $1 AND user_id = $2', [id, userId])
      : await db.query('SELECT id FROM predictions WHERE race_id = $1 AND predictor_token = $2 AND user_id IS NULL', [id, predictorToken])

    if (existingQuery.rows.length > 0) {
      throw new ConflictError('Already predicted for this race')
    }

    const result = await db.query(
      `INSERT INTO predictions (race_id, user_id, predictor_token, prediction_type, predicted_agent_id, stake)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, race_id, prediction_type, predicted_agent_id, stake, created_at`,
      [id, userId, predictorToken, pType, predicted_agent_id, stakeAmount]
    )

    res.status(201).json(result.rows[0])
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/races/:id/predictions - My predictions for this race
 */
async function racePredictions(req, res, next) {
  try {
    const { id } = req.params
    const userId = req.user ? req.user.userId : null
    const predictorToken = req.predictorId

    let result
    if (userId) {
      result = await db.query(
        `SELECT p.*, a.name AS agent_name
         FROM predictions p
         JOIN agents a ON a.id = p.predicted_agent_id
         WHERE p.race_id = $1 AND p.user_id = $2`,
        [id, userId]
      )
    } else {
      result = await db.query(
        `SELECT p.*, a.name AS agent_name
         FROM predictions p
         JOIN agents a ON a.id = p.predicted_agent_id
         WHERE p.race_id = $1 AND p.predictor_token = $2 AND p.user_id IS NULL`,
        [id, predictorToken]
      )
    }

    res.json({ predictions: result.rows })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/predictions/history - Prediction history (JWT required)
 */
async function history(req, res, next) {
  try {
    const { page, limit, offset } = require('../../utils/pagination').parsePagination(req.query)

    const countResult = await db.query(
      'SELECT COUNT(*) AS total FROM predictions WHERE user_id = $1',
      [req.user.userId]
    )
    const total = parseInt(countResult.rows[0].total, 10)

    const result = await db.query(
      `SELECT p.*, r.title AS race_title, r.state AS race_state, a.name AS agent_name
       FROM predictions p
       JOIN races r ON r.id = p.race_id
       JOIN agents a ON a.id = p.predicted_agent_id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.userId, limit, offset]
    )

    const { formatPaginatedResponse } = require('../../utils/pagination')
    res.json(formatPaginatedResponse(result.rows, total, page, limit))
  } catch (err) {
    next(err)
  }
}

module.exports = { predict, racePredictions, history }
