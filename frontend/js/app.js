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

    <button class="nav-item ${activePage === 'printing' ? 'active' : ''}" onclick="App.navigate('printing')">
      <span class="nav-icon">🖨</span> Printing
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
  // Track in-flight and completed dynamic module loads to avoid duplicate injections
  const _loadedModules = new Set();
  const _pendingLoads = new Map();

  /**
   * Dynamically inject a <script> tag for a module and wait for it to execute.
   * Subsequent calls for the same module resolve immediately from the cache.
   */
  const loadModule = (moduleName) => {
    if (_loadedModules.has(moduleName)) return Promise.resolve();
    if (_pendingLoads.has(moduleName)) return _pendingLoads.get(moduleName);

    const fileMap = {
      dashboard:    '/js/modules/dashboard.js',
      pos:          '/js/modules/pos.js',
      products:     '/js/modules/products.js',
      printing:     '/js/modules/printing.js',
      transactions: '/js/modules/transactions.js',
      inventory:    '/js/modules/inventory.js',
    };

    const src = fileMap[moduleName];
    if (!src) return Promise.resolve();

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src + '?v=1.0.1';
      script.onload = () => {
        _loadedModules.add(moduleName);
        _pendingLoads.delete(moduleName);
        console.log(`[App] Module loaded dynamically: ${moduleName}`);
        resolve();
      };
      script.onerror = () => {
        _pendingLoads.delete(moduleName);
        reject(new Error(`Failed to load module: ${moduleName}`));
      };
      document.head.appendChild(script);
    });

    _pendingLoads.set(moduleName, promise);
    return promise;
  };

  const routes = {
    login: () => {
      document.getElementById('app').innerHTML = Auth.renderLoginScreen();
    },
    register: () => {
      document.getElementById('app').innerHTML = Auth.renderRegisterScreen();
    },
    dashboard: async () => {
      await loadModule('dashboard');
      Dashboard.render();
    },
    pos: async () => {
      await loadModule('pos');
      POS.render();
    },
    products: async () => {
      await loadModule('products');
      Products.render();
    },
    printing: async () => {
      await loadModule('printing');
      Printing.render();
    },
    transactions: async (params) => {
      await loadModule('transactions');
      Transactions.render(params);
    },
    inventory: async () => {
      await loadModule('inventory');
      Inventory.render();
    },
    settings: () => {
      Settings.render();
    },
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

// ── Network Status Management ─────────────────────────────────────────────────
(() => {
  let isOnline = navigator.onLine;

  const updateNetworkStatus = () => {
    const statusEl = document.getElementById('network-status');
    if (!statusEl) return;

    if (isOnline) {
      statusEl.innerHTML = '<span class="online-dot" style="background:#4CAF50;"></span>Online';
      statusEl.style.color = 'var(--c-green)';
    } else {
      statusEl.innerHTML = '<span class="online-dot" style="background:#FF9800;"></span>Offline';
      statusEl.style.color = 'var(--c-orange)';
    }
  };

  window.addEventListener('online', async () => {
    isOnline = true;
    updateNetworkStatus();
    Toast.show('✓ You are back online!', 'success');
    console.log('[Network] Back online, starting sync...');
    
    // Auto-sync pending transactions when connection returns
    await Sync.sync();
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    updateNetworkStatus();
    Toast.show('⚠ You are offline. Changes will sync automatically.', 'warning');
    console.log('[Network] Connection lost');
  });

  // Listen for pos:offline custom event from API
  window.addEventListener('pos:offline', () => {
    if (isOnline) {
      isOnline = false;
      updateNetworkStatus();
      Toast.show('⚠ Connection lost', 'warning');
    }
  });

  // Listen for pos:online custom event from API
  window.addEventListener('pos:online', () => {
    if (!isOnline) {
      isOnline = true;
      updateNetworkStatus();
      Toast.show('✓ Connection restored!', 'success');
    }
  });

  // Initial status update
  window.addEventListener('DOMContentLoaded', updateNetworkStatus);
  
  // Update status when navigating to new pages
  const originalNavigate = App.navigate;
  App.navigate = async function(page, params) {
    updateNetworkStatus();
    return originalNavigate.call(this, page, params);
  };
})();

// ── Settings Page ─────────────────────────────────────────────────────────────
const Settings = (() => {
  let categories = [];

  const render = async () => {
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

        <!-- Categories -->
        <div class="card mb-md">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <span class="card-title">🗂 Categories</span>
            <button class="btn btn-primary btn-sm" onclick="Settings.showCategoryModal()">+ Add Category</button>
          </div>
          <div class="modal-body" style="padding:0 0 16px;">
            <div id="settings-categories-list">
              <p class="text-sm text-muted">Loading categories…</p>
            </div>
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

    await loadCategories();
  };

  const loadCategories = async () => {
    try {
      const res = await API.get('/categories');
      categories = res.data;
      renderCategoryList();
    } catch (err) {
      const list = document.getElementById('settings-categories-list');
      if (list) {
        list.innerHTML = '<p class="text-sm text-muted">Failed to load categories.</p>';
      }
    }
  };

  const renderCategoryList = () => {
    const list = document.getElementById('settings-categories-list');
    if (!list) return;

    if (categories.length === 0) {
      list.innerHTML = '<p class="text-sm text-muted">No categories yet.</p>';
      return;
    }

    list.innerHTML = categories.map(c => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--c-border);">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:12px;background:${escapeHTML(c.color || '#f3f4f6')};font-size:1.1rem;">${escapeHTML(c.icon || '📦')}</span>
          <div>
            <div style="font-weight:600;">${escapeHTML(c.name)}</div>
            <div class="text-sm text-muted">${escapeHTML(c.description || '')}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secondary btn-sm" onclick="Settings.showCategoryModal('${c._id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="Settings.deleteCategory('${c._id}','${escapeHTML(c.name)}')">Delete</button>
        </div>
      </div>`).join('');
  };

  const showCategoryModal = (categoryId = '') => {
    const category = categories.find(c => c._id === categoryId);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'category-modal';
    modal.innerHTML = `
<div class="modal" style="max-width:520px;">
  <div class="modal-header">
    <span class="modal-title">${category ? '✏ Edit Category' : '+ Add Category'}</span>
    <button class="btn-icon" onclick="document.getElementById('category-modal').remove()">✕</button>
  </div>
  <div class="modal-body">
    <div class="form-group">
      <label class="form-label">Name *</label>
      <input type="text" class="form-input" id="category-name" value="${escapeHTML(category?.name || '')}" placeholder="e.g. Beverages">
    </div>
    <div class="form-group">
      <label class="form-label">Icon</label>
      <input type="text" class="form-input" id="category-icon" value="${escapeHTML(category?.icon || '📦')}" placeholder="Emoji or icon">
    </div>
    <div class="form-group">
      <label class="form-label">Color</label>
      <input type="color" class="form-input" id="category-color" value="${escapeHTML(category?.color || '#6366f1')}">
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea class="form-textarea" id="category-desc" placeholder="Optional description...">${escapeHTML(category?.description || '')}</textarea>
    </div>
    <div id="category-modal-error" class="form-error hidden"></div>
  </div>
  <div class="modal-footer">
    <button class="btn btn-ghost" onclick="document.getElementById('category-modal').remove()">Cancel</button>
    <button class="btn btn-primary" onclick="Settings.saveCategory('${category?._id || ''}')">${category ? 'Update Category' : 'Create Category'}</button>
  </div>
</div>`;
    document.body.appendChild(modal);
  };

  const saveCategory = async (categoryId = '') => {
    const name = document.getElementById('category-name').value.trim();
    const icon = document.getElementById('category-icon').value.trim() || '📦';
    const color = document.getElementById('category-color').value;
    const description = document.getElementById('category-desc').value.trim();
    const errEl = document.getElementById('category-modal-error');
    errEl.classList.add('hidden');

    if (!name) {
      errEl.textContent = 'Category name is required.';
      errEl.classList.remove('hidden');
      return;
    }

    const data = { name, icon, color, description: description || undefined };

    try {
      if (categoryId) {
        await API.put(`/categories/${categoryId}`, data);
        Toast.show('Category updated', 'success');
      } else {
        await API.post('/categories', data);
        Toast.show('Category added', 'success');
      }
      document.getElementById('category-modal')?.remove();
      await loadCategories();
      if (window.Products?.loadCategories) window.Products.loadCategories();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  };

  const deleteCategory = async (categoryId, name) => {
    if (!confirm(`Delete category "${name}"? This will deactivate it for product assignment.`)) return;
    try {
      await API.delete(`/categories/${categoryId}`);
      Toast.show('Category deleted', 'success');
      await loadCategories();
      if (window.Products?.loadCategories) window.Products.loadCategories();
    } catch (err) {
      Toast.show(err.message, 'error');
    }
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

  return { render, saveBizInfo, changePassword, showCategoryModal, saveCategory, deleteCategory };
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
// Only wait for Auth — all other modules are loaded on-demand when the user
// navigates to the corresponding route, so there is nothing to block on here.
const waitForModules = (timeout = 5000) => {
  return new Promise((resolve) => {
    const checkAuth = () => typeof window['Auth'] !== 'undefined';

    // Already available (synchronous script already executed)
    if (checkAuth()) {
      console.log('[App] Auth module ready');
      resolve({ timedOut: false, missing: [] });
      return;
    }

    // Poll until Auth appears or we time out
    const interval = setInterval(() => {
      if (checkAuth()) {
        clearInterval(interval);
        console.log('[App] Auth module ready');
        resolve({ timedOut: false, missing: [] });
      }
    }, 50);

    setTimeout(() => {
      clearInterval(interval);
      console.warn(`[App] Auth module not available after ${timeout}ms`);
      resolve({ timedOut: true, missing: ['Auth'] });
    }, timeout);
  });
};

const bootApp = async () => {
  const loadingScreen = document.getElementById('loading-screen');
  const appEl = document.getElementById('app');

  try {
    // Register PWA
    registerServiceWorker();
    initNetworkMonitor();

    // Wait for all modules to load
    console.log('[App] Waiting for modules to load...');
    const { timedOut, missing } = await waitForModules();

    if (timedOut) {
      console.warn('[App] Continuing in degraded mode. Missing modules:', missing);
      // Show a non-fatal warning toast so the user knows something is off,
      // but let the app proceed rather than hard-crashing
      Toast.show(
        `Some modules are slow to load: ${missing.join(', ')}. Functionality may be limited.`,
        'warning',
        8000
      );
    }

    // Try to restore session
    const hasSession = Auth.loadFromStorage();

    if (hasSession) {
      // Verify token is still valid (non-blocking)
      const valid = await Auth.verify().catch(() => false);
      if (valid) {
        loadingScreen.style.display = 'none';
        appEl.style.display = 'flex';
        await App.navigate('dashboard');
      } else {
        loadingScreen.style.display = 'none';
        appEl.style.display = 'flex';
        await App.navigate('login');
      }
    } else {
      loadingScreen.style.display = 'none';
      appEl.style.display = 'flex';
      await App.navigate('login');
    }
  } catch (err) {
    console.error('[App] Boot error:', err);
    loadingScreen.style.display = 'none';
    appEl.style.display = 'flex';
    // Fall back to the login screen for any unexpected boot errors
    appEl.innerHTML = Auth.renderLoginScreen();
  }
};

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}
