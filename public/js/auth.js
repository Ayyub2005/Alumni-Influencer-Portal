// public/js/auth.js
document.addEventListener('DOMContentLoaded', () => {
  // --- AUTH CHECKER ---
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('error') === 'unauthorized') {
    API.clearToken();
  } else if (API.isLoggedIn()) {
    const user = API.getUser();
    if (user && user.role === 'developer') {
      API.redirect('/admin.html');
    } else {
      API.redirect('/dashboard.html');
    }
    return;
  }

  const alertBox = document.getElementById('auth-alert');
  const tabs = document.querySelectorAll('.auth-tab');
  const forms = document.querySelectorAll('.auth-form');

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      forms.forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.target}-form`).classList.add('active');
      hideAlert(alertBox);
    });
  });

  // Show "Forgot"
  document.getElementById('forgot-btn').addEventListener('click', (e) => {
    e.preventDefault();
    tabs.forEach(t => t.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));
    document.getElementById('forgot-form').classList.add('active');
    hideAlert(alertBox);
  });

  document.querySelector('.back-to-login').addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('[data-target="login"]').click();
  });

  // Login
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const { ok, data } = await API.post('/auth/login', { email, password });
      if (ok) {
        API.setToken(data.token);
        API.setUser(data.user);
        API.redirect('/dashboard.html');
      } else {
        showAlert(alertBox, data.message || 'Login failed.', 'error');
      }
    } catch (err) {
      showAlert(alertBox, 'Network error.', 'error');
    }
    btn.disabled = false; btn.innerHTML = 'Sign In';
  });

  // Register
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');

    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    if (password !== confirm) {
      return showAlert(alertBox, 'Passwords do not match.', 'error');
    }

    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
    try {
      const { ok, data } = await API.post('/auth/register', { email, password });
      if (ok) {
        toast('Registration successful! Please check your email (terminal log in dev mode) to verify your account.', 'success', 6000);
        document.getElementById('register-form').reset();
        document.querySelector('[data-target="login"]').click();
      } else {
        // Handle express-validator array of errors
        let msg = data.message || 'Registration failed.';
        if (data.errors && data.errors.length > 0) {
          msg = data.errors.map(e => e.msg).join('<br>');
        }
        showAlert(alertBox, msg, 'error');
      }
    } catch (err) {
      showAlert(alertBox, 'Network error.', 'error');
    }
    btn.disabled = false; btn.innerHTML = 'Create Account';
  });

  // Forgot Password
  document.getElementById('forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';

    try {
      const { ok, data } = await API.post('/auth/forgot-password', { email });
      if (ok) {
        showAlert(alertBox, 'Password reset link sent to your email (see terminal).', 'success');
        document.getElementById('forgot-form').reset();
      } else {
        showAlert(alertBox, data.message || 'Error occurred.', 'error');
      }
    } catch (err) {
      showAlert(alertBox, 'Network error.', 'error');
    }
    btn.disabled = false; btn.innerHTML = 'Send Reset Link';
  });

  if (urlParams.get('verified')) {
    showAlert(alertBox, 'Email verified successfully! You can now log in.', 'success');
  }
});
