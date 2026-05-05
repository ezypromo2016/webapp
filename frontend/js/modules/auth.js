/**
 * Auth Module
 * Login/Register screens and session management
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

  // Verify token is still valid — skips check when offline
  const verify = async () => {
    // If offline, trust the cached session
    if (!navigator.onLine) {
      console.log('[Auth] Offline — using cached session');
      return !!currentUser;
    }
    try {
      const res = await API.get('/auth/me');
      currentUser = res.user;
      Storage.set('user', res.user);
      // Save a hashed credential snapshot for offline login
      Storage.set('offline_session_valid', true);
      return true;
    } catch (err) {
      // Network error — keep session alive
      if (err.isOffline || err.status === 0) {
        console.log('[Auth] Network error — keeping cached session');
        return !!currentUser;
      }
      // Real auth failure (401) — clear session
      clearSession();
      return false;
    }
  };

  const login = async (email, password) => {
    const res = await API.post('/auth/login', { email, password });
    setSession(res.token, res.user);
    // Save offline credentials (hashed) for offline login
    saveOfflineCredentials(email, password, res.user);
    return res.user;
  };

  // Save credentials for offline login using a simple hash
  const saveOfflineCredentials = (email, password, user) => {
    // Simple hash — not cryptographic, just obfuscation for localStorage
    const hash = btoa(unescape(encodeURIComponent(email + ':' + password + ':swiftpos')));
    Storage.set('offline_creds', { email: email.toLowerCase(), hash, user });
  };

  // Attempt offline login using cached credentials
  const loginOffline = (email, password) => {
    const creds = Storage.get('offline_creds');
    if (!creds) return false;

    const hash = btoa(unescape(encodeURIComponent(email + ':' + password + ':swiftpos')));
    if (creds.email === email.toLowerCase() && creds.hash === hash) {
      // Restore session with cached user
      currentUser = creds.user;
      Storage.set('user', creds.user);
      return true;
    }
    return false;
  };

  const logout = () => {
    clearSession();
    window.App.navigate('login');
  };

  const renderLoginScreen = () => {
    const isOffline = !navigator.onLine;
    const hasOfflineCreds = !!Storage.get('offline_creds');
    return `
<div class="auth-screen page">
  <div class="auth-card">
    <div class="auth-logo">
      <div class="auth-logo-icon">🏪</div>
      <h1 class="auth-title">SwiftPOS</h1>
      <p class="auth-subtitle">Sign in to your account</p>
    </div>

    ${isOffline ? `
    <div style="
      display:flex;align-items:center;gap:10px;
      padding:10px 14px;margin-bottom:16px;
      background:${hasOfflineCreds ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'};
      border:1px solid ${hasOfflineCreds ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'};
      border-radius:10px;font-size:0.8rem;
    ">
      <span style="font-size:1.1rem;">${hasOfflineCreds ? '⚡' : '📵'}</span>
      <span style="color:${hasOfflineCreds ? 'var(--c-yellow)' : 'var(--c-red)'};">
        ${hasOfflineCreds
          ? 'You\'re offline. Use your last credentials to sign in.'
          : 'No internet. Connect to the internet for your first login.'}
      </span>
    </div>` : ''}
    
    <form id="login-form" onsubmit="Auth.handleLogin(event)">
      <div class="form-group">
        <label class="form-label">Email Address</label>
        <div class="input-group">
          <span class="input-icon">✉</span>
          <input type="email" class="form-input" id="login-email" 
            placeholder="admin@pos.com" autocomplete="email" required
            value="${isOffline && hasOfflineCreds ? Storage.get('offline_creds')?.email || '' : ''}">
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Password</label>
        <div class="input-group">
          <span class="input-icon">🔒</span>
          <input type="password" class="form-input" id="login-password" 
            placeholder="••••••••" autocomplete="current-password" required>
        </div>
      </div>
      
      <div id="login-error" class="form-error hidden"></div>
      
      <button type="submit" class="btn btn-primary btn-full btn-lg mt-lg" id="login-btn">
        ${isOffline ? '⚡ Sign In Offline' : 'Sign In'}
      </button>
    </form>
    
    <div style="text-align:center;margin-top:20px;">
      <span class="text-muted text-sm">Don't have an account? </span>
      <button class="btn btn-ghost btn-sm" onclick="Auth.showRegister()">Register</button>
    </div>
    
    <div style="margin-top:24px;padding:12px;background:var(--c-surface3);border-radius:8px;">
      <p class="text-mono text-sm text-muted" style="margin-bottom:6px;">Demo credentials:</p>
      <p class="text-mono text-sm">admin@pos.com / Admin@123</p>
      <p class="text-mono text-sm">cashier@pos.com / Cashier@123</p>
    </div>
  </div>
</div>`;
  };

  const renderRegisterScreen = () => {
    return `
<div class="auth-screen page">
  <div class="auth-card">
    <div class="auth-logo">
      <div class="auth-logo-icon">🏪</div>
      <h1 class="auth-title">Create Account</h1>
      <p class="auth-subtitle">Register a new POS user</p>
    </div>
    
    <form id="register-form" onsubmit="Auth.handleRegister(event)">
      <div class="form-group">
        <label class="form-label">Full Name</label>
        <input type="text" class="form-input" id="reg-name" placeholder="John Doe" required>
      </div>
      
      <div class="form-group">
        <label class="form-label">Email Address</label>
        <input type="email" class="form-input" id="reg-email" placeholder="user@pos.com" required>
      </div>
      
      <div class="form-group">
        <label class="form-label">Password</label>
        <input type="password" class="form-input" id="reg-password" placeholder="Min. 6 characters" required minlength="6">
      </div>
      
      <div id="register-error" class="form-error hidden"></div>
      
      <button type="submit" class="btn btn-primary btn-full btn-lg mt-lg" id="register-btn">
        Create Account
      </button>
    </form>
    
    <div style="text-align:center;margin-top:16px;">
      <button class="btn btn-ghost btn-sm" onclick="Auth.showLogin()">← Back to Login</button>
    </div>
  </div>
</div>`;
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');

    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner spinner-sm"></div> Signing in...';

    // ── Offline login path ────────────────────────────────────────────────────
    if (!navigator.onLine) {
      const offlineOk = loginOffline(email, password);
      if (offlineOk) {
        window.App.navigate('dashboard');
        Toast.show(`✓ Welcome back, ${currentUser.name}! (Offline mode)`, 'warning');
      } else {
        errEl.textContent = 'No internet connection. Please connect to the internet for your first login.';
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = 'Sign In';
      }
      return;
    }

    // ── Online login path ─────────────────────────────────────────────────────
    try {
      await login(email, password);
      window.App.navigate('dashboard');
      Toast.show(`Welcome back, ${currentUser.name}!`, 'success');
    } catch (err) {
      // If network error during submit, try offline credentials
      if (err.isOffline || err.status === 0) {
        const offlineOk = loginOffline(email, password);
        if (offlineOk) {
          window.App.navigate('dashboard');
          Toast.show(`✓ Signed in offline. Will sync when connected.`, 'warning');
          return;
        }
      }
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.innerHTML = 'Sign In';
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const btn = document.getElementById('register-btn');
    const errEl = document.getElementById('register-error');

    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner spinner-sm"></div> Creating...';

    try {
      const res = await API.post('/auth/register', { name, email, password });
      setSession(res.token, res.user);
      window.App.navigate('dashboard');
      Toast.show('Account created successfully!', 'success');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.innerHTML = 'Create Account';
    }
  };

  const showLogin = () => window.App.navigate('login');
  const showRegister = () => window.App.navigate('register');

  return {
    getUser, getToken, isLoggedIn, isAdmin,
    login, loginOffline, saveOfflineCredentials, logout, verify, loadFromStorage, clearSession,
    renderLoginScreen, renderRegisterScreen,
    handleLogin, handleRegister, showLogin, showRegister,
  };
})();
