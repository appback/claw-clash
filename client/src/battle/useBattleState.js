import { useState, useEffect, useRef } from 'react'
import { publicApi } from '../api'
import socket from '../socket'

/**
 * WebSocket-based hook for live battle state.
 * Uses socket.io for real-time tick push with gap detection fallback to HTTP.
 *
 * Primary: WS tick events populate state directly.
 * Fallback: HTTP GET /state for initial load + gap recovery.
 * Only 'battle_ended' WS event sets error='ended'.
 */
export default function useBattleState(gameId, isActive) {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const [viewers, setViewers] = useState(0)
  const lastTickRef = useRef(null)

  useEffect(() => {
    if (!gameId || !isActive) {
      setState(null)
      setError(null)
      lastTickRef.current = null
      return
    }

    // Join game room (already joined by GamePage, but ensure)
    socket.emit('join_game', gameId)

    // Initial state load via HTTP (best-effort, WS ticks are primary)
    function loadInitialState(retries = 5) {
      publicApi.get('/games/' + gameId + '/state')
        .then(res => {
          setState(res.data)
          lastTickRef.current = res.data.tick
        })
        .catch(() => {
          // Don't set error — wait for WS ticks instead.
          // Battle engine may not have initialized yet.
          if (retries > 0) {
            setTimeout(() => loadInitialState(retries - 1), 1000)
          }
          // After all retries, still don't error — WS ticks will populate state
        })
    }
    loadInitialState()

    function onTick(tickState) {
      // WS tick arrived — battle is definitely active, clear any stale error
      if (error) setError(null)

      // Gap detection: if tick is not consecutive, reload full state via HTTP
      if (lastTickRef.current !== null && tickState.tick !== lastTickRef.current + 1) {
        publicApi.get('/games/' + gameId + '/state')
          .then(res => {
            setState(res.data)
            lastTickRef.current = res.data.tick
          })
          .catch(() => {})
      } else {
        // Preserve arena from initial HTTP state (tick doesn't include it)
        setState(prev => prev?.arena ? { ...tickState, arena: prev.arena } : tickState)
      }
      lastTickRef.current = tickState.tick
    }

    function onBattleEnded() {
      // Only this event should set ended — NOT HTTP 400
      setError('ended')
    }

    function onGameState({ state: newState }) {
      if (newState === 'battle') {
        // Battle just started — fetch initial state with retry
        function fetchBattleState(retries = 5) {
          publicApi.get('/games/' + gameId + '/state')
            .then(res => {
              setState(res.data)
              lastTickRef.current = res.data.tick
            })
            .catch(() => {
              if (retries > 0) {
                setTimeout(() => fetchBattleState(retries - 1), 1000)
              }
            })
        }
        fetchBattleState()
      } else if (newState === 'ended') {
        setError('ended')
      }
    }

    function onViewers(count) {
      setViewers(count)
    }

    socket.on('tick', onTick)
    socket.on('battle_ended', onBattleEnded)
    socket.on('game_state', onGameState)
    socket.on('viewers', onViewers)

    return () => {
      socket.emit('leave_game', gameId)
      socket.off('tick', onTick)
      socket.off('battle_ended', onBattleEnded)
      socket.off('game_state', onGameState)
      socket.off('viewers', onViewers)
      lastTickRef.current = null
    }
  }, [gameId, isActive])

  return { state, error, viewers }
}
