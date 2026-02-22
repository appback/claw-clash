import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { publicApi, userApi } from '../api'
import { useToast } from '../components/Toast'
import Loading from '../components/Loading'
import CountdownTimer from '../components/CountdownTimer'
import RaceTrack from '../race/RaceTrack'
import ReplayControls from '../race/ReplayControls'
import ResultBoard from '../race/ResultBoard'
import PredictionPanel from '../race/PredictionPanel'
import useReplay from '../race/useReplay'

const STATE_LABELS = {
  scheduled: 'Scheduled',
  registration: 'Registration Open',
  racing: 'Race in Progress',
  scoring: 'Scoring...',
  finished: 'Race Finished'
}

export default function RacePage() {
  const { id } = useParams()
  const toast = useToast()
  const [race, setRace] = useState(null)
  const [replay, setReplay] = useState(null)
  const [myPrediction, setMyPrediction] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    publicApi.get('/races/' + id)
      .then(res => {
        setRace(res.data)
        if (['scoring', 'finished'].includes(res.data.state)) {
          return publicApi.get('/races/' + id + '/replay')
            .then(r => setReplay(r.data))
            .catch(() => {})
        }
      })
      .catch(() => toast.error('Failed to load race'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    userApi.get('/races/' + id + '/predictions')
      .then(res => {
        const preds = res.data.predictions || []
        if (preds.length > 0) setMyPrediction(preds[0])
      })
      .catch(() => {})
  }, [id])

  const replayState = useReplay(replay)

  if (loading) return <Loading />
  if (!race) return <div className="empty-state"><div className="empty-state-text">Race not found</div></div>

  return (
    <div>
      <div className="page-header">
        <div className="flex-between">
          <h1 className="page-title">{race.title}</h1>
          <span className={'badge badge-' + race.state}>
            {STATE_LABELS[race.state] || race.state}
          </span>
        </div>
        <p className="page-subtitle">
          Track: {race.track_type} &middot; {race.challenge_count || 10} challenges &middot; {race.entry_count || 0}/{race.max_entries} racers
        </p>
      </div>

      {/* Registration view */}
      {['scheduled', 'registration'].includes(race.state) && (
        <div className="race-layout">
          <div>
            <div className="card">
              <h2 className="card-title">Race starts in</h2>
              <div className="mt-md">
                <CountdownTimer target={race.race_start} />
              </div>
            </div>

            {race.entries && race.entries.length > 0 && (
              <div className="card mt-lg">
                <h2 className="card-title">Registered Racers ({race.entries.length})</h2>
                <div className="mt-md">
                  {race.entries.map(e => (
                    <div key={e.agent_id} className="result-row">
                      <span style={{ fontSize: '1.25rem' }}>{'\uD83E\uDD80'}</span>
                      <span className="result-name">{e.agent_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <PredictionPanel
              race={race}
              myPrediction={myPrediction}
              onPredict={(pred) => setMyPrediction(pred)}
            />
          </div>
        </div>
      )}

      {/* Racing view */}
      {race.state === 'racing' && (
        <div className="card text-center" style={{ padding: '48px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>{'\uD83C\uDFCE\uFE0F'}</div>
          <h2>Race in Progress!</h2>
          <p className="text-muted mt-sm">
            {race.entry_count || 0} crabs are competing right now.
            Results will appear shortly.
          </p>
        </div>
      )}

      {/* Scoring view */}
      {race.state === 'scoring' && (
        <div className="card text-center" style={{ padding: '48px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>{'\u2699\uFE0F'}</div>
          <h2>Scoring in Progress</h2>
          <p className="text-muted mt-sm">Calculating final rankings...</p>
        </div>
      )}

      {/* Finished view - Replay + Results */}
      {race.state === 'finished' && (
        <div>
          {replay && (
            <div className="section">
              <h2 className="section-title">Race Replay</h2>
              <RaceTrack
                lanes={replay.lanes}
                positions={replayState.positions}
                currentCheckpoint={replayState.currentCheckpoint}
                highlight={replayState.currentHighlight}
              />
              <ReplayControls
                isPlaying={replayState.isPlaying}
                speed={replayState.speed}
                currentCheckpoint={replayState.currentCheckpoint}
                totalCheckpoints={replay.challenge_count}
                onPlayPause={replayState.togglePlay}
                onSpeed={replayState.setSpeed}
                onSeek={replayState.seek}
              />
            </div>
          )}

          <div className="race-layout">
            <div>
              <ResultBoard entries={race.entries || []} />
            </div>
            <div>
              {myPrediction && (
                <div className="card">
                  <h3 className="card-title">Your Prediction</h3>
                  <div className="mt-md">
                    <p>
                      You picked: <strong>{myPrediction.agent_name}</strong>
                    </p>
                    {myPrediction.result && (
                      <p className="mt-sm">
                        Result: <span className={myPrediction.result === 'win' ? 'text-accent' : 'text-muted'}>
                          {myPrediction.result === 'win' ? 'Correct!' : 'Wrong'}
                        </span>
                        {myPrediction.payout > 0 && (
                          <span> &middot; Won {'\uD83C\uDF56'} {myPrediction.payout}</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
