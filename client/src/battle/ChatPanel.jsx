import React, { useState, useEffect, useRef } from 'react'
import { publicApi, userApi } from '../api'

export default function ChatPanel({ gameId, gameState }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)
  const lastTickRef = useRef(-1)

  const isActive = ['lobby', 'betting', 'battle'].includes(gameState)
  const isLoggedIn = !!localStorage.getItem('user_token')

  // Poll for messages
  useEffect(() => {
    if (!gameId) return

    function poll() {
      const params = lastTickRef.current >= 0 ? { after: lastTickRef.current } : {}
      publicApi.get('/games/' + gameId + '/chat', params)
        .then(res => {
          const msgs = res.data.messages || []
          if (msgs.length > 0) {
            setMessages(prev => {
              const existing = new Set(prev.map(m => m.id))
              const newMsgs = msgs.filter(m => !existing.has(m.id))
              return [...prev, ...newMsgs].slice(-200) // keep last 200
            })
            const maxTick = Math.max(...msgs.map(m => m.tick || 0))
            if (maxTick > lastTickRef.current) lastTickRef.current = maxTick
          }
        })
        .catch(() => {})
    }

    poll()
    const interval = setInterval(poll, isActive ? 2000 : 10000)
    return () => clearInterval(interval)
  }, [gameId, isActive])

  // Auto scroll only when user is already near bottom
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      const isNearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 50
      if (isNearBottom) {
        el.scrollTop = el.scrollHeight
      }
    }
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || sending) return

    setSending(true)
    try {
      const res = await userApi.post('/games/' + gameId + '/chat', { message: input.trim() })
      setMessages(prev => [...prev, res.data])
      setInput('')
    } catch {
      // silently fail
    } finally {
      setSending(false)
    }
  }

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
                  : msg.msg_type === 'ai_strategy' ? `[Slot ${msg.slot} \u2694\uFE0F]`
                  : '[Spectator]'}
              </span>
              <span className="chat-msg-text">{msg.message}</span>
            </div>
          ))
        )}
      </div>

      {isActive && isLoggedIn && (
        <form className="chat-input-form" onSubmit={handleSend}>
          <input
            className="chat-input"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Send a message..."
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
    </div>
  )
}
