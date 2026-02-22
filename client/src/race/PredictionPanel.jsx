import React, { useState } from 'react'
import { publicApi } from '../api'
import { useToast } from '../components/Toast'
import { useLang } from '../i18n'

export default function PredictionPanel({ race, myPrediction, onPredict }) {
  const { t } = useLang()
  const toast = useToast()
  const [selected, setSelected] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (!race || !['scheduled', 'registration'].includes(race.state)) {
    return null
  }

  const entries = race.entries || []

  if (myPrediction) {
    return (
      <div className="prediction-panel">
        <h3 className="prediction-panel-title">{t('prediction.title')}</h3>
        <div className="mt-md">
          <p>
            {t('race.youPicked')} <strong className="text-accent">{myPrediction.agent_name}</strong>
          </p>
          <p className="text-muted mt-sm">
            {t('prediction.predictionLocked')}
          </p>
        </div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="prediction-panel">
        <h3 className="prediction-panel-title">{t('prediction.predictWinner')}</h3>
        <p className="text-muted mt-md">{t('prediction.noRacers')}</p>
      </div>
    )
  }

  async function handleSubmit() {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await publicApi.post('/races/' + race.id + '/predict', {
        predicted_agent_id: selected,
        prediction_type: 'win'
      })
      const agentName = entries.find(e => e.agent_id === selected)?.agent_name || 'Unknown'
      onPredict({ ...res.data, agent_name: agentName })
      toast.success(t('prediction.submitted'))
    } catch (err) {
      const msg = err.response?.data?.message || t('prediction.failedSubmit')
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="prediction-panel">
      <h3 className="prediction-panel-title">{t('prediction.predictWinner')}</h3>
      <p className="text-muted" style={{ fontSize: '0.8125rem', marginBottom: '12px' }}>
        {t('prediction.pickWinner')}
      </p>
      <div className="prediction-agents">
        {entries.map(entry => (
          <div
            key={entry.agent_id}
            className={'prediction-agent' + (selected === entry.agent_id ? ' selected' : '')}
            onClick={() => setSelected(entry.agent_id)}
          >
            <span style={{ fontSize: '1.25rem' }}>{'\uD83E\uDD80'}</span>
            <span className="prediction-agent-name">{entry.agent_name}</span>
          </div>
        ))}
      </div>
      <button
        className="btn btn-primary btn-lg mt-md"
        style={{ width: '100%' }}
        disabled={!selected || submitting}
        onClick={handleSubmit}
      >
        {submitting ? t('prediction.submitting') : t('prediction.confirmPrediction')}
      </button>
    </div>
  )
}
