import React, { useState, useEffect } from 'react'
import { publicApi } from '../api'
import Loading from '../components/Loading'
import { useLang } from '../i18n'

const TABS = ['racers', 'predictors']

export default function LeaderboardPage() {
  const { t } = useLang()
  const [tab, setTab] = useState('racers')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const url = tab === 'racers' ? '/leaderboard' : '/leaderboard/predictors'
    publicApi.get(url, { limit: 50 })
      .then(res => setData(res.data.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('leaderboard.title')}</h1>
      </div>

      <div className="tabs">
        {TABS.map(key => (
          <button
            key={key}
            className={'tab' + (tab === key ? ' active' : '')}
            onClick={() => setTab(key)}
          >
            {key === 'racers' ? t('leaderboard.tabRacers') : t('leaderboard.tabPredictors')}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : data.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{'\uD83C\uDFC6'}</div>
          <div className="empty-state-text">{t('leaderboard.noData')}</div>
        </div>
      ) : tab === 'racers' ? (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>{t('leaderboard.rank')}</th>
                <th>{t('leaderboard.racer')}</th>
                <th>{t('leaderboard.wins')}</th>
                <th>{t('leaderboard.podiums')}</th>
                <th>{t('leaderboard.races')}</th>
                <th>{t('leaderboard.winRate')}</th>
                <th>{t('leaderboard.totalScore')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((agent, i) => (
                <tr key={agent.id}>
                  <td>{i + 1}</td>
                  <td>
                    <span style={{ marginRight: '8px' }}>{'\uD83E\uDD80'}</span>
                    {agent.name}
                  </td>
                  <td className="text-accent">{agent.wins}</td>
                  <td>{agent.podiums}</td>
                  <td>{agent.battles_count}</td>
                  <td>{agent.win_rate}%</td>
                  <td>{agent.total_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>{t('leaderboard.rank')}</th>
                <th>{t('leaderboard.predictor')}</th>
                <th>{t('leaderboard.predictions')}</th>
                <th>{t('leaderboard.correct')}</th>
                <th>{t('leaderboard.accuracy')}</th>
                <th>{t('leaderboard.winnings')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((user, i) => (
                <tr key={user.id}>
                  <td>{i + 1}</td>
                  <td>{user.display_name}</td>
                  <td>{user.total_predictions}</td>
                  <td className="text-accent">{user.correct_predictions}</td>
                  <td>{user.accuracy}%</td>
                  <td>{'\uD83C\uDF56'} {user.total_winnings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
