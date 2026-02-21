import React, { useState, useEffect } from 'react'
import { publicApi, userApi } from '../api'
import { SLOT_COLORS } from './AgentToken'

export default function BettingSummary({ gameId }) {
  const [data, setData] = useState(null)
  const isLoggedIn = !!localStorage.getItem('user_token')

  useEffect(() => {
    if (!gameId) return
    const api = isLoggedIn ? userApi : publicApi
    api.get('/games/' + gameId + '/bets')
      .then(res => setData(res.data))
      .catch(() => {})
  }, [gameId])

  if (!data || !data.bets) {
    return (
      <div className="card betting-summary">
        <h3 className="card-title">Betting</h3>
        <p className="text-muted text-center">No bets placed</p>
      </div>
    )
  }

  const totalBets = data.bets.reduce((s, b) => s + b.count, 0)
  const myBets = data.my_bets || []
  const isGuest = data.is_guest
  const myTotalBet = myBets.reduce((s, b) => s + b.amount, 0)
  const myTotalPayout = myBets.reduce((s, b) => s + b.payout, 0)
  const myNet = myTotalPayout - myTotalBet
  const hasSettled = myBets.some(b => b.settled)
  const guestWon = isGuest && hasSettled && myTotalPayout > 0

  return (
    <div className="card betting-summary">
      <h3 className="card-title">Betting Results</h3>

      <div className="betting-summary-slots">
        {data.bets.filter(b => b.count > 0).map(b => {
          const color = SLOT_COLORS[b.slot % SLOT_COLORS.length]
          return (
            <div key={b.slot} className="betting-summary-slot">
              <span className="betting-summary-slot-label" style={{ color }}>Slot {b.slot}</span>
              <span className="betting-summary-slot-count">{b.count} bet{b.count !== 1 ? 's' : ''}</span>
            </div>
          )
        })}
      </div>

      <div className="betting-summary-total">
        Total: {totalBets} bet{totalBets !== 1 ? 's' : ''}
      </div>

      {myBets.length > 0 && !isGuest && (
        <div className="betting-summary-my">
          <h4>Your Bets</h4>
          {myBets.map((b, i) => (
            <div key={i} className="betting-summary-my-row">
              <span style={{ color: SLOT_COLORS[b.slot % SLOT_COLORS.length] }}>Slot {b.slot}</span>
              <span>{b.amount} pts</span>
              <span className={b.payout > 0 ? 'text-win' : 'text-lose'}>
                {b.settled ? (b.payout > 0 ? `+${b.payout}` : 'Lost') : 'Pending'}
              </span>
            </div>
          ))}
          {hasSettled && (
            <div className={'betting-summary-net' + (myNet >= 0 ? ' text-win' : ' text-lose')}>
              Net: {myNet >= 0 ? '+' : ''}{myNet} pts
            </div>
          )}
        </div>
      )}

      {myBets.length > 0 && isGuest && (
        <div className="betting-summary-my">
          <h4>Your Picks</h4>
          {myBets.map((b, i) => (
            <div key={i} className="betting-summary-my-row">
              <span style={{ color: SLOT_COLORS[b.slot % SLOT_COLORS.length] }}>Slot {b.slot}</span>
              <span className="text-muted">free</span>
              <span className={b.payout > 0 ? 'text-win' : 'text-lose'}>
                {b.settled ? (b.payout > 0 ? `+${b.payout} pts` : 'Lost') : 'Pending'}
              </span>
            </div>
          ))}
          {hasSettled && myTotalPayout > 0 && (
            <div className="betting-summary-guest-result text-win">
              Would have earned: {myTotalPayout} pts
            </div>
          )}
          {guestWon && (
            <div className="betting-summary-guest-cta">
              You picked the winner! Sign up to earn points next time.
            </div>
          )}
          {hasSettled && myTotalPayout === 0 && (
            <div className="betting-summary-guest-cta">
              Sign up to bet with points and win real rewards!
            </div>
          )}
        </div>
      )}
    </div>
  )
}
