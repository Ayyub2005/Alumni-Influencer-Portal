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

  let currentPage = 1;
  let currentData = [];

  async function loadData() {
    const prog = document.getElementById('filter-programme').value;
    const year = document.getElementById('filter-year').value;
    const ind = document.getElementById('filter-industry').value;

    const q = new URLSearchParams();
    if (prog) q.set('programme', prog);
    if (year) q.set('gradYear', year);
    if (ind) q.set('industry', ind);
    q.set('page', currentPage);
    q.set('limit', 20);

    const tableWrapper = document.getElementById('table-wrapper');
    if (tableWrapper) tableWrapper.classList.add('loading-overlay');

    try {
      const res = await fetch(`/api/dashboard/alumni?${q.toString()}`);
      const data = await res.json();
      
      if (data.success) {
        currentData = data.alumni;
        const tbody = document.getElementById('alumni-table-body');
        tbody.innerHTML = '';
        data.alumni.forEach(al => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${al.first_name} ${al.last_name || ''}</td>
            <td>${al.email}</td>
            <td>${al.programme || 'N/A'}</td>
            <td>${al.grad_year || 'N/A'}</td>
            <td>${al.industry || 'N/A'}</td>
          `;
          tbody.appendChild(tr);
        });

        document.getElementById('page-info').textContent = `Page ${data.pagination.page} of ${data.pagination.pages}`;
        document.getElementById('prev-page').disabled = data.pagination.page <= 1;
        document.getElementById('next-page').disabled = data.pagination.page >= data.pagination.pages;
      }
    } catch(err) {
      console.error(err);
    } finally {
      if (tableWrapper) tableWrapper.classList.remove('loading-overlay');
    }
  }

  document.getElementById('apply-filters').addEventListener('click', () => {
    currentPage = 1;
    loadData();
  });

  document.getElementById('prev-page').addEventListener('click', () => {
    currentPage--;
    loadData();
  });

  document.getElementById('next-page').addEventListener('click', () => {
    currentPage++;
    loadData();
  });

  document.getElementById('export-csv').addEventListener('click', () => {
    let csv = 'Name,Email,Programme,Grad Year,Role\n';
    currentData.forEach(r => {
      const name = `"${r.first_name} ${r.last_name || ''}"`;
      const email = `"${r.email}"`;
      const prog = `"${r.programme || ''}"`;
      const yr = `"${r.grad_year || ''}"`;
      const ind = `"${r.industry || ''}"`;
      csv += `${name},${email},${prog},${yr},${ind}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alumni-export.csv';
    a.click();
  });

  loadData();
});
