import { useState, useEffect, useRef } from 'react'
import { publicApi } from '../api'
import socket from '../socket'

/**
 * WebSocket-based hook for live battle state.
 * Uses socket.io for real-time tick push with gap detection fallback to HTTP.
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

    // Join game room
    socket.emit('join_game', gameId)

    // Initial state load via HTTP
    publicApi.get('/games/' + gameId + '/state')
      .then(res => {
        setState(res.data)
        lastTickRef.current = res.data.tick
      })
      .catch(err => {
        if (err.response?.status === 400) setError('ended')
      })

    function onTick(tickState) {
      // Gap detection: if tick is not consecutive, reload full state via HTTP
      if (lastTickRef.current !== null && tickState.tick !== lastTickRef.current + 1) {
        publicApi.get('/games/' + gameId + '/state')
          .then(res => {
            setState(res.data)
            lastTickRef.current = res.data.tick
          })
          .catch(() => {})
      } else {
        setState(tickState)
      }
      lastTickRef.current = tickState.tick
    }

    function onBattleEnded() {
      setError('ended')
    }

    function onGameState({ state: newState }) {
      if (newState === 'battle') {
        // Re-fetch full state when battle starts
        publicApi.get('/games/' + gameId + '/state')
          .then(res => {
            setState(res.data)
            lastTickRef.current = res.data.tick
          })
          .catch(() => {})
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
