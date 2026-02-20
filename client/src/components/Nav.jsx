import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { publicApi } from '../api'
import socket from '../socket'
import ThemeToggle from './ThemeToggle'

export default function Nav() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(!!localStorage.getItem('admin_token'))
  const [queueCount, setQueueCount] = useState(0)

  useEffect(() => {
    function onStorage() {
      setIsAdmin(!!localStorage.getItem('admin_token'))
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('admin-auth-change', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('admin-auth-change', onStorage)
    }
  }, [])

  useEffect(() => {
    // Initial fetch via HTTP
    publicApi.get('/queue/info')
      .then(res => setQueueCount(res.data.players_in_queue || 0))
      .catch(() => {})

    // Real-time updates via WebSocket
    function onQueueUpdate({ players_in_queue }) {
      setQueueCount(players_in_queue || 0)
    }
    socket.on('queue_update', onQueueUpdate)
    return () => socket.off('queue_update', onQueueUpdate)
  }, [])

  const links = [
    { to: '/', label: 'Home' },
    { to: '/leaderboard', label: 'Leaderboard' },
    { to: '/history', label: 'History' },
    isAdmin
      ? { to: '/admin', label: 'Admin' }
      : { to: '/login', label: 'Login' }
  ]

  function isActive(to) {
    if (to === '/') return pathname === '/'
    return pathname.startsWith(to)
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-brand">
          {'\uD83E\uDD80'} Claw Clash
          {queueCount > 0 && (
            <span className="nav-queue-badge" title={`${queueCount} fighters in queue`}>
              {'\u2694\uFE0F'}{queueCount}
            </span>
          )}
        </Link>
        <button
          className="nav-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
        </button>
        <div className={'nav-links' + (menuOpen ? ' open' : '')}>
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={'nav-link' + (isActive(link.to) ? ' active' : '')}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}
