import React, { useState, useEffect, useRef } from 'react'
import { WEAPON_EMOJI, ARMOR_EMOJI, SLOT_COLORS } from './AgentToken'
import AgentFace from './AgentFace'
import CountdownTimer from '../components/CountdownTimer'
import { publicApi, userApi } from '../api'
import socket from '../socket'

const BET_AMOUNTS = [1, 10, 100]

export default function LobbyView({ game, onSponsor, isBetting, userPoints, onBetPlaced, onBetsLoaded, serverOffset }) {
  const entries = game.entries || []
  const maxSlots = game.max_entries || 8
  const [speakingSlots, setSpeakingSlots] = useState({})
  const timersRef = useRef({})

  // Betting state
  const [betCounts, setBetCounts] = useState({})
  const [myBets, setMyBets] = useState([])
  const [betLoading, setBetLoading] = useState(null)

  const isLoggedIn = !!localStorage.getItem('user_token')

  // Listen for chat messages to show speech bubbles with message text
  useEffect(() => {
    function onChat(msg) {
      if (msg.slot == null || msg.msg_type === 'system' || msg.msg_type === 'human_chat') return
      setSpeakingSlots(prev => ({ ...prev, [msg.slot]: msg.message }))
      if (timersRef.current[msg.slot]) {
        clearTimeout(timersRef.current[msg.slot])
      }
      timersRef.current[msg.slot] = setTimeout(() => {
        setSpeakingSlots(prev => {
          const next = { ...prev }
          delete next[msg.slot]
          return next
        })
      }, 4000)
    }

    socket.on('chat', onChat)
    return () => {
      socket.off('chat', onChat)
      Object.values(timersRef.current).forEach(clearTimeout)
    }
  }, [])

  // Load bet counts during betting phase
  useEffect(() => {
    if (!isBetting) return
    loadBetCounts()
    const interval = setInterval(loadBetCounts, 5000)
    return () => clearInterval(interval)
  }, [isBetting, game.id])

  function loadBetCounts() {
    const api = isLoggedIn ? userApi : publicApi
    api.get('/games/' + game.id + '/bets')
      .then(res => {
        const map = {}
        for (const b of (res.data.bets || [])) map[b.slot] = b.count
        setBetCounts(map)
        if (res.data.my_bets) {
          setMyBets(res.data.my_bets)
          if (onBetsLoaded) onBetsLoaded(res.data.my_bets)
        }
      })
      .catch(() => {})
  }

  async function handleBet(slot, amount) {
    if (betLoading !== null) return
    setBetLoading(slot)
    try {
      const api = isLoggedIn ? userApi : publicApi
      const res = await api.post('/games/' + game.id + '/bet', { slot, amount })
      if (onBetPlaced && res.data.remaining_points != null) onBetPlaced(res.data.remaining_points)
      loadBetCounts()
    } catch (err) {
      const msg = err.response?.data?.message || 'Bet failed'
      alert(msg)
    } finally {
      setBetLoading(null)
    }
  }

  // Group my bets by slot
  const myBetsBySlot = {}
  for (const b of myBets) {
    if (!myBetsBySlot[b.slot]) myBetsBySlot[b.slot] = []
    myBetsBySlot[b.slot].push(b)
  }

  return (
    <div className="lobby-view">
      <div className="lobby-header">
        <div>
          <h2 className="section-title">{isBetting ? 'Betting' : 'Lobby'}</h2>
          <p className="text-muted">
            {entries.length}/{maxSlots} fighters joined &middot; Arena: {game.arena_name || 'The Pit'}
            {isBetting && userPoints != null && (
              <span> &middot; <span className="betting-points-inline">{userPoints} pts</span></span>
            )}
          </p>
        </div>
        <div>
          {isBetting
            ? <CountdownTimer target={game.battle_start} serverOffset={serverOffset} />
            : <CountdownTimer target={game.betting_start} serverOffset={serverOffset} />
          }
        </div>
      </div>

      <div className="lobby-slots">
        {Array.from({ length: maxSlots }, (_, i) => {
          const entry = entries.find(e => e.slot === i)
          if (!entry) {
            return (
              <div key={i} className="lobby-slot lobby-slot-empty">
                <div className="lobby-slot-number">Slot {i}</div>
                <div className="lobby-slot-waiting">Waiting for fighter...</div>
              </div>
            )
          }

          const color = SLOT_COLORS[i % SLOT_COLORS.length]
          const weaponIcon = WEAPON_EMOJI[entry.weapon_slug] || '\u2694\uFE0F'
          const armorIcon = ARMOR_EMOJI[entry.armor_slug] || ''
          const sponsorship = entry.sponsorship || {}
          const bonusHp = sponsorship.hp_boost || entry.bonus_hp || 0
          const bonusDmg = sponsorship.weapon_boost || entry.bonus_damage || 0
          const baseHp = 100
          const baseDmg = entry.weapon_damage || 10
          const defPct = Math.round((entry.armor_dmg_reduction || 0) * 100)
          const evdPct = Math.round((entry.armor_evasion || 0) * 100)

          const slotBetCount = betCounts[i] || 0
          const slotMyBets = myBetsBySlot[i] || []
          const myTotal = slotMyBets.reduce((s, b) => s + b.amount, 0)

          return (
            <div key={i} className="lobby-slot" style={{ '--slot-color': color }}>
              <div className="lobby-slot-header">
                <span className="lobby-slot-number" style={{ color }}>Slot {i}</span>
              </div>

              <div className="lobby-slot-visual">
                <span className="lobby-weapon-icon">{weaponIcon}</span>
                <div style={{ position: 'relative' }}>
                  <AgentFace className="lobby-face" />
                  {speakingSlots[i] && (
                    <div className="lobby-speech-bubble">{speakingSlots[i]}</div>
                  )}
                </div>
                <span className="lobby-armor-icon">{armorIcon || '\u2796'}</span>
              </div>

              <div className="lobby-slot-stats">
                <div className="lobby-stat">
                  <span className="lobby-stat-label">HP</span>
                  <span className="lobby-stat-value">
                    {baseHp}
                    {bonusHp > 0 && <span className="lobby-stat-bonus"> (+{bonusHp})</span>}
                  </span>
                </div>
                <div className="lobby-stat">
                  <span className="lobby-stat-label">DMG</span>
                  <span className="lobby-stat-value">
                    {baseDmg}
                    {bonusDmg > 0 && <span className="lobby-stat-bonus"> (+{bonusDmg})</span>}
                  </span>
                </div>
                {defPct > 0 && (
                  <div className="lobby-stat">
                    <span className="lobby-stat-label">DEF</span>
                    <span className="lobby-stat-value">{defPct}%</span>
                  </div>
                )}
                {evdPct > 0 && (
                  <div className="lobby-stat">
                    <span className="lobby-stat-label">EVD</span>
                    <span className="lobby-stat-value">{evdPct}%</span>
                  </div>
                )}
              </div>

              {/* Bet row — appended below stats during betting phase */}
              {isBetting && (
                <div className="lobby-slot-bets">
                  {isLoggedIn ? (
                    BET_AMOUNTS.map(amt => (
                      <button
                        key={amt}
                        className="bet-amount-btn"
                        disabled={betLoading !== null || (userPoints != null && userPoints < amt)}
                        onClick={() => handleBet(i, amt)}
                      >
                        {betLoading === i ? '..' : amt}
                      </button>
                    ))
                  ) : (
                    <button
                      className="bet-amount-btn bet-amount-btn-free"
                      disabled={betLoading !== null}
                      onClick={() => handleBet(i, 0)}
                    >
                      {betLoading === i ? '..' : 'Bet'}
                    </button>
                  )}
                  {slotBetCount > 0 && (
                    <span className="bet-count-label">{slotBetCount}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
