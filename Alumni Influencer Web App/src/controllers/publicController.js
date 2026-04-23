const { pool } = require('../config/db');

async function getFeaturedAlumni(req, res) {
  try {
    // We strictly limit this query to one row because there should only ever be one featured winner per day
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

    // We execute rapid parallel queries mapping specifically to the nested arrays the AR client expects
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

async function getPublicProfile(req, res) {
  const profileId = req.params.id;

  try {
    // The AR client passes a raw physical ID here so we pull the base profile structure first
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

async function listAlumni(req, res) {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { programme, gradYear, industry } = req.query;

    // We start off demanding verified users with actual names populated
    // Then conditionally push SQL subqueries directly into an array if the user selected a filter
    let conditions = ['u.is_verified = 1', 'p.first_name IS NOT NULL'];
    let params = [];

    if (programme) {
      conditions.push('p.id IN (SELECT d.profile_id FROM degrees d WHERE d.title LIKE ?)');
      params.push(`%${programme}%`);
    }
    if (gradYear) {
      conditions.push('p.id IN (SELECT d.profile_id FROM degrees d WHERE YEAR(d.completion_date) = ?)');
      params.push(parseInt(gradYear));
    }
    if (industry) {
      conditions.push('p.id IN (SELECT e.profile_id FROM employment e WHERE e.role LIKE ?)');
      params.push(`%${industry}%`);
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    // The subqueries inside the select fields here prevent chaotic massive join duplications on the payload
    const [alumni] = await pool.query(
      `SELECT p.id, p.first_name, p.last_name, p.profile_image, u.email,
              (SELECT d.title FROM degrees d WHERE d.profile_id = p.id ORDER BY d.completion_date DESC LIMIT 1) AS programme,
              (SELECT YEAR(d.completion_date) FROM degrees d WHERE d.profile_id = p.id ORDER BY d.completion_date DESC LIMIT 1) AS grad_year,
              (SELECT e.role FROM employment e WHERE e.profile_id = p.id ORDER BY e.start_date DESC LIMIT 1) AS industry
       FROM profiles p JOIN users u ON p.user_id = u.id
       ${where}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM profiles p JOIN users u ON p.user_id = u.id ${where}`,
      params
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
