// src/controllers/adminController.js
// API Token Management + Usage Statistics
//   - Generate bearer tokens for API clients
//   - View usage statistics (endpoints + timestamps)
//   - Revoke tokens immediately
//   - List all tokens with metadata

const crypto = require('crypto');
const { pool } = require('../config/db');

// ─────────────────────────────────────────────
// GENERATE API TOKEN
// POST /api/admin/tokens
// Generates a cryptographically secure bearer token
// Stores the SHA-256 HASH in DB (never the raw token)
// Raw token shown once to user — never retrievable again
// ─────────────────────────────────────────────
async function generateToken(req, res) {
  const { token_name, permissions } = req.body;
  const userId = req.user.id;

  try {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Validate that only known permissions are accepted
    const allowed = ['read:alumni', 'read:analytics', 'read:alumni_of_day'];
    const finalPerms = Array.isArray(permissions)
      ? permissions.filter(p => allowed.includes(p))
      : ['read:alumni'];

    const [result] = await pool.query(
      'INSERT INTO api_tokens (user_id, token_hash, token_name, permissions) VALUES (?, ?, ?, ?)',
      [userId, tokenHash, token_name || 'API Token', JSON.stringify(finalPerms)]
    );

    res.status(201).json({
      success: true,
      message: 'API token generated. Copy it now — it will never be shown again.',
      token_id: result.insertId,
      token_name: token_name || 'API Token',
      permissions: finalPerms,
      api_token: rawToken,
      usage: 'Add to requests as: Authorization: Bearer ' + rawToken,
    });
  } catch (err) {
    console.error('Generate token error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─────────────────────────────────────────────
// LIST ALL MY TOKENS
// GET /api/admin/tokens
// Returns token metadata (NOT the raw token — only hash for reference)
// ─────────────────────────────────────────────
async function listTokens(req, res) {
  const userId = req.user.id;

  try {
    const [tokens] = await pool.query(
      `SELECT id, token_name, is_revoked, created_at, last_used_at,
              (SELECT COUNT(*) FROM token_logs WHERE token_id = api_tokens.id) AS total_requests
       FROM api_tokens WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ success: true, tokens });

  } catch (err) {
    console.error('List tokens error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─────────────────────────────────────────────
// GET TOKEN USAGE STATS
// GET /api/admin/tokens/:id/usage
// ─────────────────────────────────────────────
async function getTokenUsage(req, res) {
  const tokenId = req.params.id;
  const userId = req.user.id;

  try {
    // Verify token belongs to this user
    const [tokens] = await pool.query(
      'SELECT id, token_name, is_revoked, created_at, last_used_at FROM api_tokens WHERE id = ? AND user_id = ?',
      [tokenId, userId]
    );

    if (tokens.length === 0) {
      return res.status(404).json({ success: false, message: 'Token not found.' });
    }

    // Get usage logs (endpoint + timestamp for each request)
    const [logs] = await pool.query(
      `SELECT endpoint, ip_address, accessed_at
       FROM token_logs WHERE token_id = ?
       ORDER BY accessed_at DESC
       LIMIT 100`,
      [tokenId]
    );

    // Aggregate stats — most used endpoints
    const [stats] = await pool.query(
      `SELECT endpoint, COUNT(*) AS request_count
       FROM token_logs WHERE token_id = ?
       GROUP BY endpoint
       ORDER BY request_count DESC`,
      [tokenId]
    );

    res.json({
      success: true,
      token: tokens[0],
      summary: {
        total_requests: logs.length,
        unique_endpoints: stats.length,
        top_endpoints: stats.slice(0, 5),
      },
      recent_logs: logs,
    });

  } catch (err) {
    console.error('Token usage error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─────────────────────────────────────────────
// REVOKE TOKEN
// DELETE /api/admin/tokens/:id
// ─────────────────────────────────────────────
async function revokeToken(req, res) {
  const tokenId = req.params.id;
  const userId = req.user.id;

  try {
    const [tokens] = await pool.query(
      'SELECT id, is_revoked FROM api_tokens WHERE id = ? AND user_id = ?',
      [tokenId, userId]
    );

    if (tokens.length === 0) {
      return res.status(404).json({ success: false, message: 'Token not found.' });
    }

    if (tokens[0].is_revoked) {
      return res.status(400).json({ success: false, message: 'Token is already revoked.' });
    }

    await pool.query('UPDATE api_tokens SET is_revoked = TRUE WHERE id = ?', [tokenId]);

    res.json({
      success: true,
      message: 'Token revoked immediately. Any requests using it will be rejected.',
      token_id: tokenId,
    });

  } catch (err) {
    console.error('Revoke token error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─────────────────────────────────────────────
// GRANT 4th WIN BONUS
// POST /api/admin/alumni/:id/grant-bonus
// ─────────────────────────────────────────────
async function grantFourthWin(req, res) {
  const alumniId = req.params.id;
  try {
    const [users] = await pool.query('SELECT role FROM users WHERE id = ?', [alumniId]);
    if (users.length === 0 || users[0].role !== 'alumni') {
      return res.status(400).json({ success: false, message: 'Target user must be an alumnus.' });
    }
    await pool.query('UPDATE profiles SET has_event_participation = TRUE WHERE user_id = ?', [alumniId]);
    res.json({ success: true, message: '4th win slot granted successfully! 🎫✨' });
  } catch (err) {
    console.error('Grant bonus error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─────────────────────────────────────────────
// LIST ALUMNI WIN STATS
// GET /api/admin/alumni/win-stats
// ─────────────────────────────────────────────
async function listAlumniWinStats(req, res) {
  const currentMonth = new Date().toISOString().substring(0, 7);
  try {
    const [stats] = await pool.query(`
      SELECT u.id, u.email, p.first_name, p.last_name, p.has_event_participation, p.appearance_count,
             COALESCE(mw.win_count, 0) as win_count
      FROM users u
      JOIN profiles p ON p.user_id = u.id
      LEFT JOIN monthly_wins mw ON mw.user_id = u.id AND mw.\`year_month\` = ?
      WHERE u.role = 'alumni'
      ORDER BY win_count DESC`, [currentMonth]);
    res.json({ success: true, stats });
  } catch (err) {
    console.error('List alumni stats error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─────────────────────────────────────────────
// TRIGGER MONTHLY WIN RESET (Manual)
// POST /api/admin/monthly-reset
// Allows the developer to manually fire the same
// logic the scheduler runs on the 1st of each month.
// Useful for testing or emergency resets.
// ─────────────────────────────────────────────
async function triggerMonthlyReset(req, res) {
  const { runMonthlyReset } = require('../services/bidScheduler');
  try {
    await runMonthlyReset();
    return res.json({
      success: true,
      message: 'Monthly win reset executed successfully.',
    });
  } catch (err) {
    console.error('Manual monthly reset error:', err);
    res.status(500).json({ success: false, message: 'Server error during reset.' });
  }
}

module.exports = { generateToken, listTokens, getTokenUsage, revokeToken, grantFourthWin, listAlumniWinStats, triggerMonthlyReset };
