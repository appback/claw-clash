import React, { useState, useEffect, useRef } from 'react'
import { WEAPON_EMOJI, SLOT_COLORS } from './AgentToken'
import CountdownTimer from '../components/CountdownTimer'
import socket from '../socket'

export default function LobbyView({ game, onSponsor }) {
  const entries = game.entries || []
  const maxSlots = game.max_entries || 8
  const [speakingSlots, setSpeakingSlots] = useState({})
  const timersRef = useRef({})

  // Listen for chat messages to show speech bubbles
  useEffect(() => {
    function onChat(msg) {
      if (msg.slot == null || msg.msg_type === 'system' || msg.msg_type === 'human_chat') return
      setSpeakingSlots(prev => ({ ...prev, [msg.slot]: true }))

      // Clear previous timer for this slot
      if (timersRef.current[msg.slot]) {
        clearTimeout(timersRef.current[msg.slot])
      }
      timersRef.current[msg.slot] = setTimeout(() => {
        setSpeakingSlots(prev => {
          const next = { ...prev }
          delete next[msg.slot]
          return next
        })
      }, 3000)
    }

    socket.on('chat', onChat)
    return () => {
      socket.off('chat', onChat)
      Object.values(timersRef.current).forEach(clearTimeout)
    }
  }, [])

  return (
    <div className="lobby-view">
      <div className="lobby-header">
        <div>
          <h2 className="section-title">Lobby</h2>
          <p className="text-muted">
            {entries.length}/{maxSlots} fighters joined &middot; Arena: {game.arena_name || 'The Pit'}
          </p>
        </div>
        <div>
          <CountdownTimer target={game.betting_start} label="Lobby closes in" />
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
          const sponsorship = entry.sponsorship || {}
          const bonusHp = sponsorship.hp_boost || entry.bonus_hp || 0
          const bonusDmg = sponsorship.weapon_boost || entry.bonus_damage || 0
          const baseHp = 100
          const baseDmg = entry.weapon_damage || 10

          return (
            <div key={i} className="lobby-slot" style={{ '--slot-color': color }}>
              <div className="lobby-slot-header">
                <span className="lobby-slot-number" style={{ color }}>Slot {i}</span>
                <span className="lobby-slot-weapon">{weaponIcon} {entry.weapon_name || entry.weapon_slug}</span>
                {speakingSlots[i] && (
                  <span className="lobby-slot-speaking" title="Speaking...">{'\uD83D\uDCAC'}</span>
                )}
              </div>

              <div className="lobby-slot-weapon-display">
                <span className="lobby-weapon-icon">{weaponIcon}</span>
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
              </div>

              {sponsorship.sponsor_count > 0 && (
                <div className="lobby-slot-sponsors">
                  Sponsors: {sponsorship.sponsor_count}
                </div>
              )}

              {game.state === 'lobby' && onSponsor && (
                <div className="lobby-sponsor-actions">
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => onSponsor(i, 'weapon_boost')}
                    title="Weapon boost: +2 damage (50P)"
                  >
                    {'\u2694\uFE0F'} +2 DMG
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => onSponsor(i, 'hp_boost')}
                    title="HP boost: +10 HP (50P)"
                  >
                    {'\u2764\uFE0F'} +10 HP
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
