import React from 'react'

export default function CrabLane({ lane, position, index }) {
  return (
    <div className="crab-lane" data-lane={index}>
      <span className="crab-lane-rank">{index + 1}</span>
      <span className="crab-lane-emoji">{'\uD83E\uDD80'}</span>
      <div className="crab-lane-bar-container">
        <div
          className="crab-lane-bar"
          style={{ width: Math.max(position, 2) + '%' }}
        >
          {position > 15 && (
            <span className="crab-lane-score">{position}%</span>
          )}
        </div>
      </div>
      <span className="crab-lane-name" title={lane.name}>
        {lane.name}
      </span>
    </div>
  )
}
