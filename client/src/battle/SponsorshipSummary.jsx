import React from 'react'
import { SLOT_COLORS } from './AgentToken'

export default function SponsorshipSummary({ game }) {
  const entries = game.entries || []
  const sponsored = entries.filter(e => e.sponsorship && e.sponsorship.sponsor_count > 0)

  return (
    <div className="card sponsorship-summary">
      <h3 className="card-title">Sponsorships</h3>
      {sponsored.length === 0 ? (
        <p className="text-muted mt-sm" style={{ fontSize: '0.8125rem' }}>No sponsorships this battle</p>
      ) : (
        <div className="sponsorship-list mt-sm">
          {sponsored.map(entry => {
            const color = SLOT_COLORS[entry.slot % SLOT_COLORS.length]
            const sp = entry.sponsorship
            return (
              <div key={entry.slot} className="sponsorship-row">
                <span className="sponsorship-slot" style={{ color }}>
                  Slot {entry.slot}
                </span>
                <span className="sponsorship-agent">
                  {entry.agent_name ? `${entry.agent_name} #${entry.agent_id?.slice(0, 8) || ''}` : '-'}
                </span>
                <span className="sponsorship-count">{sp.sponsor_count}x</span>
                <div className="sponsorship-boosts">
                  {sp.weapon_boost > 0 && (
                    <span className="sponsorship-boost sponsorship-boost-dmg">+{sp.weapon_boost} dmg</span>
                  )}
                  {sp.hp_boost > 0 && (
                    <span className="sponsorship-boost sponsorship-boost-hp">+{sp.hp_boost} hp</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
