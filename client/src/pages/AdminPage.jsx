import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi, publicApi } from '../api'
import { useToast } from '../components/Toast'
import Loading from '../components/Loading'

export default function AdminPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [races, setRaces] = useState([])
  const [loading, setLoading] = useState(true)

  // Create form state
  const [title, setTitle] = useState('')
  const [trackType, setTrackType] = useState('trivia')
  const [entryFee, setEntryFee] = useState(0)
  const [maxEntries, setMaxEntries] = useState(8)
  const [challengeCount, setChallengeCount] = useState(10)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) {
      navigate('/login')
      return
    }
    loadRaces()
  }, [])

  function loadRaces() {
    setLoading(true)
    publicApi.get('/races', { limit: 20 })
      .then(res => setRaces(res.data.data || []))
      .catch(() => setRaces([]))
      .finally(() => setLoading(false))
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    setCreating(true)
    try {
      await adminApi.post('/races', {
        title: title.trim(),
        track_type: trackType,
        entry_fee: entryFee,
        max_entries: maxEntries,
        challenge_count: challengeCount
      })
      toast.success('Race created!')
      setTitle('')
      loadRaces()
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create race'
      toast.error(msg)
    } finally {
      setCreating(false)
    }
  }

  async function handleStateChange(raceId, newState) {
    try {
      await adminApi.patch('/races/' + raceId, { state: newState })
      toast.success('Race state updated to ' + newState)
      loadRaces()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update race')
    }
  }

  function handleLogout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('user_token')
    localStorage.removeItem('user')
    window.dispatchEvent(new Event('admin-auth-change'))
    navigate('/')
  }

  return (
    <div>
      <div className="flex-between mb-md">
        <h1 className="page-title">Admin Panel</h1>
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="admin-grid">
        {/* Create Race Form */}
        <div className="card">
          <h2 className="card-title">Create Race</h2>
          <form onSubmit={handleCreate} className="mt-md">
            <div className="form-group">
              <label className="form-label">Title</label>
              <input
                className="form-input"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Race title"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Track Type</label>
              <select
                className="form-select"
                value={trackType}
                onChange={e => setTrackType(e.target.value)}
              >
                <option value="trivia">Trivia</option>
                <option value="math">Math</option>
                <option value="logic">Logic</option>
                <option value="word">Word</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Entry Fee (pts)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                value={entryFee}
                onChange={e => setEntryFee(parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Max Entries</label>
              <input
                className="form-input"
                type="number"
                min="2"
                max="8"
                value={maxEntries}
                onChange={e => setMaxEntries(parseInt(e.target.value) || 8)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Challenge Count</label>
              <input
                className="form-input"
                type="number"
                min="3"
                max="20"
                value={challengeCount}
                onChange={e => setChallengeCount(parseInt(e.target.value) || 10)}
              />
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={creating}
              type="submit"
            >
              {creating ? 'Creating...' : 'Create Race'}
            </button>
          </form>
        </div>

        {/* Active Races List */}
        <div>
          <h2 className="section-title">Races</h2>
          {loading ? (
            <Loading />
          ) : races.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-text">No races found</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {races.map(race => (
                <div key={race.id} className="card">
                  <div className="flex-between">
                    <div>
                      <strong>{race.title}</strong>
                      <span className={'badge badge-' + race.state} style={{ marginLeft: '8px' }}>
                        {race.state}
                      </span>
                    </div>
                    <span className="text-muted" style={{ fontSize: '0.8125rem' }}>
                      {race.entry_count}/{race.max_entries} entries
                    </span>
                  </div>
                  <div className="mt-sm flex gap-sm" style={{ flexWrap: 'wrap' }}>
                    {race.state === 'scheduled' && (
                      <button className="btn btn-sm btn-ghost" onClick={() => handleStateChange(race.id, 'registration')}>
                        Open Registration
                      </button>
                    )}
                    {race.state === 'registration' && (
                      <button className="btn btn-sm btn-ghost" onClick={() => handleStateChange(race.id, 'racing')}>
                        Start Race
                      </button>
                    )}
                    {race.state === 'racing' && (
                      <button className="btn btn-sm btn-ghost" onClick={() => handleStateChange(race.id, 'scoring')}>
                        Start Scoring
                      </button>
                    )}
                    {race.state === 'scoring' && (
                      <button className="btn btn-sm btn-ghost" onClick={() => handleStateChange(race.id, 'finished')}>
                        Mark Finished
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
