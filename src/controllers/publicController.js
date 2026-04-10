// src/controllers/publicController.js
// Public Developer API — requires API bearer token (not alumni JWT)
//   - GET today's featured alumni (Alumni of the Day)
//   - GET alumni profile by ID (for AR client)
//   - Accessible via API token (not personal login)

const { pool } = require('../config/db');

// ─────────────────────────────────────────────
// GET TODAY'S FEATURED ALUMNI
// GET /api/public/featured
// Returns the alumni who won today's bid
// This is what the AR app would display
// ─────────────────────────────────────────────
async function getFeaturedAlumni(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT 
         p.id, p.first_name, p.last_name, p.biography,
         p.linkedin_url, p.profile_image,
         u.email
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       WHERE p.is_featured_today = TRUE
       LIMIT 1`
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        message: 'No alumni is currently featured. Bidding winners are selected at Midnight daily for the upcoming day.',
        featured: null,
      });
    }

    const profile = rows[0];
    const profileId = profile.id;

    // Fetch full profile details
    const [degrees]  = await pool.query('SELECT title, institution, degree_url, completion_date FROM degrees WHERE profile_id = ?', [profileId]);
    const [certs]    = await pool.query('SELECT title, cert_url, completion_date FROM certifications WHERE profile_id = ?', [profileId]);
    const [licences] = await pool.query('SELECT title, awarding_body, licence_url, completion_date FROM licences WHERE profile_id = ?', [profileId]);
    const [courses]  = await pool.query('SELECT title, course_url, completion_date FROM courses WHERE profile_id = ?', [profileId]);
    const [jobs]     = await pool.query('SELECT company, role, start_date, end_date FROM employment WHERE profile_id = ? ORDER BY start_date DESC', [profileId]);

    res.json({
      success: true,
      featured: {
        ...profile,
        degrees,
        certifications: certs,
        licences,
        courses,
        employment: jobs,
        featured_date: new Date().toISOString().split('T')[0],
      },
    });

  } catch (err) {
    console.error('Get featured alumni error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─────────────────────────────────────────────
// GET ALUMNI PROFILE BY ID (Public)
// GET /api/public/alumni/:id
// Allows AR client to fetch any verified alumni profile
// ─────────────────────────────────────────────
async function getPublicProfile(req, res) {
  const profileId = req.params.id;

  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.first_name, p.last_name, p.biography,
              p.linkedin_url, p.profile_image, u.email
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
      [profileId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Alumni not found.' });
    }

    const profile = rows[0];

    const [degrees]  = await pool.query('SELECT title, institution, degree_url, completion_date FROM degrees WHERE profile_id = ?', [profileId]);
    const [certs]    = await pool.query('SELECT title, cert_url, completion_date FROM certifications WHERE profile_id = ?', [profileId]);
    const [licences] = await pool.query('SELECT title, awarding_body, licence_url, completion_date FROM licences WHERE profile_id = ?', [profileId]);
    const [courses]  = await pool.query('SELECT title, course_url, completion_date FROM courses WHERE profile_id = ?', [profileId]);
    const [jobs]     = await pool.query('SELECT company, role, start_date, end_date FROM employment WHERE profile_id = ? ORDER BY start_date DESC', [profileId]);

    res.json({
      success: true,
      profile: {
        ...profile,
        degrees,
        certifications: certs,
        licences,
        courses,
        employment: jobs,
      },
    });

  } catch (err) {
    console.error('Get public profile error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─────────────────────────────────────────────
// LIST ALL ALUMNI (Public)
// GET /api/public/alumni
// Lightweight list of all alumni with profiles
// ─────────────────────────────────────────────
async function listAlumni(req, res) {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [alumni] = await pool.query(
      `SELECT p.id, p.first_name, p.last_name, p.biography, p.profile_image, u.email
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       WHERE u.is_verified = 1 AND p.first_name IS NOT NULL
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM profiles p JOIN users u ON p.user_id = u.id WHERE u.is_verified = 1'
    );

    res.json({
      success: true,
      alumni,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });

  } catch (err) {
    console.error('List alumni error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { getFeaturedAlumni, getPublicProfile, listAlumni };
