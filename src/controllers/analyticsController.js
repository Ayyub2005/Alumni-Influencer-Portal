const { pool } = require('../config/db');

// Curriculum Skills Gap
// Counts how many alumni independently acquired each certification/course post-graduation.
// This is the core scenario described in the coursework brief.
async function skillsGap(req, res) {
  try {
    const { programme, gradYear } = req.query;

    // Build optional filters — programme = degree title, gradYear = graduation year
    let degreeFilter = '';
    let params = [];
    if (programme || gradYear) {
      degreeFilter = `AND p.id IN (
        SELECT d2.profile_id FROM degrees d2
        WHERE 1=1
        ${programme ? 'AND d2.title LIKE ?' : ''}
        ${gradYear  ? 'AND YEAR(d2.completion_date) = ?' : ''}
      )`;
      if (programme) params.push(`%${programme}%`);
      if (gradYear)  params.push(parseInt(gradYear));
    }

    const [certRows] = await pool.query(
      `SELECT c.title, COUNT(*) AS count
       FROM certifications c
       JOIN profiles p ON c.profile_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE u.is_verified = 1 ${degreeFilter}
       GROUP BY c.title
       ORDER BY count DESC
       LIMIT 20`,
      params
    );

    const [courseRows] = await pool.query(
      `SELECT co.title, COUNT(*) AS count
       FROM courses co
       JOIN profiles p ON co.profile_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE u.is_verified = 1 ${degreeFilter}
       GROUP BY co.title
       ORDER BY count DESC
       LIMIT 20`,
      params
    );

    const [licenceRows] = await pool.query(
      `SELECT l.title, COUNT(*) AS count
       FROM licences l
       JOIN profiles p ON l.profile_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE u.is_verified = 1 ${degreeFilter}
       GROUP BY l.title
       ORDER BY count DESC
       LIMIT 20`,
      params
    );

    res.json({ success: true, certifications: certRows, courses: courseRows, licences: licenceRows });
  } catch (err) {
    console.error('skillsGap error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// Employment by Industry Sector
// Uses employment.role as the sector grouping since your schema has no industry column.
async function employmentByIndustry(req, res) {
  try {
    const { programme, gradYear } = req.query;
    let filter = '';
    let params = [];
    if (programme || gradYear) {
      filter = `AND e.profile_id IN (
        SELECT d.profile_id FROM degrees d WHERE 1=1
        ${programme ? 'AND d.title LIKE ?' : ''}
        ${gradYear  ? 'AND YEAR(d.completion_date) = ?' : ''}
      )`;
      if (programme) params.push(`%${programme}%`);
      if (gradYear)  params.push(parseInt(gradYear));
    }

    const [rows] = await pool.query(
      `SELECT e.role AS sector, COUNT(*) AS count
       FROM employment e
       JOIN profiles p ON e.profile_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE u.is_verified = 1 ${filter}
       GROUP BY e.role
       ORDER BY count DESC
       LIMIT 15`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('employmentByIndustry error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// Most Common Job Titles — same as above but distinct from industry grouping
async function topJobTitles(req, res) {
  try {
    const { programme, gradYear } = req.query;
    let filter = '';
    let params = [];
    if (programme || gradYear) {
      filter = `AND e.profile_id IN (
        SELECT d.profile_id FROM degrees d WHERE 1=1
        ${programme ? 'AND d.title LIKE ?' : ''}
        ${gradYear  ? 'AND YEAR(d.completion_date) = ?' : ''}
      )`;
      if (programme) params.push(`%${programme}%`);
      if (gradYear)  params.push(parseInt(gradYear));
    }

    const [rows] = await pool.query(
      `SELECT e.role AS title, COUNT(*) AS count
       FROM employment e
       JOIN profiles p ON e.profile_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE u.is_verified = 1 ${filter}
       GROUP BY e.role
       ORDER BY count DESC
       LIMIT 10`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('topJobTitles error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// Top N Employers
async function topEmployers(req, res) {
  try {
    const n = Math.min(parseInt(req.query.n) || 10, 50);
    const { programme, gradYear } = req.query;
    let filter = '';
    let params = [];
    if (programme || gradYear) {
      filter = `AND e.profile_id IN (
        SELECT d.profile_id FROM degrees d WHERE 1=1
        ${programme ? 'AND d.title LIKE ?' : ''}
        ${gradYear  ? 'AND YEAR(d.completion_date) = ?' : ''}
      )`;
      if (programme) params.push(`%${programme}%`);
      if (gradYear)  params.push(parseInt(gradYear));
    }
    params.push(n);

    const [rows] = await pool.query(
      `SELECT e.company, COUNT(*) AS count
       FROM employment e
       JOIN profiles p ON e.profile_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE u.is_verified = 1 ${filter}
       GROUP BY e.company
       ORDER BY count DESC
       LIMIT ?`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('topEmployers error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// Geographic Distribution — uses employment.company as location proxy.
async function geographic(req, res) {
  try {
    const { programme, gradYear } = req.query;
    let filter = '';
    let params = [];
    if (programme || gradYear) {
      filter = `AND e.profile_id IN (
        SELECT d.profile_id FROM degrees d WHERE 1=1
        ${programme ? 'AND d.title LIKE ?' : ''}
        ${gradYear  ? 'AND YEAR(d.completion_date) = ?' : ''}
      )`;
      if (programme) params.push(`%${programme}%`);
      if (gradYear)  params.push(parseInt(gradYear));
    }

    const [rows] = await pool.query(
      `SELECT e.company AS location, COUNT(*) AS count
       FROM employment e
       JOIN profiles p ON e.profile_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE u.is_verified = 1 ${filter}
       GROUP BY e.company
       ORDER BY count DESC
       LIMIT 20`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('geographic error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// Graduation Trends (Degrees awarded per year)
async function graduationTrends(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT YEAR(d.completion_date) AS year, COUNT(*) AS count
       FROM degrees d
       JOIN profiles p ON d.profile_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE u.is_verified = 1 AND d.completion_date IS NOT NULL
       GROUP BY YEAR(d.completion_date)
       ORDER BY year ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('graduationTrends error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { skillsGap, employmentByIndustry, topJobTitles, topEmployers, geographic, graduationTrends };
