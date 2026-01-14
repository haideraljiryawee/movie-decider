document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.auth-tab');
  const form = document.getElementById('authForm');
  const title = document.getElementById('authTitle');
  const subtitle = document.getElementById('authSubtitle');
  const confirmField = document.getElementById('confirmField');
  const submitBtn = document.getElementById('authSubmit');
  const authMsg = document.getElementById('authMsg');
  const authSwitch = document.getElementById('authSwitch');
  const passwordHint = document.getElementById('passwordHint');

  const passwordRulesMessage = 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.';
  const isValidPassword = (value) => {
    if (value.length < 8) return false;
    if (!/[A-Z]/.test(value)) return false;
    if (!/[a-z]/.test(value)) return false;
    if (!/\d/.test(value)) return false;
    return true;
  };

  let mode = 'login';

  const setMode = (nextMode) => {
    mode = nextMode;
    tabs.forEach(btn => btn.classList.toggle('is-active', btn.dataset.mode === mode));

    if (mode === 'register') {
      title.textContent = 'Create your account';
      subtitle.textContent = 'Use a username and a strong password.';
      confirmField.hidden = false;
      if (passwordHint) passwordHint.hidden = false;
      submitBtn.querySelector('span').textContent = 'Create account';
      authSwitch.innerHTML = 'Already have an account? <button type="button" data-switch="login">Sign in</button>';
    } else {
      title.textContent = 'Sign in to StreamFinder';
      subtitle.textContent = 'Use your username and password.';
      confirmField.hidden = true;
      if (passwordHint) passwordHint.hidden = true;
      submitBtn.querySelector('span').textContent = 'Sign in';
      authSwitch.innerHTML = 'New here? <button type="button" data-switch="register">Create an account</button>';
    }

    authMsg.textContent = '';
    authMsg.className = 'auth-msg';
  };

  const setMessage = (msg, type) => {
    authMsg.textContent = msg;
    authMsg.className = `auth-msg ${type ? `is-${type}` : ''}`;
  };

  tabs.forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  authSwitch.addEventListener('click', (e) => {
    const target = e.target.closest('button[data-switch]');
    if (!target) return;
    setMode(target.dataset.switch);
  });

  if (window.location.hash === '#register') {
    setMode('register');
  } else {
    setMode(mode);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage('');

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirmPassword')?.value || '';

    if (mode === 'register' && !isValidPassword(password)) {
      setMessage(passwordRulesMessage, 'error');
      return;
    }

    if (mode === 'register' && password !== confirm) {
      setMessage('Passwords do not match.', 'error');
      return;
    }

    submitBtn.disabled = true;

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      localStorage.setItem('auth_token', data.token);
      setMessage('Success! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = '/';
      }, 700);
    } catch (err) {
      setMessage(err.message || 'Something went wrong.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
});
