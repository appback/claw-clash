import React from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../i18n'

const STATE_BADGES = {
  created: 'badge-scheduled',
  lobby: 'badge-lobby',
  betting: 'badge-betting',
  battle: 'badge-battle',
  ended: 'badge-finished',
  cancelled: 'badge-cancelled',
  archived: 'badge-finished'
}

const STATE_LABELS = {
  created: 'Scheduled',
  lobby: 'Lobby Open',
  betting: 'Betting',
  battle: 'In Battle',
  ended: 'Ended',
  cancelled: 'Cancelled',
  archived: 'Archived'
}

const WEAPON_ICONS = {
  sword: '\u2694\uFE0F',
  bow: '\uD83C\uDFF9',
  dagger: '\uD83D\uDD2A',
  axe: '\uD83E\uDE93',
  bomb: '\uD83D\uDCA3',
  hammer: '\uD83D\uDD28',
  staff: '\uD83E\uDE84',
  lance: '\uD83D\uDD31'
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function getTimeLabel(game, t) {
  switch (game.state) {
    case 'created': return t('game.time.lobbyOpens', { time: formatTime(game.lobby_start) })
    case 'lobby': return t('game.time.bettingStarts', { time: formatTime(game.betting_start) })
    case 'betting': return t('game.time.battleStarts', { time: formatTime(game.battle_start) })
    case 'battle': return t('game.time.battleInProgress')
    case 'ended': return t('game.time.ended', { time: formatTime(game.battle_end) })
    case 'cancelled': return t('game.time.cancelled')
    default: return formatTime(game.created_at)
  }
}

export default function GameCard({ game }) {
  const { t } = useLang()

  return (
    <Link to={'/game/' + game.id} className="race-card">
      <div className="race-card-header">
        <span className="race-card-title">{game.title}</span>
        <span className={'badge ' + (STATE_BADGES[game.state] || 'badge-scheduled')}>
          {t('game.state.' + game.state) || game.state}
        </span>
      </div>
      <div className="race-card-meta">
        <span className="race-card-meta-item">
          {'\u2694\uFE0F'} {game.arena_name || t('game.arena')}
        </span>
        <span className="race-card-meta-item">
          {'\uD83E\uDD80'} {game.entry_count ?? 0}/{game.max_entries ?? 8}
        </span>
        {game.entry_fee > 0 && (
          <span className="race-card-meta-item">
            {'\uD83C\uDF56'} {game.entry_fee}
          </span>
        )}
        <span className="race-card-meta-item">
          {'\u23F1\uFE0F'} {Math.floor((game.max_ticks || 1500) / 5 / 60)}min
        </span>
      </div>
      <div className="race-card-time">
        {getTimeLabel(game, t)}
      </div>
    </Link>
  )
}

export { WEAPON_ICONS, STATE_LABELS, STATE_BADGES }
