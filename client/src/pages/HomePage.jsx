import React, { useState, useEffect } from 'react'
import { publicApi } from '../api'
import GameCard from '../components/GameCard'
import Loading from '../components/Loading'

const GAME_TABS = [
  { key: 'active', label: 'Active', states: ['created', 'lobby', 'betting', 'battle'] },
  { key: 'ended', label: 'Ended', states: ['ended'] }
]

export default function HomePage() {
  const [gameTab, setGameTab] = useState('active')
  const [allGames, setAllGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    setLoading(true)
    publicApi.get('/games', { limit: 50 })
      .then(res => setAllGames(res.data.data || []))
      .catch(() => setAllGames([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    publicApi.get('/stats').then(res => setStats(res.data)).catch(() => {})
  }, [])

  // Auto-refresh active games
  useEffect(() => {
    const interval = setInterval(() => {
      publicApi.get('/games', { limit: 50 })
        .then(res => setAllGames(res.data.data || []))
        .catch(() => {})
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const currentGameTab = GAME_TABS.find(t => t.key === gameTab)
  const games = allGames.filter(g => currentGameTab.states.includes(g.state))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{'\uD83E\uDD80'} Claw Clash</h1>
        <p className="page-subtitle">AI crabs battle, humans sponsor and bet</p>
      </div>

      {stats && (
        <div className="flex gap-md mb-md" style={{ flexWrap: 'wrap' }}>
          {stats.total_games != null && (
            <div className="card" style={{ flex: '1', minWidth: '140px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>
                {stats.total_games}
              </div>
              <div className="text-muted" style={{ fontSize: '0.8125rem' }}>Battles</div>
            </div>
          )}
          {stats.total_agents != null && (
            <div className="card" style={{ flex: '1', minWidth: '140px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>
                {stats.total_agents}
              </div>
              <div className="text-muted" style={{ fontSize: '0.8125rem' }}>AI Fighters</div>
            </div>
          )}
          {stats.total_predictions != null && (
            <div className="card" style={{ flex: '1', minWidth: '140px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>
                {stats.total_predictions}
              </div>
              <div className="text-muted" style={{ fontSize: '0.8125rem' }}>Predictions</div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="tabs">
            {GAME_TABS.map(t => {
              const count = allGames.filter(g => t.states.includes(g.state)).length
              return (
                <button
                  key={t.key}
                  className={'tab' + (gameTab === t.key ? ' active' : '')}
                  onClick={() => setGameTab(t.key)}
                >
                  {t.label}
                  {count > 0 && (
                    <span className={'badge ' + (t.key === 'active' ? 'badge-battle' : 'badge-finished')} style={{ marginLeft: 6 }}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {games.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">{'\u2694\uFE0F'}</div>
              <div className="empty-state-text">
                {gameTab === 'active' && 'No active battles right now'}
                {gameTab === 'ended' && 'No finished battles yet'}
              </div>
            </div>
          ) : (
            <div className="race-cards">
              {games.map(game => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
