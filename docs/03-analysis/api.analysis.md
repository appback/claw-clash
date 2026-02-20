# WebSocket (Socket.io) Migration Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: claw-clash
> **Version**: 0.1.0
> **Analyst**: gap-detector
> **Date**: 2026-02-20
> **Design Spec**: HTTP Polling -> WebSocket (Socket.io) Migration

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Verify that the Socket.io real-time communication layer has been correctly implemented according to the design specification for migrating ClawClash from HTTP polling to WebSocket push architecture.

### 1.2 Analysis Scope

- **Design Document**: User-provided design specification (12 items + HTTP API retention)
- **Implementation Path**: `claw-clash/apps/api/` (backend), `claw-clash/client/` (frontend)
- **Analysis Date**: 2026-02-20

---

## 2. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match | 100% | PASS |
| Architecture Compliance | 100% | PASS |
| Convention Compliance | 100% | PASS |
| HTTP API Retention | 100% | PASS |
| **Overall** | **100%** | **PASS** |

---

## 3. Detailed Gap Analysis (Design vs Implementation)

### 3.1 Socket.io Server Setup (Design Item 1)

| Design Spec | Implementation | Status | File:Line |
|-------------|---------------|--------|-----------|
| `http.createServer(app)` | `const server = http.createServer(app)` | MATCH | `apps/api/server.js:17` |
| `new Server(server, cors)` | `const io = new Server(server, { cors: {...}, transports: [...] })` | MATCH | `apps/api/server.js:18-31` |
| `server.listen()` (not `app.listen()`) | `server.listen(config.port, ...)` | MATCH | `apps/api/server.js:93` |
| `startScheduler(io)` receives io | `startScheduler(io)` called in listen callback | MATCH | `apps/api/server.js:95` |
| `app.set('io', io)` stores io | `app.set('io', io)` | MATCH | `apps/api/server.js:34` |
| `join_game` room management | `socket.on('join_game', (gameId) => { socket.join(\`game:${gameId}\`) ... })` | MATCH | `apps/api/server.js:69-73` |
| `leave_game` room management | `socket.on('leave_game', (gameId) => { socket.leave(\`game:${gameId}\`) ... })` | MATCH | `apps/api/server.js:75-79` |
| Viewer count broadcast | `io.to(\`game:${gameId}\`).emit('viewers', count)` on join/leave/disconnect | MATCH | `apps/api/server.js:72,78,85` |
| Disconnecting handler | `socket.on('disconnecting', ...)` iterates rooms, broadcasts updated count | MATCH | `apps/api/server.js:81-89` |

**Score: 9/9 (100%)**

### 3.2 Battle State Push (Design Item 2)

| Design Spec | Implementation | Status | File:Line |
|-------------|---------------|--------|-----------|
| `battleEngine.js` has `setIO` | `let io = null; function setIO(socketIO) { io = socketIO }` | MATCH | `apps/api/services/battleEngine.js:22-23` |
| `setIO` exported | `module.exports = { setIO, ... }` | MATCH | `apps/api/services/battleEngine.js:1150` |
| `processTick()`: emit tick after `updateTick()` | `gameStateManager.updateTick(gameId, tickState)` then `if (io) io.to(\`game:${gameId}\`).emit('tick', tickState)` | MATCH | `apps/api/services/battleEngine.js:239-242` |
| `finalizeBattle()`: emit `battle_ended` | `if (io) io.to(\`game:${gameId}\`).emit('battle_ended', { reason, rankings: results })` | MATCH | `apps/api/services/battleEngine.js:821` |
| tickState includes tick number | `tickState = { tick, shrinkPhase, actorSlot, agents, powerups, events, eliminations }` | MATCH | `apps/api/services/battleEngine.js:214-235` |

**Score: 5/5 (100%)**

### 3.3 Chat Push (Design Item 3)

| Design Spec | Implementation | Status | File:Line |
|-------------|---------------|--------|-----------|
| `games.js sendChat()`: DB INSERT then emit | `await db.query(INSERT...)` then `const io = req.app.get('io'); if (io) io.to(\`game:${id}\`).emit('chat', result.rows[0])` | MATCH | `apps/api/controllers/v1/games.js:304-313` |
| Uses `req.app.get('io')` | `const io = req.app.get('io')` | MATCH | `apps/api/controllers/v1/games.js:312` |
| `chatPoolService.js triggerChat()`: DB INSERT then emit | `await db.query(INSERT...) ... if (io && insertResult.rows[0]) { io.to(\`game:${gameId}\`).emit('chat', insertResult.rows[0]) }` | MATCH | `apps/api/services/chatPoolService.js:59-69` |
| `chatPoolService.js` has `setIO()` | `let io = null; function setIO(socketIO) { io = socketIO }` | MATCH | `apps/api/services/chatPoolService.js:12-13` |

**Score: 4/4 (100%)**

### 3.4 Game State Change Push (Design Item 4)

| Design Spec | Implementation | Status | File:Line |
|-------------|---------------|--------|-----------|
| `startScheduler(io)` receives io | `function startScheduler(socketIO) { io = socketIO \|\| null; ... }` | MATCH | `apps/api/services/scheduler.js:19-20` |
| Injects io into battleEngine and chatPoolService | `battleEngine.setIO(io); chatPoolService.setIO(io)` | MATCH | `apps/api/services/scheduler.js:23-24` |
| created->lobby emit | `if (io) io.to(\`game:${g.id}\`).emit('game_state', { state: 'lobby' })` | MATCH | `apps/api/services/scheduler.js:107` |
| lobby->betting emit | `if (io) io.to(\`game:${g.id}\`).emit('game_state', { state: 'betting' })` | MATCH | `apps/api/services/scheduler.js:122` |
| betting->battle emit | `if (io) io.to(\`game:${g.id}\`).emit('game_state', { state: 'battle' })` | MATCH | `apps/api/services/scheduler.js:193` |
| Matchmaker queue broadcast | `io.emit('queue_update', { players_in_queue: parseInt(qResult.rows[0].cnt) })` | MATCH | `apps/api/services/scheduler.js:68` |

**Score: 6/6 (100%)**

### 3.5 Nginx WebSocket Config (Design Item 5)

| Design Spec | Implementation | Status | File:Line |
|-------------|---------------|--------|-----------|
| `/socket.io/` location block | `location /socket.io/ { ... }` | MATCH | `docker/nginx-host.conf:26` |
| proxy_pass to API | `proxy_pass http://127.0.0.1:3200;` | MATCH | `docker/nginx-host.conf:27` |
| Upgrade header | `proxy_set_header Upgrade $http_upgrade;` | MATCH | `docker/nginx-host.conf:29` |
| Connection header | `proxy_set_header Connection "upgrade";` | MATCH | `docker/nginx-host.conf:30` |
| 3600s timeout | `proxy_read_timeout 3600s;` | MATCH | `docker/nginx-host.conf:35` |

**Score: 5/5 (100%)**

### 3.6 Client Socket Singleton (Design Item 6)

| Design Spec | Implementation | Status | File:Line |
|-------------|---------------|--------|-----------|
| `io()` singleton export | `const socket = io({...}); export default socket` | MATCH | `client/src/socket.js:3-8` |
| `transports: ['websocket', 'polling']` | `transports: ['websocket', 'polling']` | MATCH | `client/src/socket.js:5` |

**Score: 2/2 (100%)**

### 3.7 Battle State Hook (Design Item 7)

| Design Spec | Implementation | Status | File:Line |
|-------------|---------------|--------|-----------|
| Polling removed | No `setInterval`, no periodic HTTP fetch | MATCH | `client/src/battle/useBattleState.js` (entire file) |
| `socket.emit('join_game')` | `socket.emit('join_game', gameId)` | MATCH | `client/src/battle/useBattleState.js:24` |
| `socket.emit('leave_game')` in cleanup | `socket.emit('leave_game', gameId)` in return | MATCH | `client/src/battle/useBattleState.js:77` |
| `socket.on('tick')` -> setState | `socket.on('tick', onTick)` where onTick calls `setState(tickState)` | MATCH | `client/src/battle/useBattleState.js:71` |
| Gap detection (tick !== lastTick+1 -> HTTP) | `if (lastTickRef.current !== null && tickState.tick !== lastTickRef.current + 1) { publicApi.get(...) }` | MATCH | `client/src/battle/useBattleState.js:38-44` |
| `socket.on('battle_ended')` -> setError('ended') | `function onBattleEnded() { setError('ended') }; socket.on('battle_ended', onBattleEnded)` | MATCH | `client/src/battle/useBattleState.js:51-52,72` |
| `socket.on('game_state')` -> state change detect | `function onGameState({ state: newState }) { if (newState === 'battle') ... }; socket.on('game_state', onGameState)` | MATCH | `client/src/battle/useBattleState.js:55-65,73` |
| `socket.on('viewers')` -> viewers count | `function onViewers(count) { setViewers(count) }; socket.on('viewers', onViewers)` | MATCH | `client/src/battle/useBattleState.js:67-68,74` |
| Returns `{ state, error, viewers }` | `return { state, error, viewers }` | MATCH | `client/src/battle/useBattleState.js:86` |

**Score: 9/9 (100%)**

### 3.8 Chat Panel (Design Item 8)

| Design Spec | Implementation | Status | File:Line |
|-------------|---------------|--------|-----------|
| Polling removed | No `setInterval` for chat refresh | MATCH | `client/src/battle/ChatPanel.jsx` (entire file) |
| `socket.on('chat')` -> add message | `socket.on('chat', onChat)` where onChat appends to messages | MATCH | `client/src/battle/ChatPanel.jsx:38` |
| Dedup with seenIds | `seenIdsRef.current.has(msg.id)` check before adding | MATCH | `client/src/battle/ChatPanel.jsx:33` |
| Initial load: HTTP (retained) | `publicApi.get('/games/' + gameId + '/chat')` | MATCH | `client/src/battle/ChatPanel.jsx:19` |
| Send: HTTP POST (retained) | `userApi.post('/games/' + gameId + '/chat', { message: ... })` | MATCH | `client/src/battle/ChatPanel.jsx:59` |

**Score: 5/5 (100%)**

### 3.9 Nav Queue Badge (Design Item 9)

| Design Spec | Implementation | Status | File:Line |
|-------------|---------------|--------|-----------|
| `socket.on('queue_update')` real-time | `socket.on('queue_update', onQueueUpdate)` | MATCH | `client/src/components/Nav.jsx:35` |
| Initial value HTTP (retained) | `publicApi.get('/queue/info')` | MATCH | `client/src/components/Nav.jsx:27` |
| 15s polling removed | No `setInterval` for queue polling | MATCH | `client/src/components/Nav.jsx` (entire file) |

**Score: 3/3 (100%)**

### 3.10 Viewer Count Display (Design Item 10)

| Design Spec | Implementation | Status | File:Line |
|-------------|---------------|--------|-----------|
| `useBattleState` viewers in UI | `const { state: liveState, error: liveError, viewers } = useBattleState(id, isBattle)` | MATCH | `client/src/pages/GamePage.jsx:23` |
| Viewers displayed in UI | `{isBattle && viewers > 0 && (<span> ... {viewers} watching</span>)}` | MATCH | `client/src/pages/GamePage.jsx:87-89` |

**Score: 2/2 (100%)**

### 3.11 Package Dependencies (Design Item 11)

| Design Spec | Implementation | Status | File:Line |
|-------------|---------------|--------|-----------|
| `socket.io` in API package.json | `"socket.io": "^4.7.0"` | MATCH | `apps/api/package.json:20` |
| `socket.io-client` in client package.json | `"socket.io-client": "^4.7.0"` | MATCH | `client/package.json:16` |

**Score: 2/2 (100%)**

### 3.12 Vite Dev Proxy (Design Item 12)

| Design Spec | Implementation | Status | File:Line |
|-------------|---------------|--------|-----------|
| `/socket.io` dev proxy | `'/socket.io': { target: 'http://localhost:3200', ws: true }` | MATCH | `client/vite.config.js:10-13` |
| `ws: true` enabled | `ws: true` | MATCH | `client/vite.config.js:12` |

**Score: 2/2 (100%)**

---

## 4. HTTP API Retention Verification

| Endpoint | Purpose | Route File | Status |
|----------|---------|------------|--------|
| `GET /games/:id/state` | Initial load + gap recovery | `routes/v1/index.js:59` | RETAINED |
| `GET /games/:id/chat` | Initial chat history | `routes/v1/index.js:60` | RETAINED |
| `POST /games/:id/chat` | Chat send (server broadcasts WS) | `routes/v1/index.js:81` | RETAINED |
| `GET /queue/info` | Initial queue count | `routes/v1/index.js:94` | RETAINED |

**Score: 4/4 (100%)**

---

## 5. Missing Features (Design O, Implementation X)

| Item | Design Location | Description |
|------|-----------------|-------------|
| (none) | - | - |

No missing features detected.

---

## 6. Added Features (Design X, Implementation O)

| Item | Implementation Location | Description |
|------|------------------------|-------------|
| CORS origin validation | `apps/api/server.js:20-27` | Socket.io server includes full CORS origin validation with dev fallback -- appropriate security hardening |
| `disconnecting` handler | `apps/api/server.js:81-89` | Broadcasts updated viewer count for all rooms on disconnect -- implicit in design but explicitly implemented |
| Chat dedup (seenIds) | `client/src/battle/ChatPanel.jsx:10,33-34` | Prevents duplicate messages on initial load + WS overlap -- implementation detail not in spec |
| game_state re-fetch on battle start | `client/src/battle/useBattleState.js:56-64` | When `game_state.state === 'battle'`, re-fetches full HTTP state -- smart fallback |

All additions are improvements. No unauthorized feature drift.

---

## 7. Changed Features (Design != Implementation)

| Item | Design | Implementation | Impact |
|------|--------|----------------|--------|
| (none) | - | - | - |

No deviations from design spec detected.

---

## 8. Match Rate Summary

```
Total Design Checkpoints:   54
  Matched:                  54  (100%)
  Missing:                   0  (0%)
  Changed:                   0  (0%)
  Added (enhancements):      4  (not counted as gap)

Breakdown by Category:
  1. Socket.io Server Setup:       9/9   (100%)
  2. Battle State Push:            5/5   (100%)
  3. Chat Push:                    4/4   (100%)
  4. Game State Change Push:       6/6   (100%)
  5. Nginx WebSocket Config:       5/5   (100%)
  6. Client Socket Singleton:      2/2   (100%)
  7. Battle State Hook:            9/9   (100%)
  8. Chat Panel:                   5/5   (100%)
  9. Nav Queue Badge:              3/3   (100%)
 10. Viewer Count Display:         2/2   (100%)
 11. Package Dependencies:         2/2   (100%)
 12. Vite Dev Proxy:               2/2   (100%)
 13. HTTP API Retention:           4/4   (100%)

Match Rate: 100%
```

---

## 9. Architecture Notes

### 9.1 io Injection Pattern

The implementation uses a consistent `setIO()` injection pattern across all services that need WebSocket access:

```
server.js
  |-- app.set('io', io)              // for Express controllers (req.app.get('io'))
  |-- startScheduler(io)             // passes to scheduler
        |-- battleEngine.setIO(io)   // scheduler injects to battle engine
        |-- chatPoolService.setIO(io) // scheduler injects to chat pool
```

This avoids circular dependencies and keeps io initialization centralized.

### 9.2 Null-Safe Emission

Every `io.emit()` / `io.to().emit()` call is guarded with `if (io)`, ensuring the API still functions correctly if Socket.io is not initialized (e.g., in test environments where `NODE_ENV === 'test'` skips `server.listen()`).

### 9.3 Gap Detection (Client)

The `useBattleState` hook tracks `lastTickRef` and detects non-consecutive tick numbers. When a gap is found, it falls back to a full HTTP state reload. This provides resilience against dropped WebSocket messages.

---

## 10. Recommended Actions

### 10.1 Immediate Actions

None required. All design items are fully implemented.

### 10.2 Documentation Update Needed

None. Implementation matches design specification exactly.

### 10.3 Future Considerations

| Item | Description | Priority |
|------|-------------|----------|
| Reconnection handling | Client `socket.js` does not configure explicit `reconnection` options. Socket.io defaults (infinite retries) apply, which is acceptable but explicit config may be preferable. | Low |
| Room cleanup audit | Verify that `disconnecting` handler covers all edge cases (e.g., browser crash before `leave_game` fires). Current implementation handles this via `disconnecting` event iterating `socket.rooms`. | Low |
| Load testing | Socket.io with many concurrent viewers per game room has not been profiled. For `>100` concurrent viewers, consider Redis adapter. | Medium (future) |

---

## 11. Conclusion

The HTTP Polling to WebSocket (Socket.io) migration is **fully implemented** with a **100% match rate** against the design specification. All 12 design items and 4 HTTP API retention requirements are correctly reflected in the codebase. The 4 additional implementation details (CORS validation, disconnect handling, chat dedup, game_state re-fetch) are positive enhancements that improve robustness without deviating from the design intent.

**Status: PASS -- No gaps found. Ready for deployment.**

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-20 | Initial gap analysis | gap-detector |
