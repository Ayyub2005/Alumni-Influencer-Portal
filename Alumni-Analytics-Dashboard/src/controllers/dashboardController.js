require('dotenv').config();

const CW1   = process.env.CW1_API_URL;
const KEY   = process.env.CW1_ANALYTICS_KEY;
const AR_KEY = process.env.CW1_AR_KEY;

// We use native node fetch to proxy requests securely to the main API
// This completely hides the developer keys from the browser network tab
async function cw1(path) {
  const res = await fetch(`${CW1}${path}`, {
    headers: { 'Authorization': `Bearer ${KEY}` },
  });
  return res.json();
}

async function getAlumni(req, res) {
  try {
    // URLSearchParams automatically handles query string encoding for us
    const { programme, gradYear, industry, page, limit } = req.query;
    const params = new URLSearchParams();
    if (programme) params.set('programme', programme);
    if (gradYear)  params.set('gradYear', gradYear);
    if (industry)  params.set('industry', industry);
    if (page)      params.set('page', page);
    if (limit)     params.set('limit', limit);

    const data = await cw1(`/api/public/alumni?${params.toString()}`);
    res.json(data);
  } catch (err) {
    console.error('getAlumni error:', err);
    res.status(500).json({ success: false, message: 'Failed to reach CW1 API.' });
  }
}

async function getSkillsGap(req, res) {
  try {
    const { programme, gradYear } = req.query;
    const params = new URLSearchParams();
    if (programme) params.set('programme', programme);
    if (gradYear)  params.set('gradYear', gradYear);
    const data = await cw1(`/api/analytics/skills-gap?${params.toString()}`);
    res.json(data);
  } catch (err) {
    console.error('getSkillsGap error:', err);
    res.status(500).json({ success: false, message: 'Failed to reach CW1 API.' });
  }
}

async function getEmploymentByIndustry(req, res) {
  try {
    const { programme, gradYear } = req.query;
    const params = new URLSearchParams();
    if (programme) params.set('programme', programme);
    if (gradYear)  params.set('gradYear', gradYear);
    const data = await cw1(`/api/analytics/employment-by-industry?${params.toString()}`);
    res.json(data);
  } catch (err) {
    console.error('getEmploymentByIndustry error:', err);
    res.status(500).json({ success: false, message: 'Failed to reach CW1 API.' });
  }
}

async function getTopJobTitles(req, res) {
  try {
    const { programme, gradYear } = req.query;
    const params = new URLSearchParams();
    if (programme) params.set('programme', programme);
    if (gradYear)  params.set('gradYear', gradYear);
    const data = await cw1(`/api/analytics/top-job-titles?${params.toString()}`);
    res.json(data);
  } catch (err) {
    console.error('getTopJobTitles error:', err);
    res.status(500).json({ success: false, message: 'Failed to reach CW1 API.' });
  }
}

async function getTopEmployers(req, res) {
  try {
    const { n, programme, gradYear } = req.query;
    const params = new URLSearchParams();
    if (n)         params.set('n', n);
    if (programme) params.set('programme', programme);
    if (gradYear)  params.set('gradYear', gradYear);
    const data = await cw1(`/api/analytics/top-employers?${params.toString()}`);
    res.json(data);
  } catch (err) {
    console.error('getTopEmployers error:', err);
    res.status(500).json({ success: false, message: 'Failed to reach CW1 API.' });
  }
}

async function getGeographic(req, res) {
  try {
    const data = await cw1('/api/analytics/geographic');
    res.json(data);
  } catch (err) {
    console.error('getGeographic error:', err);
    res.status(500).json({ success: false, message: 'Failed to reach CW1 API.' });
  }
}

// We intentionally use a weak key here to prove that CW1 enforces permissions
// The response will be a 403 error because the AR key cannot read analytics data
async function permissionDemo(req, res) {
  try {
    const response = await fetch(`${CW1}/api/analytics/skills-gap`, {
      headers: { 'Authorization': `Bearer ${AR_KEY}` },
    });
    const data = await response.json();
    
    // We send everything back so the frontend can render the error proof
    res.status(response.status).json({
      cw1_status: response.status,
      cw1_response: data,
      key_used: 'AR App key (permissions: read_alumni_of_day only)',
      endpoint_called: 'GET /api/analytics/skills-gap',
    });
  } catch (err) {
    console.error('permissionDemo error:', err);
    res.status(500).json({ success: false, message: 'Failed to reach CW1 API.' });
  }
}

async function getGraduationTrends(req, res) {
  try {
    const data = await cw1('/api/analytics/graduation-trends');
    res.json(data);
  } catch (err) {
    console.error('getGraduationTrends error:', err);
    res.status(500).json({ success: false, message: 'Failed to reach CW1 API.' });
  }
}

module.exports = {
  getAlumni,
  getSkillsGap,
  getEmploymentByIndustry,
  getTopJobTitles,
  getTopEmployers,
  getGeographic,
  getGraduationTrends,
  permissionDemo,
};
