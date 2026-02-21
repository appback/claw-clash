import React from 'react'
import AgentFace from './AgentFace'

const SLOT_COLORS = [
  'var(--crab-1)', 'var(--crab-2)', 'var(--crab-3)', 'var(--crab-4)',
  'var(--crab-5)', 'var(--crab-6)', 'var(--crab-7)', 'var(--crab-8)'
]

const WEAPON_EMOJI = {
  sword: '\u2694\uFE0F',
  bow: '\uD83C\uDFF9',
  dagger: '\uD83D\uDD2A',
  hammer: '\uD83D\uDD28',
  spear: '\uD83D\uDD31',
  axe: '\uD83E\uDE93',
  bomb: '\uD83D\uDCA3',
  staff: '\uD83E\uDE84',
  lance: '\uD83D\uDD31'
}

export default function AgentToken({ agent, cellSize, isHit, isAttacking, bubble }) {
  if (!agent.alive) return null

  const hpPercent = Math.max(0, (agent.hp / agent.maxHp) * 100)
  const color = SLOT_COLORS[agent.slot % SLOT_COLORS.length]
  const weapon = WEAPON_EMOJI[agent.weapon] || '\u2694\uFE0F'

  const classes = [
    'agent-token',
    isHit ? 'agent-hit' : '',
    isAttacking ? 'agent-attacking' : ''
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      style={{
        left: agent.x * cellSize,
        top: agent.y * cellSize,
        width: cellSize,
        height: cellSize,
        '--agent-color': color
      }}
      title={`Slot ${agent.slot} | HP: ${agent.hp}/${agent.maxHp} | ${agent.weapon} | Score: ${agent.score}`}
    >
      {bubble && (
        <div className="speech-bubble">{bubble}</div>
      )}
      <div className="agent-token-body">
        <AgentFace className="agent-token-face" />
        <div className="agent-token-weapon">{weapon}</div>
      </div>
      <div className="agent-token-slot">{agent.slot}</div>
      <div className="agent-hp-bar">
        <div
          className="agent-hp-fill"
          style={{
            width: hpPercent + '%',
            background: hpPercent > 50 ? 'var(--success)' : hpPercent > 25 ? 'var(--warning)' : 'var(--danger)'
          }}
        />
      </div>
    </div>
  )
}

export { SLOT_COLORS, WEAPON_EMOJI }
