import React, { useState, useEffect } from 'react'
import { publicApi } from '../api'
import RaceCard from '../components/RaceCard'
import Loading from '../components/Loading'

const TRACK_TYPES = ['all', 'trivia', 'math', 'logic', 'word']

export default function HistoryPage() {
  const [races, setRaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [trackFilter, setTrackFilter] = useState('all')

  useEffect(() => {
    setLoading(true)
    publicApi.get('/races', { state: 'finished', limit: 50 })
      .then(res => setRaces(res.data.data || []))
      .catch(() => setRaces([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = trackFilter === 'all'
    ? races
    : races.filter(r => r.track_type === trackFilter)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Race History</h1>
        <p className="page-subtitle">Browse completed races and watch replays</p>
      </div>

      <div className="filters">
        {TRACK_TYPES.map(tt => (
          <button
            key={tt}
            className={'btn btn-sm' + (trackFilter === tt ? ' btn-primary' : ' btn-ghost')}
            onClick={() => setTrackFilter(tt)}
          >
            {tt === 'all' ? 'All Tracks' : tt.charAt(0).toUpperCase() + tt.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{'\uD83D\uDCDC'}</div>
          <div className="empty-state-text">No finished races found</div>
        </div>
      ) : (
        <div className="race-cards">
          {filtered.map(race => (
            <RaceCard key={race.id} race={race} />
          ))}
        </div>
      )}
    </div>
  )
}
