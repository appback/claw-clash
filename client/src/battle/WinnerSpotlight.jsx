import React from 'react'
import { SLOT_COLORS, WEAPON_EMOJI } from './AgentToken'
import AgentFace from './AgentFace'
import { useLang } from '../i18n'

export default function WinnerSpotlight({ game }) {
  const { t } = useLang()
  const entries = game.entries || []
  const winner = entries.find(e => e.final_rank === 1)
  if (!winner) return null

  const color = SLOT_COLORS[winner.slot % SLOT_COLORS.length]
  const weapon = WEAPON_EMOJI[winner.weapon_slug] || '\u2694\uFE0F'
  const survivedSec = winner.survived_ticks || 0

  return (
    <div className="winner-spotlight" style={{ '--winner-color': color }}>
      <div className="winner-spotlight-glow" />
      <div className="winner-spotlight-content">
        <div className="winner-spotlight-badge">{t('winner.badge')}</div>
        <div className="winner-spotlight-face">
          <AgentFace className="winner-face" />
        </div>
        <div className="winner-spotlight-identity">
          <span className="winner-slot" style={{ color }}>{t('common.slot')} {winner.slot}</span>
          {winner.agent_name && (
            <span className="winner-agent-name"> = {winner.agent_name} #{winner.agent_id?.slice(0, 8).toUpperCase()}</span>
          )}
        </div>
        <div className="winner-spotlight-weapon">
          <span className="winner-weapon-icon">{weapon}</span>
          <span className="winner-weapon-name">{winner.weapon_name || winner.weapon_slug}</span>
        </div>
        <div className="winner-spotlight-stats">
          <div className="winner-stat">
            <span className="winner-stat-value">{winner.total_score}</span>
            <span className="winner-stat-label">{t('winner.score')}</span>
          </div>
          <div className="winner-stat">
            <span className="winner-stat-value">{winner.kills || 0}</span>
            <span className="winner-stat-label">{t('winner.kills')}</span>
          </div>
          <div className="winner-stat">
            <span className="winner-stat-value">{survivedSec}s</span>
            <span className="winner-stat-label">{t('winner.survived')}</span>
          </div>
        </div>
        {winner.prize_earned > 0 && (
          <div className="winner-spotlight-prize">{t('winner.earned', { amount: winner.prize_earned })}</div>
        )}
      </div>
    </div>
  )
}
