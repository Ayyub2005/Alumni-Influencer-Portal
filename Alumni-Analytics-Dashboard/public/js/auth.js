document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  
  // --- UI Toggle Logic ---
  const loginContainer = document.getElementById('login-container');
  const registerContainer = document.getElementById('register-container');
  const showRegisterBtn = document.getElementById('show-register');
  const showLoginBtn = document.getElementById('show-login');

  if (showRegisterBtn && showLoginBtn && loginContainer && registerContainer) {
    showRegisterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loginContainer.style.display = 'none';
      registerContainer.style.display = 'block';
    });

    showLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      registerContainer.style.display = 'none';
      loginContainer.style.display = 'block';
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const errorDiv = document.getElementById('login-error');

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (data.success) {
          window.location.href = '/dashboard.html';
        } else {
          errorDiv.textContent = data.message || 'Login failed';
        }
      } catch (err) {
        errorDiv.textContent = 'Network error.';
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;
      const msgDiv = document.getElementById('register-msg');

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        msgDiv.textContent = data.message || 'Registration failed';
        msgDiv.style.color = data.success ? 'green' : 'red';
      } catch (err) {
        msgDiv.textContent = 'Network error.';
        msgDiv.style.color = 'red';
      }
    });
  }

  // --- Password Recovery ---
  const forgotForm = document.getElementById('forgot-form');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgot-email').value;
      const msgDiv = document.getElementById('forgot-msg');
      msgDiv.textContent = 'Sending...';

      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        msgDiv.textContent = data.message;
        msgDiv.style.color = data.success ? '#10b981' : '#f87171'; // emerald green or red
      } catch (err) {
        msgDiv.textContent = 'Network error.';
        msgDiv.style.color = '#f87171';
      }
    });
  }

  const resetForm = document.getElementById('reset-form');
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('reset-password').value;
      const msgDiv = document.getElementById('reset-msg');
      // Extract token from ?token= abc URL
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      if (!token) {
        msgDiv.innerHTML = '<span style="color:#f87171;">Invalid or missing reset token.</span>';
        return;
      }

      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password })
        });
        const data = await res.json();
        msgDiv.textContent = data.message;
        msgDiv.style.color = data.success ? '#10b981' : '#f87171';
        if(data.success) {
          setTimeout(() => window.location.href = '/index.html', 2000);
        }
      } catch (err) {
        msgDiv.textContent = 'Network error.';
        msgDiv.style.color = '#f87171';
      }
    });
  }
});
