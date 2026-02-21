import React, { useMemo, useState, useEffect, useRef } from 'react'
import AgentToken from './AgentToken'

const TERRAIN_CLASSES = {
  0: '',
  1: 'terrain-wall',
  2: 'terrain-bush',
  3: 'terrain-lava',
  4: 'terrain-heal'
}

const POWERUP_ICONS = {
  heal_pack: '\uD83D\uDC9A',
  damage_boost: '\u2694\uFE0F',
  speed_boost: '\u26A1'
}

export default function BattleArena({ state, gridWidth, gridHeight, entries }) {
  const [hitSlots, setHitSlots] = useState(new Set())
  const [attackSlots, setAttackSlots] = useState(new Set())
  const [slashEffects, setSlashEffects] = useState([])
  const [eventLog, setEventLog] = useState([])
  const prevTick = useRef(null)
  const logContainerRef = useRef(null)

  if (!state) {
    return (
      <div className="battle-arena-container">
        <div className="empty-state">
          <div className="empty-state-text">Waiting for battle data...</div>
        </div>
      </div>
    )
  }

  const width = state.arena?.width || gridWidth || 8
  const height = state.arena?.height || gridHeight || 8
  const terrain = state.arena?.terrain || []
  const agents = state.agents || []
  const shrinkPhase = state.shrink_phase || state.shrinkPhase || 0
  const powerups = state.powerups || []

  const cellSize = 56

  // Build weapon map from entries (replay) or agent data
  const weaponMap = useMemo(() => {
    const map = {}
    if (entries && entries.length > 0) {
      for (const e of entries) {
        map[e.slot] = e.weapon_slug
      }
    }
    return map
  }, [entries])

  // Enrich agents with weapon info from entries if not already present
  const enrichedAgents = useMemo(() => {
    return agents.map(a => ({
      ...a,
      weapon: a.weapon || weaponMap[a.slot] || 'sword'
    }))
  }, [agents, weaponMap])

  const grid = useMemo(() => {
    const cells = []
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const terrainType = (terrain[y] && terrain[y][x]) || 0
        const inDanger = shrinkPhase > 0 && (
          x < shrinkPhase || x >= width - shrinkPhase ||
          y < shrinkPhase || y >= height - shrinkPhase
        )
        cells.push({ x, y, terrain: terrainType, inDanger })
      }
    }
    return cells
  }, [width, height, terrain, shrinkPhase])

  // Filter out noise events (turn, move) for the event feed
  const allEvents = state.last_events || state.events || []
  const tickEvents = allEvents.filter(e => e.type !== 'turn' && e.type !== 'move_blocked')

  // Detect hit/attack events for animations + accumulate event log
  useEffect(() => {
    const currentTick = state.tick
    if (prevTick.current === currentTick) return
    prevTick.current = currentTick

    const newHits = new Set()
    const newAttacks = new Set()
    const newSlashes = []

    // Append events to cumulative log
    if (tickEvents.length > 0) {
      const timeSec = Math.floor(currentTick / 5)
      const stamped = tickEvents.map((e, i) => ({
        ...e,
        _id: `${currentTick}-${i}`,
        _time: timeSec
      }))
      setEventLog(prev => {
        const combined = [...prev, ...stamped]
        // Keep last 200 events to prevent memory bloat
        return combined.length > 200 ? combined.slice(-200) : combined
      })
    }

    for (const e of tickEvents) {
      if (e.type === 'damage' || e.type === 'terrain_damage' || e.type === 'ring_damage') {
        newHits.add(e.to_slot != null ? e.to_slot : e.slot)
      }
      if (e.type === 'damage') {
        newAttacks.add(e.from_slot)
        // Find target position for slash effect
        const target = enrichedAgents.find(a => a.slot === e.to_slot)
        if (target) {
          newSlashes.push({
            id: `${currentTick}-${e.from_slot}-${e.to_slot}`,
            x: target.x,
            y: target.y,
            damage: e.damage,
            isSkill: e.is_skill
          })
        }
      }
    }

    setHitSlots(newHits)
    setAttackSlots(newAttacks)
    setSlashEffects(newSlashes)

    // Clear animations after duration
    if (newHits.size > 0 || newAttacks.size > 0) {
      const timer = setTimeout(() => {
        setHitSlots(new Set())
        setAttackSlots(new Set())
        setSlashEffects([])
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [state.tick, tickEvents, enrichedAgents])

  // Auto-scroll event log only when user is already near bottom
  useEffect(() => {
    const container = logContainerRef.current
    if (container) {
      const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 50
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight
      }
    }
  }, [eventLog.length])

  return (
    <div className="battle-arena-container">
      <div className="battle-arena-header">
        <span>Time: {Math.floor((state.tick || 0) / 5)}s/{Math.floor((state.max_ticks || state.maxTicks || 1500) / 5)}s</span>
        <span>Alive: {enrichedAgents.filter(a => a.alive).length}/{enrichedAgents.length}</span>
        {shrinkPhase > 0 && (
          <span className="shrink-indicator">Ring Phase {shrinkPhase}</span>
        )}
      </div>

      <div
        className="battle-arena-grid"
        style={{
          gridTemplateColumns: `repeat(${width}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${height}, ${cellSize}px)`,
          width: width * cellSize,
          height: height * cellSize
        }}
      >
        {grid.map(cell => (
          <div
            key={`${cell.x}-${cell.y}`}
            className={
              'arena-cell ' +
              (TERRAIN_CLASSES[cell.terrain] || '') +
              (cell.inDanger ? ' terrain-danger' : '')
            }
          >
            {cell.terrain === 2 && <span className="terrain-tree-icon">{'\uD83C\uDF33'}</span>}
          </div>
        ))}

        {/* Power-up tokens */}
        {powerups.map((p, i) => (
          <div
            key={'pu-' + i}
            className={'powerup-token powerup-' + p.type}
            style={{
              left: p.x * cellSize,
              top: p.y * cellSize,
              width: cellSize,
              height: cellSize
            }}
          >
            {POWERUP_ICONS[p.type] || '?'}
          </div>
        ))}

        {/* Slash/damage effects */}
        {slashEffects.map(fx => (
          <div
            key={fx.id}
            className={'slash-effect' + (fx.isSkill ? ' slash-skill' : '')}
            style={{
              left: fx.x * cellSize,
              top: fx.y * cellSize,
              width: cellSize,
              height: cellSize
            }}
          >
            <span className="slash-damage">-{fx.damage}</span>
          </div>
        ))}

        {/* Agent tokens overlaid on grid */}
        {enrichedAgents.filter(a => a.alive).map(agent => (
          <AgentToken
            key={agent.slot}
            agent={agent}
            cellSize={cellSize}
            isHit={hitSlots.has(agent.slot)}
            isAttacking={attackSlots.has(agent.slot)}
          />
        ))}

        {/* Death markers */}
        {enrichedAgents.filter(a => !a.alive).map(agent => (
          <div
            key={'dead-' + agent.slot}
            className="agent-dead"
            style={{
              left: agent.x * cellSize,
              top: agent.y * cellSize,
              width: cellSize,
              height: cellSize
            }}
          >
            {'\uD83D\uDC80'}
          </div>
        ))}
      </div>

      {/* Cumulative Event Log */}
      <div className="event-log">
        <div className="event-log-header">Battle Log</div>
        <div className="event-log-body" ref={logContainerRef}>
          {eventLog.length === 0 ? (
            <div className="event-log-empty">Waiting for events...</div>
          ) : (
            eventLog.map(e => (
              <div key={e._id} className={'event-log-entry event-log-' + e.type}>
                <span className="event-log-time">{e._time}s</span>
                <span className="event-log-text">{formatEvent(e)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// Allow parent to clear event log (used by replay on seek)
BattleArena.clearLog = null

function formatEvent(e) {
  switch (e.type) {
    case 'damage':
      return `\u2694\uFE0F #${e.from_slot} \u2192 #${e.to_slot} (${e.damage} dmg${e.is_skill ? ' SKILL!' : ''})`
    case 'kill':
      return `\uD83D\uDC80 #${e.killer_slot} eliminated #${e.victim_slot}!`
    case 'first_blood':
      return `\uD83E\uDE78 FIRST BLOOD! #${e.killer_slot} \u2192 #${e.victim_slot}!`
    case 'elimination':
      return `\uD83D\uDCA5 #${e.slot} eliminated!`
    case 'move':
      return `\u27A1\uFE0F #${e.slot} moved`
    case 'terrain_damage':
      return `\uD83D\uDD25 #${e.slot} takes ${e.damage} lava damage`
    case 'terrain_heal':
      return `\uD83D\uDC9A #${e.slot} heals ${e.heal}`
    case 'lifesteal':
      return `\uD83E\uDE78 #${e.slot} lifesteals ${e.amount}`
    case 'ring_damage':
      return `\uD83D\uDFE5 #${e.slot} takes ${e.damage} ring damage!`
    case 'powerup_spawn':
      return `\u2728 ${e.powerup} spawned at (${e.x},${e.y})`
    case 'powerup_collect':
      return `\uD83C\uDF81 #${e.slot} picked up ${e.powerup}`
    case 'powerup_destroyed':
      return `\uD83D\uDCA8 ${e.powerup} destroyed by ring`
    default:
      return e.type
  }
}
