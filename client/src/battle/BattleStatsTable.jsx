import React from 'react'
import { SLOT_COLORS, WEAPON_EMOJI, ARMOR_EMOJI } from './AgentToken'

const RANK_MEDALS = { 1: '\uD83E\uDD47', 2: '\uD83E\uDD48', 3: '\uD83E\uDD49' }

export default function BattleStatsTable({ game }) {
  const entries = game.entries || []
  const sorted = [...entries]
    .filter(e => e.final_rank != null)
    .sort((a, b) => a.final_rank - b.final_rank)

  if (sorted.length === 0) return null

  return (
    <div className="card battle-stats-table">
      <h2 className="card-title">Battle Stats</h2>
      <div className="battle-stats-scroll mt-md">
        <table className="stats-table">
          <thead>
            <tr>
              <th className="stats-th-rank">Rank</th>
              <th className="stats-th-slot">Slot</th>
              <th className="stats-th-name">Agent</th>
              <th className="stats-th-weapon">Weapon</th>
              <th className="stats-th-armor">Armor</th>
              <th className="stats-th-num">Score</th>
              <th className="stats-th-num">Kills</th>
              <th className="stats-th-num">DMG Dealt</th>
              <th className="stats-th-num">DMG Taken</th>
              <th className="stats-th-num">Survived</th>
              <th className="stats-th-status">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(entry => {
              const color = SLOT_COLORS[entry.slot % SLOT_COLORS.length]
              const weapon = WEAPON_EMOJI[entry.weapon_slug] || '\u2694\uFE0F'
              const armorEmoji = ARMOR_EMOJI[entry.armor_slug] || ''
              const medal = RANK_MEDALS[entry.final_rank]
              const survivedSec = Math.round((entry.survived_ticks || 0) / 5)
              const isEliminated = entry.final_rank > 1 && entry.survived_ticks < (game.max_ticks || 1500)
              const rowClass = entry.final_rank === 1
                ? 'stats-row-gold'
                : entry.final_rank <= 3
                  ? 'stats-row-podium'
                  : isEliminated ? 'stats-row-eliminated' : ''

              return (
                <tr key={entry.slot} className={rowClass}>
                  <td className="stats-td-rank">
                    {medal || `#${entry.final_rank}`}
                  </td>
                  <td>
                    <span className="stats-slot-dot" style={{ background: color }} />
                    <span style={{ color }}>{entry.slot}</span>
                  </td>
                  <td className="stats-td-name">
                    {entry.agent_name ? `${entry.agent_name} #${entry.agent_id?.slice(0, 8) || ''}` : '-'}
                  </td>
                  <td>
                    <span className="stats-weapon">{weapon} {entry.weapon_name || entry.weapon_slug}</span>
                  </td>
                  <td>
                    <span className="stats-armor">{armorEmoji} {entry.armor_name || entry.armor_slug || '-'}</span>
                  </td>
                  <td className="stats-td-num">{entry.total_score}</td>
                  <td className="stats-td-num">{entry.kills || 0}</td>
                  <td className="stats-td-num">{entry.damage_dealt || 0}</td>
                  <td className="stats-td-num">{entry.damage_taken || 0}</td>
                  <td className="stats-td-num">{survivedSec}s</td>
                  <td>
                    <span className={isEliminated ? 'stats-status-eliminated' : 'stats-status-survived'}>
                      {isEliminated ? 'Eliminated' : 'Survived'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
