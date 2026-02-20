import { useState, useEffect, useRef } from 'react'
import { publicApi } from '../api'

/**
 * Polling hook for live battle state.
 * Polls /games/:id/state every 1 second during battle phase.
 */
export default function useBattleState(gameId, isActive) {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!gameId || !isActive) {
      setState(null)
      return
    }

    function poll() {
      publicApi.get('/games/' + gameId + '/state')
        .then(res => {
          setState(res.data)
          setError(null)
        })
        .catch(err => {
          // Game might have ended
          if (err.response?.status === 400) {
            setError('ended')
          }
        })
    }

    poll() // immediate first poll
    intervalRef.current = setInterval(poll, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [gameId, isActive])

  return { state, error }
}
