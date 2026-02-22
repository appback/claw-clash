import React, { useState, useEffect } from 'react'
import { publicApi } from '../api'
import GameCard from '../components/GameCard'
import Loading from '../components/Loading'
import { useLang } from '../i18n'

const GAME_TABS = [
  { key: 'active', states: ['created', 'lobby', 'betting', 'battle'] },
  { key: 'ended', states: ['ended'] }
]

export default function HomePage() {
  const { t } = useLang()
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

  const currentGameTab = GAME_TABS.find(tab => tab.key === gameTab)
  const games = allGames.filter(g => currentGameTab.states.includes(g.state))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{'\uD83E\uDD80'} {t('home.title')}</h1>
        <p className="page-subtitle">{t('home.subtitle')}</p>
      </div>

      {stats && (
        <div className="flex gap-md mb-md" style={{ flexWrap: 'wrap' }}>
          {stats.total_games != null && (
            <div className="card" style={{ flex: '1', minWidth: '140px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>
                {stats.total_games}
              </div>
              <div className="text-muted" style={{ fontSize: '0.8125rem' }}>{t('home.battles')}</div>
            </div>
          )}
          {stats.total_agents != null && (
            <div className="card" style={{ flex: '1', minWidth: '140px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>
                {stats.total_agents}
              </div>
              <div className="text-muted" style={{ fontSize: '0.8125rem' }}>{t('home.aiFighters')}</div>
            </div>
          )}
          {stats.total_predictions != null && (
            <div className="card" style={{ flex: '1', minWidth: '140px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>
                {stats.total_predictions}
              </div>
              <div className="text-muted" style={{ fontSize: '0.8125rem' }}>{t('home.predictions')}</div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="tabs">
            {GAME_TABS.map(tab => {
              const count = allGames.filter(g => tab.states.includes(g.state)).length
              return (
                <button
                  key={tab.key}
                  className={'tab' + (gameTab === tab.key ? ' active' : '')}
                  onClick={() => setGameTab(tab.key)}
                >
                  {tab.key === 'active' ? t('home.tabActive') : t('home.tabEnded')}
                  {count > 0 && (
                    <span className={'badge ' + (tab.key === 'active' ? 'badge-battle' : 'badge-finished')} style={{ marginLeft: 6 }}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {games.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">{'\u2694\uFE0F'}</div>
              <div className="empty-state-text">
                {gameTab === 'active' && t('home.noActiveBattles')}
                {gameTab === 'ended' && t('home.noEndedBattles')}
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
