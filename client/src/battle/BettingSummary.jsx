import React, { useState, useEffect, useRef } from 'react'
import { publicApi, userApi } from '../api'
import { SLOT_COLORS } from './AgentToken'
import { addCredits } from '../utils/guestCredits'

export default function BettingSummary({ gameId }) {
  const [data, setData] = useState(null)
  const isLoggedIn = !!localStorage.getItem('user_token')
  const creditSettledRef = useRef(false)

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
  const hasSettled = myBets.some(b => b.settled)

  // Group my bets by slot
  const myBetsBySlot = {}
  for (const b of myBets) {
    if (!myBetsBySlot[b.slot]) myBetsBySlot[b.slot] = { count: 0, totalAmount: 0, totalPayout: 0, settled: false }
    myBetsBySlot[b.slot].count++
    myBetsBySlot[b.slot].totalAmount += b.amount
    myBetsBySlot[b.slot].totalPayout += b.payout
    if (b.settled) myBetsBySlot[b.slot].settled = true
  }

  const myTotalBet = myBets.reduce((s, b) => s + b.amount, 0)
  const myTotalPayout = myBets.reduce((s, b) => s + b.payout, 0)
  const myNet = myTotalPayout - myTotalBet

  // Guest credit settlement: add credits on win (once per game)
  if (isGuest && hasSettled && myTotalPayout > 0 && !creditSettledRef.current) {
    const settledKey = 'cc_settled_' + gameId
    if (!sessionStorage.getItem(settledKey)) {
      addCredits(myTotalPayout)
      sessionStorage.setItem(settledKey, '1')
    }
    creditSettledRef.current = true
  }

  return (
    <div className="card betting-summary">
      <h3 className="card-title">Betting Results</h3>

      <div className="betting-summary-slots">
        {data.bets.filter(b => b.count > 0).map(b => {
          const color = SLOT_COLORS[b.slot % SLOT_COLORS.length]
          return (
            <div key={b.slot} className="betting-summary-slot">
              <span className="betting-summary-slot-label" style={{ color }}>Slot {b.slot}</span>
              <span className="betting-summary-slot-count">
                {b.count} bet{b.count !== 1 ? 's' : ''}
                {b.total_amount > 0 && ` / \uD83C\uDF56 ${b.total_amount}`}
              </span>
            </div>
          )
        })}
      </div>

      <div className="betting-summary-total">
        Total: {totalBets} bet{totalBets !== 1 ? 's' : ''}
      </div>

      {Object.keys(myBetsBySlot).length > 0 && !isGuest && (
        <div className="betting-summary-my">
          <h4>Your Bets</h4>
          {Object.entries(myBetsBySlot).map(([slot, info]) => (
            <div key={slot} className="betting-summary-my-row">
              <span style={{ color: SLOT_COLORS[slot % SLOT_COLORS.length] }}>Slot {slot}</span>
              <span>{info.count > 1 ? `${info.count}x / ` : ''}{'\uD83C\uDF56'} {info.totalAmount}</span>
              <span className={info.totalPayout > 0 ? 'text-win' : 'text-lose'}>
                {info.settled ? (info.totalPayout > 0 ? `+${info.totalPayout}` : 'Lost') : 'Pending'}
              </span>
            </div>
          ))}
          {hasSettled && (
            <div className={'betting-summary-net' + (myNet >= 0 ? ' text-win' : ' text-lose')}>
              Net: {myNet >= 0 ? '+' : ''}{'\uD83C\uDF56'} {myNet}
            </div>
          )}
        </div>
      )}

      {Object.keys(myBetsBySlot).length > 0 && isGuest && (
        <div className="betting-summary-my">
          <h4>Your Picks</h4>
          {Object.entries(myBetsBySlot).map(([slot, info]) => (
            <div key={slot} className="betting-summary-my-row">
              <span style={{ color: SLOT_COLORS[slot % SLOT_COLORS.length] }}>Slot {slot}</span>
              <span className="text-muted">{info.count} bet{info.count !== 1 ? 's' : ''}</span>
              <span className={info.totalPayout > 0 ? 'text-win' : 'text-lose'}>
                {info.settled ? (info.totalPayout > 0 ? `+${info.totalPayout} credits` : 'Lost') : 'Pending'}
              </span>
            </div>
          ))}
          {hasSettled && myTotalPayout > 0 && (
            <div className="betting-summary-guest-result text-win">
              Won: +{myTotalPayout} credits
            </div>
          )}
          {hasSettled && myTotalPayout === 0 && (
            <div className="betting-summary-guest-cta">
              Better luck next time! Sign up for real rewards.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
