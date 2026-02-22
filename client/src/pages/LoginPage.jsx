import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { publicApi } from '../api'
import { useToast } from '../components/Toast'
import { useLang } from '../i18n'

export default function LoginPage() {
  const { t } = useLang()
  const navigate = useNavigate()
  const toast = useToast()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)

  // Already logged in → redirect home
  useEffect(() => {
    if (localStorage.getItem('user_token')) {
      navigate('/', { replace: true })
    }
  }, [])

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

      toast.success(mode === 'login' ? t('login.loggedIn') : t('login.accountCreated'))

      if (user.role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/')
      }
    } catch (err) {
      const msg = err.response?.data?.message || t('login.authFailed')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="card">
        <h1 className="card-title" style={{ textAlign: 'center', marginBottom: '24px' }}>
          {mode === 'login' ? t('login.title') : t('login.register')}
        </h1>

        <a href="https://appback.app/api/v1/auth/github?redirect=https://clash.appback.app/auth/callback"
          className="btn btn-lg" style={{ width: '100%', marginBottom: '16px', background: '#24292e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <svg viewBox="0 0 16 16" width="20" height="20"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          {t('login.github')}
        </a>
        <div style={{ textAlign: 'center', margin: '12px 0', color: 'var(--text-muted)', fontSize: '13px' }}>{t('login.or')}</div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">{t('login.displayName')}</label>
              <input
                className="form-input"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder={t('login.nicknamePlaceholder')}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t('login.email')}</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder={t('login.emailPlaceholder')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('login.password')}</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder={t('login.passwordPlaceholder')}
            />
          </div>

          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '8px' }}
            disabled={loading}
            type="submit"
          >
            {loading ? t('login.pleaseWait') : mode === 'login' ? t('login.loginBtn') : t('login.registerBtn')}
          </button>
        </form>

        <div className="text-center mt-md">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? t('login.needAccount') : t('login.haveAccount')}
          </button>
        </div>
      </div>
    </div>
  )
}
