// src/security/csrf.js
// Custom CSRF Protection Middleware
// Implements the Synchronizer Token Pattern
// 1. Generates a unique token for every session
// 2. Validates the X-CSRF-Token header on all state-changing requests (POST, PUT, PATCH, DELETE)

const crypto = require('crypto');

/**
 * Ensures a CSRF token exists in the session.
 * If one doesn't exist, it generates a cryptographically secure 32-byte string.
 */
function setupCsrf(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    console.log(`[CSRF] New token generated for session: ${req.sessionID.substring(0,6)}...`);
  }
  next();
}

/**
 * Validates the CSRF token for any mutation request.
 * Mutation methods = POST, PUT, PATCH, DELETE
 */
function csrfProtection(req, res, next) {
  // 1. Skip validation for safe methods (GET, HEAD, OPTIONS)
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // 2. Extract token from header or body
  const clientToken = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session.csrfToken;

  // 3. Compare
  if (!clientToken || clientToken !== sessionToken) {
    console.warn(`[SECURITY] CSRF Validation Failed for ${req.method} ${req.path}`);
    return res.status(403).json({
      success: false,
      message: 'CSRF Validation Failed. Security token missing or invalid.',
      error: 'CSRF_FAILURE'
    });
  }

  // 4. Success
  next();
}

module.exports = { setupCsrf, csrfProtection };
