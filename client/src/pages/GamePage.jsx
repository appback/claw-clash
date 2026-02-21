import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { publicApi, userApi } from '../api'
import { useToast } from '../components/Toast'
import Loading from '../components/Loading'
import CountdownTimer from '../components/CountdownTimer'
import { STATE_LABELS } from '../components/GameCard'
import LobbyView from '../battle/LobbyView'
import BattleArena from '../battle/BattleArena'
import BattleReplay from '../battle/BattleReplay'
import WinnerSpotlight from '../battle/WinnerSpotlight'
import BattleStatsTable from '../battle/BattleStatsTable'
import SponsorshipSummary from '../battle/SponsorshipSummary'
import BettingSummary from '../battle/BettingSummary'
import ChatPanel from '../battle/ChatPanel'
import useBattleState from '../battle/useBattleState'
import socket from '../socket'

export default function GamePage() {
  const { id } = useParams()
  const toast = useToast()
  const [game, setGame] = useState(null)
  const [replay, setReplay] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showReplay, setShowReplay] = useState(false)
  const [userPoints, setUserPoints] = useState(null)
  const [myBets, setMyBets] = useState([])

  const isBattle = game?.state === 'battle'
  const { state: liveState, error: liveError, viewers } = useBattleState(id, isBattle)
  const [liveChatBubbles, setLiveChatBubbles] = useState([])

  // Listen for chat messages during live battle → pass to BattleArena as bubbles
  useEffect(() => {
    if (!id) return
    function onChat(msg) {
      if (msg.slot != null) {
        setLiveChatBubbles([msg])
      }
    }
    socket.on('chat', onChat)
    return () => socket.off('chat', onChat)
  }, [id])

  // Load user points if logged in
  useEffect(() => {
    if (localStorage.getItem('user_token')) {
      userApi.get('/users/me')
        .then(res => setUserPoints(res.data.points))
        .catch(() => {})
    }
  }, [])

  // Load game data
  useEffect(() => {
    loadGame()
  }, [id])

  // Listen for game state changes via WS (lobby→betting→battle→ended)
  useEffect(() => {
    if (!id) return
    socket.emit('join_game', id)
    function onGameState({ state: newState }) {
      setGame(prev => prev ? { ...prev, state: newState } : prev)
      loadGame()
    }
    function onLobbyFull({ betting_start, battle_start }) {
      setGame(prev => prev ? { ...prev, betting_start, battle_start } : prev)
    }
    socket.on('game_state', onGameState)
    socket.on('lobby_full', onLobbyFull)
    return () => {
      socket.off('game_state', onGameState)
      socket.off('lobby_full', onLobbyFull)
    }
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
          {isBattle && viewers > 0 && (
            <span> &middot; {viewers} watching</span>
          )}
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
            <ChatPanel gameId={id} gameState={game.state} userPoints={userPoints} myBets={myBets} />
          </div>
        </div>
      )}

      {/* BETTING state */}
      {game.state === 'betting' && (
        <div className="game-layout">
          <div className="game-main">
            <LobbyView
              game={game}
              isBetting={true}
              userPoints={userPoints}
              onBetPlaced={(remaining) => setUserPoints(remaining)}
              onBetsLoaded={setMyBets}
            />
          </div>
          <div className="game-sidebar">
            <ChatPanel gameId={id} gameState={game.state} userPoints={userPoints} myBets={myBets} />
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
              entries={game.entries}
              chatMessages={liveChatBubbles}
            />
          </div>
          <div className="game-sidebar">
            <ChatPanel gameId={id} gameState={game.state} userPoints={userPoints} myBets={myBets} />
          </div>
        </div>
      )}

      {/* ENDED state */}
      {['ended', 'archived'].includes(game.state) && (
        <div>
          <WinnerSpotlight game={game} />

          <div className="section mt-lg">
            <BattleStatsTable game={game} />
          </div>

          <div className="result-summaries mt-lg">
            <SponsorshipSummary game={game} />
            <BettingSummary gameId={id} />
          </div>

          {replay && (
            <div className="mt-lg text-center">
              <button
                className="btn btn-primary btn-lg replay-toggle-btn"
                onClick={() => setShowReplay(v => !v)}
              >
                {showReplay ? 'Hide Replay' : 'Watch Replay'}
              </button>
            </div>
          )}

          {replay && showReplay && (
            <div className="game-layout mt-lg">
              <div className="game-main">
                <BattleReplay replayData={replay} entries={game.entries} />
              </div>
              <div className="game-sidebar">
                <ChatPanel gameId={id} gameState={game.state} />
              </div>
            </div>
          )}
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
