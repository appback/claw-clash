const rateLimit = require('express-rate-limit')

const skip = () => process.env.NODE_ENV === 'test'

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMIT', message: 'Too many requests. Please try again later.' },
  skip
})

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMIT', message: 'Too many authentication attempts.' },
  skip
})

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMIT', message: 'Too many registration attempts. Try again in an hour.' },
  skip
})

const submissionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.agent ? req.agent.id : req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMIT', message: 'Too many submissions.' },
  skip,
  validate: false
})

const predictionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    if (req.user && req.user.userId) return req.user.userId
    return `${req.predictorId || 'anon'}_${req.ip}`
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMIT', message: 'Too many predictions.' },
  skip,
  validate: false
})

module.exports = {
  globalLimiter,
  authLimiter,
  registrationLimiter,
  submissionLimiter,
  predictionLimiter
}
