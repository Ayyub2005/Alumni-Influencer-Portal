// src/utils/tokenGenerator.js
// Cryptographically secure token generation

const crypto = require('crypto');

/**
 * Generate a cryptographically random token
 * Used for: email verification, password reset
 * @returns {string} 64-char hex token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex'); // 32 bytes = 64 hex chars
}

/**
 * Generate token expiry time
 * @param {number} hours - How many hours until expiry
 * @returns {Date} Expiry date object
 */
function generateExpiry(hours = 1) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/**
 * Hash a token using SHA-256 before storing in DB
 * This way even if DB is breached, raw tokens are not exposed
 * @param {string} token - Raw token
 * @returns {string} SHA-256 hex hash
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { generateToken, generateExpiry, hashToken };
