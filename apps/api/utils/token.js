const { generateToken, hashToken, compareToken } = require('../../../../packages/common/token');
const jwt = require('jsonwebtoken');

const AGENT_TOKEN_PREFIX = 'cr_agent_';

function generateAgentToken() {
  return generateToken(AGENT_TOKEN_PREFIX);
}

function generateJWT(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  return jwt.sign(payload, secret, { expiresIn });
}

function verifyJWT(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return jwt.verify(token, secret);
}

module.exports = {
  AGENT_TOKEN_PREFIX,
  generateAgentToken,
  generateJWT,
  verifyJWT,
  hashToken,
  compareToken
};
