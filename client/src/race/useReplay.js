import { useState, useEffect, useCallback, useRef } from 'react'

export default function useReplay(replayData) {
  const [currentCheckpoint, setCurrentCheckpoint] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const intervalRef = useRef(null)

  const totalCheckpoints = replayData ? replayData.challenge_count : 0

  // Compute positions (0-100) for each lane at current checkpoint
  const positions = replayData
    ? replayData.lanes.map(lane => lane.checkpoints[currentCheckpoint] || 0)
    : []

  // Find current highlight
  const currentHighlight = replayData
    ? replayData.highlights.find(h => h.at_checkpoint === currentCheckpoint)
    : null

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const play = useCallback(() => {
    if (!replayData || totalCheckpoints === 0) return
    setIsPlaying(true)
  }, [replayData, totalCheckpoints])

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stop()
    } else {
      if (currentCheckpoint >= totalCheckpoints) {
        setCurrentCheckpoint(0)
      }
      play()
    }
  }, [isPlaying, currentCheckpoint, totalCheckpoints, play, stop])

  const seek = useCallback((checkpoint) => {
    setCurrentCheckpoint(Math.max(0, Math.min(checkpoint, totalCheckpoints)))
  }, [totalCheckpoints])

  // Interval-based playback
  useEffect(() => {
    if (!isPlaying) return

    const intervalMs = 1500 / speed
    intervalRef.current = setInterval(() => {
      setCurrentCheckpoint(prev => {
        if (prev >= totalCheckpoints) {
          stop()
          return totalCheckpoints
        }
        return prev + 1
      })
    }, intervalMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isPlaying, speed, totalCheckpoints, stop])

  return {
    currentCheckpoint,
    isPlaying,
    speed,
    positions,
    currentHighlight,
    togglePlay,
    setSpeed,
    seek
  }
}
