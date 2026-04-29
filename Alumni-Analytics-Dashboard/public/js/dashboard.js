async function checkAuth() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) window.location.href = '/index.html';
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/index.html';
    });
  }

  // Stat value element IDs
  const statIds = [
    'stat-total-alumni', 'stat-top-cert', 'stat-top-employer', 'stat-top-job',
    'stat-top-course', 'stat-top-licence', 'stat-top-industry', 'stat-top-location'
  ];

  function showSkeletons() {
    statIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<span class="skeleton"></span>';
    });
  }

  // Fetch Dashboard Stats
  async function loadStats() {
    showSkeletons();
    try {
      const [alumniRes, gapRes, employerRes, jobRes, geoRes, indRes] = await Promise.all([
        fetch('/api/dashboard/alumni?limit=1'),
        fetch('/api/dashboard/skills-gap'),
        fetch('/api/dashboard/top-employers?n=1'),
        fetch('/api/dashboard/top-job-titles'),
        fetch('/api/dashboard/geographic'),
        fetch('/api/dashboard/employment-by-industry')
      ]);

      const alumni = await alumniRes.json();
      const gap = await gapRes.json();
      const employers = await employerRes.json();
      const jobs = await jobRes.json();
      const geo = await geoRes.json();
      const inds = await indRes.json();

      // Row 1
      document.getElementById('stat-total-alumni').textContent = alumni.pagination ? alumni.pagination.total : 'Error';
      document.getElementById('stat-top-cert').textContent = gap.certifications && gap.certifications[0] ? gap.certifications[0].title : 'N/A';
      document.getElementById('stat-top-employer').textContent = employers.data && employers.data[0] ? employers.data[0].company : 'N/A';
      document.getElementById('stat-top-job').textContent = jobs.data && jobs.data[0] ? jobs.data[0].title : 'N/A';

      // Row 2
      document.getElementById('stat-top-course').textContent = gap.courses && gap.courses[0] ? gap.courses[0].title : 'N/A';
      document.getElementById('stat-top-licence').textContent = gap.licences && gap.licences[0] ? gap.licences[0].title : 'N/A';
      document.getElementById('stat-top-industry').textContent = inds.data && inds.data[0] ? inds.data[0].sector : 'N/A';
      document.getElementById('stat-top-location').textContent = geo.data && geo.data[0] ? geo.data[0].location : 'N/A';

    } catch (err) {
      console.error('Failed to load stats', err);
      statIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = 'Error';
      });
    }
  }

  loadStats();
});
