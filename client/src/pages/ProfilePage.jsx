import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { userApi } from '../api'
import { useToast } from '../components/Toast'
import Loading from '../components/Loading'
import { useLang } from '../i18n'

const TABS = ['profile', 'bets', 'sponsors']

const PRESETS = [10, 50, 100]
const CURRENCY_ICON = { gem: '\uD83D\uDC8E', star: '\u2B50' }
const PTS = '\uD83C\uDF56'

export default function ProfilePage() {
  const { t } = useLang()
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
  const [chargeCurrency, setChargeCurrency] = useState('')
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
      setError(t('profile.charRequired'))
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
      setError(err.response?.data?.message || t('profile.failedUpdate'))
    } finally {
      setSaving(false)
    }
  }

  // Convertible balances sorted: star first (to encourage spending star before gem)
  const convertibleBalances = (wallet?.balances || [])
    .filter(b => parseInt(b.balance) > 0)
    .sort((a, b) => {
      const codeA = a.currency_code || a.code
      const codeB = b.currency_code || b.code
      if (codeA === 'star') return -1
      if (codeB === 'star') return 1
      return 0
    })
  const selectedBalance = convertibleBalances.find(b => (b.currency_code || b.code) === chargeCurrency)
  const selectedMax = parseInt(selectedBalance?.balance) || 0

  function openCharge() {
    // Default to star if available, else first available
    const defaultCurrency = convertibleBalances.length > 0
      ? (convertibleBalances[0].currency_code || convertibleBalances[0].code)
      : ''
    setChargeCurrency(defaultCurrency)
    setChargeOpen(true)
  }

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
    setChargeCurrency('')
    setChargeAmount('')
    setChargeConfirm(false)
  }

  async function confirmCharge() {
    const amount = parseInt(chargeAmount)
    if (!amount || amount < 1) return
    setCharging(true)
    try {
      const icon = CURRENCY_ICON[chargeCurrency] || chargeCurrency
      const res = await userApi.post('/wallet/convert', { amount, currency_code: chargeCurrency })
      toast.success(t('profile.chargeSuccess', { icon, amount, pts: PTS }))
      setProfile(prev => ({ ...prev, points: res.data.new_points ?? prev.points + amount }))
      setWallet(prev => {
        if (!prev) return prev
        return {
          ...prev,
          balances: prev.balances.map(b =>
            (b.currency_code || b.code) === chargeCurrency ? { ...b, balance: String(parseInt(b.balance) - amount) } : b
          )
        }
      })
      cancelCharge()
    } catch (err) {
      const msg = err.response?.data?.message || t('profile.chargeFailed')
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

  const tabLabelMap = {
    profile: t('profile.tabProfile'),
    bets: t('profile.tabBets'),
    sponsors: t('profile.tabSponsors')
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('profile.title')}</h1>
      </div>

      <div className="tabs">
        {TABS.map(key => (
          <button
            key={key}
            className={'tab' + (tab === key ? ' active' : '')}
            onClick={() => setTab(key)}
          >
            {tabLabelMap[key]}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('profile.nickname')}
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
                  {saving ? '...' : t('common.save')}
                </button>
                <button className="btn" onClick={() => { setEditing(false); setEditName(profile.display_name || ''); setError('') }} style={{ padding: '8px 16px' }}>
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{profile.display_name || t('profile.noName')}</span>
                <button
                  onClick={() => setEditing(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  {t('profile.edit')}
                </button>
              </div>
            )}
            {error && <div style={{ color: 'var(--danger, #ef4444)', fontSize: '0.875rem', marginTop: '4px' }}>{error}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <StatCard label={PTS + ' ' + t('profile.points')} value={profile.points} accent />
            <StatCard label={t('profile.bets')} value={stats.bets_count} />
            <StatCard label={t('profile.betsWon')} value={stats.bets_won} />
            <StatCard label={t('profile.wagered')} value={stats.total_wagered} />
            <StatCard label={t('profile.payout')} value={stats.total_payout} />
            <StatCard label={t('profile.sponsors')} value={stats.sponsors_count} />
          </div>

          {profile.hub_connected && wallet?.expired ? (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('profile.hubWallet')}
              </label>
              <div style={{
                marginTop: '8px', padding: '16px', background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
              }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {t('profile.hubExpired')}
                </span>
                <button className="btn btn-primary" onClick={() => navigate('/login')} style={{ padding: '6px 16px', fontSize: '0.875rem' }}>
                  {t('profile.reLogin')}
                </button>
              </div>
            </div>
          ) : profile.hub_connected && wallet && !wallet.expired ? (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('profile.hubWallet')}
              </label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {wallet.balances.map(b => {
                  const code = b.currency_code || b.code
                  const icon = CURRENCY_ICON[code] || code.toUpperCase()
                  return (
                    <span key={code} style={{
                      padding: '6px 12px', background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', fontSize: '0.875rem'
                    }}>
                      {icon} {b.balance}
                    </span>
                  )
                })}
                {!chargeOpen && convertibleBalances.length > 0 && (
                  <button className="btn btn-primary" onClick={openCharge} style={{ padding: '6px 16px', fontSize: '0.875rem' }}>
                    {t('profile.chargePoints')}
                  </button>
                )}
              </div>

              {chargeOpen && (
                <div style={{
                  marginTop: '16px', padding: '20px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)'
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '1rem' }}>{t('profile.chargePoints')}</div>

                  {/* Currency selector */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    {convertibleBalances.map(b => {
                      const code = b.currency_code || b.code
                      const icon = CURRENCY_ICON[code] || code.toUpperCase()
                      const isSelected = chargeCurrency === code
                      return (
                        <button
                          key={code}
                          className={'bet-amount-btn' + (isSelected ? '' : '')}
                          onClick={() => { setChargeCurrency(code); setChargeAmount(''); setChargeConfirm(false) }}
                          style={{
                            background: isSelected ? 'var(--primary)' : 'var(--bg)',
                            color: isSelected ? '#fff' : 'var(--text)',
                            border: '1px solid ' + (isSelected ? 'var(--primary)' : 'var(--border)')
                          }}
                        >
                          {icon} {b.balance}
                        </button>
                      )
                    })}
                  </div>

                  {!chargeConfirm ? (
                    <>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {PRESETS.filter(v => v <= selectedMax).map(v => (
                          <button key={v} className="bet-amount-btn" onClick={() => selectPreset(v)}>{v}</button>
                        ))}
                        <input
                          type="number"
                          className="form-input"
                          placeholder={t('common.custom')}
                          min="1"
                          max={selectedMax}
                          value={chargeAmount}
                          onChange={e => setChargeAmount(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleCustomSubmit() }}
                          style={{ width: '100px', padding: '8px 12px' }}
                        />
                        {chargeAmount && parseInt(chargeAmount) > 0 && (
                          <button className="btn btn-primary" onClick={handleCustomSubmit} style={{ padding: '8px 16px' }}>
                            {t('common.next')}
                          </button>
                        )}
                      </div>
                      <button className="btn btn-ghost" onClick={cancelCharge} style={{ padding: '6px 16px', fontSize: '0.875rem' }}>
                        {t('common.cancel')}
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{
                        padding: '12px 16px', background: 'var(--card-bg, var(--surface))', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)', marginBottom: '16px', fontSize: '0.95rem'
                      }}>
                        {CURRENCY_ICON[chargeCurrency] || chargeCurrency} {chargeAmount} &rarr; {PTS} {chargeAmount}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary" onClick={confirmCharge} disabled={charging} style={{ padding: '8px 20px' }}>
                          {charging ? t('profile.charging') : t('common.confirm')}
                        </button>
                        <button className="btn btn-ghost" onClick={cancelCharge} disabled={charging} style={{ padding: '8px 20px' }}>
                          {t('common.cancel')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : !profile.hub_connected && (
            <div style={{ marginBottom: '24px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {t('profile.connectHub')}
            </div>
          )}

          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            <div>{t('profile.emailLabel')}: {profile.email || '-'}</div>
            <div>{t('profile.roleLabel')}: {profile.role}</div>
            <div>{t('profile.hubLabel')}: {profile.hub_connected ? t('profile.connected') : t('profile.notConnected')}</div>
            <div>{t('profile.joinedLabel')}: {new Date(profile.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      )}

      {tab === 'bets' && (
        historyLoading ? <Loading /> : bets.data.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">{'\uD83C\uDFB2'}</div>
            <div className="empty-state-text">{t('profile.noBets')}</div>
          </div>
        ) : (
          <>
            <div className="card" style={{ overflowX: 'auto' }}>
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>{t('profile.thGame')}</th>
                    <th>{t('profile.thSlot')}</th>
                    <th>{t('profile.thAmount')}</th>
                    <th>{t('profile.thPayout')}</th>
                    <th>{t('profile.thResult')}</th>
                    <th>{t('profile.thDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bets.data.map(b => (
                    <tr key={b.id}>
                      <td>{b.game_title}</td>
                      <td>#{b.slot}</td>
                      <td>{PTS} {parseInt(b.amount)}</td>
                      <td className={parseInt(b.payout) > 0 ? 'text-accent' : ''}>{PTS} {parseInt(b.payout)}</td>
                      <td className={b.result === 'won' ? 'text-accent' : ''}>{b.result === 'won' ? t('profile.won') : b.result === 'lost' ? t('profile.lost') : t('profile.pending')}</td>
                      <td>{new Date(b.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {bets.pagination && <Pagination pagination={bets.pagination} onPage={loadBets} t={t} />}
          </>
        )
      )}

      {tab === 'sponsors' && (
        historyLoading ? <Loading /> : sponsors.data.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">{'\u2B50'}</div>
            <div className="empty-state-text">{t('profile.noSponsors')}</div>
          </div>
        ) : (
          <>
            <div className="card" style={{ overflowX: 'auto' }}>
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>{t('profile.thGame')}</th>
                    <th>{t('profile.thSlot')}</th>
                    <th>{t('profile.thBoost')}</th>
                    <th>{t('profile.thEffect')}</th>
                    <th>{t('profile.thCost')}</th>
                    <th>{t('profile.thPayout')}</th>
                    <th>{t('profile.thResult')}</th>
                    <th>{t('profile.thDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sponsors.data.map(s => (
                    <tr key={s.id}>
                      <td>{s.game_title}</td>
                      <td>#{s.slot}</td>
                      <td>{s.boost_type === 'weapon_boost' ? t('profile.weapon') : t('profile.hp')}</td>
                      <td>+{s.effect_value}</td>
                      <td>{PTS} {parseInt(s.cost)}</td>
                      <td className={parseInt(s.payout) > 0 ? 'text-accent' : ''}>{PTS} {parseInt(s.payout)}</td>
                      <td className={s.result === 'won' ? 'text-accent' : ''}>{s.result === 'won' ? t('profile.won') : s.result === 'lost' ? t('profile.lost') : t('profile.pending')}</td>
                      <td>{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sponsors.pagination && <Pagination pagination={sponsors.pagination} onPage={loadSponsors} t={t} />}
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

function Pagination({ pagination, onPage, t }) {
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
        {t('common.prev')}
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
        {t('common.next')}
      </button>
    </div>
  )
}
