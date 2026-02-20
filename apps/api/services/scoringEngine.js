/**
 * Scoring Engine - Auto-scores challenge submissions by type.
 * Phase 1: trivia (exact match) and estimation (proximity).
 */

/**
 * Score a submission based on challenge type.
 * @param {string} type - Challenge type
 * @param {*} submission - Agent's answer
 * @param {object} correctAnswer - Expected answer from question bank
 * @param {number} maxScore - Maximum score for this challenge
 * @returns {number} Score (0 to maxScore)
 */
function score(type, submission, correctAnswer, maxScore) {
  switch (type) {
    case 'trivia':
      return scoreTrivia(submission, correctAnswer, maxScore)
    case 'estimation':
      return scoreEstimation(submission, correctAnswer, maxScore)
    default:
      return scoreTrivia(submission, correctAnswer, maxScore)
  }
}

/**
 * Trivia: exact match (case-insensitive, trimmed).
 * Full marks for correct, 0 for incorrect.
 */
function scoreTrivia(submission, correctAnswer, maxScore) {
  const agentAnswer = normalizeAnswer(submission)
  const correct = normalizeAnswer(correctAnswer.value || correctAnswer)

  // Support multiple accepted answers
  if (Array.isArray(correctAnswer.accept)) {
    const accepted = correctAnswer.accept.map(a => normalizeAnswer(a))
    if (accepted.includes(agentAnswer)) return maxScore
  }

  if (agentAnswer === correct) return maxScore

  // Partial credit for close answers (Levenshtein distance <= 2 for short answers)
  if (correct.length <= 15 && levenshtein(agentAnswer, correct) <= 2) {
    return Math.round(maxScore * 0.5)
  }

  return 0
}

/**
 * Estimation: score based on proximity to correct value.
 * Uses logarithmic proximity scoring.
 */
function scoreEstimation(submission, correctAnswer, maxScore) {
  const agentValue = parseFloat(submission)
  const correctValue = parseFloat(correctAnswer.value || correctAnswer)

  if (isNaN(agentValue) || isNaN(correctValue)) return 0
  if (correctValue === 0) return agentValue === 0 ? maxScore : 0

  const ratio = agentValue / correctValue
  const logError = Math.abs(Math.log10(Math.max(ratio, 0.001)))

  // Perfect: within 5% → full marks
  if (logError < 0.02) return maxScore
  // Very close: within 10% → 90%
  if (logError < 0.05) return Math.round(maxScore * 0.9)
  // Close: within 25% → 70%
  if (logError < 0.1) return Math.round(maxScore * 0.7)
  // Reasonable: within 50% → 50%
  if (logError < 0.18) return Math.round(maxScore * 0.5)
  // Far: within 2x → 30%
  if (logError < 0.3) return Math.round(maxScore * 0.3)
  // Very far: within 5x → 10%
  if (logError < 0.7) return Math.round(maxScore * 0.1)

  return 0
}

function normalizeAnswer(val) {
  if (typeof val === 'object' && val !== null) {
    val = val.value || val.answer || JSON.stringify(val)
  }
  return String(val).trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function levenshtein(a, b) {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[b.length][a.length]
}

module.exports = { score, scoreTrivia, scoreEstimation }
