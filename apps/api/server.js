// Claw Clash - Express API server
const express = require('express')
const helmet = require('helmet')
const corsMiddleware = require('./middleware/corsConfig')
const { globalLimiter } = require('./middleware/rateLimiter')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const auth = require('./middleware/auth')
const errorHandler = require('./middleware/errorHandler')
const v1Routes = require('./routes/v1')
const { startScheduler } = require('./services/scheduler')
const config = require('./config')

const app = express()

// Trust first proxy (Nginx)
app.set('trust proxy', 1)

// 1. Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}))

// 2. CORS
app.use(corsMiddleware)

// 3. Global rate limiting
app.use(globalLimiter)

// 4. Body parsing
app.use(bodyParser.json({ limit: '1mb' }))
app.use(cookieParser())

// 5. Auth (cookie + JWT parsing)
app.use(auth)

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'claw-clash' }))

// Mount v1 API routes
app.use('/api/v1', v1Routes)

// Global error handler
app.use(errorHandler)

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`Claw Clash API listening on ${config.port}`)
    startScheduler()
  })
}

module.exports = app
