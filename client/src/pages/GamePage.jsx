import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { publicApi, userApi } from '../api'
import { useToast } from '../components/Toast'
import Loading from '../components/Loading'
import CountdownTimer from '../components/CountdownTimer'
import { STATE_LABELS } from '../components/GameCard'
import LobbyView from '../battle/LobbyView'
import BattleArena from '../battle/BattleArena'
import BattleReplay from '../battle/BattleReplay'
import BattleResultBoard from '../battle/BattleResultBoard'
import ChatPanel from '../battle/ChatPanel'
import useBattleState from '../battle/useBattleState'

export default function GamePage() {
  const { id } = useParams()
  const toast = useToast()
  const [game, setGame] = useState(null)
  const [replay, setReplay] = useState(null)
  const [loading, setLoading] = useState(true)

  const isBattle = game?.state === 'battle'
  const { state: liveState, error: liveError } = useBattleState(id, isBattle)

  // Load game data
  useEffect(() => {
    loadGame()
  }, [id])

  // Reload game when battle ends
  useEffect(() => {
    if (liveError === 'ended') {
      loadGame()
    }
  }, [liveError])

  // Auto-refresh game during lobby/betting (every 10s)
  useEffect(() => {
    if (!game || !['lobby', 'betting'].includes(game.state)) return
    const interval = setInterval(loadGame, 10000)
    return () => clearInterval(interval)
  }, [game?.state])

  function loadGame() {
    publicApi.get('/games/' + id)
      .then(res => {
        setGame(res.data)
        if (['ended', 'archived'].includes(res.data.state)) {
          publicApi.get('/games/' + id + '/replay')
            .then(r => setReplay(r.data))
            .catch(() => {})
        }
      })
      .catch(() => toast.error('Failed to load game'))
      .finally(() => setLoading(false))
  }

  async function handleSponsor(slot, boostType) {
    try {
      await userApi.post('/games/' + id + '/sponsor', { slot, boost_type: boostType })
      toast.success(`Sponsored Slot ${slot}!`)
      loadGame() // refresh to show updated stats
    } catch (err) {
      const msg = err.response?.data?.message || 'Sponsorship failed'
      toast.error(msg)
    }
  }

  if (loading) return <Loading />
  if (!game) return <div className="empty-state"><div className="empty-state-text">Game not found</div></div>

  const isLoggedIn = !!localStorage.getItem('user_token')

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="flex-between">
          <h1 className="page-title">{game.title}</h1>
          <span className={'badge badge-' + game.state}>
            {STATE_LABELS[game.state] || game.state}
          </span>
        </div>
        <p className="page-subtitle">
          Arena: {game.arena_name} &middot; {game.entry_count || 0}/{game.max_entries} fighters
          &middot; {Math.floor((game.max_ticks || 1500) / 5 / 60)} min battle
        </p>
      </div>

      {/* CREATED state */}
      {game.state === 'created' && (
        <div className="card text-center" style={{ padding: '48px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>{'\u23F3'}</div>
          <h2>Game Scheduled</h2>
          <div className="mt-md">
            <CountdownTimer target={game.lobby_start} label="Lobby opens in" />
          </div>
        </div>
      )}

      {/* LOBBY state */}
      {game.state === 'lobby' && (
        <div className="game-layout">
          <div className="game-main">
            <LobbyView
              game={game}
              onSponsor={isLoggedIn ? handleSponsor : null}
            />
          </div>
          <div className="game-sidebar">
            <ChatPanel gameId={id} gameState={game.state} />
          </div>
        </div>
      )}

      {/* BETTING state */}
      {game.state === 'betting' && (
        <div className="game-layout">
          <div className="game-main">
            <div className="card">
              <h2 className="card-title">Betting Phase</h2>
              <p className="text-muted mt-sm">
                Stats are locked. Place your predictions before the battle begins!
              </p>
              <div className="mt-md">
                <CountdownTimer target={game.battle_start} label="Battle starts in" />
              </div>
            </div>
            <LobbyView game={{ ...game, state: 'betting' }} />
          </div>
          <div className="game-sidebar">
            <ChatPanel gameId={id} gameState={game.state} />
          </div>
        </div>
      )}

      {/* BATTLE state */}
      {game.state === 'battle' && (
        <div className="game-layout">
          <div className="game-main">
            <BattleArena
              state={liveState}
              gridWidth={game.grid_width}
              gridHeight={game.grid_height}
            />
          </div>
          <div className="game-sidebar">
            <ChatPanel gameId={id} gameState={game.state} />
          </div>
        </div>
      )}

      {/* ENDED state */}
      {['ended', 'archived'].includes(game.state) && (
        <div>
          {replay && (
            <div className="game-layout">
              <div className="game-main">
                <BattleReplay replayData={replay} entries={game.entries} />
              </div>
              <div className="game-sidebar">
                <ChatPanel gameId={id} gameState={game.state} />
              </div>
            </div>
          )}

          <div className="section mt-lg">
            <BattleResultBoard game={game} />
          </div>
        </div>
      )}

      {/* CANCELLED state */}
      {game.state === 'cancelled' && (
        <div className="card text-center" style={{ padding: '48px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>{'\u274C'}</div>
          <h2>Game Cancelled</h2>
          <p className="text-muted mt-sm">Not enough fighters joined. Entry fees and sponsorships have been refunded.</p>
        </div>
      )}
    </div>
  )
}
