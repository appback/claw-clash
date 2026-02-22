import React, { useState, useEffect, useRef } from 'react'
import { publicApi, userApi } from '../api'
import { SLOT_COLORS } from './AgentToken'
import socket from '../socket'
import { getCredits } from '../utils/guestCredits'

export default function ChatPanel({ gameId, gameState, userPoints, myBets }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [anonymous, setAnonymous] = useState(false)
  const scrollRef = useRef(null)
  const seenIdsRef = useRef(new Set())
  const initialLoadRef = useRef(true)

  const isActive = ['lobby', 'betting', 'battle'].includes(gameState)
  const isLoggedIn = !!localStorage.getItem('user_token')

  // Initial load via HTTP
  useEffect(() => {
    if (!gameId) return

    publicApi.get('/games/' + gameId + '/chat')
      .then(res => {
        const msgs = res.data.messages || []
        setMessages(msgs.slice(-200))
        seenIdsRef.current = new Set(msgs.map(m => m.id))
        initialLoadRef.current = true
      })
      .catch(() => {})
  }, [gameId])

  // WebSocket real-time chat
  useEffect(() => {
    if (!gameId) return

    function onChat(msg) {
      if (seenIdsRef.current.has(msg.id)) return
      seenIdsRef.current.add(msg.id)
      setMessages(prev => [...prev, msg].slice(-200))
    }

    socket.on('chat', onChat)
    return () => socket.off('chat', onChat)
  }, [gameId])

  // Auto scroll only when user is already near bottom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (initialLoadRef.current) {
      el.scrollTop = el.scrollHeight
      initialLoadRef.current = false
      return
    }
    const isNearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 50
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || sending) return

    setSending(true)
    try {
      await userApi.post('/games/' + gameId + '/chat', { message: input.trim(), anonymous })
      // Message will arrive via WebSocket broadcast
      setInput('')
    } catch {
      // silently fail
    } finally {
      setSending(false)
    }
  }

  // Aggregate myBets by slot for display
  const betsBySlot = {}
  if (myBets) {
    for (const b of myBets) {
      if (!betsBySlot[b.slot]) betsBySlot[b.slot] = 0
      betsBySlot[b.slot] += b.amount
    }
  }
  const totalBet = myBets ? myBets.reduce((s, b) => s + b.amount, 0) : 0
  const guestBetCount = !isLoggedIn && myBets ? myBets.length : 0

  return (
    <div className="chat-panel">
      <div className="chat-header">
        Chat {isActive && <span className="chat-live-dot" />}
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">No messages yet</div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={'chat-msg chat-msg-' + msg.msg_type}>
              <span className="chat-msg-sender">
                {msg.msg_type === 'system' ? '[System]'
                  : msg.msg_type === 'human_chat'
                    ? (msg.sender_name ? `[${msg.sender_name}]` : '[Spectator]')
                  : msg.slot != null ? `[Slot ${msg.slot}]`
                  : '[Unknown]'}
              </span>
              <span className="chat-msg-text">{msg.message}</span>
            </div>
          ))
        )}
      </div>

      {isActive && isLoggedIn && (
        <form className="chat-input-form" onSubmit={handleSend}>
          <label className="chat-anon-toggle" title="Send anonymously">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={e => setAnonymous(e.target.checked)}
            />
            <span className="chat-anon-label">Anon</span>
          </label>
          <input
            className="chat-input"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={anonymous ? 'Send anonymously...' : 'Send a message...'}
            maxLength={200}
            disabled={sending}
          />
          <button className="btn btn-primary btn-sm" type="submit" disabled={sending || !input.trim()}>
            Send
          </button>
        </form>
      )}

      {isActive && !isLoggedIn && (
        <div className="chat-login-hint">Log in to chat</div>
      )}

      {/* User asset panel */}
      {isActive && isLoggedIn && (
        <div className="chat-user-panel">
          <div className="chat-user-balance">
            {'\uD83D\uDCB0'} {userPoints != null ? userPoints : '...'} pts
          </div>
          {myBets && myBets.length > 0 && (
            <div className="chat-user-bets">
              <div className="chat-user-bets-label">This game:</div>
              {Object.entries(betsBySlot).map(([slot, amount]) => (
                <div key={slot} className="chat-user-bet-row">
                  <span style={{ color: SLOT_COLORS[slot % SLOT_COLORS.length] }}>Slot {slot}</span>
                  <span>{amount} pts</span>
                </div>
              ))}
              {totalBet > 0 && (
                <div className="chat-user-bet-total">Total: {totalBet} pts bet</div>
              )}
            </div>
          )}
        </div>
      )}

      {isActive && !isLoggedIn && (
        <div className="chat-user-panel chat-user-panel-guest">
          <div className="chat-user-guest-info">
            {'\uD83D\uDCB0'} {getCredits()} credits
          </div>
          <div className="chat-user-guest-cta">Sign up for more rewards!</div>
        </div>
      )}
    </div>
  )
}
