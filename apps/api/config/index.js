module.exports = {
  port: parseInt(process.env.PORT) || 3200,
  jwtSecret: process.env.JWT_SECRET || 'cr-dev-jwt-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:8089,http://localhost:8090,https://clash.appback.app').split(','),
  walletServiceUrl: process.env.WALLET_SERVICE_URL || '',
  walletServiceKey: process.env.WALLET_SERVICE_KEY || '',

  // Race defaults (Phase 1 legacy)
  defaultMaxEntries: 8,
  defaultChallengeCount: 10,
  defaultTimeLimitSec: 60,
  registrationDurationMin: 30,
  racingDurationMin: 15,
  autoRaceIntervalHours: 2,

  // Battle defaults (Phase 3 — Dual accumulator round system)
  defaultMaxTicks: 1500,      // 300s at 200ms/tick
  tickIntervalMs: 200,        // 0.2 second sub-ticks
  startingHp: 100,
  actionRoundTicks: 5,        // 5 ticks = 1 second = 1 action round
  actionThreshold: 100,       // accumulator threshold for an action
  speedClampMin: 80,          // min effective speed
  speedClampMax: 120,         // max effective speed
  passiveTickInterval: 5,     // apply terrain/ring/buffs every 5 ticks (=1s)
  strategyCooldownTicks: 50,  // 10s at 200ms/tick
  maxStrategyChanges: 30,
  batchFlushInterval: 50,     // flush every ~10s

  // Timing
  lobbyDurationMin: 5,
  bettingDurationSec: 300,
  autoGameIntervalHours: 2,

  // Battle scoring (v2 rebalanced)
  scorePerDamage: 3,
  scorePerKill: 150,
  scorePerSurvivalTick: 0,
  scoreLastStanding: 200,
  scoreSkillHit: 30,
  scoreFirstBlood: 50,
  scorePowerupCollect: 10,

  // Shrink zone (Ring of Death)
  shrinkPhase1Pct: 0.6,
  shrinkPhase2Pct: 0.8,
  ringDamagePerTick: 8,

  // Power-ups (scaled for 200ms ticks)
  powerupSpawnInterval: 300,    // 60s at 200ms/tick
  powerupMaxActive: 2,
  healPackAmount: 25,
  damageBoostMultiplier: 1.5,
  damageBoostDuration: 100,     // 20s at 200ms/tick
  speedBoostDuration: 75,       // 15s at 200ms/tick

  // Chat pool (Pre-generation system)
  chatCooldownTicks: 150,             // 30s at 200ms/tick
  chatPoolMaxCategories: 10,
  chatPoolMaxPerCategory: 5,
  chatPoolMaxMessageLength: 50,

  // AI defaults
  defaultFleeThreshold: 15,

  // Defense
  stayDamageReduction: 0.2,

  // Sponsorship
  sponsorCostPerBoost: 50,
  maxBoostsPerSlot: 5,
  weaponBoostValue: 2,
  hpBoostValue: 10,
  sponsorReturns: { 1: 3.0, 2: 1.5, 3: 1.0 },

  // Matchmaking queue (Phase 2.5)
  queueProcessIntervalSec: 30,
  queueMinPlayers: 4,
  queueMaxPlayers: 8,
  queueSmallGameMinPlayers: 2,
  queueSmallGameWaitMin: 10,
  queueLeaveCooldownCount: 3,
  queueLeaveCooldownMin: 5,
  queueSameOwnerWeight: 0.1,
  queueRecentOpponentWeight: 0.7,
  queueLongWaitWeight: 1.5,
  queueLongWaitMinutes: 10,
  queueRecentGameCount: 3,

  // Betting (games)
  betAmounts: [1, 10, 100],
  betHouseEdge: 0.05,

  // Prediction
  houseEdge: 0.05,
  maxStake: 1000,
  minStake: 10,
  freePredictionsPerDay: 3,

  // Rewards
  rewards: {
    registration: 500,
    participation: 10,
    rank1: 200,
    rank2: 100,
    rank3: 50,
    rank4_5: 20,
    record: 50
  }
}
