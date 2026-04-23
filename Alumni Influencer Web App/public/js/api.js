// public/js/api.js
// Central API helper — all fetch calls go through here
const API = {
  base: '/api',

  getToken() { return localStorage.getItem('jwt_token'); },
  setToken(t) { localStorage.setItem('jwt_token', t); },
  clearToken() { localStorage.removeItem('jwt_token'); localStorage.removeItem('user'); },

  getUser() { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } },
  setUser(u) { localStorage.setItem('user', JSON.stringify(u)); },

  // CSRF Handling
  csrfToken: null,
  async fetchCsrfToken() {
    try {
      const res = await fetch('/api/csrf-token');
      const data = await res.json();
      if (data.success) {
        this.csrfToken = data.csrfToken;
        console.log('[SECURITY] CSRF Token Synchronized.');
      }
    } catch (err) { console.error('Failed to fetch CSRF token:', err); }
  },

  async request(method, path, body, useApiToken = false) {
    if (!this.csrfToken && path !== '/csrf-token') {
      await this.fetchCsrfToken();
    }

    const token = useApiToken ? localStorage.getItem('api_token') : this.getToken();
    const headers = { 
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.csrfToken || '' 
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(this.base + path, opts);
    const data = await res.json();
    
    // Auto-logout if token expires on global API routes
    // But SKIP redirect if we are currently TRYING to login/register/reset
    const isAuthRoute = path.includes('/auth/login') || path.includes('/auth/register') || path.includes('/auth/reset-password');
    if (res.status === 401 && !isAuthRoute) {
      this.clearToken();
      window.location = '/index.html';
    }
    return { ok: res.ok, status: res.status, data };
  },

  get(path, useApiToken)      { return this.request('GET',    path, null, useApiToken); },
  post(path, body)             { return this.request('POST',   path, body); },
  put(path, body)              { return this.request('PUT',    path, body); },
  patch(path, body)            { return this.request('PATCH',  path, body); },
  del(path)                    { return this.request('DELETE', path); },

  // Upload file (multipart)
  async upload(path, formData) {
    if (!this.csrfToken) await this.fetchCsrfToken();
    const token = this.getToken();
    const headers = { 'X-CSRF-Token': this.csrfToken || '' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(this.base + path, { method: 'POST', headers, body: formData });
    const data = await res.json();
    return { ok: res.ok, data };
  },

  isLoggedIn() { return !!this.getToken(); },

  redirect(path) { window.location.href = path; },
};

// Toast notifications
function toast(msg, type = 'success', duration = 3500) {
  const t = document.createElement('div');
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#06b6d4' };
  t.style.cssText = `
    position:fixed; bottom:1.5rem; right:1.5rem; z-index:9999;
    background:#1e1e2e; border:1px solid ${colors[type]}44;
    color:#f1f5f9; padding:.85rem 1.2rem; border-radius:10px;
    font-family:Inter,sans-serif; font-size:.875rem;
    display:flex; align-items:center; gap:.6rem;
    box-shadow:0 8px 24px rgba(0,0,0,.5);
    animation: slideIn .3s ease; max-width:320px;
  `;
  t.innerHTML = `<span style="color:${colors[type]};font-weight:700">${icons[type]}</span>${msg}`;
  document.head.insertAdjacentHTML('beforeend',
    '<style>@keyframes slideIn{from{opacity:0;transform:translateY(1rem)}to{opacity:1;transform:none}}</style>'
  );
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, duration);
}

// Show/hide alert helper
function showAlert(el, msg, type = 'error') {
  if (!el) return;
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  el.className = `alert alert-${type} show`;
  el.innerHTML = `<span style="font-weight:700" class="alert-icon">${icons[type]}</span> <div>${msg}</div>`;
}
function hideAlert(el) { if (el) el.className = 'alert'; }

// Format date
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}); }
function fmtDateTime(d) { if (!d) return '—'; return new Date(d).toLocaleString('en-GB'); }
// Copy to clipboard helper (High-compatibility)
async function copyToClipboard(elementId) {
  const text = document.getElementById(elementId).innerText;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard📋');
    } else {
      // Fallback: Create a hidden textarea
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed"; textArea.style.left = "-999999px"; textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus(); textArea.select();
      document.execCommand('copy');
      textArea.remove();
      toast('Copied to clipboard📋');
    }
  } catch (err) {
    console.error('Copy failed:', err);
    toast('Could not copy automatically. Please select text manually.', 'error');
  }
}
