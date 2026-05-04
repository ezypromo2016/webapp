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
  let categoryEditId = null;
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
        ${Auth.isAdmin() ? `<button class="btn btn-secondary btn-sm" onclick="POS.showCategoryManager()">Manage Categories</button>` : ''}
        <div id="network-status" class="online-indicator"><span class="online-dot"></span>Online</div>
      </div>
    </div>
    
    <div class="pos-layout">
      <!-- Left: Products -->
      <div class="pos-left">
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
        <!-- Mobile cart toggle -->
        <div class="cart-toggle-btn" id="cart-toggle" onclick="POS.toggleMobileCart()">
          <span style="font-weight:600;font-size:0.9rem;">🛒 Cart</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="cart-count" id="cart-badge">0</span>
            <span id="cart-toggle-icon">▲</span>
          </div>
        </div>
        
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
          
          <div id="cash-input-section" style="display:none;">
            <label class="form-label">Cash Tendered</label>
            <input type="number" class="form-input" id="cash-tendered" 
              placeholder="0.00" min="0" step="0.01"
              oninput="POS.updateChange()" style="font-size:1rem;font-family:var(--font-mono);">
            <div id="change-display" style="display:flex;justify-content:space-between;margin-top:6px;font-family:var(--font-mono);font-size:0.9rem;">
              <span class="text-muted">Change:</span>
              <span id="change-amount" class="text-success fw-bold">₱0.00</span>
            </div>
          </div>
          
          <div id="ref-input-section" style="display:none;">
            <label class="form-label">Reference Number</label>
            <input type="text" class="form-input" id="payment-reference" 
              placeholder="Enter reference #">
          </div>
          
          <button class="charge-btn" id="charge-btn" disabled onclick="POS.processPayment()">
            <span id="charge-btn-text">Charge ₱0.00</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>`;

    await loadData();
    setupNetworkListeners();
    // Autofocus search
    setTimeout(() => document.getElementById('product-search')?.focus(), 300);
  };

  const loadData = async () => {
    try {
      const [productsRes, catsRes] = await Promise.all([
        API.get('/products', { isActive: 'true', limit: 200 }),
        API.get('/categories'),
      ]);
      products = productsRes.data;
      categories = catsRes.data;
      renderCategoryTabs();
      renderProducts(products);
    } catch (err) {
      Toast.show('Failed to load products: ' + err.message, 'error');
      // Try to render with cached data
      const cached = Storage.getCache('products');
      if (cached) { products = cached; renderProducts(products); }
    }
    // Cache for offline
    if (products.length > 0) Storage.cache('products', products, 600);
  };

  // ── Category Tabs ────────────────────────────────────────────────────────────
  const renderCategoryTabs = () => {
    if (selectedCategory !== 'all' && !categories.some(c => c._id === selectedCategory)) {
      selectedCategory = 'all';
    }

    const tabs = [
      `<button class="category-tab ${selectedCategory === 'all' ? 'active' : ''}" onclick="POS.filterCategory('all')" data-cat="all">🏪 All</button>`,
      ...categories.map(c =>
        `<button class="category-tab ${selectedCategory === c._id ? 'active' : ''}" onclick="POS.filterCategory('${c._id}')" data-cat="${c._id}">
          ${c.icon} ${c.name}
        </button>`
      ),
    ];
    document.getElementById('category-tabs').innerHTML = tabs.join('');
  };

  const showCategoryManager = async () => {
    try {
      const res = await API.get('/categories');
      categories = res.data;
    } catch (err) {
      Toast.show('Failed to load categories: ' + err.message, 'error');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'category-manager-modal';
    modal.innerHTML = `
<div class="modal" style="max-width:720px;">
  <div class="modal-header">
    <span class="modal-title">🗂 Manage Categories</span>
    <button class="btn-icon" onclick="document.getElementById('category-manager-modal').remove()">✕</button>
  </div>
  <div class="modal-body" style="padding:0;display:grid;grid-template-columns:1fr 1fr;gap:18px;">
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span class="form-label" style="margin:0;">Categories</span>
        <button class="btn btn-secondary btn-sm" onclick="POS.resetCategoryForm()">New</button>
      </div>
      <div id="category-manager-list" style="max-height:520px;overflow:auto;padding-right:4px;"></div>
    </div>
    <div>
      <div class="form-group">
        <label class="form-label">Name *</label>
        <input type="text" class="form-input" id="category-name" placeholder="e.g. Beverages">
      </div>
      <div class="form-group">
        <label class="form-label">Icon</label>
        <input type="text" class="form-input" id="category-icon" placeholder="Emoji or icon" value="📦">
      </div>
      <div class="form-group">
        <label class="form-label">Color</label>
        <input type="color" class="form-input" id="category-color" value="#6366f1">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="category-desc" placeholder="Optional description..."></textarea>
      </div>
      <div id="category-manager-error" class="form-error hidden"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button class="btn btn-ghost" onclick="document.getElementById('category-manager-modal').remove()">Close</button>
        <button class="btn btn-primary" id="category-save-btn" onclick="POS.saveCategory()">Add Category</button>
      </div>
    </div>
  </div>
</div>`;
    document.body.appendChild(modal);
    renderCategoryManagerList();
    resetCategoryForm();
  };

  const renderCategoryManagerList = () => {
    const listEl = document.getElementById('category-manager-list');
    if (!listEl) return;

    if (!categories || categories.length === 0) {
      listEl.innerHTML = '<p class="text-sm text-muted">No categories found.</p>';
      return;
    }

    listEl.innerHTML = categories.map(c => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--c-border);">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;background:${escapeHTML(c.color || '#f3f4f6')};font-size:1.1rem;">${escapeHTML(c.icon || '📦')}</span>
          <div>
            <div style="font-weight:600;">${escapeHTML(c.name)}</div>
            <div class="text-sm text-muted">${escapeHTML(c.description || '')}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secondary btn-sm" onclick="POS.editCategory('${c._id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="POS.deleteCategory('${c._id}','${escapeHTML(c.name)}')">Delete</button>
        </div>
      </div>`).join('');
  };

  const resetCategoryForm = () => {
    categoryEditId = null;
    document.getElementById('category-name').value = '';
    document.getElementById('category-icon').value = '📦';
    document.getElementById('category-color').value = '#6366f1';
    document.getElementById('category-desc').value = '';
    document.getElementById('category-save-btn').textContent = 'Add Category';
    const err = document.getElementById('category-manager-error');
    if (err) {
      err.textContent = '';
      err.classList.add('hidden');
    }
  };

  const editCategory = (categoryId) => {
    const category = categories.find(c => c._id === categoryId);
    if (!category) return;
    categoryEditId = categoryId;
    document.getElementById('category-name').value = category.name;
    document.getElementById('category-icon').value = category.icon || '📦';
    document.getElementById('category-color').value = category.color || '#6366f1';
    document.getElementById('category-desc').value = category.description || '';
    document.getElementById('category-save-btn').textContent = 'Update Category';
  };

  const saveCategory = async () => {
    const name = document.getElementById('category-name').value.trim();
    const icon = document.getElementById('category-icon').value.trim() || '📦';
    const color = document.getElementById('category-color').value;
    const description = document.getElementById('category-desc').value.trim();
    const errEl = document.getElementById('category-manager-error');
    errEl.classList.add('hidden');

    if (!name) {
      errEl.textContent = 'Category name is required.';
      errEl.classList.remove('hidden');
      return;
    }

    const data = { name, icon, color, description: description || undefined };

    try {
      if (categoryEditId) {
        await API.put(`/categories/${categoryEditId}`, data);
        Toast.show('Category updated', 'success');
      } else {
        await API.post('/categories', data);
        Toast.show('Category added', 'success');
      }
      await loadData();
      renderCategoryManagerList();
      resetCategoryForm();
      renderCategoryTabs();
      renderProducts(getFilteredProducts(document.getElementById('product-search')?.value || ''));
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
      await loadData();
      renderCategoryManagerList();
      renderCategoryTabs();
      renderProducts(getFilteredProducts(document.getElementById('product-search')?.value || ''));
    } catch (err) {
      Toast.show(err.message, 'error');
    }
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
    if (clearBtn) clearBtn.style.display = cart.length > 0 ? 'flex' : 'none';
    if (discountSection) discountSection.style.display = cart.length > 0 ? 'block' : 'none';

    if (cart.length === 0) {
      cartItemsEl.innerHTML = `<div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <div class="cart-empty-title">Your cart is empty</div>
        <div class="cart-empty-hint">Tap products on the left to add items to your order</div>
      </div>`;
      renderTotals(0, 0, 0);
      updateChargeButton(0);
      return;
    }

    cartItemsEl.innerHTML = cart.map(item => `
<div class="cart-item">
  <div class="cart-item-badge" title="${escapeHTML(item.product.category?.name || 'Uncategorized')}">${item.product.category?.icon || '📦'}</div>
  <div class="cart-item-info">
    <div class="cart-item-name">${escapeHTML(item.product.name)}</div>
    <div class="cart-item-meta">${escapeHTML(item.product.category?.name || '-')} • ${formatCurrency(item.product.price)}/ea</div>
  </div>
  <div class="cart-item-controls">
    <div class="cart-qty-controls">
      <button class="qty-btn" onclick="POS.updateQuantity('${item.product._id}', -1)" title="Remove one">−</button>
      <span class="qty-value">${item.quantity}</span>
      <button class="qty-btn" onclick="POS.updateQuantity('${item.product._id}', 1)" title="Add one">+</button>
    </div>
    <button class="cart-remove" onclick="POS.removeFromCart('${item.product._id}')" title="Remove item">✕</button>
  </div>
  <div class="cart-item-total">${formatCurrency(item.product.price * item.quantity)}</div>
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
<div class="totals-section">
  <div class="totals-row"><span>Subtotal</span><span class="text-mono">${formatCurrency(subtotal)}</span></div>
  ${discountAmount > 0 ? `<div class="totals-row discount-row"><span>💰 Discount</span><span class="text-mono discount-value">-${formatCurrency(discountAmount)}</span></div>` : ''}
  <div class="totals-row tax-row"><span>Tax (12%)</span><span class="text-mono">${formatCurrency(taxAmount)}</span></div>
  <div class="totals-row totals-grand"><span>TOTAL</span><span class="amount">${formatCurrency(total)}</span></div>
</div>`;
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

    if (method === 'cash') {
      showCashPaymentModal();
    } else {
      const cashSection = document.getElementById('cash-input-section');
      const refSection = document.getElementById('ref-input-section');
      if (cashSection) cashSection.style.display = 'none';
      if (refSection) refSection.style.display = 'block';
      updateChange();
    }
  };

  const showCashPaymentModal = () => {
    const totals = calculateTotals();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'cash-payment-modal';
    modal.innerHTML = `
<div class="modal cash-payment-modal">
  <div class="modal-header">
    <span class="modal-title">💵 Cash Payment</span>
    <button class="btn-icon" onclick="document.getElementById('cash-payment-modal').remove()">✕</button>
  </div>
  
  <div class="modal-body" style="display:flex;flex-direction:column;gap:24px;padding:32px;">
    
    <!-- Total Amount Display -->
    <div class="cash-total-box">
      <span class="cash-total-label">Total Amount</span>
      <span class="cash-total-amount">${formatCurrency(totals.total)}</span>
    </div>
    
    <!-- Cash Tendered Input -->
    <div class="cash-input-group">
      <label class="form-label">Cash Tendered</label>
      <input type="number" 
        class="cash-input-field" 
        id="cash-modal-tendered" 
        placeholder="0.00" 
        min="0" 
        step="0.01"
        oninput="POS.updateCashModalChange()"
        autofocus>
    </div>
    
    <!-- Change Display -->
    <div class="cash-change-box">
      <div class="cash-change-row">
        <span class="cash-change-label">Change</span>
        <span class="cash-change-amount" id="cash-modal-change">₱0.00</span>
      </div>
      <div class="cash-change-indicator" id="cash-change-indicator"></div>
    </div>
    
    <!-- Action Buttons -->
    <div style="display:flex;gap:12px;">
      <button class="btn btn-ghost btn-block" onclick="document.getElementById('cash-payment-modal').remove()">Cancel</button>
      <button class="btn btn-primary btn-block" style="font-size:1rem;padding:14px;font-weight:700;" 
        onclick="POS.confirmCashPayment(${totals.total})">
        Complete Payment
      </button>
    </div>
  </div>
</div>`;
    
    document.body.appendChild(modal);
    updateCashModalChange();
    document.getElementById('cash-modal-tendered')?.focus();
  };

  const updateCashModalChange = () => {
    const totals = calculateTotals();
    const tendered = parseFloat(document.getElementById('cash-modal-tendered')?.value) || 0;
    const change = tendered - totals.total;
    const changeEl = document.getElementById('cash-modal-change');
    const indicatorEl = document.getElementById('cash-change-indicator');
    
    if (changeEl) {
      if (tendered < totals.total) {
        changeEl.textContent = `₱${Math.abs(change).toFixed(2)} short`;
        changeEl.style.color = 'var(--c-red)';
        if (indicatorEl) {
          indicatorEl.innerHTML = '<span style="color:var(--c-red);">⚠ Insufficient amount</span>';
        }
      } else {
        changeEl.textContent = formatCurrency(Math.max(0, change));
        changeEl.style.color = 'var(--c-green)';
        if (indicatorEl) {
          indicatorEl.innerHTML = '<span style="color:var(--c-green);">✓ Ready to process</span>';
        }
      }
    }
  };

  const confirmCashPayment = (totalAmount) => {
    const tendered = parseFloat(document.getElementById('cash-modal-tendered')?.value) || 0;
    if (tendered < totalAmount) {
      Toast.show('Cash amount is less than total!', 'error');
      return;
    }
    document.getElementById('cash-input-section').style.display = 'none';
    const refSection = document.getElementById('ref-input-section');
    if (refSection) refSection.style.display = 'none';
    document.getElementById('cash-payment-modal')?.remove();
    document.getElementById('cash-tendered').value = tendered;
    updateChange();
    processPayment();
  };

  const updateChange = () => {
    if (paymentMethod !== 'cash') return;
    const totals = calculateTotals();
    const tendered = parseFloat(document.getElementById('cash-tendered')?.value) || 0;
    const change = Math.max(0, tendered - totals.total);
    const el = document.getElementById('change-amount');
    if (el) el.textContent = formatCurrency(change);
  };

  // ── Process Payment ───────────────────────────────────────────────────────────
  const processPayment = async () => {
    if (cart.length === 0 || isProcessing) return;

    const totals = calculateTotals();

    // Validate cash tendered
    if (paymentMethod === 'cash') {
      const tendered = parseFloat(document.getElementById('cash-tendered')?.value) || 0;
      if (tendered < totals.total) {
        Toast.show('Cash amount is less than total!', 'error');
        document.getElementById('cash-tendered')?.focus();
        return;
      }
    }

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
      amountTendered: paymentMethod === 'cash'
        ? parseFloat(document.getElementById('cash-tendered')?.value) || totals.total
        : totals.total,
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

  // ── Mobile cart toggle ────────────────────────────────────────────────────────
  const toggleMobileCart = () => {
    const panel = document.getElementById('pos-cart-panel');
    const icon = document.getElementById('cart-toggle-icon');
    panel.classList.toggle('cart-expanded');
    if (icon) icon.textContent = panel.classList.contains('cart-expanded') ? '▼' : '▲';
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
    setDiscountType, setDiscountValue, selectPayment, updateChange, processPayment,
    showCashPaymentModal, updateCashModalChange, confirmCashPayment,
    toggleMobileCart,
    showCategoryManager, saveCategory, deleteCategory, editCategory, resetCategoryForm,
  };
})();
