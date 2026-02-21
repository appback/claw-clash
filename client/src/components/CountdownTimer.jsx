import React, { useState, useEffect } from 'react'

function calcRemaining(target, offset) {
  const now = Date.now() + (offset || 0)
  const diff = new Date(target) - now
  if (diff <= 0) return { h: 0, m: 0, s: 0, expired: true }
  return {
    h: Math.floor(diff / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
    expired: false
  }
}

export default function CountdownTimer({ target, serverOffset }) {
  const [time, setTime] = useState(() => calcRemaining(target, serverOffset))

  useEffect(() => {
    const id = setInterval(() => setTime(calcRemaining(target, serverOffset)), 1000)
    return () => clearInterval(id)
  }, [target, serverOffset])

  if (time.expired) {
    return <span className="text-muted">Started</span>
  }

  const pad = n => String(n).padStart(2, '0')

  return (
    <div className="countdown">
      <div className="countdown-segment">
        <span className="countdown-value">{pad(time.h)}</span>
        <span className="countdown-label">hrs</span>
      </div>
      <span className="countdown-sep">:</span>
      <div className="countdown-segment">
        <span className="countdown-value">{pad(time.m)}</span>
        <span className="countdown-label">min</span>
      </div>
      <span className="countdown-sep">:</span>
      <div className="countdown-segment">
        <span className="countdown-value">{pad(time.s)}</span>
        <span className="countdown-label">sec</span>
      </div>
    </div>
  )
}
