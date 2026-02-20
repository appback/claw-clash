const db = require('../../db')
const { ValidationError } = require('../../utils/errors')

/**
 * POST /api/v1/admin/question-bank - Add questions to bank
 */
async function addQuestions(req, res, next) {
  try {
    const { questions } = req.body

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      throw new ValidationError('questions array is required')
    }

    const inserted = []
    for (const q of questions) {
      if (!q.category || !q.question || !q.answer) {
        throw new ValidationError('Each question needs category, question, and answer')
      }

      const result = await db.query(
        `INSERT INTO question_bank (category, difficulty, question, answer)
         VALUES ($1, $2, $3, $4)
         RETURNING id, category, difficulty`,
        [q.category, q.difficulty || 1, JSON.stringify(q.question), JSON.stringify(q.answer)]
      )
      inserted.push(result.rows[0])
    }

    res.status(201).json({ inserted: inserted.length, questions: inserted })
  } catch (err) {
    next(err)
  }
}

module.exports = { addQuestions }
