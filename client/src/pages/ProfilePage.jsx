import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { userApi } from '../api'
import { useToast } from '../components/Toast'
import Loading from '../components/Loading'

const TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'bets', label: 'Bet History' },
  { key: 'sponsors', label: 'Sponsor History' }
]

const PRESETS = [10, 50, 100]

export default function ProfilePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState('profile')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Bet / Sponsor history state
  const [bets, setBets] = useState({ data: [], pagination: null })
  const [sponsors, setSponsors] = useState({ data: [], pagination: null })
  const [historyLoading, setHistoryLoading] = useState(false)

  // Hub wallet state
  const [wallet, setWallet] = useState(null)

  // Nickname edit state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Gem conversion state
  const [chargeOpen, setChargeOpen] = useState(false)
  const [chargeAmount, setChargeAmount] = useState('')
  const [chargeConfirm, setChargeConfirm] = useState(false)
  const [charging, setCharging] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('user_token')
    if (!token) { navigate('/login'); return }

    userApi.get('/users/me')
      .then(res => {
        setProfile(res.data)
        setEditName(res.data.display_name || '')
        if (res.data.hub_connected) {
          userApi.get('/users/me/wallet')
            .then(w => {
              if (!w.data.hub_connected) {
                setWallet({ hub_connected: false, balances: [], expired: true })
              } else {
                setWallet(w.data)
              }
            })
            .catch(() => {})
        }
      })
      .catch(() => navigate('/login'))
      .finally(() => setLoading(false))
  }, [navigate])

  useEffect(() => {
    if (tab === 'bets') loadBets(1)
    if (tab === 'sponsors') loadSponsors(1)
  }, [tab])

  function loadBets(page) {
    setHistoryLoading(true)
    userApi.get('/users/me/bets', { page, limit: 20 })
      .then(res => setBets(res.data))
      .catch(() => setBets({ data: [], pagination: null }))
      .finally(() => setHistoryLoading(false))
  }

  function loadSponsors(page) {
    setHistoryLoading(true)
    userApi.get('/users/me/sponsors', { page, limit: 20 })
      .then(res => setSponsors(res.data))
      .catch(() => setSponsors({ data: [], pagination: null }))
      .finally(() => setHistoryLoading(false))
  }

  async function handleSave() {
    const trimmed = editName.trim()
    if (trimmed.length < 2 || trimmed.length > 20) {
      setError('2-20 characters required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await userApi.put('/users/me/profile', { display_name: trimmed })
      setProfile(prev => ({ ...prev, ...res.data }))
      // Sync localStorage so Nav picks it up
      const stored = localStorage.getItem('user')
      if (stored) {
        const u = JSON.parse(stored)
        u.display_name = res.data.display_name
        localStorage.setItem('user', JSON.stringify(u))
        window.dispatchEvent(new Event('admin-auth-change'))
      }
      setEditing(false)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  const gemBalance = wallet?.balances?.find(b => b.currency_code === 'gem')?.balance || 0

  function selectPreset(val) {
    setChargeAmount(String(val))
    setChargeConfirm(true)
  }

  function handleCustomSubmit() {
    const num = parseInt(chargeAmount)
    if (!num || num < 1) return
    setChargeConfirm(true)
  }

  function cancelCharge() {
    setChargeOpen(false)
    setChargeAmount('')
    setChargeConfirm(false)
  }

  async function confirmCharge() {
    const amount = parseInt(chargeAmount)
    if (!amount || amount < 1) return
    setCharging(true)
    try {
      const res = await userApi.post('/wallet/convert', { amount })
      toast.success(`Charged ${amount} points!`)
      setProfile(prev => ({ ...prev, points: res.data.new_points ?? prev.points + amount }))
      setWallet(prev => {
        if (!prev) return prev
        return {
          ...prev,
          balances: prev.balances.map(b =>
            b.currency_code === 'gem' ? { ...b, balance: res.data.new_gem_balance ?? b.balance - amount } : b
          )
        }
      })
      cancelCharge()
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to charge points'
      toast.error(msg)
      if (msg.includes('Hub') && (msg.includes('token') || msg.includes('login'))) {
        setTimeout(() => navigate('/login'), 1500)
      }
    } finally {
      setCharging(false)
    }
  }

  if (loading) return <Loading />
  if (!profile) return null

  const { stats } = profile

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={'tab' + (tab === t.key ? ' active' : '')}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nickname
            </label>
            {editing ? (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  maxLength={20}
                  style={{
                    padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: '1rem', flex: 1
                  }}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
                />
                <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '8px 16px' }}>
                  {saving ? '...' : 'Save'}
                </button>
                <button className="btn" onClick={() => { setEditing(false); setEditName(profile.display_name || ''); setError('') }} style={{ padding: '8px 16px' }}>
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{profile.display_name || 'No name'}</span>
                <button
                  onClick={() => setEditing(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Edit
                </button>
              </div>
            )}
            {error && <div style={{ color: 'var(--danger, #ef4444)', fontSize: '0.875rem', marginTop: '4px' }}>{error}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <StatCard label="Points" value={profile.points} accent />
            <StatCard label="Bets" value={stats.bets_count} />
            <StatCard label="Bets Won" value={stats.bets_won} />
            <StatCard label="Wagered" value={stats.total_wagered} />
            <StatCard label="Payout" value={stats.total_payout} />
            <StatCard label="Sponsors" value={stats.sponsors_count} />
          </div>

          {profile.hub_connected && wallet?.expired ? (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Hub Wallet
              </label>
              <div style={{
                marginTop: '8px', padding: '16px', background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
              }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Hub session expired. Please log in again.
                </span>
                <button className="btn btn-primary" onClick={() => navigate('/login')} style={{ padding: '6px 16px', fontSize: '0.875rem' }}>
                  Re-login
                </button>
              </div>
            </div>
          ) : profile.hub_connected && wallet && !wallet.expired ? (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Hub Wallet
              </label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {wallet.balances.map(b => (
                  <span key={b.currency_code} style={{
                    padding: '6px 12px', background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', fontSize: '0.875rem'
                  }}>
                    {b.balance} {b.currency_code.toUpperCase()}
                  </span>
                ))}
                {!chargeOpen && (
                  <button className="btn btn-primary" onClick={() => setChargeOpen(true)} style={{ padding: '6px 16px', fontSize: '0.875rem' }}>
                    Charge Points
                  </button>
                )}
              </div>

              {chargeOpen && (
                <div style={{
                  marginTop: '16px', padding: '20px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)'
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '1rem' }}>Charge Points</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Hub Balance: {gemBalance} GEM
                  </div>

                  {!chargeConfirm ? (
                    <>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {PRESETS.map(v => (
                          <button key={v} className="bet-amount-btn" onClick={() => selectPreset(v)}>{v}</button>
                        ))}
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Custom"
                          min="1"
                          value={chargeAmount}
                          onChange={e => setChargeAmount(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleCustomSubmit() }}
                          style={{ width: '100px', padding: '8px 12px' }}
                        />
                        {chargeAmount && parseInt(chargeAmount) > 0 && (
                          <button className="btn btn-primary" onClick={handleCustomSubmit} style={{ padding: '8px 16px' }}>
                            Next
                          </button>
                        )}
                      </div>
                      <button className="btn btn-ghost" onClick={cancelCharge} style={{ padding: '6px 16px', fontSize: '0.875rem' }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{
                        padding: '12px 16px', background: 'var(--card-bg, var(--surface))', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)', marginBottom: '16px', fontSize: '0.95rem'
                      }}>
                        {chargeAmount} Gems &rarr; {chargeAmount} Points
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary" onClick={confirmCharge} disabled={charging} style={{ padding: '8px 20px' }}>
                          {charging ? 'Charging...' : 'Confirm'}
                        </button>
                        <button className="btn btn-ghost" onClick={cancelCharge} disabled={charging} style={{ padding: '8px 20px' }}>
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : !profile.hub_connected && (
            <div style={{ marginBottom: '24px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Connect via Hub to charge points
            </div>
          )}

          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            <div>Email: {profile.email || '-'}</div>
            <div>Role: {profile.role}</div>
            <div>Hub: {profile.hub_connected ? 'Connected' : 'Not connected'}</div>
            <div>Joined: {new Date(profile.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      )}

      {tab === 'bets' && (
        historyLoading ? <Loading /> : bets.data.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">{'\uD83C\uDFB2'}</div>
            <div className="empty-state-text">No bets yet</div>
          </div>
        ) : (
          <>
            <div className="card" style={{ overflowX: 'auto' }}>
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Slot</th>
                    <th>Amount</th>
                    <th>Payout</th>
                    <th>Result</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {bets.data.map(b => (
                    <tr key={b.id}>
                      <td>{b.game_title}</td>
                      <td>#{b.slot}</td>
                      <td>{parseInt(b.amount)} pts</td>
                      <td className={parseInt(b.payout) > 0 ? 'text-accent' : ''}>{parseInt(b.payout)} pts</td>
                      <td className={b.result === 'won' ? 'text-accent' : ''}>{b.result === 'won' ? 'Won' : b.result === 'lost' ? 'Lost' : 'Pending'}</td>
                      <td>{new Date(b.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {bets.pagination && <Pagination pagination={bets.pagination} onPage={loadBets} />}
          </>
        )
      )}

      {tab === 'sponsors' && (
        historyLoading ? <Loading /> : sponsors.data.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">{'\u2B50'}</div>
            <div className="empty-state-text">No sponsorships yet</div>
          </div>
        ) : (
          <>
            <div className="card" style={{ overflowX: 'auto' }}>
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Slot</th>
                    <th>Boost</th>
                    <th>Effect</th>
                    <th>Cost</th>
                    <th>Payout</th>
                    <th>Result</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sponsors.data.map(s => (
                    <tr key={s.id}>
                      <td>{s.game_title}</td>
                      <td>#{s.slot}</td>
                      <td>{s.boost_type === 'weapon_boost' ? 'Weapon' : 'HP'}</td>
                      <td>+{s.effect_value}</td>
                      <td>{parseInt(s.cost)} pts</td>
                      <td className={parseInt(s.payout) > 0 ? 'text-accent' : ''}>{parseInt(s.payout)} pts</td>
                      <td className={s.result === 'won' ? 'text-accent' : ''}>{s.result === 'won' ? 'Won' : s.result === 'lost' ? 'Lost' : 'Pending'}</td>
                      <td>{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sponsors.pagination && <Pagination pagination={sponsors.pagination} onPage={loadSponsors} />}
          </>
        )
      )}
    </div>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '16px', textAlign: 'center'
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: accent ? 'var(--primary)' : 'var(--text)' }}>
        {value}
      </div>
    </div>
  )
}

function Pagination({ pagination, onPage }) {
  const { page, totalPages } = pagination
  if (totalPages <= 1) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
      <button
        className="btn"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        style={{ padding: '6px 12px' }}
      >
        Prev
      </button>
      <span style={{ padding: '6px 12px', color: 'var(--text-muted)' }}>
        {page} / {totalPages}
      </span>
      <button
        className="btn"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        style={{ padding: '6px 12px' }}
      >
        Next
      </button>
    </div>
  )
}
