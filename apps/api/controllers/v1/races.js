const db = require('../../db')
const { parsePagination, formatPaginatedResponse } = require('../../utils/pagination')
const { ValidationError, NotFoundError, ConflictError, BadRequestError } = require('../../utils/errors')
const config = require('../../config')
const questionBank = require('../../services/questionBank')

/**
 * GET /api/v1/races - List races (public, filterable by state)
 */
async function list(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { state } = req.query

    let where = ''
    const params = []
    if (state) {
      where = 'WHERE r.state = $1'
      params.push(state)
    }

    const countResult = await db.query(
      `SELECT COUNT(*) AS total FROM races r ${where}`, params
    )
    const total = parseInt(countResult.rows[0].total, 10)

    const result = await db.query(
      `SELECT r.id, r.title, r.track_type, r.state, r.entry_fee, r.max_entries,
              r.prize_pool, r.challenge_count,
              r.registration_start, r.race_start, r.race_end,
              r.created_at,
              (SELECT COUNT(*) FROM race_entries re WHERE re.race_id = r.id) AS entry_count
       FROM races r ${where}
       ORDER BY r.race_start DESC NULLS LAST
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    )

    res.json(formatPaginatedResponse(result.rows, total, page, limit))
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/races/:id - Race detail (public)
 */
async function get(req, res, next) {
  try {
    const { id } = req.params

    const raceResult = await db.query(
      `SELECT r.*, (SELECT COUNT(*) FROM race_entries re WHERE re.race_id = r.id) AS entry_count
       FROM races r WHERE r.id = $1`,
      [id]
    )
    if (raceResult.rows.length === 0) {
      throw new NotFoundError('Race not found')
    }

    const race = raceResult.rows[0]

    // Get participants
    const entries = await db.query(
      `SELECT re.agent_id, a.name AS agent_name, a.meta,
              re.total_score, re.final_rank, re.status, re.created_at
       FROM race_entries re
       JOIN agents a ON a.id = re.agent_id
       WHERE re.race_id = $1
       ORDER BY re.final_rank NULLS LAST, re.total_score DESC`,
      [id]
    )

    res.json({
      ...race,
      entries: entries.rows
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/races/:id/replay - Replay data for race visualization
 */
async function replay(req, res, next) {
  try {
    const { id } = req.params

    const raceResult = await db.query('SELECT * FROM races WHERE id = $1', [id])
    if (raceResult.rows.length === 0) {
      throw new NotFoundError('Race not found')
    }

    const race = raceResult.rows[0]
    if (!['scoring', 'finished', 'archived'].includes(race.state)) {
      throw new BadRequestError('Race replay not available yet')
    }

    // Get entries with agent info
    const entries = await db.query(
      `SELECT re.agent_id, a.name AS agent_name, a.meta,
              re.total_score, re.final_rank, re.status
       FROM race_entries re
       JOIN agents a ON a.id = re.agent_id
       WHERE re.race_id = $1
       ORDER BY re.final_rank NULLS LAST`,
      [id]
    )

    // Get challenges
    const challenges = await db.query(
      `SELECT id, seq, challenge_type, max_score FROM race_challenges
       WHERE race_id = $1 ORDER BY seq`,
      [id]
    )

    // Get all submissions for this race
    const submissions = await db.query(
      `SELECT cs.agent_id, cs.challenge_id, rc.seq, cs.score, cs.response_time_ms
       FROM challenge_submissions cs
       JOIN race_challenges rc ON rc.id = cs.challenge_id
       WHERE cs.race_id = $1
       ORDER BY rc.seq, cs.score DESC`,
      [id]
    )

    // Build replay lanes: cumulative score as checkpoints per challenge
    const challengeCount = challenges.rows.length
    const maxPossible = challenges.rows.reduce((sum, c) => sum + c.max_score, 0)

    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']

    const lanes = entries.rows.map((entry, idx) => {
      const agentSubs = submissions.rows.filter(s => s.agent_id === entry.agent_id)
      let cumScore = 0
      const checkpoints = [0] // start at 0

      for (let seq = 1; seq <= challengeCount; seq++) {
        const sub = agentSubs.find(s => s.seq === seq)
        if (sub) cumScore += sub.score
        checkpoints.push(maxPossible > 0 ? Math.round((cumScore / maxPossible) * 100) : 0)
      }

      return {
        agent_id: entry.agent_id,
        name: entry.agent_name,
        color: colors[idx % colors.length],
        rank: entry.final_rank,
        total_score: entry.total_score,
        checkpoints
      }
    })

    // Generate highlights (overtakes)
    const highlights = []
    for (let cp = 1; cp <= challengeCount; cp++) {
      const sorted = [...lanes].sort((a, b) => b.checkpoints[cp] - a.checkpoints[cp])
      const prevSorted = [...lanes].sort((a, b) => b.checkpoints[cp - 1] - a.checkpoints[cp - 1])

      for (let i = 0; i < sorted.length; i++) {
        const prevIdx = prevSorted.findIndex(l => l.agent_id === sorted[i].agent_id)
        if (prevIdx > i && prevIdx - i >= 2) {
          highlights.push({
            at_checkpoint: cp,
            type: 'overtake',
            by: sorted[i].name,
            positions_gained: prevIdx - i
          })
        }
      }
    }

    res.json({
      race_id: id,
      title: race.title,
      track_type: race.track_type,
      challenge_count: challengeCount,
      lanes,
      duration_ms: challengeCount * 1500,
      highlights
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/races/:id/enter - Agent enters race
 */
async function enter(req, res, next) {
  try {
    const { id } = req.params
    const agent = req.agent

    const raceResult = await db.query('SELECT * FROM races WHERE id = $1', [id])
    if (raceResult.rows.length === 0) {
      throw new NotFoundError('Race not found')
    }

    const race = raceResult.rows[0]
    if (race.state !== 'registration') {
      throw new BadRequestError(`Race is not accepting entries (state: ${race.state})`)
    }

    // Check max entries
    const entryCount = await db.query(
      'SELECT COUNT(*) AS cnt FROM race_entries WHERE race_id = $1',
      [id]
    )
    if (parseInt(entryCount.rows[0].cnt) >= race.max_entries) {
      throw new ConflictError('Race is full')
    }

    // Check duplicate
    const existing = await db.query(
      'SELECT id FROM race_entries WHERE race_id = $1 AND agent_id = $2',
      [id, agent.id]
    )
    if (existing.rows.length > 0) {
      throw new ConflictError('Agent already entered this race')
    }

    // Debit entry fee if applicable
    if (race.entry_fee > 0) {
      if (agent.balance_cache < race.entry_fee) {
        throw new BadRequestError(`Insufficient balance. Need ${race.entry_fee}, have ${agent.balance_cache}`)
      }
      await db.query(
        'UPDATE agents SET balance_cache = balance_cache - $1 WHERE id = $2',
        [race.entry_fee, agent.id]
      )
    }

    // Create entry
    await db.query(
      `INSERT INTO race_entries (race_id, agent_id, entry_fee_paid) VALUES ($1, $2, $3)`,
      [id, agent.id, race.entry_fee]
    )

    // Update prize pool
    await db.query(
      'UPDATE races SET prize_pool = prize_pool + $1, updated_at = now() WHERE id = $2',
      [race.entry_fee, id]
    )

    res.status(201).json({
      race_id: id,
      agent_id: agent.id,
      entry_fee_paid: race.entry_fee,
      message: 'Successfully entered the race'
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/races/:id/challenge - Get current challenge for agent
 */
async function getChallenge(req, res, next) {
  try {
    const { id } = req.params
    const agent = req.agent

    // Verify agent is in this race
    const entry = await db.query(
      `SELECT id, status FROM race_entries WHERE race_id = $1 AND agent_id = $2`,
      [id, agent.id]
    )
    if (entry.rows.length === 0) {
      throw new NotFoundError('Agent not entered in this race')
    }

    const race = await db.query('SELECT state FROM races WHERE id = $1', [id])
    if (race.rows[0].state !== 'racing') {
      throw new BadRequestError('Race is not in progress')
    }

    // Find next unanswered challenge
    const challenge = await db.query(
      `SELECT rc.id, rc.seq, rc.challenge_type, rc.question, rc.max_score, rc.time_limit_sec
       FROM race_challenges rc
       WHERE rc.race_id = $1
         AND rc.id NOT IN (
           SELECT cs.challenge_id FROM challenge_submissions cs
           WHERE cs.race_id = $1 AND cs.agent_id = $2
         )
       ORDER BY rc.seq
       LIMIT 1`,
      [id, agent.id]
    )

    if (challenge.rows.length === 0) {
      // All challenges answered
      return res.json({
        message: 'All challenges completed',
        completed: true,
        race_id: id
      })
    }

    const ch = challenge.rows[0]
    res.json({
      challenge_id: ch.id,
      seq: ch.seq,
      challenge_type: ch.challenge_type,
      question: ch.question,
      max_score: ch.max_score,
      time_limit_sec: ch.time_limit_sec,
      completed: false
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/races/:id/submit - Submit challenge answer
 */
async function submit(req, res, next) {
  try {
    const { id } = req.params
    const agent = req.agent
    const { challenge_id, answer } = req.body

    if (!challenge_id || answer === undefined) {
      throw new ValidationError('challenge_id and answer are required')
    }

    // Verify race state
    const race = await db.query('SELECT state, track_type FROM races WHERE id = $1', [id])
    if (race.rows.length === 0) throw new NotFoundError('Race not found')
    if (race.rows[0].state !== 'racing') {
      throw new BadRequestError('Race is not in progress')
    }

    // Verify agent entry
    const entry = await db.query(
      'SELECT id FROM race_entries WHERE race_id = $1 AND agent_id = $2',
      [id, agent.id]
    )
    if (entry.rows.length === 0) throw new NotFoundError('Agent not entered in this race')

    // Verify challenge belongs to race
    const challenge = await db.query(
      'SELECT id, seq, challenge_type, answer AS correct_answer, max_score FROM race_challenges WHERE id = $1 AND race_id = $2',
      [challenge_id, id]
    )
    if (challenge.rows.length === 0) throw new NotFoundError('Challenge not found in this race')

    // Check duplicate submission
    const existing = await db.query(
      'SELECT id FROM challenge_submissions WHERE challenge_id = $1 AND agent_id = $2',
      [challenge_id, agent.id]
    )
    if (existing.rows.length > 0) {
      throw new ConflictError('Already submitted for this challenge')
    }

    const ch = challenge.rows[0]
    const startTime = Date.now()

    // Score the submission
    const scoringEngine = require('../../services/scoringEngine')
    const score = scoringEngine.score(ch.challenge_type, answer, ch.correct_answer, ch.max_score)

    const responseTimeMs = Date.now() - startTime

    // Insert submission
    await db.query(
      `INSERT INTO challenge_submissions (race_id, challenge_id, agent_id, response, score, scored_at, response_time_ms)
       VALUES ($1, $2, $3, $4, $5, now(), $6)`,
      [id, challenge_id, agent.id, JSON.stringify({ answer }), score, responseTimeMs]
    )

    // Update entry total score
    await db.query(
      `UPDATE race_entries SET total_score = total_score + $1 WHERE race_id = $2 AND agent_id = $3`,
      [score, id, agent.id]
    )

    res.json({
      challenge_id,
      seq: ch.seq,
      score,
      max_score: ch.max_score,
      response_time_ms: responseTimeMs
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/races - Create race (admin)
 */
async function create(req, res, next) {
  try {
    const { title, track_type, entry_fee, max_entries, challenge_count, registration_start, race_start } = req.body

    if (!title) throw new ValidationError('title is required')

    const tt = track_type || 'trivia'
    const ef = entry_fee || 0
    const me = max_entries || config.defaultMaxEntries
    const cc = challenge_count || config.defaultChallengeCount
    const regStart = registration_start || new Date(Date.now() + 5 * 60000).toISOString()
    const rStart = race_start || new Date(Date.now() + config.registrationDurationMin * 60000).toISOString()

    const client = await db.getClient()
    try {
      await client.query('BEGIN')

      const raceResult = await client.query(
        `INSERT INTO races (title, track_type, state, entry_fee, max_entries, challenge_count,
                            registration_start, race_start, created_by)
         VALUES ($1, $2, 'scheduled', $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [title, tt, ef, me, cc, regStart, rStart, req.user.userId]
      )

      const race = raceResult.rows[0]

      // Pull questions from bank and create challenges
      const questions = await questionBank.selectQuestions(client, tt, cc)
      for (let i = 0; i < questions.length; i++) {
        await client.query(
          `INSERT INTO race_challenges (race_id, seq, challenge_type, question, answer, max_score, time_limit_sec)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [race.id, i + 1, tt, JSON.stringify(questions[i].question), JSON.stringify(questions[i].answer),
           100, config.defaultTimeLimitSec]
        )
      }

      await client.query('COMMIT')

      res.status(201).json(race)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /api/v1/races/:id - Update race (admin)
 */
async function update(req, res, next) {
  try {
    const { id } = req.params
    const { title, state, registration_start, race_start } = req.body

    const existing = await db.query('SELECT id, state FROM races WHERE id = $1', [id])
    if (existing.rows.length === 0) throw new NotFoundError('Race not found')

    const updates = []
    const params = []
    let idx = 1

    if (title !== undefined) { updates.push(`title = $${idx++}`); params.push(title) }
    if (state !== undefined) { updates.push(`state = $${idx++}`); params.push(state) }
    if (registration_start !== undefined) { updates.push(`registration_start = $${idx++}`); params.push(registration_start) }
    if (race_start !== undefined) { updates.push(`race_start = $${idx++}`); params.push(race_start) }

    if (updates.length === 0) throw new ValidationError('No fields to update')

    updates.push(`updated_at = now()`)
    params.push(id)

    const result = await db.query(
      `UPDATE races SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    )

    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
}

module.exports = { list, get, replay, enter, getChallenge, submit, create, update }
