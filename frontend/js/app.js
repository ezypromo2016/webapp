/**
 * SwiftPOS - Main App Controller
 * SPA router, layout helpers, toast notifications, PWA registration
 */

// ── Business Config (override via server or localStorage) ────────────────────
window._POS_CONFIG = {
  apiUrl: '/api',
  businessName: 'SwiftPOS Store',
  businessAddress: '123 Main St, City',
  businessPhone: '+1234567890',
  businessTin: '000-000-000',
  taxRate: 0.12,
  ...JSON.parse(localStorage.getItem('swiftpos_config') || '{}'),
};

// ── Toast Notification System ─────────────────────────────────────────────────
const Toast = (() => {
  const show = (message, type = 'info', duration = 3000) => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  return { show };
})();

// ── HTML Escape Utility ────────────────────────────────────────────────────────
const escapeHTML = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// ── Shared UI Components ──────────────────────────────────────────────────────
const renderSidebar = (activePage) => {
  const user = Auth.getUser();
  const isAdmin = Auth.isAdmin();
  const initial = user?.name?.charAt(0)?.toUpperCase() || '?';

  return `
<aside class="sidebar" id="main-sidebar">
  <div class="sidebar-logo">
    <div class="logo-icon">🏪</div>
    <span class="logo-text">Swift<span>POS</span></span>
  </div>
  
  <nav class="sidebar-nav">
    <div class="nav-section-label">Main</div>
    
    <button class="nav-item ${activePage === 'dashboard' ? 'active' : ''}" onclick="App.navigate('dashboard')">
      <span class="nav-icon">📊</span> Dashboard
    </button>
    
    <button class="nav-item ${activePage === 'pos' ? 'active' : ''}" onclick="App.navigate('pos')">
      <span class="nav-icon">🏪</span> POS Register
    </button>
    
    <div class="nav-section-label">Manage</div>
    
    <button class="nav-item ${activePage === 'products' ? 'active' : ''}" onclick="App.navigate('products')">
      <span class="nav-icon">📦</span> Products
    </button>
    
    <button class="nav-item ${activePage === 'transactions' ? 'active' : ''}" onclick="App.navigate('transactions')">
      <span class="nav-icon">🧾</span> Transactions
    </button>
    
    <button class="nav-item ${activePage === 'inventory' ? 'active' : ''}" onclick="App.navigate('inventory')">
      <span class="nav-icon">📋</span> Inventory
      <span class="nav-badge" id="inventory-alert-badge" style="display:none;">!</span>
    </button>
    
    ${isAdmin ? `
    <div class="nav-section-label">Admin</div>
    <button class="nav-item ${activePage === 'settings' ? 'active' : ''}" onclick="App.navigate('settings')">
      <span class="nav-icon">⚙</span> Settings
    </button>` : ''}
  </nav>
  
  <div class="sidebar-footer">
    <div class="user-card" onclick="App.navigate('settings')">
      <div class="user-avatar">${initial}</div>
      <div class="user-info">
        <div class="user-name">${escapeHTML(user?.name || 'User')}</div>
        <div class="user-role">${user?.role || 'cashier'}</div>
      </div>
    </div>
    <button class="btn btn-ghost btn-sm btn-full" style="margin-top:8px;" onclick="Auth.logout()">
      Sign Out
    </button>
  </div>
</aside>`;
};

const renderTopbar = (title, actions = '') => {
  return `
<div class="topbar">
  <button class="hamburger-btn" onclick="toggleSidebar()">☰</button>
  <span class="topbar-title">${title}</span>
  <div class="topbar-actions">
    ${actions}
    <div id="network-status" class="online-indicator" style="font-family:var(--font-mono);font-size:0.7rem;">
      <span class="online-dot"></span>Online
    </div>
  </div>
</div>`;
};

// ── Sidebar Toggle (Mobile) ───────────────────────────────────────────────────
const toggleSidebar = () => {
  const sidebar = document.getElementById('main-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;
  sidebar.classList.toggle('open');
  overlay?.classList.toggle('hidden');
};

const closeSidebar = () => {
  document.getElementById('main-sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.add('hidden');
};

// ── App Router ────────────────────────────────────────────────────────────────
const App = (() => {
  const routes = {
    login: () => { document.getElementById('app').innerHTML = Auth.renderLoginScreen(); },
    register: () => { document.getElementById('app').innerHTML = Auth.renderRegisterScreen(); },
    dashboard: () => Dashboard.render(),
    pos: () => POS.render(),
    products: () => Products.render(),
    transactions: (params) => Transactions.render(params),
    inventory: () => Inventory.render(),
    settings: () => Settings.render(),
  };

  const navigate = async (page, params = null) => {
    // Close sidebar on navigation (mobile)
    closeSidebar();

    // Guard: redirect to login if not authenticated
    if (!['login', 'register'].includes(page) && !Auth.isLoggedIn()) {
      return navigate('login');
    }

    // Guard: redirect to pos if already logged in
    if (['login', 'register'].includes(page) && Auth.isLoggedIn()) {
      return navigate('dashboard');
    }

    // Show loading state
    window.scrollTo(0, 0);

    const handler = routes[page] || routes.dashboard;
    try {
      await handler(params);
    } catch (err) {
      console.error('Navigation error:', err);
      Toast.show('Page load failed: ' + err.message, 'error');
    }

    // Check inventory alerts in background
    if (!['login', 'register'].includes(page)) {
      checkInventoryAlerts();
    }
  };

  const checkInventoryAlerts = async () => {
    try {
      const res = await API.get('/inventory/summary');
      const total = res.data.lowStockCount + res.data.outOfStockCount;
      const badge = document.getElementById('inventory-alert-badge');
      if (badge) {
        badge.textContent = total;
        badge.style.display = total > 0 ? 'inline' : 'none';
      }
    } catch {}
  };

  const updateOfflineBadge = async () => {
    const count = await OfflineDB.getPendingCount();
    // Could show a badge somewhere in UI
  };

  return { navigate, updateOfflineBadge };
})();

// Make App globally accessible to all modules
window.App = App;

// ── Settings Page ─────────────────────────────────────────────────────────────
const Settings = (() => {
  const render = () => {
    const config = window._POS_CONFIG;
    const user = Auth.getUser();

    document.getElementById('app').innerHTML = `
<div class="main-layout">
  ${renderSidebar('settings')}
  <div class="content-area">
    ${renderTopbar('Settings')}
    <div class="page-content page">
      <div style="max-width:640px;">
        
        <!-- Business Info -->
        <div class="card mb-md">
          <div class="card-header"><span class="card-title">🏪 Business Information</span></div>
          <div class="modal-body" style="padding:0 0 16px;">
            <div class="form-group">
              <label class="form-label">Business Name</label>
              <input type="text" class="form-input" id="biz-name" value="${escapeHTML(config.businessName)}">
            </div>
            <div class="form-group">
              <label class="form-label">Address</label>
              <input type="text" class="form-input" id="biz-address" value="${escapeHTML(config.businessAddress)}">
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input type="text" class="form-input" id="biz-phone" value="${escapeHTML(config.businessPhone)}">
            </div>
            <div class="form-group">
              <label class="form-label">TIN</label>
              <input type="text" class="form-input" id="biz-tin" value="${escapeHTML(config.businessTin)}">
            </div>
            <button class="btn btn-primary" onclick="Settings.saveBizInfo()">Save Business Info</button>
          </div>
        </div>
        
        <!-- Account -->
        <div class="card mb-md">
          <div class="card-header"><span class="card-title">👤 Account</span></div>
          <div style="padding:0 0 16px;">
            <p class="text-sm mb-md">Logged in as: <strong>${escapeHTML(user?.name)}</strong> (${user?.role})</p>
            <div class="form-group">
              <label class="form-label">Current Password</label>
              <input type="password" class="form-input" id="curr-pass">
            </div>
            <div class="form-group">
              <label class="form-label">New Password</label>
              <input type="password" class="form-input" id="new-pass" minlength="6">
            </div>
            <div id="pass-error" class="form-error hidden"></div>
            <button class="btn btn-secondary" onclick="Settings.changePassword()">Change Password</button>
          </div>
        </div>
        
        <!-- Danger Zone -->
        <div class="card" style="border-color:var(--c-red);">
          <div class="card-header"><span class="card-title text-danger">Danger Zone</span></div>
          <div>
            <p class="text-sm text-muted mb-md">These actions cannot be undone.</p>
            <button class="btn btn-danger btn-sm" onclick="Auth.logout()">🚪 Sign Out</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;
  };

  const saveBizInfo = () => {
    const config = {
      ...window._POS_CONFIG,
      businessName: document.getElementById('biz-name').value,
      businessAddress: document.getElementById('biz-address').value,
      businessPhone: document.getElementById('biz-phone').value,
      businessTin: document.getElementById('biz-tin').value,
    };
    window._POS_CONFIG = config;
    localStorage.setItem('swiftpos_config', JSON.stringify(config));
    Toast.show('Business info saved!', 'success');
  };

  const changePassword = async () => {
    const curr = document.getElementById('curr-pass').value;
    const newPass = document.getElementById('new-pass').value;
    const errEl = document.getElementById('pass-error');
    errEl.classList.add('hidden');

    if (!curr || !newPass) {
      errEl.textContent = 'Both fields are required';
      errEl.classList.remove('hidden');
      return;
    }

    try {
      await API.put('/auth/change-password', { currentPassword: curr, newPassword: newPass });
      Toast.show('Password changed successfully', 'success');
      document.getElementById('curr-pass').value = '';
      document.getElementById('new-pass').value = '';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  };

  return { render, saveBizInfo, changePassword };
})();

// ── PWA Service Worker Registration ───────────────────────────────────────────
const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[App] Service Worker registered:', reg.scope);

    // Check for updates
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available
          const banner = document.createElement('div');
          banner.className = 'alert-banner alert-info';
          banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;border-radius:0;';
          banner.innerHTML = `
            <span>🔄 New version available!</span>
            <button class="btn btn-primary btn-sm" onclick="window.location.reload()">Update Now</button>`;
          document.body.prepend(banner);
        }
      });
    });
  } catch (err) {
    console.warn('[App] Service Worker registration failed:', err);
  }
};

// ── Network Status Monitoring ──────────────────────────────────────────────────
const initNetworkMonitor = () => {
  const update = () => {
    const els = document.querySelectorAll('#network-status');
    els.forEach(el => {
      el.innerHTML = navigator.onLine
        ? '<span class="online-dot"></span>Online'
        : '⚠ Offline';
      el.className = navigator.onLine ? 'online-indicator' : 'offline-indicator';
      el.style.fontFamily = 'var(--font-mono)';
      el.style.fontSize = '0.7rem';
    });
  };

  window.addEventListener('online', update);
  window.addEventListener('offline', update);
};

// ── App Bootstrap ─────────────────────────────────────────────────────────────
const bootApp = async () => {
  const loadingScreen = document.getElementById('loading-screen');
  const appEl = document.getElementById('app');

  const show = async (page) => {
    loadingScreen.style.display = 'none';
    appEl.style.display = 'flex';
    await App.navigate(page);
  };

  try {
    registerServiceWorker();
    initNetworkMonitor();

    // Try to restore session from localStorage
    const hasSession = Auth.loadFromStorage();

    if (hasSession) {
      if (!navigator.onLine) {
        // ── OFFLINE: trust cached session, go straight to dashboard ──────────
        console.log('[Boot] Offline — using cached session');
        await show('dashboard');
        Toast.show('⚡ Running in offline mode', 'warning');
      } else {
        // ── ONLINE: verify token with server ─────────────────────────────────
        const valid = await Auth.verify().catch(() => null);
        if (valid === false) {
          // Genuine 401 — token invalid, must re-login
          await show('login');
        } else {
          // Valid or network hiccup — proceed
          await show('dashboard');
        }
      }
    } else {
      // No session at all — show login
      await show('login');
    }

    // When coming back online after offline session — sync pending transactions
    window.addEventListener('online', async () => {
      Toast.show('🌐 Back online! Syncing...', 'info');
      // Re-verify token in background
      await Auth.verify().catch(() => {});
      // Sync queued transactions
      await Sync.sync().catch(() => {});
    });

  } catch (err) {
    console.error('Boot error:', err);
    loadingScreen.style.display = 'none';
    appEl.style.display = 'flex';
    appEl.innerHTML = Auth.renderLoginScreen();
  }
};

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}
