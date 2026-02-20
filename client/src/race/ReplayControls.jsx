import React from 'react'

const SPEEDS = [1, 2, 4]

export default function ReplayControls({
  isPlaying, speed, currentCheckpoint, totalCheckpoints,
  onPlayPause, onSpeed, onSeek
}) {
  const progress = totalCheckpoints > 0 ? (currentCheckpoint / totalCheckpoints) * 100 : 0

  function handleProgressClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    onSeek(Math.round(pct * totalCheckpoints))
  }

  return (
    <div className="replay-controls">
      <button className="replay-btn" onClick={onPlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? '\u23F8' : '\u25B6'}
      </button>

      <div className="replay-progress" onClick={handleProgressClick}>
        <div className="replay-progress-fill" style={{ width: progress + '%' }} />
      </div>

      <span className="replay-checkpoint">
        {currentCheckpoint}/{totalCheckpoints}
      </span>

      <div className="replay-speed">
        {SPEEDS.map(s => (
          <button
            key={s}
            className={'speed-btn' + (speed === s ? ' active' : '')}
            onClick={() => onSpeed(s)}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  )
}
