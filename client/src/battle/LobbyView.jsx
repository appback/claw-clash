import React, { useState, useEffect, useRef } from 'react'
import { WEAPON_EMOJI, ARMOR_EMOJI, SLOT_COLORS } from './AgentToken'
import AgentFace from './AgentFace'
import CountdownTimer from '../components/CountdownTimer'
import { publicApi, userApi } from '../api'
import socket from '../socket'
import { getCredits, useCredit } from '../utils/guestCredits'

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

  // Pulse + reaction state
  const prevBetCountsRef = useRef({})
  const prevSponsorCountsRef = useRef({})
  const [pulseSlots, setPulseSlots] = useState({})
  const [reactionSlots, setReactionSlots] = useState({})

  // Guest credits
  const [guestCredits, setGuestCredits] = useState(getCredits())

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

  // Detect bet count changes → pulse + reaction
  useEffect(() => {
    const prev = prevBetCountsRef.current
    const newPulse = {}
    const newReaction = {}
    for (const slot of Object.keys(betCounts)) {
      if ((prev[slot] || 0) < (betCounts[slot] || 0)) {
        newPulse[slot] = 'bet'
        newReaction[slot] = 'shake'
      }
    }
    prevBetCountsRef.current = { ...betCounts }
    if (Object.keys(newPulse).length > 0) {
      setPulseSlots(p => ({ ...p, ...newPulse }))
      setReactionSlots(p => ({ ...p, ...newReaction }))
      setTimeout(() => {
        setPulseSlots(p => {
          const next = { ...p }
          for (const s of Object.keys(newPulse)) delete next[s]
          return next
        })
        setReactionSlots(p => {
          const next = { ...p }
          for (const s of Object.keys(newReaction)) delete next[s]
          return next
        })
      }, 2000)
    }
  }, [betCounts])

  // Detect sponsor count changes → pulse + reaction
  useEffect(() => {
    const sponsorCounts = {}
    for (const entry of entries) {
      if (entry.sponsorship) sponsorCounts[entry.slot] = entry.sponsorship.sponsor_count || 0
    }
    const prev = prevSponsorCountsRef.current
    const newPulse = {}
    const newReaction = {}
    for (const slot of Object.keys(sponsorCounts)) {
      if ((prev[slot] || 0) < (sponsorCounts[slot] || 0)) {
        newPulse[slot] = 'sponsor'
        newReaction[slot] = 'happy'
      }
    }
    prevSponsorCountsRef.current = { ...sponsorCounts }
    if (Object.keys(newPulse).length > 0) {
      setPulseSlots(p => ({ ...p, ...newPulse }))
      setReactionSlots(p => ({ ...p, ...newReaction }))
      setTimeout(() => {
        setPulseSlots(p => {
          const next = { ...p }
          for (const s of Object.keys(newPulse)) delete next[s]
          return next
        })
        setReactionSlots(p => {
          const next = { ...p }
          for (const s of Object.keys(newReaction)) delete next[s]
          return next
        })
      }, 2000)
    }
  }, [entries])

  // Guest: find which slot already bet on
  const guestBetSlot = (!isLoggedIn && myBets.length > 0) ? myBets[0].slot : null

  async function handleBet(slot, amount) {
    if (betLoading !== null) return
    setBetLoading(slot)
    try {
      const api = isLoggedIn ? userApi : publicApi
      const res = await api.post('/games/' + game.id + '/bet', { slot, amount })
      if (onBetPlaced && res.data.remaining_points != null) onBetPlaced(res.data.remaining_points)
      if (!isLoggedIn && res.data.guest_credits_used) {
        useCredit()
        setGuestCredits(getCredits())
      }
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
            {isBetting && !isLoggedIn && (
              <span> &middot; <span className="betting-points-inline">{'\uD83D\uDCB0'} {guestCredits} credits</span></span>
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
          const sponsorCount = sponsorship.sponsor_count || 0
          const hasBetPulse = pulseSlots[i] === 'bet'
          const hasSponsorPulse = pulseSlots[i] === 'sponsor'
          const reaction = reactionSlots[i] || null

          // Guest: disable other slot buttons if already bet on a slot
          const guestOtherSlot = !isLoggedIn && guestBetSlot != null && guestBetSlot !== i

          return (
            <div key={i} className="lobby-slot" style={{ '--slot-color': color }}>
              <div className="lobby-slot-header">
                <span className="lobby-slot-number" style={{ color }}>Slot {i}</span>
                {isBetting && (
                  <span className="lobby-slot-counts">
                    <span className={hasSponsorPulse ? 'lobby-count-pulse' : ''} style={{ fontSize: Math.min(13 + sponsorCount * 0.1, 16) }}>S:{sponsorCount}</span>
                    {' '}
                    <span className={hasBetPulse ? 'lobby-count-pulse' : ''} style={{ fontSize: Math.min(13 + slotBetCount * 0.1, 16) }}>B:{slotBetCount}</span>
                  </span>
                )}
              </div>

              <div className="lobby-slot-visual">
                <span className="lobby-weapon-icon">{weaponIcon}</span>
                <div style={{ position: 'relative' }}>
                  <AgentFace className="lobby-face" reaction={reaction} />
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
                      disabled={betLoading !== null || guestCredits <= 0 || guestOtherSlot}
                      onClick={() => handleBet(i, 0)}
                    >
                      {betLoading === i ? '..' : `Bet (\uD83D\uDCB0${guestCredits})`}
                    </button>
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
