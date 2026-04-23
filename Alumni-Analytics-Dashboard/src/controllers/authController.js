const bcrypt  = require('bcryptjs');
const { pool } = require('../config/db');
const { validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

// We share the same mailer pattern from CW1 so we don't have to rewrite smtp logic
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { email, password } = req.body;

  try {
    // Check if the administrator is already in the database before doing heavy crypto work
    const [existing] = await pool.query('SELECT id FROM dashboard_users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(409).json({ success: false, message: 'Email already registered.' });

    // Hash the password so a database leak doesn't expose raw text
    const password_hash = await bcrypt.hash(password, 10);
    
    // We generate a long hex string for the email link
    // Then we hash it before saving it so hackers can't find raw tokens in the DB
    const rawToken      = crypto.randomBytes(32).toString('hex');
    const tokenHash     = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires       = new Date(Date.now() + 3600000); 

    await pool.query(
      'INSERT INTO dashboard_users (email, password_hash, verify_token, verify_expires) VALUES (?, ?, ?, ?)',
      [email, password_hash, tokenHash, expires]
    );

    // Send the raw token to the user inside a link
    const verifyUrl = `${process.env.FRONTEND_URL}/api/auth/verify-email?token=${rawToken}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify your Dashboard account',
      html: `<p>Click to verify: <a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });

    res.status(201).json({ success: true, message: 'Registration successful. Check your email to verify.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function verifyEmail(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).json({ success: false, message: 'Token missing.' });

  try {
    // The user clicked the link so we hash their raw token to find the match in the database
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.query(
      'SELECT id, verify_expires FROM dashboard_users WHERE verify_token = ? AND is_verified = FALSE',
      [tokenHash]
    );

    if (rows.length === 0) return res.status(400).json({ success: false, message: 'Invalid or expired token.' });
    
    // We strictly check the one hour lifespan here
    if (new Date() > new Date(rows[0].verify_expires)) {
      return res.status(400).json({ success: false, message: 'Token expired. Register again.' });
    }

    // Force the token back to null so nobody can replay this url later
    await pool.query(
      'UPDATE dashboard_users SET is_verified = TRUE, verify_token = NULL, verify_expires = NULL WHERE id = ?',
      [rows[0].id]
    );

    res.redirect('/index.html?verified=true');
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { email, password } = req.body;

  try {
    const [rows] = await pool.query('SELECT * FROM dashboard_users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const user = rows[0];
    if (!user.is_verified) return res.status(403).json({ success: false, message: 'Email not verified.' });

    // Compare the plain text login with the stored bcrypt hash safely
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    // We rely totally on express sessions here rather than JWTs
    // This allows the server to instantly invalidate sessions without waiting for expiries
    req.session.userId = user.id;
    req.session.email  = user.email;

    res.json({ success: true, message: 'Logged in.' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function logout(req, res) {
  // Purge the session entirely from memory
  req.session.destroy();
  res.json({ success: true, message: 'Logged out.' });
}

async function forgotPassword(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  const { email } = req.body;
  try {
    const [rows] = await pool.query('SELECT id FROM dashboard_users WHERE email = ?', [email]);
    
    // We always send a success message to prevent hackers from figuring out who has an account
    if (rows.length === 0) return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });

    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires   = new Date(Date.now() + 3600000);

    await pool.query(
      'UPDATE dashboard_users SET reset_token = ?, reset_expires = ? WHERE id = ?',
      [tokenHash, expires, rows[0].id]
    );

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${rawToken}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Reset your Dashboard password',
      html: `<p>Click to reset: <a href="${resetUrl}">${resetUrl}</a></p>`,
    });

    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function resetPassword(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  const { token, password } = req.body;
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.query(
      'SELECT id, reset_expires FROM dashboard_users WHERE reset_token = ?',
      [tokenHash]
    );

    if (rows.length === 0) return res.status(400).json({ success: false, message: 'Invalid or expired token.' });
    if (new Date() > new Date(rows[0].reset_expires)) {
      return res.status(400).json({ success: false, message: 'Token expired.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    
    // Erase the tokens immediately after rewriting the main password hash
    await pool.query(
      'UPDATE dashboard_users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
      [password_hash, rows[0].id]
    );

    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// React or vanilla javascript uses this to figure out if it should show the page or kick you out
async function me(req, res) {
  if (!req.session.userId) return res.status(401).json({ success: false });
  res.json({ success: true, email: req.session.email });
}

module.exports = { register, verifyEmail, login, logout, forgotPassword, resetPassword, me };
