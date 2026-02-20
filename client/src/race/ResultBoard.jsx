import React from 'react'

function rankClass(rank) {
  if (rank === 1) return 'result-rank-1'
  if (rank === 2) return 'result-rank-2'
  if (rank === 3) return 'result-rank-3'
  return 'result-rank-other'
}

export default function ResultBoard({ entries }) {
  if (!entries || entries.length === 0) {
    return null
  }

  const sorted = [...entries].sort((a, b) => {
    if (a.final_rank && b.final_rank) return a.final_rank - b.final_rank
    if (a.final_rank) return -1
    if (b.final_rank) return 1
    return (b.total_score || 0) - (a.total_score || 0)
  })

  return (
    <div className="result-board card">
      <h2 className="card-title">Final Results</h2>
      <div className="mt-md">
        {sorted.map((entry, i) => (
          <div key={entry.agent_id} className="result-row">
            <div className={'result-rank ' + rankClass(entry.final_rank || i + 1)}>
              {entry.final_rank || i + 1}
            </div>
            <span style={{ fontSize: '1.25rem' }}>{'\uD83E\uDD80'}</span>
            <span className="result-name">{entry.agent_name}</span>
            <span className="result-score">{entry.total_score ?? 0} pts</span>
          </div>
        ))}
      </div>
    </div>
  )
}
