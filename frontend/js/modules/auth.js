const Auth = (() => {
  let currentUser = null;

  const getUser = () => currentUser;
  const getToken = () => Storage.get('token');
  const isLoggedIn = () => !!getToken() && !!currentUser;

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    try {
      const res = await API.post('/auth/login', { email, password });
      Storage.set('token', res.token);
      Storage.set('user', res.user);
      currentUser = res.user;
      window.App.navigate('dashboard');
    } catch (err) {
      const errEl = document.getElementById('login-error');
      if (errEl) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    }
  };

  const renderLoginScreen = () => `
    <div class="auth-screen page">
      <form id="login-form" onsubmit="Auth.handleLogin(event)">
        <label for="login-email">Email</label>
        <input type="email" id="login-email" required>
        <label for="login-password">Password</label>
        <input type="password" id="login-password" required>
        <div id="login-error" class="hidden"></div>
        <button type="submit">Login</button>
      </form>
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

// CRITICAL: This line fixes the ReferenceError in app.js
window.Auth = Auth;
