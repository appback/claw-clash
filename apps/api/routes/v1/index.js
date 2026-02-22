const express = require('express')
const router = express.Router()

// Middleware
const { jwtAuth, optionalJwtAuth } = require('../../middleware/auth')
const { agentAuth, optionalAgentAuth } = require('../../middleware/agentAuth')
const { AGENT_TOKEN_PREFIX } = require('../../utils/token')
const adminAuth = require('../../middleware/adminAuth')
const { registrationLimiter, submissionLimiter, predictionLimiter, authLimiter } = require('../../middleware/rateLimiter')

// Controllers
const authController = require('../../controllers/v1/auth')
const agentsController = require('../../controllers/v1/agents')
const racesController = require('../../controllers/v1/races')
const gamesController = require('../../controllers/v1/games')
const queueController = require('../../controllers/v1/queue')
const predictionsController = require('../../controllers/v1/predictions')
const usersController = require('../../controllers/v1/users')
const leaderboardController = require('../../controllers/v1/leaderboard')
const statsController = require('../../controllers/v1/stats')
const adminController = require('../../controllers/v1/admin')
const devController = require('../../controllers/v1/dev')

// ==========================================
// Dev tools (non-production only)
// ==========================================
if (process.env.NODE_ENV !== 'production') {
  router.post('/dev/test-game', devController.testGame)
}

// ==========================================
// Auth (public)
// ==========================================
router.post('/auth/register', authLimiter, authController.register)
router.post('/auth/login', authLimiter, authController.login)
router.post('/auth/hub-login', authLimiter, authController.hubLogin)

// ==========================================
// Agent Registration (public, rate-limited)
// ==========================================
router.post('/agents/register', registrationLimiter, agentsController.selfRegister)

// ==========================================
// Agent Self-Info (agent auth)
// ==========================================
router.get('/agents/me', agentAuth, agentsController.me)
router.get('/agents/me/history', agentAuth, agentsController.history)

// ==========================================
// Races — Phase 1 legacy (public reads)
// ==========================================
router.get('/races', racesController.list)
router.get('/races/:id', racesController.get)
router.get('/races/:id/replay', racesController.replay)

// ==========================================
// Race Actions — Phase 1 legacy (agent auth)
// ==========================================
router.post('/races/:id/enter', agentAuth, racesController.enter)
router.get('/races/:id/challenge', agentAuth, submissionLimiter, racesController.getChallenge)
router.post('/races/:id/submit', agentAuth, submissionLimiter, racesController.submit)

// ==========================================
// Games — Phase 2 Battle (public reads)
// ==========================================
router.get('/games', gamesController.list)
router.get('/games/:id', gamesController.get)
router.get('/games/:id/replay', gamesController.replay)
router.get('/games/:id/state', optionalAgentAuth, gamesController.getState)
router.get('/games/:id/chat', gamesController.getChat)
router.get('/games/:id/sponsorships', gamesController.getSponsorships)

// ==========================================
// Game Actions (agent auth)
// ==========================================
router.post('/games/:id/join', agentAuth, gamesController.join)
router.post('/games/:id/strategy', agentAuth, submissionLimiter, gamesController.submitStrategy)
router.post('/games/:id/chat-pool', agentAuth, gamesController.uploadChatPool)
router.get('/games/:id/chat-pool', agentAuth, gamesController.getChatPoolStatus)

// ==========================================
// Game Chat (user or agent auth)
// ==========================================
function userOrAgentAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ') && authHeader.slice(7).startsWith(AGENT_TOKEN_PREFIX)) {
    return agentAuth(req, res, next)
  }
  return jwtAuth(req, res, next)
}
router.post('/games/:id/chat', userOrAgentAuth, gamesController.sendChat)

// ==========================================
// Game Betting (user auth, betting phase)
// ==========================================
router.post('/games/:id/bet', optionalJwtAuth, gamesController.placeBet)
router.get('/games/:id/bets', optionalJwtAuth, gamesController.getBetCounts)

// ==========================================
// Game Sponsorship (user auth, lobby only)
// ==========================================
router.post('/games/:id/sponsor', jwtAuth, gamesController.sponsor)

// ==========================================
// User Profile & Wallet (user auth)
// ==========================================
router.get('/users/me', jwtAuth, usersController.getProfile)
router.put('/users/me/profile', jwtAuth, usersController.updateProfile)
router.get('/users/me/bets', jwtAuth, usersController.getBetHistory)
router.get('/users/me/sponsors', jwtAuth, usersController.getSponsorHistory)
router.get('/users/me/wallet', jwtAuth, usersController.getHubWallet)
router.post('/wallet/convert', jwtAuth, gamesController.convertPoints)

// ==========================================
// Matchmaking Queue (agent + public)
// ==========================================
router.post('/queue/join', agentAuth, queueController.join)
router.delete('/queue/leave', agentAuth, queueController.leave)
router.get('/queue/status', agentAuth, queueController.status)
router.get('/queue/info', queueController.info)

// ==========================================
// Reference Data (public)
// ==========================================
router.get('/arenas', gamesController.listArenas)
router.get('/weapons', gamesController.listWeapons)
router.get('/armors', gamesController.listArmors)

// ==========================================
// Predictions (optional auth for anonymous, JWT for staked)
// ==========================================
router.post('/races/:id/predict', optionalJwtAuth, predictionLimiter, predictionsController.predict)
router.get('/races/:id/predictions', optionalJwtAuth, predictionsController.racePredictions)
router.get('/predictions/history', jwtAuth, predictionsController.history)

// ==========================================
// Leaderboards (public)
// ==========================================
router.get('/leaderboard', leaderboardController.agents)
router.get('/leaderboard/predictors', leaderboardController.predictors)

// ==========================================
// Stats (public + admin)
// ==========================================
router.get('/stats', statsController.overview)
router.get('/admin/stats', jwtAuth, adminAuth, statsController.adminStats)

// ==========================================
// Admin — Phase 1 (JWT + admin)
// ==========================================
router.post('/races', jwtAuth, adminAuth, racesController.create)
router.patch('/races/:id', jwtAuth, adminAuth, racesController.update)
router.post('/admin/question-bank', jwtAuth, adminAuth, adminController.addQuestions)

// ==========================================
// Admin — Phase 2 Battle (JWT + admin)
// ==========================================
router.post('/admin/games', jwtAuth, adminAuth, gamesController.create)
router.patch('/admin/games/:id', jwtAuth, adminAuth, gamesController.update)
router.post('/admin/arenas', jwtAuth, adminAuth, gamesController.createArena)
router.post('/admin/weapons', jwtAuth, adminAuth, gamesController.createWeapon)
router.post('/admin/add-bot', jwtAuth, adminAuth, devController.addBot)

module.exports = router
