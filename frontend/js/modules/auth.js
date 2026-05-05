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
      if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
    }
  };

  const renderLoginScreen = () => `
    <div class="auth-screen">
      <form onsubmit="Auth.handleLogin(event)">
        <h1>SwiftPOS</h1>
        <input type="email" id="login-email" required placeholder="Email">
        <input type="password" id="login-password" required placeholder="Password">
        <div id="login-error" class="hidden"></div>
        <button type="submit">Login</button>
      </form>
    </div>`;

  return { getUser, getToken, isLoggedIn, handleLogin, renderLoginScreen };
})();

window.Auth = Auth; // CRITICAL
