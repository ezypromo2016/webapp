/**
 * POS Module
 * Main cashier interface: product grid, cart, payment, receipt
 */

const POS = (() => {
  // State
  let products = [];
  let categories = [];
  let cart = [];
  let selectedCategory = 'all';
  let paymentMethod = 'cash';
  let discountType = 'none';
  let discountValue = 0;
  let isProcessing = false;
  let searchTimeout = null;

  const TAX_RATE = 0.12;

  const formatCurrency = (n) =>
    '₱' + parseFloat(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Render ──────────────────────────────────────────────────────────────────
  const render = async () => {
    const user = Auth.getUser();
    document.getElementById('app').innerHTML = `
<div class="main-layout">
  ${renderSidebar('pos')}
  <div class="content-area">
    <div class="topbar">
      <button class="hamburger-btn" onclick="toggleSidebar()">☰</button>
      <span class="topbar-title">🏪 POS Register</span>
      <div class="topbar-actions">
        <div id="network-status" class="online-indicator"><span class="online-dot"></span>Online</div>
      </div>
    </div>
    
    <div class="pos-layout">
      <!-- Mobile Tab Bar (hidden on desktop) -->
      <div class="pos-tab-bar" id="pos-tab-bar" style="display:none;">
        <button class="pos-tab-btn active" id="tab-products" onclick="POS.switchTab('products')">
          🛍 Products
        </button>
        <button class="pos-tab-btn" id="tab-cart" onclick="POS.switchTab('cart')">
          🛒 Cart
          <span class="tab-badge" id="cart-badge-tab">0</span>
        </button>
      </div>

      <!-- Left: Products -->
      <div class="pos-left" id="pos-products-panel">
        <!-- Search -->
        <div class="pos-search">
          <span class="pos-search-icon">🔍</span>
          <input type="search" class="pos-search-input" id="product-search"
            placeholder="Search products or scan barcode..." autocomplete="off"
            oninput="POS.onSearch(this.value)" onkeydown="POS.onSearchKey(event)">
        </div>
        
        <!-- Category tabs -->
        <div class="category-tabs" id="category-tabs">
          <div class="spinner spinner-sm"></div>
        </div>
        
        <!-- Product grid -->
        <div class="product-grid" id="product-grid">
          <div style="grid-column:1/-1;text-align:center;padding:40px;">
            <div class="spinner" style="margin:0 auto;"></div>
          </div>
        </div>
      </div>
      
      <!-- Right: Cart -->
      <div class="pos-right" id="pos-cart-panel">
        <!-- Old mobile toggle hidden - replaced by tab bar -->
        <div class="cart-toggle-btn" style="display:none;"></div>
        
        <div class="cart-panel" style="flex:1;min-height:0;">
          <div class="cart-header">
            <span class="cart-title">Order Items</span>
            <button class="btn btn-ghost btn-sm" onclick="POS.clearCart()" id="clear-cart-btn" style="display:none;">
              🗑 Clear
            </button>
          </div>
          
          <div class="cart-items" id="cart-items">
            <div class="cart-empty">
              <div class="cart-empty-icon">🛒</div>
              <div>Cart is empty</div>
              <div class="text-sm text-muted">Tap products to add them</div>
            </div>
          </div>
          
          <div class="cart-totals" id="cart-totals"></div>
        </div>
        
        <!-- Discount -->
        <div class="card" style="padding:var(--gap-sm) var(--gap-md);" id="discount-section" style="display:none;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="text-sm text-muted">Discount:</span>
            <select class="form-select" style="flex:1;min-width:80px;padding:6px 8px;font-size:0.8rem;" 
              onchange="POS.setDiscountType(this.value)" id="discount-type">
              <option value="none">None</option>
              <option value="percentage">%</option>
              <option value="fixed">₱ Fixed</option>
            </select>
            <input type="number" class="form-input" id="discount-value"
              style="flex:1;min-width:70px;padding:6px 8px;font-size:0.8rem;"
              placeholder="0" min="0" oninput="POS.setDiscountValue(this.value)" value="0">
          </div>
        </div>
        
        <!-- Payment methods -->
        <div class="payment-section">
          <div class="payment-methods">
            <button class="payment-method-btn active" onclick="POS.selectPayment('cash')" id="pm-cash">
              <span class="pm-icon">💵</span>Cash
            </button>
            <button class="payment-method-btn" onclick="POS.selectPayment('gcash')" id="pm-gcash">
              <span class="pm-icon">📱</span>GCash
            </button>
            <button class="payment-method-btn" onclick="POS.selectPayment('card')" id="pm-card">
              <span class="pm-icon">💳</span>Card
            </button>
          </div>
          
          <div id="ref-input-section" style="display:none;">
            <label class="form-label">Reference Number</label>
            <input type="text" class="form-input" id="payment-reference" 
              placeholder="Enter reference #">
          </div>
          
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <button class="btn btn-secondary btn-sm" onclick="Receipt.openCashDrawer()" 
              style="flex:1;" title="Test cash drawer connection">
              🏪 Open Drawer
            </button>
            <button class="charge-btn" id="charge-btn" disabled onclick="POS.handleChargeClick()" 
              style="flex:2;">
              <span id="charge-btn-text">Charge ₱0.00</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;

    await loadData();
    setupNetworkListeners();
    initMobileTabBar();
    // Re-init on resize (orientation change)
    window.addEventListener('resize', initMobileTabBar);
    // Autofocus search
    setTimeout(() => document.getElementById('product-search')?.focus(), 300);
  };

  const loadData = async () => {
    try {
      console.log('[POS] Loading data online...');
      const [productsRes, catsRes] = await Promise.all([
        API.get('/products', { isActive: 'true', limit: 200 }),
        API.get('/categories'),
      ]);
      products = productsRes.data;
      categories = catsRes.data;
      console.log('[POS] ✓ Loaded online data:', { products: products.length, categories: categories.length });
      renderCategoryTabs();
      renderProducts(products);
    } catch (err) {
      console.log('[POS] ✗ Online load failed, trying cached data:', err.message);

      // Try to load from API cache first (more reliable)
      let cachedProducts = Storage.getCache('api_/products');
      let cachedCategories = Storage.getCache('api_/categories');

      const unwrap = (value) => value && value.data ? value.data : value;

      // Fallback to manual cache if API cache not available
      if (!cachedProducts) {
        cachedProducts = Storage.getCache('products');
        console.log('[POS] Using manual product cache');
      }
      if (!cachedCategories) {
        cachedCategories = Storage.getCache('categories');
        console.log('[POS] Using manual category cache');
      }

      const productData = unwrap(cachedProducts);
      const categoryData = unwrap(cachedCategories);

      if (productData) {
        products = productData;
        console.log('[POS] ✓ Loaded cached products:', products.length);
      } else {
        products = [];
        console.log('[POS] ✗ No cached products available');
      }

      if (categoryData) {
        categories = categoryData;
        console.log('[POS] ✓ Loaded cached categories:', categories.length);
      } else {
        categories = [];
        console.log('[POS] ✗ No cached categories available');
      }

      renderCategoryTabs();
      renderProducts(products);

      if (products.length === 0 && categories.length === 0) {
        Toast.show('⚠ No cached data available. Connect to internet to load products.', 'warning');
      } else {
        Toast.show('⚠ Using cached data. Some features may be limited.', 'warning');
      }
    }

    // Always cache current data for offline use
    if (products.length > 0) {
      Storage.cache('products', products, 600);
      console.log('[POS] Cached products for offline use');
    }
    if (categories.length > 0) {
      Storage.cache('categories', categories, 600);
      console.log('[POS] Cached categories for offline use');
    }
  };

  // ── Category Tabs ────────────────────────────────────────────────────────────
  const renderCategoryTabs = () => {
    const tabs = [
      `<button class="category-tab active" onclick="POS.filterCategory('all')" data-cat="all">🏪 All</button>`,
      ...categories.map(c =>
        `<button class="category-tab" onclick="POS.filterCategory('${c._id}')" data-cat="${c._id}">
          ${c.icon} ${c.name}
        </button>`
      ),
    ];
    document.getElementById('category-tabs').innerHTML = tabs.join('');
  };

  const filterCategory = (catId) => {
    selectedCategory = catId;
    document.querySelectorAll('.category-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.cat === catId);
    });
    const search = document.getElementById('product-search').value;
    renderProducts(getFilteredProducts(search));
  };

  // ── Product Grid ─────────────────────────────────────────────────────────────
  const getFilteredProducts = (search = '') => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'all' || p.category?._id === selectedCategory || p.category === selectedCategory;
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode?.includes(search) ||
        p.sku?.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  };

  const renderProducts = (prods) => {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    if (prods.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--c-text-3);">
        <div style="font-size:2rem;margin-bottom:8px;">🔍</div>No products found
      </div>`;
      return;
    }

    grid.innerHTML = prods.map(p => {
      const stockClass = p.stock === 0 ? 'out' : p.stock <= p.lowStockThreshold ? 'low' : '';
      const stockLabel = p.stock === 0 ? 'Out of Stock' : `${p.stock} ${p.unit}`;
      return `
<div class="product-card ${p.stock === 0 ? 'out-of-stock' : ''}" onclick="POS.addToCart('${p._id}')">
  <div class="product-card-icon">${p.category?.icon || '📦'}</div>
  <div class="product-card-name">${escapeHTML(p.name)}</div>
  <div class="product-card-price">${formatCurrency(p.price)}</div>
  <div class="product-card-stock ${stockClass}">${stockLabel}</div>
  <div class="add-btn">+</div>
</div>`;
    }).join('');
  };

  // ── Search ────────────────────────────────────────────────────────────────────
  const onSearch = (val) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => renderProducts(getFilteredProducts(val)), 150);
  };

  const onSearchKey = (e) => {
    // Enter key: if only one result, add it to cart
    if (e.key === 'Enter') {
      const val = e.target.value.trim();
      const filtered = getFilteredProducts(val);
      if (filtered.length === 1) {
        addToCart(filtered[0]._id);
        e.target.value = '';
        renderProducts(getFilteredProducts(''));
      }
    }
  };

  // ── Cart Management ───────────────────────────────────────────────────────────
  const addToCart = (productId) => {
    const product = products.find(p => p._id === productId);
    if (!product || product.stock === 0) return;

    const existing = cart.find(i => i.product._id === productId);
    if (existing) {
      if (existing.quantity >= product.stock) {
        Toast.show(`Max stock: ${product.stock}`, 'warning');
        return;
      }
      existing.quantity++;
    } else {
      cart.push({ product, quantity: 1 });
    }

    // Vibrate on mobile (feedback)
    navigator.vibrate?.(50);
    updateCart();
  };

  const updateQuantity = (productId, delta) => {
    const idx = cart.findIndex(i => i.product._id === productId);
    if (idx === -1) return;

    const product = products.find(p => p._id === productId);
    const newQty = cart[idx].quantity + delta;

    if (newQty <= 0) {
      cart.splice(idx, 1);
    } else if (newQty > product.stock) {
      Toast.show(`Only ${product.stock} in stock`, 'warning');
      return;
    } else {
      cart[idx].quantity = newQty;
    }

    updateCart();
  };

  const removeFromCart = (productId) => {
    cart = cart.filter(i => i.product._id !== productId);
    updateCart();
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (!confirm('Clear all items from cart?')) return;
    cart = [];
    discountType = 'none';
    discountValue = 0;
    document.getElementById('discount-type').value = 'none';
    document.getElementById('discount-value').value = '0';
    updateCart();
  };

  const updateCart = () => {
    const cartItemsEl = document.getElementById('cart-items');
    const cartBadge = document.getElementById('cart-badge');
    const clearBtn = document.getElementById('clear-cart-btn');
    const discountSection = document.getElementById('discount-section');

    if (!cartItemsEl) return;

    const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
    if (cartBadge) cartBadge.textContent = totalItems;
    // Also update the mobile tab badge
    const tabBadge = document.getElementById('cart-badge-tab');
    if (tabBadge) tabBadge.textContent = totalItems;
    if (clearBtn) clearBtn.style.display = cart.length > 0 ? 'flex' : 'none';
    if (discountSection) discountSection.style.display = cart.length > 0 ? 'block' : 'none';

    if (cart.length === 0) {
      cartItemsEl.innerHTML = `<div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <div>Cart is empty</div>
        <div class="text-sm text-muted">Tap products to add them</div>
      </div>`;
      renderTotals(0, 0, 0);
      updateChargeButton(0);
      return;
    }

    cartItemsEl.innerHTML = cart.map(item => `
<div class="cart-item">
  <div class="cart-item-info">
    <div class="cart-item-name">${escapeHTML(item.product.name)}</div>
    <div class="cart-item-price">${formatCurrency(item.product.price)} each</div>
  </div>
  <div class="cart-qty-controls">
    <button class="qty-btn" onclick="POS.updateQuantity('${item.product._id}', -1)">−</button>
    <span class="qty-value">${item.quantity}</span>
    <button class="qty-btn" onclick="POS.updateQuantity('${item.product._id}', 1)">+</button>
  </div>
  <div class="cart-item-total">${formatCurrency(item.product.price * item.quantity)}</div>
  <button class="cart-remove" onclick="POS.removeFromCart('${item.product._id}')">✕</button>
</div>`).join('');

    const totals = calculateTotals();
    renderTotals(totals.subtotal, totals.discountAmount, totals.taxAmount, totals.total);
    updateChargeButton(totals.total);
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
    let discountAmount = 0;
    if (discountType === 'percentage') discountAmount = subtotal * (discountValue / 100);
    else if (discountType === 'fixed') discountAmount = Math.min(discountValue, subtotal);
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * TAX_RATE;
    const total = taxableAmount + taxAmount;
    return { subtotal, discountAmount, taxAmount, total };
  };

  const renderTotals = (subtotal, discountAmount, taxAmount, total) => {
    const el = document.getElementById('cart-totals');
    if (!el) return;

    el.innerHTML = `
<div class="totals-row"><span>Subtotal</span><span class="text-mono">${formatCurrency(subtotal)}</span></div>
${discountAmount > 0 ? `<div class="totals-row discount-row"><span>Discount</span><span class="text-mono">-${formatCurrency(discountAmount)}</span></div>` : ''}
<div class="totals-row"><span>VAT (12%)</span><span class="text-mono">${formatCurrency(taxAmount)}</span></div>
<div class="totals-row total"><span>TOTAL</span><span class="amount">${formatCurrency(total)}</span></div>`;
  };

  const updateChargeButton = (total) => {
    const btn = document.getElementById('charge-btn');
    const btnText = document.getElementById('charge-btn-text');
    if (!btn) return;
    btn.disabled = cart.length === 0 || isProcessing;
    if (btnText) btnText.textContent = `Charge ${formatCurrency(total)}`;
    updateChange();
  };

  // ── Discount ─────────────────────────────────────────────────────────────────
  const setDiscountType = (type) => {
    discountType = type;
    document.getElementById('discount-value').value = '0';
    discountValue = 0;
    updateCart();
  };

  const setDiscountValue = (val) => {
    discountValue = parseFloat(val) || 0;
    updateCart();
  };

  // ── Payment ───────────────────────────────────────────────────────────────────
  const selectPayment = (method) => {
    paymentMethod = method;
    ['cash', 'gcash', 'card'].forEach(m => {
      document.getElementById(`pm-${m}`)?.classList.toggle('active', m === method);
    });
    const refSection = document.getElementById('ref-input-section');
    if (refSection) refSection.style.display = ['gcash', 'card'].includes(method) ? 'block' : 'none';
  };

  const updateChange = () => {};

  // ── Cash Payment Modal ────────────────────────────────────────────────────────
  const handleChargeClick = () => {
    if (cart.length === 0 || isProcessing) return;
    if (paymentMethod === 'cash') {
      Receipt.openCashDrawer();
      showCashModal();
    } else {
      processPayment();
    }
  };

  const showCashModal = () => {
    const totals = calculateTotals();
    const total = totals.total;

    // Remove existing modal if any
    document.getElementById('cash-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'cash-modal';
    modal.style.cssText = `
      position: fixed; inset: 0; z-index: 1000;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.75); backdrop-filter: blur(6px);
      animation: fadeIn 0.15s ease; padding: 16px;
    `;

    modal.innerHTML = `
<div style="
  background: var(--c-surface);
  border: 1px solid var(--c-border2);
  border-radius: 20px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.7);
  animation: slideUp 0.25s cubic-bezier(0.4,0,0.2,1);
  overflow: hidden;
">
  <!-- Header -->
  <div style="
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--c-border);
    display: flex; align-items: center; justify-content: space-between;
  ">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="
        width:38px;height:38px;border-radius:10px;
        background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);
        display:flex;align-items:center;justify-content:center;font-size:1.2rem;
      ">💵</div>
      <div>
        <div style="font-family:var(--font-display);font-weight:700;font-size:0.95rem;">Cash Payment</div>
        <div style="font-size:0.72rem;color:var(--c-text-3);font-family:var(--font-mono);">Enter amount received</div>
      </div>
    </div>
    <button onclick="document.getElementById('cash-modal').remove()"
      style="background:var(--c-surface3);border:1px solid var(--c-border);border-radius:8px;
             color:var(--c-text-3);width:32px;height:32px;cursor:pointer;font-size:1rem;
             display:flex;align-items:center;justify-content:center;">✕</button>
  </div>

  <!-- Total Amount Display -->
  <div style="
    margin: 20px 24px 0;
    background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(99,102,241,0.05));
    border: 1px solid rgba(99,102,241,0.2);
    border-radius: 14px;
    padding: 16px 20px;
    display: flex; justify-content: space-between; align-items: center;
  ">
    <div>
      <div style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.1em;
                  text-transform:uppercase;color:var(--c-text-3);margin-bottom:4px;">Total Amount Due</div>
      <div style="font-family:var(--font-display);font-size:1.8rem;font-weight:800;
                  letter-spacing:-0.03em;color:var(--c-primary-light);">${formatCurrency(total)}</div>
    </div>
    <div style="font-size:2.5rem;opacity:0.15;">🧾</div>
  </div>

  <!-- Cash Tendered Input -->
  <div style="padding: 20px 24px 0;">
    <label style="
      display:block;font-family:var(--font-mono);font-size:0.65rem;
      letter-spacing:0.1em;text-transform:uppercase;color:var(--c-text-3);
      margin-bottom:8px;
    ">Cash Tendered</label>
    <div style="position:relative;">
      <span style="
        position:absolute;left:14px;top:50%;transform:translateY(-50%);
        font-family:var(--font-mono);font-size:1rem;color:var(--c-text-3);
        pointer-events:none;
      ">₱</span>
      <input type="number" id="cash-tendered-modal"
        placeholder="0.00" min="0" step="0.01"
        oninput="POS.updateCashModal(${total})"
        style="
          width:100%;background:var(--c-surface3);border:2px solid var(--c-border2);
          color:var(--c-text);padding:14px 14px 14px 32px;border-radius:12px;
          font-size:1.4rem;font-family:var(--font-mono);font-weight:600;
          outline:none;transition:border-color 0.15s ease;
          -webkit-appearance:none;
        "
        onfocus="this.style.borderColor='var(--c-primary)'"
        onblur="this.style.borderColor='var(--c-border2)'"
      >
    </div>

    <!-- Quick amount buttons -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px;">
      ${[20,50,100,200,500,1000].filter(v => v >= Math.ceil(total/10)*10).slice(0,4).concat([500,1000]).slice(0,4).map(amt => `
        <button onclick="POS.setCashAmount(${amt}, ${total})"
          style="
            padding:8px 4px;border-radius:8px;
            border:1px solid var(--c-border);background:var(--c-surface2);
            color:var(--c-text-2);font-family:var(--font-mono);font-size:0.78rem;
            cursor:pointer;transition:all 0.12s ease;font-weight:500;
          "
          onmouseover="this.style.borderColor='var(--c-primary)';this.style.color='var(--c-primary-light)'"
          onmouseout="this.style.borderColor='var(--c-border)';this.style.color='var(--c-text-2)'"
        >₱${amt.toLocaleString()}</button>
      `).join('')}
    </div>

    <!-- Exact amount button -->
    <button onclick="POS.setCashAmount(${total}, ${total})"
      style="
        width:100%;margin-top:8px;padding:9px;border-radius:8px;
        border:1px dashed var(--c-border2);background:transparent;
        color:var(--c-text-3);font-size:0.78rem;font-family:var(--font-mono);
        cursor:pointer;transition:all 0.12s ease;
      "
      onmouseover="this.style.borderColor='var(--c-green)';this.style.color='var(--c-green)'"
      onmouseout="this.style.borderColor='var(--c-border2)';this.style.color='var(--c-text-3)'"
    >Exact Amount — ${formatCurrency(total)}</button>
  </div>

  <!-- Change Display -->
  <div id="change-display-modal" style="
    margin: 16px 24px 0;
    padding: 14px 18px;
    background: var(--c-surface2);
    border: 1px solid var(--c-border);
    border-radius: 12px;
    display: flex; justify-content: space-between; align-items: center;
    transition: all 0.2s ease;
  ">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:1.1rem;">💰</span>
      <span style="font-family:var(--font-mono);font-size:0.7rem;
                   letter-spacing:0.08em;text-transform:uppercase;color:var(--c-text-3);">Change</span>
    </div>
    <span id="change-amount-modal" style="
      font-family:var(--font-display);font-size:1.4rem;font-weight:800;
      color:var(--c-text-3);letter-spacing:-0.02em;
    ">₱0.00</span>
  </div>

  <!-- Action Buttons -->
  <div style="padding: 20px 24px 24px; display:flex; gap:10px;">
    <button onclick="document.getElementById('cash-modal').remove()"
      style="
        flex:1;padding:13px;border-radius:12px;
        border:1px solid var(--c-border);background:var(--c-surface2);
        color:var(--c-text-2);font-size:0.9rem;font-weight:500;cursor:pointer;
      ">Cancel</button>
    <button id="confirm-cash-btn" onclick="POS.confirmCashPayment(${total})"
      disabled
      style="
        flex:2;padding:13px;border-radius:12px;border:none;
        background:var(--c-surface3);color:var(--c-text-3);
        font-family:var(--font-display);font-size:1rem;font-weight:700;
        cursor:not-allowed;transition:all 0.2s ease;
        display:flex;align-items:center;justify-content:center;gap:8px;
      ">
      <span>Confirm Payment</span>
    </button>
  </div>
</div>`;

    document.body.appendChild(modal);
    // Focus the input after a short delay
    setTimeout(() => document.getElementById('cash-tendered-modal')?.focus(), 100);
  };

  const updateCashModal = (total) => {
    const input = document.getElementById('cash-tendered-modal');
    const changeEl = document.getElementById('change-amount-modal');
    const changeBox = document.getElementById('change-display-modal');
    const confirmBtn = document.getElementById('confirm-cash-btn');
    if (!input || !changeEl) return;

    const tendered = parseFloat(input.value) || 0;
    const change = tendered - total;
    const sufficient = tendered >= total;

    changeEl.textContent = sufficient ? formatCurrency(change) : '—';
    changeEl.style.color = sufficient ? 'var(--c-green)' : 'var(--c-text-3)';

    if (changeBox) {
      changeBox.style.borderColor = sufficient ? 'rgba(34,197,94,0.3)' : 'var(--c-border)';
      changeBox.style.background = sufficient ? 'rgba(34,197,94,0.05)' : 'var(--c-surface2)';
    }

    if (confirmBtn) {
      if (sufficient) {
        confirmBtn.disabled = false;
        confirmBtn.style.background = 'var(--c-green)';
        confirmBtn.style.color = 'white';
        confirmBtn.style.cursor = 'pointer';
        confirmBtn.style.boxShadow = '0 0 20px rgba(34,197,94,0.25)';
      } else {
        confirmBtn.disabled = true;
        confirmBtn.style.background = 'var(--c-surface3)';
        confirmBtn.style.color = 'var(--c-text-3)';
        confirmBtn.style.cursor = 'not-allowed';
        confirmBtn.style.boxShadow = 'none';
      }
    }

    // Highlight input border
    if (input) {
      input.style.borderColor = tendered === 0 ? 'var(--c-border2)'
        : sufficient ? 'var(--c-green)' : 'var(--c-red)';
    }
  };

  const setCashAmount = (amount, total) => {
    const input = document.getElementById('cash-tendered-modal');
    if (input) {
      input.value = amount.toFixed(2);
      updateCashModal(total);
    }
  };

  const confirmCashPayment = (total) => {
    const tendered = parseFloat(document.getElementById('cash-tendered-modal')?.value) || 0;
    if (tendered < total) {
      Toast.show('Cash amount is less than total!', 'error');
      return;
    }
    document.getElementById('cash-modal')?.remove();
    processPayment(tendered);
  };

  // ── Process Payment ───────────────────────────────────────────────────────────
  const processPayment = async (cashTendered = null) => {
    if (cart.length === 0 || isProcessing) return;

    const totals = calculateTotals();
    const tendered = cashTendered !== null ? cashTendered : totals.total;

    isProcessing = true;
    const btn = document.getElementById('charge-btn');
    const btnText = document.getElementById('charge-btn-text');
    if (btn) btn.disabled = true;
    if (btnText) btnText.innerHTML = '<div class="spinner spinner-sm" style="display:inline-block;"></div> Processing...';

    const txnData = {
      items: cart.map(i => ({ product: i.product._id, quantity: i.quantity })),
      discountType,
      discountValue,
      taxRate: TAX_RATE,
      paymentMethod,
      amountTendered: paymentMethod === 'cash' ? tendered : totals.total,
      paymentReference: document.getElementById('payment-reference')?.value || null,
    };

    try {
      let transaction;

      if (!navigator.onLine) {
        // Save offline
        const offlineId = await OfflineDB.queueTransaction(txnData);
        transaction = {
          ...txnData,
          offlineId,
          transactionNumber: `OFFLINE-${Date.now()}`,
          total: totals.total,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          change: txnData.amountTendered - totals.total,
          cashierName: Auth.getUser().name,
          createdAt: new Date().toISOString(),
          items: cart.map(i => ({
            productName: i.product.name,
            quantity: i.quantity,
            unitPrice: i.product.price,
            total: i.product.price * i.quantity,
          })),
          status: 'pending',
        };
        Toast.show('Saved offline. Will sync when online.', 'warning');
      } else {
        const res = await API.post('/transactions', txnData);
        transaction = res.data;
        Toast.show('Transaction complete! ✓', 'success');
      }

      // Show receipt modal
      showReceiptModal(transaction, totals);

      // Reset cart
      cart = [];
      discountType = 'none';
      discountValue = 0;
      paymentMethod = 'cash';
      updateCart();
      selectPayment('cash');
      const cashInput = document.getElementById('cash-tendered');
      if (cashInput) cashInput.value = '';
    } catch (err) {
      Toast.show(err.message || 'Payment failed', 'error');
    } finally {
      isProcessing = false;
      updateChargeButton(totals.total);
    }
  };

  // ── Receipt Modal ─────────────────────────────────────────────────────────────
  const showReceiptModal = (transaction, totals) => {
    const bizInfo = {
      name: window._POS_CONFIG?.businessName || 'SwiftPOS Store',
      address: window._POS_CONFIG?.businessAddress || '',
      phone: window._POS_CONFIG?.businessPhone || '',
    };

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
<div class="modal" style="max-width:380px;">
  <div class="modal-header">
    <span class="modal-title">✓ Transaction Complete</span>
    <button class="btn-icon" onclick="this.closest('.modal-overlay').remove()">✕</button>
  </div>
  <div class="modal-body" id="receipt-preview">
    ${Receipt.buildHTML(transaction, bizInfo)}
  </div>
  <div class="modal-footer" style="flex-wrap:wrap;gap:8px;">
    <button class="btn btn-secondary" onclick="Receipt.print(${JSON.stringify(transaction).replace(/"/g, '&quot;')},${JSON.stringify(bizInfo).replace(/"/g, '&quot;')})">
      🖨 Print
    </button>
    <button class="btn btn-secondary" onclick="Receipt.exportPDF(window._lastTransaction,${JSON.stringify(bizInfo).replace(/"/g, '&quot;')})">
      📄 PDF
    </button>
    <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">
      New Sale →
    </button>
  </div>
</div>`;

    window._lastTransaction = transaction;
    document.body.appendChild(modal);
  };

  // ── Mobile Tab Switching ──────────────────────────────────────────────────────
  const switchTab = (tab) => {
    const productsPanel = document.getElementById('pos-products-panel');
    const cartPanel = document.getElementById('pos-cart-panel');
    const tabProducts = document.getElementById('tab-products');
    const tabCart = document.getElementById('tab-cart');

    if (tab === 'products') {
      productsPanel?.classList.remove('hidden-mobile');
      cartPanel?.classList.add('hidden-mobile');
      tabProducts?.classList.add('active');
      tabCart?.classList.remove('active');
    } else {
      productsPanel?.classList.add('hidden-mobile');
      cartPanel?.classList.remove('hidden-mobile');
      tabProducts?.classList.remove('active');
      tabCart?.classList.add('active');
    }
  };

  const initMobileTabBar = () => {
    const tabBar = document.getElementById('pos-tab-bar');
    if (!tabBar) return;
    // Show tab bar only on mobile
    if (window.innerWidth <= 768) {
      tabBar.style.display = 'flex';
      // Default: show products tab
      switchTab('products');
    } else {
      tabBar.style.display = 'none';
      // Desktop: show both panels
      document.getElementById('pos-products-panel')?.classList.remove('hidden-mobile');
      document.getElementById('pos-cart-panel')?.classList.remove('hidden-mobile');
    }
  };

  // Auto-switch to cart tab when item is added on mobile
  const addToCartAndSwitch = (productId) => {
    addToCart(productId);
    // On mobile, briefly flash the cart badge but stay on products
    // User can manually switch to cart
  };

  // ── Network status ────────────────────────────────────────────────────────────
  const setupNetworkListeners = () => {
    const updateStatus = (online) => {
      const el = document.getElementById('network-status');
      if (!el) return;
      el.innerHTML = online
        ? '<span class="online-dot"></span>Online'
        : '⚠ Offline';
      el.className = online ? 'online-indicator' : 'offline-indicator';
    };

    window.addEventListener('pos:online', () => updateStatus(true));
    window.addEventListener('pos:offline', () => updateStatus(false));
    updateStatus(navigator.onLine);
  };

  return {
    render, addToCart, updateQuantity, removeFromCart, clearCart,
    filterCategory, onSearch, onSearchKey,
    setDiscountType, setDiscountValue, selectPayment, updateChange,
    handleChargeClick, showCashModal, updateCashModal, setCashAmount, confirmCashPayment,
    processPayment, switchTab,
  };
})();
