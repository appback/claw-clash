const cors = require('cors')
const config = require('../config')

const corsMiddleware = cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile, curl, etc.)
    if (!origin) return callback(null, true)
    if (config.corsOrigins.includes(origin)) {
      return callback(null, true)
    }
    // In development, allow localhost on any port
    if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost')) {
      return callback(null, true)
    }
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
})

module.exports = corsMiddleware
