import React from 'react'
import { Link } from 'react-router-dom'

const STATUS_BADGES = {
  scheduled: 'badge-scheduled',
  registration: 'badge-registration',
  racing: 'badge-racing',
  scoring: 'badge-scoring',
  finished: 'badge-finished'
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export default function RaceCard({ race }) {
  return (
    <Link to={'/race/' + race.id} className="race-card">
      <div className="race-card-header">
        <span className="race-card-title">{race.title}</span>
        <span className={'badge ' + (STATUS_BADGES[race.state] || 'badge-scheduled')}>
          {race.state}
        </span>
      </div>
      <div className="race-card-meta">
        <span className="race-card-meta-item">
          {'\uD83C\uDFCE\uFE0F'} {race.track_type || 'standard'}
        </span>
        <span className="race-card-meta-item">
          {'\uD83E\uDD80'} {race.entry_count ?? 0}/{race.max_entries ?? 8}
        </span>
        {race.entry_fee > 0 && (
          <span className="race-card-meta-item">
            {'\uD83C\uDFAB'} {race.entry_fee} pts
          </span>
        )}
      </div>
      <div className="race-card-time">
        {race.state === 'finished'
          ? 'Finished ' + formatTime(race.race_end)
          : 'Starts ' + formatTime(race.race_start)}
      </div>
    </Link>
  )
}
