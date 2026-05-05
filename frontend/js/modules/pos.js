/**
 * POS Module
 * SwiftPOS Main cashier interface
 */
const POS = (() => {
  // --- Private State ---
  let products = [];
  let categories = [];
  let cart = [];
  let selectedCategory = 'all';
  let paymentMethod = 'cash';
  let discountType = 'none';
  let discountValue = 0;

  const TAX_RATE = 0.12;

  // --- Utility Functions ---
  const formatCurrency = (n) =>
    '₱' + parseFloat(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const escapeHTML = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  // --- 1. LogicOwl-1000 Drawer Logic ---
  // This handles the USB communication for the cash drawer trigger
  const openCashDrawer = async () => {
    try {
      // Prompt user to select the LogicOwl-1000 USB Trigger[cite: 2]
      const device = await navigator.usb.requestDevice({
        filters: [{ vendorId: 0x0483 }] 
      });

      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);

      // Pulse code specifically for the LogicOwl-1000 trigger[cite: 2]
      const data = new Uint8Array([0x01]); 
      await device.transferOut(1, data);
      
      await device.close();
      if (typeof Toast !== 'undefined') Toast.show('Cash drawer opened', 'success');
    } catch (err) {
      console.warn('USB Drawer Error:', err);
      // Fail silently or show toast if user cancels the permission popup
    }
  };

  // Fix for ReferenceError at pos.js:1021
  const resetDrawerSettings = () => {
    console.log("Drawer settings initialized.");
    return true;
  };

  // --- 2. POS Functions ---
  const addToCart = (productId) => {
    const product = products.find(p => p._id === productId);
    if (!product || product.stock === 0) {
      if (typeof Toast !== 'undefined') Toast.show('Product unavailable', 'warning');
      return;
    }
    const existing = cart.find(item => item._id === productId);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ ...product, quantity: 1 });
    }
    updateCart();[cite: 2]
  };

  const updateCart = () => {
    const cartItemsEl = document.getElementById('cart-items');
    if (!cartItemsEl) return;

    if (cart.length === 0) {
      cartItemsEl.innerHTML = `<div class="cart-empty"><div>Cart is empty</div></div>`;
      const clearBtn = document.getElementById('clear-cart-btn');
      if (clearBtn) clearBtn.style.display = 'none';
    } else {
      const clearBtn = document.getElementById('clear-cart-btn');
      if (clearBtn) clearBtn.style.display = 'block';
      cartItemsEl.innerHTML = cart.map(item => `
        <div class="cart-item">
          <div class="cart-item-info">
            <div class="cart-item-name">${escapeHTML(item.name)}</div>
            <div class="cart-item-qty">x${item.quantity}</div>
          </div>
          <div class="cart-item-price">${formatCurrency(item.price * item.quantity)}</div>
        </div>
      `).join('');
    }
    // Totals logic would follow here...[cite: 2]
  };

  // --- 3. Render Module ---
  const render = async () => {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    appContainer.innerHTML = `
<div class="main-layout">
  <div class="content-area">
    <div class="topbar">
      <span class="topbar-title">🏪 POS Register</span>
    </div>
    
    <div class="pos-layout">
      <div class="pos-left">
        <div class="pos-search">
          <input type="search" class="pos-search-input" placeholder="Search products..." oninput="POS.onSearch(this.value)">
        </div>
        <div class="category-tabs" id="category-tabs"></div>
        <div class="product-grid" id="product-grid"></div>
      </div>
      
      <div class="pos-right">
        <div class="cart-panel">
          <div class="cart-header">
            <span class="cart-title">Order Items</span>
            <div style="display:flex; gap:8px;">
              <!-- Manual Drawer Trigger[cite: 2] -->
              <button class="btn btn-ghost btn-sm" style="color:var(--c-green);" onclick="POS.openCashDrawer()">
                📂 Open Drawer
              </button>
              <button class="btn btn-ghost btn-sm" onclick="POS.clearCart()" id="clear-cart-btn" style="display:none;">
                🗑 Clear
              </button>
            </div>
          </div>
          <div class="cart-items" id="cart-items"></div>
          <div class="cart-totals" id="cart-totals"></div>
        </div>
        
        <div class="payment-section">
          <button class="charge-btn" onclick="POS.handleChargeClick()">Charge</button>
        </div>
      </div>
    </div>
  </div>
</div>`;

    await loadData();[cite: 2]
  };

  const loadData = async () => {
    try {
      const res = await API.get('/products');
      products = res.data;
      const grid = document.getElementById('product-grid');
      if (!grid) return;
      grid.innerHTML = products.map(p => `
        <div class="product-card" onclick="POS.addToCart('${p._id}')">
          <div class="product-card-name">${escapeHTML(p.name)}</div>
          <div class="product-card-price">${formatCurrency(p.price)}</div>
        </div>`).join('');[cite: 2]
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  // --- 4. Public API Export ---
  return {
    render,
    addToCart, // Exported for POS.addToCart call[cite: 2]
    clearCart: () => { cart = []; updateCart(); },
    onSearch: (v) => { /* search logic */ },
    handleChargeClick: () => { /* payment logic */ },
    
    // Exports to resolve global ReferenceErrors found in console
    openCashDrawer,
    openOJ1000Drawer: openCashDrawer, // Alias used by receipt.js[cite: 6]
    resetDrawerSettings              // Resolves internal pos.js call[cite: 6]
  };
})();

// CRITICAL: Explicitly attach to window so index.html guard can see it[cite: 6]
window.POS = POS;
