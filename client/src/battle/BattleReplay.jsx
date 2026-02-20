import React, { useState, useEffect, useRef, useCallback } from 'react'
import BattleArena from './BattleArena'

/**
 * Sub-tick battle replay with playback controls.
 * Steps through 5 sub-ticks per visible frame at 1x speed (= 1 real second).
 * Uses the same BattleArena component as live view.
 */
const SUBTICKS_PER_SECOND = 5

export default function BattleReplay({ replayData, entries }) {
  const [currentTick, setCurrentTick] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const intervalRef = useRef(null)
  const arenaRef = useRef(null)

  const ticks = replayData?.ticks || []
  const maxTick = ticks.length - 1

  const currentState = ticks[currentTick] || null

  // Enrich state with arena info from replayData
  const enrichedState = currentState ? {
    ...currentState,
    arena: replayData.arena || currentState.arena || {
      width: 8,
      height: 8,
      terrain: []
    },
    max_ticks: replayData.max_ticks || 1500
  } : null

  const play = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    const stepSize = SUBTICKS_PER_SECOND
    const frameMs = 1000 / speed
    intervalRef.current = setInterval(() => {
      setCurrentTick(prev => {
        const next = prev + stepSize
        if (next >= maxTick) {
          setIsPlaying(false)
          clearInterval(intervalRef.current)
          return maxTick
        }
        return next
      })
    }, frameMs)
    setIsPlaying(true)
  }, [maxTick, speed])

  const pause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setIsPlaying(false)
  }, [])

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      if (currentTick >= maxTick) setCurrentTick(0)
      play()
    }
  }, [isPlaying, currentTick, maxTick, play, pause])

  // Update speed while playing
  useEffect(() => {
    if (isPlaying) {
      play()
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [speed])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  function handleSeek(e) {
    const tick = parseInt(e.target.value)
    setCurrentTick(tick)
    if (isPlaying) {
      pause()
    }
  }

  function cycleSpeed() {
    setSpeed(prev => {
      if (prev === 1) return 2
      if (prev === 2) return 4
      if (prev === 4) return 8
      return 1
    })
  }

  if (ticks.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-text">No replay data available</div>
        </div>
      </div>
    )
  }

  // Display time in seconds
  const currentSec = Math.floor(currentTick / SUBTICKS_PER_SECOND)
  const totalSec = Math.floor(maxTick / SUBTICKS_PER_SECOND)

  return (
    <div className="battle-replay">
      <BattleArena ref={arenaRef} state={enrichedState} entries={entries} />

      <div className="replay-controls">
        <button className="btn btn-sm btn-primary" onClick={togglePlay}>
          {isPlaying ? '\u23F8\uFE0F Pause' : '\u25B6\uFE0F Play'}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={cycleSpeed}>
          {speed}x
        </button>
        <input
          className="replay-slider"
          type="range"
          min="0"
          max={maxTick}
          value={currentTick}
          onChange={handleSeek}
        />
        <span className="replay-tick-label">
          {currentSec}s/{totalSec}s
        </span>
      </div>
    </div>
  )
}
