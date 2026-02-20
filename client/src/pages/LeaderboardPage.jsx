import React, { useState, useEffect } from 'react'
import { publicApi } from '../api'
import Loading from '../components/Loading'

const TABS = [
  { key: 'racers', label: 'Racers' },
  { key: 'predictors', label: 'Predictors' }
]

export default function LeaderboardPage() {
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
        <h1 className="page-title">Leaderboard</h1>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={'tab' + (tab === t.key ? ' active' : '')}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : data.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{'\uD83C\uDFC6'}</div>
          <div className="empty-state-text">No data yet</div>
        </div>
      ) : tab === 'racers' ? (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Racer</th>
                <th>Wins</th>
                <th>Podiums</th>
                <th>Races</th>
                <th>Win Rate</th>
                <th>Total Score</th>
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
                <th>#</th>
                <th>Predictor</th>
                <th>Predictions</th>
                <th>Correct</th>
                <th>Accuracy</th>
                <th>Winnings</th>
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
                  <td>{user.total_winnings} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
