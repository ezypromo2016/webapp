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
          </div>
          <form id="login-form" onsubmit="Auth.handleLogin(event)">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-input" id="login-email" required value="${offline && hasCreds ? savedEmail : ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" class="form-input" id="login-password" required>
            </div>
            <div id="login-error" class="form-error hidden"></div>
            <button type="submit" class="btn btn-primary btn-full" id="login-btn">Sign In</button>
          </form>
        </div>
      </div>`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!navigator.onLine) {
      if (loginOffline(email, password)) {
        window.App.navigate('dashboard');
      } else {
        document.getElementById('login-error').classList.remove('hidden');
      }
      return;
    }
    try {
      await login(email, password);
      window.App.navigate('dashboard');
    } catch (err) {
      document.getElementById('login-error').classList.remove('hidden');
    }
  };

  return {
    getUser, getToken, isLoggedIn, isAdmin, login, loginOffline,
    logout, verify, loadFromStorage, renderLoginScreen, handleLogin,
    showLogin: () => window.App.navigate('login'),
    showRegister: () => window.App.navigate('register')
  };
})();

window.Auth = Auth;
