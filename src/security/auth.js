// src/security/auth.js
// JWT Authentication Logic
// High-security token-based access control

const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
require('dotenv').config();

/**
 * Security Guard: Verify JWT Bearer Token
 * Attach the decoded user to req.user so controllers can use it
 * Usage: add to any protected route
 */
async function verifyToken(req, res, next) {
  // Extract token from Authorization header
  // Format: "Authorization: Bearer <token>"
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. No token provided.' 
    });
  }

  const token = authHeader.split(' ')[1]; // Get the token part after "Bearer "

  try {
    // Verify the token using our JWT secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check user still exists in DB (token could be valid but user deleted)
    const [rows] = await pool.query('SELECT id, email, role, is_verified FROM users WHERE id = ?', [decoded.id]);

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    // Attach user info to request for use in controllers
    req.user = rows[0];
    next(); // Pass control to next system layer or route handler

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
}

/**
 * Security Guard: Validate API Bearer Token (for external clients like the AR app)
 * Logs usage to token_logs table
 * Checks if token has been revoked
 */
async function verifyApiToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'API token required.' });
  }

  const rawToken = authHeader.split(' ')[1].trim(); // Trim accidental spaces

  // Hash the incoming token to compare with stored hash
  const crypto = require('crypto');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  try {
    const [rows] = await pool.query(
      'SELECT * FROM api_tokens WHERE token_hash = ? AND is_revoked = FALSE',
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid or revoked API token.' });
    }

    const apiToken = rows[0];

    // Log this usage for audit trails (track timestamps + endpoints accessed)
    await pool.query(
      'INSERT INTO token_logs (token_id, endpoint, ip_address) VALUES (?, ?, ?)',
      [apiToken.id, `${req.method} ${req.path}`, req.ip]
    );

    // Update last_used_at
    await pool.query(
      'UPDATE api_tokens SET last_used_at = NOW() WHERE id = ?',
      [apiToken.id]
    );

    req.apiToken = apiToken;
    next();

  } catch (err) {
    console.error('API token verification error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

/**
 * Security Guard: Verify Developer Authority
 * Ensures the logged-in user has 'developer' role before proceeding
 */
async function verifyDeveloper(req, res, next) {
  if (!req.user || req.user.role !== 'developer') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Developer authority required.' 
    });
  }
  next();
}

function requirePermission(permission) {
  return (req, res, next) => {
    const perms = req.apiToken.permissions;
    const permArray = typeof perms === 'string' ? JSON.parse(perms) : (perms || []);
    if (!permArray.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. This token does not have the '${permission}' permission.`
      });
    }
    next();
  };
}
module.exports = { verifyToken, verifyApiToken, verifyDeveloper, requirePermission };
