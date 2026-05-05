/**
 * Auth Module
 * Login/Register + Offline login support
 */

const Auth = (() => {
  let currentUser = null;

  const getUser = () => currentUser;
  const getToken = () => Storage.get('token');
  const isLoggedIn = () => !!getToken() && !!currentUser;
  const isAdmin = () => currentUser?.role === 'admin';

  const setSession = (token, user) => {
    Storage.set('token', token);
    Storage.set('user', user);
    currentUser = user;
  };

  const clearSession = () => {
    Storage.clear();
    currentUser = null;
  };

  const loadFromStorage = () => {
    const token = Storage.get('token');
    const user = Storage.get('user');
    if (token && user) {
      currentUser = user;
      return true;
    }
    return false;
  };

  const verify = async () => {
    if (!navigator.onLine) return !!currentUser;
    try {
      const res = await API.get('/auth/me');
      currentUser = res.user;
      Storage.set('user', res.user);
      return true;
    } catch (err) {
      if (!err.status || err.status === 0 || err.isOffline) return !!currentUser;
      if (err.status === 401) { clearSession(); return false; }
      return !!currentUser;
    }
  };

  const saveOfflineCreds = (email, password, user) => {
    try {
      const hash = btoa(unescape(encodeURIComponent(
        email.toLowerCase() + '||' + password + '||pos2024'
      )));
      Storage.set('offline_creds', { email: email.toLowerCase(), hash, user });
    } catch (e) { /* ignore */ }
  };

  const login = async (email, password) => {
    const res = await API.post('/auth/login', { email, password });
    setSession(res.token, res.user);
    saveOfflineCreds(email, password, res.user);
    return res.user;
  };

  const loginOffline = (email, password) => {
    try {
      const creds = Storage.get('offline_creds');
      if (!creds) return false;
      const hash = btoa(unescape(encodeURIComponent(
        email.toLowerCase() + '||' + password + '||pos2024'
      )));
      if (creds.email === email.toLowerCase() && creds.hash === hash) {
        currentUser = creds.user;
        Storage.set('user', creds.user);
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  };

  const logout = () => {
    clearSession();
    window.App.navigate('login');
  };

  const renderLoginScreen = () => {
    const offline = !navigator.onLine;
    const hasCreds = !!Storage.get('offline_creds');
    const savedEmail = Storage.get('offline_creds')?.email || '';

    return `
<div class="auth-screen page">
  <div class="auth-card">
    <div class="auth-logo">
      <div class="auth-logo-icon">&#127978;</div>
      <h1 class="auth-title">SwiftPOS</h1>
      <p class="auth-subtitle">Sign in to continue</p>
    </div>

    ${offline ? `<div style="padding:10px 14px;margin-bottom:16px;border-radius:10px;font-size:0.82rem;display:flex;align-items:center;gap:10px;background:${hasCreds ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)'};border:1px solid ${hasCreds ? 'rgba(245,158,11,0.35)' : 'rgba(239,68,68,0.35)'};color:${hasCreds ? 'var(--c-yellow)' : 'var(--c-red)'};">
      <span>${hasCreds ? '&#9889;' : '&#128245;'}</span>
      <span>${hasCreds ? 'Offline mode &mdash; use your saved credentials.' : 'No internet. You must log in online first.'}</span>
    </div>` : ''}

    <form id="login-form" onsubmit="Auth.handleLogin(event)">
     <div class="form-group">
  <label class="form-label" for="login-email">Email Address</label>
  <div class="input-group">
    <span class="input-icon">&#9993;</span>
    <input type="email" class="form-input" id="login-email" required>
  </div>
</div>

<div class="form-group">
  <label class="form-label" for="login-password">Password</label>
  <div class="input-group">
    <span class="input-icon">&#128274;</span>
    <input type="password" class="form-input" id="login-password" required>
  </div>
</div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <div class="input-group">
          <span class="input-icon">&#128274;</span>
          <input type="password" class="form-input" id="login-password" placeholder="••••••••" autocomplete="current-password" required>
        </div>
      </div>
      <div id="login-error" class="form-error hidden"></div>
      <button type="submit" class="btn btn-primary btn-full btn-lg mt-lg" id="login-btn">
        ${offline ? '&#9889; Sign In Offline' : 'Sign In'}
      </button>
    </form>

    <div style="text-align:center;margin-top:20px;">
      <span class="text-muted text-sm">No account? </span>
      <button class="btn btn-ghost btn-sm" onclick="Auth.showRegister()">Register</button>
    </div>
  </div>
</div>`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');

    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.innerHTML = 'Signing in...';

    if (!navigator.onLine) {
      if (loginOffline(email, password)) {
        window.App.navigate('dashboard');
      } else {
        errEl.textContent = 'Offline: credentials not recognized.';
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = '&#9889; Sign In Offline';
      }
      return;
    }

    try {
      await login(email, password);
      window.App.navigate('dashboard');
    } catch (err) {
      if (err.isOffline || err.status === 0) {
        if (loginOffline(email, password)) {
          window.App.navigate('dashboard');
          return;
        }
      }
      errEl.textContent = err.message || 'Login failed.';
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.innerHTML = 'Sign In';
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const btn = document.getElementById('register-btn');
    const errEl = document.getElementById('register-error');

    errEl.classList.add('hidden');
    btn.disabled = true;

    try {
      const res = await API.post('/auth/register', { name, email, password });
      setSession(res.token, res.user);
      saveOfflineCreds(email, password, res.user);
      window.App.navigate('dashboard');
    } catch (err) {
      errEl.textContent = err.message || 'Registration failed.';
      errEl.classList.remove('hidden');
      btn.disabled = false;
    }
  };

  return {
    getUser, getToken, isLoggedIn, isAdmin,
    login, loginOffline, logout, verify, loadFromStorage,
    renderLoginScreen, handleLogin, handleRegister,
    showLogin: () => window.App.navigate('login'),
    showRegister: () => window.App.navigate('register'),
  };
})();

// CRITICAL: Make the module accessible to the login form
window.Auth = Auth;
