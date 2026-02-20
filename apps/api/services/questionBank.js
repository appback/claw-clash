/**
 * Question Bank Service - Selects questions for races from the question bank.
 */

/**
 * Select questions for a race, preferring least-used questions.
 * @param {object} client - DB client (within transaction)
 * @param {string} trackType - Challenge type (trivia, estimation, etc.)
 * @param {number} count - Number of questions needed
 * @returns {Array} Selected questions
 */
async function selectQuestions(client, trackType, count) {
  // Map track types to question bank categories
  const categoryMap = {
    trivia: ['general_knowledge', 'science', 'history', 'geography', 'pop_culture'],
    estimation: ['estimation']
  }

  const categories = categoryMap[trackType] || ['general_knowledge']

  const result = await client.query(
    `SELECT id, question, answer
     FROM question_bank
     WHERE category = ANY($1) AND is_active = true
     ORDER BY used_count ASC, RANDOM()
     LIMIT $2`,
    [categories, count]
  )

  if (result.rows.length < count) {
    console.warn(`[QuestionBank] Only ${result.rows.length}/${count} questions available for ${trackType}`)
  }

  // Increment used_count
  if (result.rows.length > 0) {
    const ids = result.rows.map(r => r.id)
    await client.query(
      `UPDATE question_bank SET used_count = used_count + 1 WHERE id = ANY($1)`,
      [ids]
    )
  }

  return result.rows
}

module.exports = { selectQuestions }
