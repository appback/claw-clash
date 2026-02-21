import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { publicApi } from '../api'
import Loading from '../components/Loading'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    // Hub 토큰을 CC API로 보내 CC 자체 JWT로 교환
    publicApi.post('/auth/hub-login', { token })
      .then(res => {
        localStorage.setItem('user_token', res.data.token)
        localStorage.setItem('user', JSON.stringify(res.data.user))
        window.dispatchEvent(new Event('admin-auth-change'))
        navigate('/', { replace: true })
      })
      .catch(() => {
        navigate('/login', { replace: true })
      })
  }, [searchParams, navigate])

  return (
    <div className="login-container">
      <Loading message="Signing you in..." />
    </div>
  )
}
