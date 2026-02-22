import React from 'react'
import { SLOT_COLORS, WEAPON_EMOJI, ARMOR_EMOJI } from './AgentToken'
import { useLang } from '../i18n'

const RANK_MEDALS = { 1: '\uD83E\uDD47', 2: '\uD83E\uDD48', 3: '\uD83E\uDD49' }

export default function BattleStatsTable({ game }) {
  const { t } = useLang()
  const entries = game.entries || []
  const sorted = [...entries]
    .filter(e => e.final_rank != null)
    .sort((a, b) => a.final_rank - b.final_rank)

  if (sorted.length === 0) return null

  return (
    <div className="card battle-stats-table">
      <h2 className="card-title">{t('battleStats.title')}</h2>
      <div className="battle-stats-scroll mt-md">
        <table className="stats-table">
          <thead>
            <tr>
              <th className="stats-th-rank">{t('battleStats.rank')}</th>
              <th className="stats-th-slot">{t('battleStats.slot')}</th>
              <th className="stats-th-name">{t('battleStats.agent')}</th>
              <th className="stats-th-weapon">{t('battleStats.weapon')}</th>
              <th className="stats-th-armor">{t('battleStats.armor')}</th>
              <th className="stats-th-num">{t('battleStats.score')}</th>
              <th className="stats-th-num">{t('battleStats.kills')}</th>
              <th className="stats-th-num">{t('battleStats.dmgDealt')}</th>
              <th className="stats-th-num">{t('battleStats.dmgTaken')}</th>
              <th className="stats-th-num">{t('battleStats.survived')}</th>
              <th className="stats-th-status">{t('battleStats.status')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(entry => {
              const color = SLOT_COLORS[entry.slot % SLOT_COLORS.length]
              const weapon = WEAPON_EMOJI[entry.weapon_slug] || '\u2694\uFE0F'
              const armorEmoji = ARMOR_EMOJI[entry.armor_slug] || ''
              const medal = RANK_MEDALS[entry.final_rank]
              const survivedSec = entry.survived_ticks || 0
              const maxSec = Math.round((game.max_ticks || 1500) / 5)
              const isEliminated = entry.final_rank > 1 && (entry.survived_ticks || 0) < maxSec
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
                    {entry.agent_name ? `${entry.agent_name} #${(entry.agent_id?.slice(0, 8) || '').toUpperCase()}` : '-'}
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
                      {isEliminated ? t('battleStats.eliminated') : t('battleStats.survivedStatus')}
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
