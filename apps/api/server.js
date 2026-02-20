// Claw Clash - Express API server
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
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
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true)
      if (config.corsOrigins.includes(origin)) return callback(null, true)
      if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost')) {
        return callback(null, true)
      }
      callback(new Error('Not allowed by CORS'))
    },
    credentials: true
  },
  transports: ['websocket', 'polling']
})

// Make io accessible via app for controllers
app.set('io', io)

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

// Socket.io connection handling
io.on('connection', (socket) => {
  socket.on('join_game', (gameId) => {
    socket.join(`game:${gameId}`)
    const count = io.sockets.adapter.rooms.get(`game:${gameId}`)?.size || 0
    io.to(`game:${gameId}`).emit('viewers', count)
  })

  socket.on('leave_game', (gameId) => {
    socket.leave(`game:${gameId}`)
    const count = io.sockets.adapter.rooms.get(`game:${gameId}`)?.size || 0
    io.to(`game:${gameId}`).emit('viewers', count)
  })

  socket.on('disconnecting', () => {
    // Broadcast updated viewer count for all game rooms this socket was in
    for (const room of socket.rooms) {
      if (room.startsWith('game:')) {
        const count = (io.sockets.adapter.rooms.get(room)?.size || 1) - 1
        io.to(room).emit('viewers', count)
      }
    }
  })
})

if (process.env.NODE_ENV !== 'test') {
  server.listen(config.port, () => {
    console.log(`Claw Clash API listening on ${config.port}`)
    startScheduler(io)
  })
}

module.exports = app
