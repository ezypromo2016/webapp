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
    Storage.remove('token');
    Storage.remove('user');
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

  // Verify token is still valid
  const verify = async () => {
    try {
      const res = await API.get('/auth/me');
      currentUser = res.user;
      Storage.set('user', res.user);
      return true;
    } catch {
      clearSession();
      return false;
    }
  };

  const getOfflineDemoUser = (email, password) => {
    const demoUsers = [
      {
        email: 'admin@pos.com',
        password: 'Admin@123',
        name: 'Admin User',
        role: 'admin',
      },
      {
        email: 'cashier@pos.com',
        password: 'Cashier@123',
        name: 'Cashier User',
        role: 'cashier',
      },
    ];

    return demoUsers.find(u => u.email === email && u.password === password) || null;
  };

  const login = async (email, password) => {
    const tryOfflineLogin = () => {
      const cachedUser = Storage.get('user');
      const cachedToken = Storage.get('token');
      const cachedCredentials = Storage.get('login_credentials');

      if (cachedUser && cachedCredentials &&
          cachedCredentials.email === email &&
          cachedCredentials.password === btoa(password)) {
        const tokenToUse = cachedToken || `offline_${Date.now()}`;
        setSession(tokenToUse, cachedUser);
        Toast.show('Offline mode: Using cached credentials', 'warning');
        return cachedUser;
      }

      const demoUser = getOfflineDemoUser(email, password);
      if (demoUser) {
        const offlineToken = `offline_demo_${Date.now()}`;
        setSession(offlineToken, demoUser);
        Toast.show('Offline mode: Demo credentials accepted', 'warning');
        return demoUser;
      }

      return null;
    };

    if (!navigator.onLine) {
      const offlineUser = tryOfflineLogin();
      if (offlineUser) return offlineUser;
      throw new ApiError('No internet connection. Working offline.', 0, null, true);
    }

    try {
      const res = await API.post('/auth/login', { email, password });
      setSession(res.token, res.user);
      return res.user;
    } catch (err) {
      // Allow offline login with cached credentials on network failure
      if (err.isOffline) {
        const offlineUser = tryOfflineLogin();
        if (offlineUser) return offlineUser;
      }
      throw err;
    }
  };
  
  // Store credentials encrypted for offline login
  const storeCredentials = (email, password) => {
    try {
      Storage.set('login_credentials', {
        email,
        password: btoa(password), // Simple base64, not true encryption
      });
    } catch (e) {
      console.warn('Could not store credentials:', e);
    }
  };

  const logout = () => {
    clearSession();
    window.App.navigate('login');
  };

  // ── Login Screen HTML ──────────────────────────────────────────────────────
  const renderLoginScreen = () => {
    return `
<div class="auth-screen page">
  <div class="auth-card">
    <div class="auth-logo">
      <div class="auth-logo-icon">🏪</div>
      <h1 class="auth-title">SwiftPOS</h1>
      <p class="auth-subtitle">Sign in to your account</p>
    </div>
    
    <form id="login-form" onsubmit="Auth.handleLogin(event)">
      <div class="form-group">
        <label class="form-label">Email Address</label>
        <div class="input-group">
          <span class="input-icon">✉</span>
          <input type="email" class="form-input" id="login-email" 
            placeholder="admin@pos.com" autocomplete="email" required>
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
        Sign In
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

    try {
      await login(email, password);
      storeCredentials(email, password);
      window.App.navigate('dashboard');
      Toast.show(`Welcome back, ${currentUser.name}!`, 'success');
    } catch (err) {
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
      storeCredentials(email, password);
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
    login, logout, verify, loadFromStorage, clearSession, storeCredentials,
    renderLoginScreen, renderRegisterScreen,
    handleLogin, handleRegister, showLogin, showRegister,
  };
})();
