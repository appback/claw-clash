/**
 * AgentFace — Centralized agent face component.
 *
 * Used in: LobbyView, AgentToken (battle + replay), betting cards.
 * Currently: single crab emoji for all agents.
 * Future: multiple generated face images per agent (faceId from DB).
 */
const FACES = {
  crab: '\uD83E\uDD80'
}

const HAPPY_MESSAGES = ['\uD83C\uDF89', '\uD83D\uDD25', '\uD83D\uDCAA', 'LFG!']

export default function AgentFace({ faceId = 'crab', className, reaction }) {
  const face = FACES[faceId] || FACES.crab
  let cls = 'agent-face'
  if (className) cls += ' ' + className
  if (reaction === 'shake') cls += ' agent-face-shake'
  if (reaction === 'happy') cls += ' agent-face-happy-anim'

  return (
    <span className={cls} style={{ position: 'relative', display: 'inline-block' }}>
      {face}
      {reaction === 'happy' && (
        <span className="agent-face-happy-bubble">
          {HAPPY_MESSAGES[Math.floor(Math.random() * HAPPY_MESSAGES.length)]}
        </span>
      )}
    </span>
  )
}
