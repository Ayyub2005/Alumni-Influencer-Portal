// public/js/admin.js
document.addEventListener('DOMContentLoaded', () => {
  if (!API.isLoggedIn()) return API.redirect('/index.html');

  const tokensList = document.getElementById('tokens-list');
  const newTokenContainer = document.getElementById('new-token-container');
  const rawTokenValue = document.getElementById('raw-token-value');

  // Load Tokens
  async function loadTokens() {
    tokensList.innerHTML = '<div class="spinner"></div>';
    try {
      const { ok, data } = await API.get('/admin/tokens');
      if (ok) {
        if (data.tokens.length === 0) {
          tokensList.innerHTML = '<div class="empty-state">No API keys generated yet.</div>';
          return;
        }
        tokensList.innerHTML = data.tokens.map(renderTokenCard).join('');
        // Attach listeners AFTER injection
        attachListeners();
      } else {
        tokensList.innerHTML = '<div class="alert alert-error show">Failed to load API keys.</div>';
      }
    } catch (err) {
      tokensList.innerHTML = '<div class="alert alert-error show">Network error.</div>';
    }
  }

  // Render Token Card (No onclick!)
  function renderTokenCard(t) {
    const isRevoked = t.is_revoked === 1;
    return `
      <div class="token-card ${isRevoked ? 'revoked' : ''}">
        <div class="token-header">
          <div>
            <h4 class="flex items-center gap-2">
              ${t.token_name}
              ${isRevoked ? '<span class="badge badge-red">Revoked</span>' : '<span class="badge badge-green">Active</span>'}
            </h4>
            <div class="text-xs text-muted mt-1">Created: ${fmtDateTime(t.created_at)}</div>
          </div>
          <div class="flex gap-2">
            ${!isRevoked ? `<button class="btn btn-sm btn-danger btn-revoke" data-id="${t.id}">Revoke Key</button>` : ''}
            <button class="btn btn-sm btn-secondary btn-usage" data-id="${t.id}" id="btn-usage-${t.id}">View Usage Stat</button>
          </div>
        </div>
        <div id="usage-container-${t.id}" class="hidden mt-4 pt-4" style="border-top:1px solid var(--border);">
          <div class="stat-grid mb-6" style="grid-template-columns: repeat(2, 1fr);">
            <div class="stat-card" style="padding:1rem;">
              <div class="stat-value" style="font-size:1.5rem;">${t.total_requests}</div>
              <div class="stat-label">Total Uses</div>
            </div>
            <div class="stat-card" style="padding:1rem;">
              <div class="stat-value" style="font-size:1rem; padding-top:.5rem;">${t.last_used_at ? fmtDateTime(t.last_used_at) : 'Never'}</div>
              <div class="stat-label">Last Used</div>
            </div>
          </div>
          <div id="usage-logs-${t.id}"></div>
        </div>
      </div>
    `;
  }

  // Attach Event Listeners to dynamic buttons
  function attachListeners() {
    document.querySelectorAll('.btn-revoke').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        if (!confirm('Are you sure? This will immediately break any apps using this key.')) return;
        btn.disabled = true;
        const { ok } = await API.del(`/admin/tokens/${id}`);
        if (ok) { toast('Key revoked successfully'); loadTokens(); }
        else { toast('Error revoking key', 'error'); btn.disabled = false; }
      };
    });

    document.querySelectorAll('.btn-usage').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const cont = document.getElementById(`usage-container-${id}`);
        const logs = document.getElementById(`usage-logs-${id}`);
        if (!cont.classList.contains('hidden')) {
          cont.classList.add('hidden');
          btn.innerText = 'View Usage Stat';
          return;
        }
        btn.innerText = 'Loading...'; btn.disabled = true;
        try {
          const { ok, data } = await API.get(`/admin/tokens/${id}/usage`);
          if (ok) {
            // Note: Endpoints and Logs are still in 'data' for markers if needed
            cont.classList.remove('hidden');
            btn.innerText = 'Hide Usage Stat';
          } else toast('Error loading logs', 'error');
        } catch (err) { toast('Network error', 'error'); }
        btn.disabled = false;
      };
    });
  }

  // Generate Token
  document.getElementById('generate-token-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('generate-btn'); btn.disabled = true;
    
    const checkboxes = document.querySelectorAll('input[name="permissions"]:checked');
    const permissions = Array.from(checkboxes).map(cb => cb.value);

    try {
      const { ok, data } = await API.post('/admin/tokens', { 
        token_name: document.getElementById('token-name').value,
        permissions: permissions
      });
      if (ok) {
        document.getElementById('generate-token-form').reset();
        const rawTokenInput = document.getElementById('raw-token-input');
        if (rawTokenInput) rawTokenInput.value = data.api_token;
        newTokenContainer.classList.remove('hidden');
        toast('API Key generated successfully');
        loadTokens();
      } else toast(data.message || 'Error generating key', 'error');
    } catch (err) { toast('Network error', 'error'); }
    btn.disabled = false;
  });

  const copyBtn = document.getElementById('copy-key-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const input = document.getElementById('raw-token-input');
      if (!input || !input.value) return;
      
      const originalText = copyBtn.innerText;
      input.select();
      input.setSelectionRange(0, 99999);

      try {
        const success = document.execCommand('copy');
        if (success) {
          copyBtn.innerText = 'COPIED!';
          copyBtn.style.background = '#10b981';
          setTimeout(() => {
            copyBtn.innerText = originalText;
            copyBtn.style.background = '';
          }, 1500);
          if (typeof toast === 'function') toast('Key Copied!');
        }
      } catch (err) { alert('Please manually copy the key.'); }
    });
  }

  // --- NAVIGATION ---
  const navLinks = document.querySelectorAll('[data-nav]');
  const panels   = document.querySelectorAll('.admin-panel');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navLinks.forEach(l => l.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      link.classList.add('active');
      document.getElementById(`panel-${link.dataset.nav}`).classList.add('active');
      if (link.dataset.nav === 'alumni') loadAlumniStats();
      if (link.dataset.nav === 'api') loadTokens();
    });
  });

  // --- LOGOUT ---
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await API.post('/auth/logout');
    API.clearToken();
    API.redirect('/index.html');
  });

  // --- SEARCH ---
  let allAlumni = [];
  document.getElementById('alumni-search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allAlumni.filter(a => 
      (a.first_name || '').toLowerCase().includes(term) || 
      (a.last_name || '').toLowerCase().includes(term) || 
      a.email.toLowerCase().includes(term)
    );
    renderAlumniTable(filtered);
  });


  // --- ALUMNI 4th WIN MANAGEMENT ---
  async function loadAlumniStats() {
    const list = document.getElementById('alumni-win-list');
    try {
      const { ok, data } = await API.get('/admin/alumni/win-stats');
      if (ok) {
        allAlumni = data.stats;
        renderAlumniTable(allAlumni);
      } else list.innerHTML = '<div class="alert alert-error">Error loading stats</div>';
    } catch (err) {
       list.innerHTML = '<div class="alert alert-error">Failed to connect</div>';
    }
  }

  function renderAlumniTable(stats) {
    const list = document.getElementById('alumni-win-list');
    if (stats.length === 0) {
      list.innerHTML = '<div class="empty-state">No alumni matching criteria</div>';
      return;
    }
    list.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Monthly Win</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${stats.map(s => `
            <tr>
              <td>${s.first_name || 'N/A'} ${s.last_name || ''}</td>
              <td class="text-sm">${s.email}</td>
              <td><span class="badge ${s.win_count >= 3 ? 'badge-red' : 'badge-cyan'}">${s.win_count} / ${s.has_event_participation ? 4 : 3}</span></td>
              <td>
                <div class="flex gap-1">
                  ${!s.has_event_participation ? `
                    <button class="btn btn-sm btn-primary btn-grant" data-id="${s.id}">Grant 4th Slot</button>
                  ` : '<span class="badge badge-green">4th Slot Awarded</span>'}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    attachGrantListeners();
  }

  function attachGrantListeners() {
    document.querySelectorAll('.btn-grant').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        const { ok } = await API.post(`/admin/alumni/${id}/grant-bonus`);
        if (ok) { toast('4th win slot granted!'); loadAlumniStats(); }
        else { toast('Error granting slot', 'error'); btn.disabled = false; }
      };
    });
  }

  loadTokens();
});
