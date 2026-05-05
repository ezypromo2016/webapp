/**
 * Auth Module - SwiftPOS
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
    if (token && user) { currentUser = user; return true; }
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
      const hash = btoa(unescape(encodeURIComponent(email.toLowerCase() + '||' + password + '||pos2024')));
      Storage.set('offline_creds', { email: email.toLowerCase(), hash, user });
    } catch (e) {}
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
      const hash = btoa(unescape(encodeURIComponent(email.toLowerCase() + '||' + password + '||pos2024')));
      if (creds.email === email.toLowerCase() && creds.hash === hash) {
        currentUser = creds.user;
        Storage.set('user', creds.user);
        return true;
      }
    } catch (e) {}
    return false;
  };

  const logout = () => {
    clearSession();
    window.App.navigate('login');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');

    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    if (!navigator.onLine) {
      if (loginOffline(email, password)) {
        window.App.navigate('dashboard');
        Toast.show('Signed in offline', 'warning');
      } else {
        errEl.textContent = 'Offline: use your saved credentials or connect to internet first.';
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
      return;
    }

    try {
      await login(email, password);
      window.App.navigate('dashboard');
      Toast.show('Welcome back, ' + currentUser.name + '!', 'success');
    } catch (err) {
      if (err.isOffline || err.status === 0) {
        if (loginOffline(email, password)) {
          window.App.navigate('dashboard');
          Toast.show('Signed in offline', 'warning');
          return;
        }
      }
      errEl.textContent = err.message || 'Login failed. Please try again.';
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Sign In';
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
    btn.textContent = 'Creating...';

    try {
      const res = await API.post('/auth/register', { name, email, password });
      setSession(res.token, res.user);
      saveOfflineCreds(email, password, res.user);
      window.App.navigate('dashboard');
      Toast.show('Account created!', 'success');
    } catch (err) {
      errEl.textContent = err.message || 'Registration failed.';
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  };

  const showLogin = () => window.App.navigate('login');
  const showRegister = () => window.App.navigate('register');

  const renderLoginScreen = () => {
    const offline = !navigator.onLine;
    const hasCreds = !!Storage.get('offline_creds');
    const savedEmail = Storage.get('offline_creds')?.email || '';

    return '<div class="auth-screen page">' +
      '<div class="auth-card">' +
        '<div class="auth-logo">' +
          '<div class="auth-logo-icon" style="width:56px;height:56px;border-radius:16px;background:#6366f1;display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 12px;box-shadow:0 0 30px rgba(99,102,241,0.4);">&#127978;</div>' +
          '<h1 class="auth-title">SwiftPOS</h1>' +
          '<p class="auth-subtitle">Sign in to continue</p>' +
        '</div>' +
        (offline ? '<div style="padding:10px 14px;margin-bottom:16px;border-radius:10px;font-size:0.82rem;display:flex;align-items:center;gap:10px;background:' + (hasCreds ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)') + ';border:1px solid ' + (hasCreds ? 'rgba(245,158,11,0.35)' : 'rgba(239,68,68,0.35)') + ';color:' + (hasCreds ? 'var(--c-yellow)' : 'var(--c-red)') + ';">' +
          '<span>' + (hasCreds ? '&#9889;' : '&#128245;') + '</span>' +
          '<span>' + (hasCreds ? 'Offline mode - use your saved credentials.' : 'No internet. Connect first to log in.') + '</span>' +
        '</div>' : '') +
        '<form id="login-form" onsubmit="Auth.handleLogin(event)">' +
          '<div class="form-group">' +
            '<label class="form-label">Email Address</label>' +
            '<div class="input-group">' +
              '<span class="input-icon">&#9993;</span>' +
              '<input type="email" class="form-input" id="login-email" placeholder="admin@pos.com" autocomplete="email" required value="' + (offline && hasCreds ? savedEmail : '') + '">' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">Password</label>' +
            '<div class="input-group">' +
              '<span class="input-icon">&#128274;</span>' +
              '<input type="password" class="form-input" id="login-password" placeholder="Password" autocomplete="current-password" required>' +
            '</div>' +
          '</div>' +
          '<div id="login-error" class="form-error hidden"></div>' +
          '<button type="submit" class="btn btn-primary btn-full btn-lg mt-lg" id="login-btn">' + (offline ? '&#9889; Sign In Offline' : 'Sign In') + '</button>' +
        '</form>' +
        '<div style="text-align:center;margin-top:20px;">' +
          '<span class="text-muted text-sm">No account? </span>' +
          '<button class="btn btn-ghost btn-sm" onclick="Auth.showRegister()">Register</button>' +
        '</div>' +
        '<div style="margin-top:24px;padding:12px;background:var(--c-surface3);border-radius:8px;">' +
          '<p class="text-mono text-sm text-muted" style="margin-bottom:6px;">Demo credentials:</p>' +
          '<p class="text-mono text-sm">admin@pos.com / Admin@123</p>' +
          '<p class="text-mono text-sm">cashier@pos.com / Cashier@123</p>' +
        '</div>' +
      '</div>' +
    '</div>';
  };

  const renderRegisterScreen = () =>
    '<div class="auth-screen page">' +
      '<div class="auth-card">' +
        '<div class="auth-logo">' +
          '<div class="auth-logo-icon" style="width:56px;height:56px;border-radius:16px;background:#6366f1;display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 12px;">&#127978;</div>' +
          '<h1 class="auth-title">Create Account</h1>' +
          '<p class="auth-subtitle">Register a new POS user</p>' +
        '</div>' +
        '<form id="register-form" onsubmit="Auth.handleRegister(event)">' +
          '<div class="form-group"><label class="form-label">Full Name</label><input type="text" class="form-input" id="reg-name" placeholder="John Doe" required></div>' +
          '<div class="form-group"><label class="form-label">Email Address</label><input type="email" class="form-input" id="reg-email" placeholder="user@pos.com" required></div>' +
          '<div class="form-group"><label class="form-label">Password</label><input type="password" class="form-input" id="reg-password" placeholder="Min. 6 characters" required minlength="6"></div>' +
          '<div id="register-error" class="form-error hidden"></div>' +
          '<button type="submit" class="btn btn-primary btn-full btn-lg mt-lg" id="register-btn">Create Account</button>' +
        '</form>' +
        '<div style="text-align:center;margin-top:16px;"><button class="btn btn-ghost btn-sm" onclick="Auth.showLogin()">Back to Login</button></div>' +
      '</div>' +
    '</div>';

  return {
    getUser, getToken, isLoggedIn, isAdmin,
    login, loginOffline, saveOfflineCreds,
    logout, verify, loadFromStorage, clearSession,
    renderLoginScreen, renderRegisterScreen,
    handleLogin, handleRegister, showLogin, showRegister,
  };
})();

window.Auth = Auth;
