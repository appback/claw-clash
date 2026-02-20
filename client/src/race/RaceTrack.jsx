import React from 'react'
import CrabLane from './CrabLane'

export default function RaceTrack({ lanes, positions, currentCheckpoint, highlight }) {
  if (!lanes || lanes.length === 0) {
    return (
      <div className="race-track">
        <div className="empty-state">
          <div className="empty-state-text">No race data available</div>
        </div>
      </div>
    )
  }

  // Sort lanes by current position (descending) for visual ranking
  const sortedLanes = lanes
    .map((lane, i) => ({ lane, position: positions[i] || 0, originalIndex: i }))
    .sort((a, b) => b.position - a.position)

  return (
    <div className="race-track" style={{ position: 'relative' }}>
      <div className="race-track-header">
        <span>START</span>
        <span>FINISH</span>
      </div>
      <div className="race-lanes">
        {sortedLanes.map(({ lane, position, originalIndex }) => (
          <CrabLane
            key={lane.agent_id}
            lane={lane}
            position={position}
            index={originalIndex}
          />
        ))}
      </div>
      {highlight && (
        <div className="highlight-toast">
          {'\uD83D\uDD25'} {highlight.by} overtakes {highlight.positions_gained} positions!
        </div>
      )}
    </div>
  )
}
