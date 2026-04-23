// public/js/dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
  if (!API.isLoggedIn()) { return API.redirect('/index.html'); }

  const user = API.getUser();
  if (user && user.role === 'developer') {
    return API.redirect('/admin.html');
  }
  if (user) document.getElementById('user-email').innerText = user.email;

  // -- Navigation
  const navLinks = document.querySelectorAll('[data-nav]');
  const panels = document.querySelectorAll('.panel');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navLinks.forEach(l => l.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      link.classList.add('active');
      document.getElementById(`panel-${link.dataset.nav}`).classList.add('active');
      if (link.dataset.nav === 'bidding') {
        loadBidStatus();
        loadTomorrowSlot();
      }
    });
  });

  // -- Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await API.post('/auth/logout');
    API.clearToken();
    API.redirect('/index.html');
  });

  // ==========================================
  // PROFILE LOGIC — View / Edit Stage
  // ==========================================

  let profileData = null; // cached profile for cancel restore

  // Stage helpers
  function setStage(stage) { // 'view' or 'edit'
    const viewEl  = document.getElementById('profile-view-stage');
    const editEl  = document.getElementById('profile-edit-stage');
    const btnEdit = document.getElementById('btn-edit-profile');
    const btnSave = document.getElementById('btn-save-profile');
    const btnCncl = document.getElementById('btn-cancel-edit');
    if (stage === 'edit') {
      viewEl.style.display = 'none'; editEl.style.display = 'block';
      btnEdit.style.display = 'none'; btnSave.style.display = 'inline-block'; btnCncl.style.display = 'inline-block';
    } else {
      viewEl.style.display = 'block'; editEl.style.display = 'none';
      btnEdit.style.display = 'inline-block'; btnSave.style.display = 'none'; btnCncl.style.display = 'none';
    }
  }

  // ── Completion bar ──
  async function loadCompletion() {
    const { ok, data } = await API.get('/profile/me/completion');
    if (!ok || !data.success) return;
    const bar   = document.getElementById('completion-bar');
    const lbl   = document.getElementById('completion-label');
    const chips = document.getElementById('completion-sections');
    if (bar)   bar.style.width = `${data.percent}%`;
    if (lbl) {
      lbl.textContent = `${data.percent}% — ${data.label}`;
      lbl.className = `badge ${data.percent === 100 ? 'badge-green' : data.percent >= 60 ? 'badge-cyan' : 'badge-red'}`;
    }
    if (chips) {
      chips.innerHTML = data.sections.map(s => `
        <span class="badge ${s.complete ? 'badge-green' : 'badge-red'}" title="${s.hint || s.label}" style="font-size:.7rem; cursor:default;">
          ${s.complete ? '✓' : '✕'} ${s.label}
        </span>`).join('');
    }
  }

  // ── Render items (used in both stages) ──
  function renderItems(containerId, items, renderFn) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    if (!items || items.length === 0) { cont.innerHTML = '<div class="empty-state">No items added yet.</div>'; return; }
    cont.innerHTML = items.map(renderFn).join('');
  }

  // ── Read-only view renderers (no delete button) ──
  const viewDegree  = (i) => `<div class="item-card"><div><h4>${i.title}</h4><div class="text-sm text-secondary">${i.institution || ''}</div><div class="text-xs text-muted">Completed: ${fmtDate(i.completion_date)}</div>${i.degree_url ? `<a href="${i.degree_url}" target="_blank">Verify</a>` : ''}</div></div>`;
  const viewCert    = (i) => `<div class="item-card"><div><h4>${i.title}</h4><div class="text-xs text-muted">Completed: ${fmtDate(i.completion_date)}</div>${i.cert_url ? `<a href="${i.cert_url}" target="_blank">Verify</a>` : ''}</div></div>`;
  const viewLicence = (i) => `<div class="item-card"><div><h4>${i.title}</h4><div class="text-sm text-secondary">${i.awarding_body || ''}</div>${i.licence_url ? `<a href="${i.licence_url}" target="_blank">Verify</a>` : ''}</div></div>`;
  const viewCourse  = (i) => `<div class="item-card"><div><h4>${i.title}</h4>${i.course_url ? `<a href="${i.course_url}" target="_blank">Verify</a>` : ''}</div></div>`;
  const viewJob     = (i) => `<div class="item-card"><div><h4>${i.role} at ${i.company}</h4><div class="text-xs text-muted">${fmtDate(i.start_date)} — ${i.end_date ? fmtDate(i.end_date) : 'Present'}</div></div></div>`;

  // ── Edit renderers (using data attributes for event delegation) ──
  const renderDegree  = (i) => `<div class="item-card"><div><h4>${i.title}</h4><div class="text-sm text-secondary">${i.institution || ''}</div><div class="text-xs text-muted">Comp: ${fmtDate(i.completion_date)}</div></div> <div class="flex gap-1"><button class="btn btn-xs btn-secondary item-edit-btn" data-type="degrees" data-id="${i.id}">Edit</button> <button class="btn btn-xs btn-danger item-del-btn" data-type="degrees" data-id="${i.id}">Delete</button></div></div>`;
  const renderCert    = (i) => `<div class="item-card"><div><h4>${i.title}</h4><div class="text-xs text-muted">Comp: ${fmtDate(i.completion_date)}</div></div> <div class="flex gap-1"><button class="btn btn-xs btn-secondary item-edit-btn" data-type="certifications" data-id="${i.id}">Edit</button> <button class="btn btn-xs btn-danger item-del-btn" data-type="certifications" data-id="${i.id}">Delete</button></div></div>`;
  const renderLicence = (i) => `<div class="item-card"><div><h4>${i.title}</h4><div class="text-sm text-secondary">${i.awarding_body || ''}</div></div> <div class="flex gap-1"><button class="btn btn-xs btn-secondary item-edit-btn" data-type="licences" data-id="${i.id}">Edit</button> <button class="btn btn-xs btn-danger item-del-btn" data-type="licences" data-id="${i.id}">Delete</button></div></div>`;
  const renderCourse  = (i) => `<div class="item-card"><div><h4>${i.title}</h4></div> <div class="flex gap-1"><button class="btn btn-xs btn-secondary item-edit-btn" data-type="courses" data-id="${i.id}">Edit</button> <button class="btn btn-xs btn-danger item-del-btn" data-type="courses" data-id="${i.id}">Delete</button></div></div>`;
  const renderJob     = (i) => `<div class="item-card"><div><h4>${i.role} at ${i.company}</h4><div class="text-xs text-muted">${fmtDate(i.start_date)} — ${i.end_date ? fmtDate(i.end_date) : 'Present'}</div></div> <div class="flex gap-1"><button class="btn btn-xs btn-secondary item-edit-btn" data-type="employment" data-id="${i.id}">Edit</button> <button class="btn btn-xs btn-danger item-del-btn" data-type="employment" data-id="${i.id}">Delete</button></div></div>`;

  // ── Populate view stage from profile data ──
  function populateView(p) {
    // Avatar
    const viewAvatar = document.getElementById('view-avatar');
    const viewImg    = document.getElementById('view-avatar-img');
    const firstInitial = (p.first_name || '?').charAt(0);
    const lastInitial  = (p.last_name  || '').charAt(0);
    const initials     = (firstInitial + lastInitial).toUpperCase();
    
    if (p.profile_image) {
      viewImg.src = p.profile_image;
      viewImg.classList.remove('hidden');
      if (viewAvatar) viewAvatar.classList.add('hidden');
    } else {
      if (viewAvatar) { viewAvatar.textContent = initials; viewAvatar.classList.remove('hidden'); }
      viewImg.classList.add('hidden');
    }
    // Text
    const nameEl = document.getElementById('view-name');
    if (nameEl) nameEl.textContent = [p.first_name, p.last_name].filter(Boolean).join(' ') || '—';
    const bioEl = document.getElementById('view-bio');
    if (bioEl) bioEl.textContent = p.biography || 'No biography added yet.';
    const liEl = document.getElementById('view-linkedin');
    if (liEl) liEl.innerHTML = p.linkedin_url
      ? `<a href="${p.linkedin_url}" target="_blank" class="btn btn-secondary btn-sm">🔗 LinkedIn</a>`
      : '<span class="text-xs text-muted">No LinkedIn URL added.</span>';

    // View-stage lists
    renderItems('view-degrees-list',  p.degrees,        viewDegree);
    renderItems('view-certs-list',    p.certifications, viewCert);
    renderItems('view-licences-list', p.licences,       viewLicence);
    renderItems('view-courses-list',  p.courses,        viewCourse);
    renderItems('view-jobs-list',     p.employment,     viewJob);
  }

  // ── Populate edit stage form fields ──
  function populateEditForm(p) {
    const fname = document.getElementById('p-fname'); if (fname) fname.value = p.first_name || '';
    const lname = document.getElementById('p-lname'); if (lname) lname.value = p.last_name  || '';
    const bio   = document.getElementById('p-bio');   if (bio)   bio.value   = p.biography  || '';
    const li    = document.getElementById('p-linkedin'); if (li) li.value    = p.linkedin_url || '';

    // Edit avatar
    const editImg = document.getElementById('profile-img-preview');
    const editAv  = document.getElementById('avatar-container');
    if (p.profile_image && editImg) {
      editImg.src = p.profile_image; editImg.classList.remove('hidden');
      if (editAv) editAv.classList.add('hidden');
    } else {
      if (editImg) editImg.classList.add('hidden');
      if (editAv)  editAv.classList.remove('hidden');
    }

    // Edit-stage lists (with delete buttons)
    renderItems('degrees-list',  p.degrees,        renderDegree);
    renderItems('certs-list',    p.certifications, renderCert);
    renderItems('licences-list', p.licences,       renderLicence);
    renderItems('courses-list',  p.courses,        renderCourse);
    renderItems('jobs-list',     p.employment,     renderJob);
  }

  // ── Main load ──
  async function loadProfile() {
    const { ok, data } = await API.get('/profile/me');
    if (ok && data.success) {
      profileData = data.data;
      populateView(profileData);
      loadCompletion();
    }
    document.getElementById('app-layout').style.opacity = '1';
    document.getElementById('page-loading').classList.add('fade');
  }

  // ── Edit / Save / Cancel buttons ──
  document.getElementById('btn-edit-profile').addEventListener('click', () => {
    if (profileData) populateEditForm(profileData);
    setStage('edit');
  });

  document.getElementById('btn-cancel-edit').addEventListener('click', () => {
    setStage('view');
  });

  document.getElementById('btn-save-profile').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-profile'); btn.disabled = true;
    const { ok, data } = await API.put('/profile/me', {
      first_name:   document.getElementById('p-fname').value,
      last_name:    document.getElementById('p-lname').value,
      biography:    document.getElementById('p-bio').value,
      linkedin_url: document.getElementById('p-linkedin').value,
    });
    if (ok) {
      toast('Profile saved successfully.');
      await loadProfile();   // refresh everything
      setStage('view');
    } else {
      toast(data.message || 'Error saving profile.', 'error');
    }
    btn.disabled = false;
  });

  // ── Image upload ──
  document.getElementById('image-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (re) => {
      const img = document.getElementById('profile-img-preview');
      if (img) { img.src = re.target.result; img.classList.remove('hidden'); }
      const av = document.getElementById('avatar-container');
      if (av) av.classList.add('hidden');
    };
    reader.readAsDataURL(file);
    const fd = new FormData(); fd.append('image', file);
    const { ok, data: d } = await API.upload('/profile/me/image', fd);
    if (ok) { toast('Photo updated!', 'success'); loadCompletion(); }
    else toast(d.message || 'Error uploading image', 'error');
  });

  // ── Edit-stage tab switching ──
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.card').querySelectorAll('[data-tab]');
      group.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const groupConts = btn.closest('.card').querySelectorAll('.tab-content');
      groupConts.forEach(c => c.classList.remove('active'));
      const target = document.getElementById(`tab-${btn.dataset.tab}`);
      if (target) target.classList.add('active');
    });
  });

  // ── View-stage tab switching ──
  document.querySelectorAll('[data-vtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-vtab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('#profile-view-stage .tab-content').forEach(c => c.classList.remove('active'));
      const target = document.getElementById(btn.dataset.vtab);
      if (target) target.classList.add('active');
    });
  });

  // ── Delete item ──
  async function deleteItem(type, id) {
    if (!confirm('Delete this item?')) return;
    try {
      const { ok } = await API.del(`/profile/me/${type}/${id}`);
      if (ok) { toast('Deleted'); await loadProfile(); if (profileData) populateEditForm(profileData); loadCompletion(); }
    } catch (err) { toast('Delete failed', 'error'); }
  }

  // ── Start editing an item ──
  function startEdit(type, id) {
    if (!profileData || !profileData[type]) return console.error('Data not ready');
    // Ensure id is a number for comparison
    const numericId = parseInt(id);
    const item = profileData[type].find(x => x.id === numericId);
    if (!item) return console.error('Item not found', type, id);

    const formIdMap = {
      'degrees':        'add-degree-form',
      'certifications': 'add-cert-form',
      'licences':       'add-licence-form',
      'courses':        'add-course-form',
      'employment':     'add-job-form'
    };

    const formId = formIdMap[type];
    const form   = document.getElementById(formId);
    if (!form) return console.error(`Form not found for ${type}`);

    editingStates[type] = numericId;
    toast(`Editing: ${item.title || item.role}`, 'info');

    if (type === 'degrees') {
      document.getElementById('deg-title').value = item.title;
      document.getElementById('deg-inst').value = item.institution || '';
      document.getElementById('deg-url').value = item.degree_url || '';
      document.getElementById('deg-date').value = item.completion_date ? item.completion_date.split('T')[0] : '';
      form.querySelector('button[type="submit"]').textContent = 'Update Degree';
    } else if (type === 'certifications') {
      document.getElementById('cert-title').value = item.title;
      document.getElementById('cert-url').value = item.cert_url || '';
      document.getElementById('cert-date').value = item.completion_date ? item.completion_date.split('T')[0] : '';
      form.querySelector('button[type="submit"]').textContent = 'Update Certification';
    } else if (type === 'licences') {
      document.getElementById('lic-title').value = item.title;
      document.getElementById('lic-body').value = item.awarding_body || '';
      document.getElementById('lic-url').value = item.licence_url || '';
      form.querySelector('button[type="submit"]').textContent = 'Update Licence';
    } else if (type === 'courses') {
      document.getElementById('crs-title').value = item.title;
      document.getElementById('crs-url').value = item.course_url || '';
      form.querySelector('button[type="submit"]').textContent = 'Update Course';
    } else if (type === 'employment') {
      document.getElementById('job-company').value = item.company;
      document.getElementById('job-role').value = item.role;
      document.getElementById('job-start').value = item.start_date ? item.start_date.split('T')[0] : '';
      document.getElementById('job-end').value = item.end_date ? item.end_date.split('T')[0] : '';
      form.querySelector('button[type="submit"]').textContent = 'Update Record';
    }

    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── Event Delegation for dynamic Edit/Delete buttons ──
  document.getElementById('profile-edit-stage').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.item-edit-btn');
    const delBtn  = e.target.closest('.item-del-btn');
    
    if (editBtn) {
      const { type, id } = editBtn.dataset;
      startEdit(type, id);
    } else if (delBtn) {
      const { type, id } = delBtn.dataset;
      deleteItem(type, id);
    }
  });

  window.cancelBidFromHistory = async (bidId) => {
    if (!confirm('Cancel this bid?')) return;
    try {
      const { ok, data } = await API.del(`/bids/${bidId}`);
      if (ok) {
        toast('Bid cancelled.');
        loadBidStatus();
        loadTomorrowSlot();
      } else toast(data.message || 'Could not cancel bid.', 'error');
    } catch (err) { toast('Cancellation failed', 'error'); }
  };

  const editingStates = {}; 

  // ── Submission handler logic ──
  const setFormHandler = (formId, type, payloadFn) => {
    const form = document.getElementById(formId); if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = editingStates[type];
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;

      let res;
      if (editId) {
        res = await API.put(`/profile/me/${type}/${editId}`, payloadFn());
      } else {
        res = await API.post(`/profile/me/${type}`, payloadFn());
      }

      if (res.ok) {
        toast(editId ? 'Changes saved' : 'Added');
        form.reset();
        delete editingStates[type]; // Clear edit state
        const originalBtnText = { 'degrees': 'Add Degree', 'certifications': 'Add Certification', 'licences': 'Add Licence', 'courses': 'Add Course', 'employment': 'Add Record' };
        btn.textContent = originalBtnText[type] || 'Add Item';
        await loadProfile();
        if (profileData) populateEditForm(profileData);
        loadCompletion();
      } else {
        toast('Error processing request', 'error');
      }
      btn.disabled = false;
    });
  };

  setFormHandler('add-degree-form',  'degrees',        () => ({ title: document.getElementById('deg-title').value, institution: document.getElementById('deg-inst').value, degree_url: document.getElementById('deg-url').value, completion_date: document.getElementById('deg-date').value }));
  setFormHandler('add-cert-form',    'certifications', () => ({ title: document.getElementById('cert-title').value, cert_url: document.getElementById('cert-url').value, completion_date: document.getElementById('cert-date').value }));
  setFormHandler('add-licence-form', 'licences',       () => ({ title: document.getElementById('lic-title').value, awarding_body: document.getElementById('lic-body').value, licence_url: document.getElementById('lic-url').value }));
  setFormHandler('add-course-form',  'courses',        () => ({ title: document.getElementById('crs-title').value, course_url: document.getElementById('crs-url').value }));
  setFormHandler('add-job-form',     'employment',     () => ({ company: document.getElementById('job-company').value, role: document.getElementById('job-role').value, start_date: document.getElementById('job-start').value, end_date: document.getElementById('job-end').value }));




  // ==========================================
  // BIDDING LOGIC
  // ==========================================

  let currentBidId = null;

  // Null-safe getter — silently skips if element doesn't exist
  function el(id) { return document.getElementById(id); }
  function setText(id, value) { const e = el(id); if (e) e.innerText = value; }

  // ------------------------------------------
  // Load tomorrow's bidding slot
  // ------------------------------------------
  async function loadTomorrowSlot() {
    const { ok, data } = await API.get('/bids/tomorrow');
    if (!ok || !data || !data.success) return;

    const slot = data.slot;
    const elig = data.eligibility;

    setText('tmr-date',   slot.date);
    setText('tmr-opens',  '12:00 AM (Midnight start)');
    setText('tmr-closes', '11:59 PM → Winner at Midnight');
    setText('tmr-reason', elig.reason);

    const badge = el('tmr-eligibility-badge');
    if (badge) {
      if (elig.can_bid) {
        badge.textContent = `Eligible · ${elig.wins_remaining} win${elig.wins_remaining === 1 ? '' : 's'} left`;
        badge.className   = 'badge badge-green';
      } else {
        badge.textContent = 'Ineligible this month';
        badge.className   = 'badge badge-red';
      }
    }
  }

  async function loadBidStatus() {
    const { ok, data } = await API.get('/bids/status');
    const { ok: okH, data: dataH } = await API.get('/bids/history');

    if (ok && okH) {
      document.getElementById('wins-month').innerText = data.total_monthly_wins ?? dataH.total_monthly_wins ?? 0;
      document.getElementById('wins-left').innerText = data.wins_remaining ?? dataH.wins_remaining ?? 0;

      const card = document.getElementById('bid-status-card');
      const hl = document.getElementById('bid-headline');
      const fb = document.getElementById('bid-feedback');
      const amtDiv = document.getElementById('my-bid-amount');
      const formCard = document.getElementById('bid-action-card');

      card.className = 'card mb-6';
      card.classList.remove('winning', 'losing'); // Clear previous states

      if (data.has_bid) {
        currentBidId = data.bid_id;
        setText('bid-headline', data.STATUS === 'winning' ? 'You are Winning!' : 'You are Losing');
        card.classList.add(data.STATUS);
        setText('bid-feedback', data.feedback);

        // Show bid amount + cancel button
        const amtDiv   = el('my-bid-amount');
        const cancelBtn = el('cancel-bid-btn');
        if (amtDiv) {
          amtDiv.classList.remove('hidden');
          amtDiv.style.display     = 'flex';
          amtDiv.style.alignItems  = 'center';
          amtDiv.style.gap         = '0.85rem';
        }
        setText('my-bid-val', data.your_bid_amount);
        if (cancelBtn) cancelBtn.style.display = 'inline-block';

        setText('bid-form-title', 'Increase Your Bid (Tomorrow\'s Highlight)');
        setText('bid-submit-btn', 'Update Bid');
      } else {
        currentBidId = null;
        setText('bid-headline', 'No Active Bid');
        setText('bid-feedback', data.message || "You haven't placed a bid for tomorrow's highlight yet.");

        // Hide bid amount + cancel button
        const amtDiv    = el('my-bid-amount');
        const cancelBtn = el('cancel-bid-btn');
        if (amtDiv) { amtDiv.classList.add('hidden'); amtDiv.style.display = 'none'; }
        if (cancelBtn) cancelBtn.style.display = 'none';

        setText('bid-form-title', 'Place Your Bid for Tomorrow\'s Highlight');
        setText('bid-submit-btn', 'Place Bid');

        if (data.wins_remaining === 0 && formCard) formCard.classList.add('hidden');
      }
      const tb = document.getElementById('bid-history');
      const todayObj = new Date();
      const tomorrowObj = new Date(todayObj);
      tomorrowObj.setDate(tomorrowObj.getDate() + 1);
      const todayString = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(todayObj);
      const tomorrowString = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(tomorrowObj);
      
      if (dataH.bids.length === 0) tb.innerHTML = '<tr><td colspan="4" class="text-center">No bids placed yet</td></tr>';
      else {
        tb.innerHTML = dataH.bids.map(b => {
          // Normalize DB date string properly honoring Asia/Colombo timezone translation
          const bDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date(b.bid_date));
          return `
          <tr>
            <td>${fmtDate(b.bid_date)}</td>
            <td>£${b.amount}</td>
            <td>
              <span class="badge ${b.is_winner ? 'badge-green' : (b.STATUS === 'active' ? 'badge-cyan' : 'badge-red')}">
                ${b.is_winner ? 'Winner' : b.STATUS.toUpperCase()}
              </span>
            </td>
            <td></td>
          </tr>
        `}).join('');
      }
    }
  }

  document.getElementById('bid-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('bid-submit-btn'); btn.disabled = true;
    const amount = document.getElementById('bid-amount').value;

    let opt;
    if (currentBidId) {
      opt = API.patch(`/bids/${currentBidId}`, { amount: parseFloat(amount) });
    } else {
      opt = API.post('/bids', { amount: parseFloat(amount) });
    }

    const { ok, data } = await opt;

    if (ok) {
      toast(currentBidId ? 'Bid increased!' : 'Bid placed!');
      document.getElementById('bid-form').reset();
      loadBidStatus();
    } else {
      toast(data.message || 'Error occurred', 'error');
    }
    btn.disabled = false;
  });


  // ------------------------------------------
  // Cancel bid — from status card button
  // ------------------------------------------
  document.getElementById('cancel-bid-btn').addEventListener('click', async () => {
    if (!currentBidId) return;
    if (!confirm('Are you sure you want to cancel your bid? You can place a new one before Midnight.')) return;
    const btn = document.getElementById('cancel-bid-btn');
    btn.disabled = true;
    const { ok, data } = await API.del(`/bids/${currentBidId}`);
    if (ok) {
      toast('Bid cancelled. You may place a new bid.');
      loadBidStatus();
      loadTomorrowSlot();
    } else {
      toast(data.message || 'Could not cancel bid.', 'error');
    }
    btn.disabled = false;
  });

  // ------------------------------------------
  // Cancel bid — from history table row
  // ------------------------------------------
  // Handled globally at top

  // Developer Vision: Show Admin link only for dev role
  if (user && user.role === 'developer') {
    const devLink = document.getElementById('nav-dev-api');
    if (devLink) devLink.style.display = 'flex';
  }

  // Init
  loadProfile();
});
