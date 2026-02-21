import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { publicApi, userApi } from '../api'
import socket from '../socket'
import ThemeToggle from './ThemeToggle'

function getAuthState() {
  const isAdmin = !!localStorage.getItem('admin_token')
  const userRaw = localStorage.getItem('user')
  const user = userRaw ? JSON.parse(userRaw) : null
  const isUser = !!localStorage.getItem('user_token')
  return { isAdmin, isUser, user }
}

export default function Nav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [auth, setAuth] = useState(getAuthState)
  const [queueCount, setQueueCount] = useState(0)
  const [userPoints, setUserPoints] = useState(null)

  useEffect(() => {
    function onAuthChange() {
      setAuth(getAuthState())
    }
    window.addEventListener('storage', onAuthChange)
    window.addEventListener('admin-auth-change', onAuthChange)
    return () => {
      window.removeEventListener('storage', onAuthChange)
      window.removeEventListener('admin-auth-change', onAuthChange)
    }
  }, [])

  useEffect(() => {
    publicApi.get('/queue/info')
      .then(res => setQueueCount(res.data.players_in_queue || 0))
      .catch(() => {})

    function onQueueUpdate({ players_in_queue }) {
      setQueueCount(players_in_queue || 0)
    }
    socket.on('queue_update', onQueueUpdate)
    return () => socket.off('queue_update', onQueueUpdate)
  }, [])

  // Load user points when logged in
  useEffect(() => {
    if (auth.isUser) {
      userApi.get('/users/me')
        .then(res => setUserPoints(res.data.points))
        .catch(() => {})
    } else {
      setUserPoints(null)
    }
  }, [auth.isUser])

  function handleLogout() {
    localStorage.removeItem('user_token')
    localStorage.removeItem('user')
    localStorage.removeItem('admin_token')
    window.dispatchEvent(new Event('admin-auth-change'))
    setMenuOpen(false)
    navigate('/')
  }

  const links = [
    { to: '/', label: 'Home' },
    { to: '/leaderboard', label: 'Leaderboard' },
    { to: '/history', label: 'History' },
  ]

  if (auth.isAdmin) {
    links.push({ to: '/admin', label: 'Admin' })
  }

  function isActive(to) {
    if (to === '/') return pathname === '/'
    return pathname.startsWith(to)
  }

  const displayName = auth.user?.display_name || auth.user?.email || 'User'

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
          {auth.isUser ? (
            <>
              {userPoints != null && (
                <span className="nav-points-badge">{userPoints} pts</span>
              )}
              <span className="nav-link" style={{ color: 'var(--primary)', cursor: 'default' }}>
                {displayName}
              </span>
              <button className="nav-link" onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                Logout
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className={'nav-link' + (isActive('/login') ? ' active' : '')}
              onClick={() => setMenuOpen(false)}
            >
              Login
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}
