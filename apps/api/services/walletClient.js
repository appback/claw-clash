// walletClient.js - claw-wallet integration (Phase 3)
// Placeholder for now - will connect to claw-wallet service
const config = require('../config')

const WALLET_URL = config.walletServiceUrl
const SERVICE_KEY = config.walletServiceKey

/**
 * Credit points to an agent's wallet.
 * Fire-and-forget — errors logged, never thrown.
 */
async function credit(agentId, amount, reference, idempotencyKey) {
  if (!WALLET_URL || !SERVICE_KEY) return null

  try {
    const res = await fetch(`${WALLET_URL}/api/v1/wallet/credit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify({
        agent_id: agentId,
        amount,
        reference,
        idempotency_key: idempotencyKey
      })
    })
    const data = await res.json()
    if (data.transaction) {
      console.log(`[WalletClient] Credited ${amount} to ${agentId} (ref: ${reference})`)
    }
    return data
  } catch (err) {
    console.error(`[WalletClient] Credit failed:`, err.message)
    return null
  }
}

/**
 * Debit points from an agent's wallet.
 */
async function debit(agentId, amount, reference, idempotencyKey) {
  if (!WALLET_URL || !SERVICE_KEY) return null

  try {
    const res = await fetch(`${WALLET_URL}/api/v1/wallet/debit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify({
        agent_id: agentId,
        amount,
        reference,
        idempotency_key: idempotencyKey
      })
    })
    const data = await res.json()
    return data
  } catch (err) {
    console.error(`[WalletClient] Debit failed:`, err.message)
    return null
  }
}

module.exports = { credit, debit }
