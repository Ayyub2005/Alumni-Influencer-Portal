// src/controllers/authController.js
// Handles all authentication: register, verify email, login, logout, reset password

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { generateToken, generateExpiry, hashToken } = require('../utils/tokenGenerator');
const emailService = require('../services/emailService');
require('dotenv').config();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { generateToken, generateExpiry, hashToken } = require('../utils/tokenGenerator');
const emailService = require('../services/emailService');
require('dotenv').config();

async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const [existing] = await pool.query('SELECT id, is_verified FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      if (existing[0].is_verified) {
        return res.status(409).json({ success: false, message: 'Email already registered.' });
      } else {
        // We delete incomplete accounts so users can safely restart the registration process
        await pool.query('DELETE FROM users WHERE id = ?', [existing[0].id]);
      }
    }

    const password_hash = await bcrypt.hash(password, 10);

    const rawToken = generateToken();
    
    // We never store raw tokens so we hash it immediately before the database push
    const tokenHash = hashToken(rawToken);       
    const tokenExpiry = generateExpiry(1);

    await pool.query(
      `INSERT INTO users (email, password_hash, verify_token, verify_expires) 
       VALUES (?, ?, ?, ?)`,
      [email, password_hash, tokenHash, tokenExpiry]
    );

    // Tell the email service to drop the raw token directly into the physical link they click
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

async function verifyEmail(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Verification token missing.' });
  }

  try {
    // We mathematically hash the url parameter to see if it matches the encrypted copy holding in SQL
    const tokenHash = hashToken(token);

    const [rows] = await pool.query(
      'SELECT id, verify_expires FROM users WHERE verify_token = ? AND is_verified = FALSE',
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or already used token.' });
    }

    const user = rows[0];

    if (new Date() > new Date(user.verify_expires)) {
      return res.status(400).json({ success: false, message: 'Verification token has expired. Please register again.' });
    }

    // Completely erase the token so this link physically stops working
    await pool.query(
      'UPDATE users SET is_verified = TRUE, verify_token = NULL, verify_expires = NULL WHERE id = ?',
      [user.id]
    );

    // This creates the blank slate profile automatically so they do not hit null errors upon login
    await pool.query('INSERT IGNORE INTO profiles (user_id) VALUES (?)', [user.id]).catch(() => null);

    res.redirect('/index.html?verified=true');

  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).send('Something went wrong during verification.');
  }
}

async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      // Returning generic credentials stops anyone from sniffing out valid user accounts
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = rows[0];

    if (!user.is_verified) {
      return res.status(403).json({ success: false, message: 'Please verify your email before logging in.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Build the payload mapping the explicit permissions directly into the JWT string
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2d' }
    );

    // We still maintain session state for the legacy developer web pages
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.role = user.role;

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

async function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Could not log out.' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully.' });
  });
}

async function forgotPassword(req, res) {
  const { email } = req.body;

  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);

    // Give a success response regardless so bots hitting this endpoint get frustrated and quit
    if (rows.length === 0) {
      return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    }

    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const tokenExpiry = generateExpiry(1);

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

    if (new Date() > new Date(user.reset_expires)) {
      return res.status(400).json({ success: false, message: 'Reset token has expired. Please request a new one.' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);

    // Replay attacks fail totally here because we aggressively wipe the token after updating the hash
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
