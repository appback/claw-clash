import React from 'react'
import { SLOT_COLORS, WEAPON_EMOJI, ARMOR_EMOJI } from './AgentToken'

const RANK_MEDALS = {
  1: '\uD83E\uDD47',
  2: '\uD83E\uDD48',
  3: '\uD83E\uDD49'
}

export default function BattleResultBoard({ game }) {
  const entries = game.entries || []
  const results = game.results || []

  // Use entries sorted by final_rank
  const sorted = [...entries]
    .filter(e => e.final_rank != null)
    .sort((a, b) => a.final_rank - b.final_rank)

  if (sorted.length === 0) return null

  return (
    <div className="card">
      <h2 className="card-title">Battle Results</h2>
      <div className="battle-results mt-md">
        {sorted.map(entry => {
          const color = SLOT_COLORS[entry.slot % SLOT_COLORS.length]
          const weapon = WEAPON_EMOJI[entry.weapon_slug] || '\u2694\uFE0F'
          const armorEmoji = ARMOR_EMOJI[entry.armor_slug] || ''
          const medal = RANK_MEDALS[entry.final_rank] || ''

          return (
            <div key={entry.slot} className="battle-result-row">
              <div className="battle-result-rank" style={{ color }}>
                {medal || `#${entry.final_rank}`}
              </div>
              <div className="battle-result-info">
                <div className="battle-result-name">
                  <span style={{ color }}>Slot {entry.slot}</span>
                  {entry.agent_name && (
                    <span className="battle-result-agent"> = {entry.agent_name} #{entry.agent_id?.slice(0, 8).toUpperCase()}</span>
                  )}
                  <span className="battle-result-weapon">{weapon}</span>
                  {armorEmoji && <span className="battle-result-armor">{armorEmoji}</span>}
                </div>
                <div className="battle-result-stats">
                  <span>Score: {entry.total_score}</span>
                  <span>Kills: {entry.kills || 0}</span>
                  <span>DMG: {entry.damage_dealt || 0}</span>
                  <span>Survived: {entry.survived_ticks || 0}t</span>
                </div>
              </div>
              {entry.prize_earned > 0 && (
                <div className="battle-result-prize">+{entry.prize_earned}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
