// src/controllers/authController.js
// Handles all authentication: register, verify email, login, logout, reset password

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { generateToken, generateExpiry, hashToken } = require('../utils/tokenGenerator');
const emailService = require('../services/emailService');
require('dotenv').config();

// ─────────────────────────────────────────────
// REGISTER
// POST /api/auth/register
// ─────────────────────────────────────────────
async function register(req, res) {
  // Check express-validator errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Check if email already registered
    const [existing] = await pool.query('SELECT id, is_verified FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      if (existing[0].is_verified) {
        return res.status(409).json({ success: false, message: 'Email already registered.' });
      } else {
        // Safe to delete because no foreign key records (profiles/bids) are generated until verification completes
        await pool.query('DELETE FROM users WHERE id = ?', [existing[0].id]);
      }
    }

    const password_hash = await bcrypt.hash(password, 10);

    // Generate email verification token (crypto-random, single-use, with expiry)
    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);       // Store hashed version in DB
    const tokenExpiry = generateExpiry(1);          // Expires in 1 hour

    // Insert new user
    await pool.query(
      `INSERT INTO users (email, password_hash, verify_token, verify_expires) 
       VALUES (?, ?, ?, ?)`,
      [email, password_hash, tokenHash, tokenExpiry]
    );

    // Send verification email with raw token (user clicks link containing raw token)
    await emailService.sendVerificationEmail(email, rawToken);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
}

// ─────────────────────────────────────────────
// VERIFY EMAIL
// GET /api/auth/verify-email?token=xxx
// ─────────────────────────────────────────────
async function verifyEmail(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Verification token missing.' });
  }

  try {
    // Hash the incoming token to compare with DB (we store hashes, not raw tokens)
    const tokenHash = hashToken(token);

    const [rows] = await pool.query(
      'SELECT id, verify_expires FROM users WHERE verify_token = ? AND is_verified = FALSE',
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or already used token.' });
    }

    const user = rows[0];

    // Check expiry
    if (new Date() > new Date(user.verify_expires)) {
      return res.status(400).json({ success: false, message: 'Verification token has expired. Please register again.' });
    }

    // Mark user as verified, clear the token (single-use)
    await pool.query(
      'UPDATE users SET is_verified = TRUE, verify_token = NULL, verify_expires = NULL WHERE id = ?',
      [user.id]
    );

    // Create empty profile for this user
    await pool.query('INSERT IGNORE INTO profiles (user_id) VALUES (?)', [user.id]).catch(() => null);

    // Redirect to the login page with a success message
    res.redirect('/index.html?verified=true');

  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).send('Something went wrong during verification.');
  }
}

// ─────────────────────────────────────────────
// LOGIN
// POST /api/auth/login
// ─────────────────────────────────────────────
async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      // Don't reveal whether email exists (security best practice)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = rows[0];

    if (!user.is_verified) {
      return res.status(403).json({ success: false, message: 'Please verify your email before logging in.' });
    }

    // Compare password with stored bcrypt hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2d' }  // Token expires in 2 days
    );

    // This gives us session management for the web UI
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.role = user.role;

    // Explicitly save the session to prevent race conditions during redirect
    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      res.json({
        success: true,
        message: 'Login successful.',
        token,
        user: { id: user.id, email: user.email, role: user.role },
      });
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─────────────────────────────────────────────
// LOGOUT
// POST /api/auth/logout
// ─────────────────────────────────────────────
async function logout(req, res) {
  // Destroy the server-side session
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Could not log out.' });
    }
    res.clearCookie('connect.sid');  // Clear the session cookie
    res.json({ success: true, message: 'Logged out successfully.' });
  });
}

// ─────────────────────────────────────────────
// FORGOT PASSWORD - Send reset email
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────
async function forgotPassword(req, res) {
  const { email } = req.body;

  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);

    // Always return success even if email not found (prevents email enumeration attack)
    if (rows.length === 0) {
      return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    }

    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const tokenExpiry = generateExpiry(1); // 1 hour

    await pool.query(
      'UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?',
      [tokenHash, tokenExpiry, rows[0].id]
    );

    await emailService.sendPasswordResetEmail(email, rawToken);

    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });

  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─────────────────────────────────────────────
// RESET PASSWORD - Set new password
// POST /api/auth/reset-password
// ─────────────────────────────────────────────
async function resetPassword(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { token, newPassword } = req.body;

  try {
    const tokenHash = hashToken(token);

    const [rows] = await pool.query(
      'SELECT id, reset_expires FROM users WHERE reset_token = ?',
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    const user = rows[0];

    // Check token hasn't expired
    if (new Date() > new Date(user.reset_expires)) {
      return res.status(400).json({ success: false, message: 'Reset token has expired. Please request a new one.' });
    }

    // Hash new password
    const password_hash = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token (single-use)
    await pool.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
      [password_hash, user.id]
    );

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });

  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { register, verifyEmail, login, logout, forgotPassword, resetPassword };
