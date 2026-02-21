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

export default function AgentFace({ faceId = 'crab', className }) {
  const face = FACES[faceId] || FACES.crab
  return <span className={'agent-face' + (className ? ' ' + className : '')}>{face}</span>
}
