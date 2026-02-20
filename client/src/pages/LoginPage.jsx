import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { publicApi } from '../api'
import { useToast } from '../components/Toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    try {
      const url = mode === 'login' ? '/auth/login' : '/auth/register'
      const body = mode === 'login'
        ? { email, password }
        : { email, password, display_name: displayName || undefined }

      const res = await publicApi.post(url, body)
      const { user, token } = res.data

      if (user.role === 'admin') {
        localStorage.setItem('admin_token', token)
      }
      localStorage.setItem('user_token', token)
      localStorage.setItem('user', JSON.stringify(user))
      window.dispatchEvent(new Event('admin-auth-change'))

      toast.success(mode === 'login' ? 'Logged in!' : 'Account created!')

      if (user.role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/')
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Authentication failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="card">
        <h1 className="card-title" style={{ textAlign: 'center', marginBottom: '24px' }}>
          {mode === 'login' ? 'Login' : 'Create Account'}
        </h1>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                className="form-input"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your nickname"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="email@example.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Min 6 characters"
            />
          </div>

          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '8px' }}
            disabled={loading}
            type="submit"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>

        <div className="text-center mt-md">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Need an account? Register' : 'Have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  )
}
