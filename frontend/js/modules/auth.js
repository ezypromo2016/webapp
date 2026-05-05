const Auth = (() => {
  let currentUser = null;

  const getUser = () => currentUser;
  const getToken = () => Storage.get('token');
  const isLoggedIn = () => !!getToken() && !!currentUser;

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');

    if (errEl) errEl.classList.add('hidden');
    if (btn) btn.disabled = true;

    try {
      const res = await API.post('/auth/login', { email, password });
      Storage.set('token', res.token);
      Storage.set('user', res.user);
      currentUser = res.user;
      window.App.navigate('dashboard');
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || 'Login failed';
        errEl.classList.remove('hidden');
      }
      if (btn) btn.disabled = false;
    }
  };

  const renderLoginScreen = () => `
    <div class="auth-screen page">
      <div class="auth-card">
        <h1>SwiftPOS</h1>
        <form id="login-form" onsubmit="Auth.handleLogin(event)">
          <div class="form-group">
            <label for="login-email">Email Address</label>
            <input type="email" id="login-email" class="form-input" required>
          </div>
          <div class="form-group">
            <label for="login-password">Password</label>
            <input type="password" id="login-password" class="form-input" required>
          </div>
          <div id="login-error" class="form-error hidden"></div>
          <button type="submit" id="login-btn" class="btn btn-primary btn-full">Login</button>
        </form>
      </div>
    </div>`;

  return {
    getUser, getToken, isLoggedIn, handleLogin, renderLoginScreen,
    verify: async () => {
      if (!navigator.onLine) return !!Storage.get('user');
      try {
        const res = await API.get('/auth/me');
        currentUser = res.user;
        return true;
      } catch { return false; }
    },
    loadFromStorage: () => {
      const user = Storage.get('user');
      if (user) { currentUser = user; return true; }
      return false;
    }
  };
})();

// CRITICAL: Exporting to window passes the index.html check
window.Auth = Auth;
