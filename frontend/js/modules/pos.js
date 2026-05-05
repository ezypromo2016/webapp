/**
 * pos.js - SwiftPOS Module
 * Updated for LogicOwl-1000 USB Trigger
 */
const POS = (() => {
  // --- Private State ---
  let products = [];
  let cart = [];

  const formatCurrency = (n) =>
    '₱' + parseFloat(n || 0).toLocaleString('en-PH', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });

  const escapeHTML = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  // --- LogicOwl-1000 USB Trigger Logic ---
  const openCashDrawer = async () => {
    try {
      const device = await navigator.usb.requestDevice({
        filters: [{ vendorId: 0x0483 }] 
      });

      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);

      const data = new Uint8Array([0x01]); 
      await device.transferOut(1, data);
      
      await device.close();
      if (typeof Toast !== 'undefined') Toast.show('Cash drawer opened', 'success');
    } catch (err) {
      console.warn('USB Drawer Error:', err);
    }
  };

  const resetDrawerSettings = () => {
    console.log("Drawer settings initialized.");
    return true;
  };

  // --- POS Core Functions ---
  const addToCart = (productId) => {
    const product = products.find(p => p._id === productId);
    if (!product || product.stock === 0) return;
    
    const existing = cart.find(item => item._id === productId);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ ...product, quantity: 1 });
    }
    updateCart();
  };

  const updateCart = () => {
    const cartItemsEl = document.getElementById('cart-items');
    if (!cartItemsEl) return;

    if (cart.length === 0) {
      cartItemsEl.innerHTML = `<div class="cart-empty"><div>Cart is empty</div></div>`;
    } else {
      cartItemsEl.innerHTML = cart.map(item => `
        <div class="cart-item">
          <span>${escapeHTML(item.name)} x${item.quantity}</span>
          <span>${formatCurrency(item.price * item.quantity)}</span>
        </div>
      `).join('');
    }
  };

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
                <input type="search" class="pos-search-input" placeholder="Search..." oninput="POS.onSearch(this.value)">
              </div>
              <div id="product-grid" class="product-grid"></div>
            </div>
            <div class="pos-right">
              <div class="cart-panel">
                <div class="cart-header">
                  <span class="cart-title">Order Items</span>
                  <button class="btn btn-ghost btn-sm" style="color:#10b981;" onclick="POS.openCashDrawer()">
                    📂 Open Drawer
                  </button>
                </div>
                <div id="cart-items" class="cart-items"></div>
              </div>
              <div class="payment-section">
                <button class="charge-btn" onclick="POS.handleChargeClick()">Charge</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    await loadData();
  };

  const loadData = async () => {
    try {
      const res = await API.get('/products');
      products = res.data;
      const grid = document.getElementById('product-grid');
      if (grid) {
        grid.innerHTML = products.map(p => `
          <div class="product-card" onclick="POS.addToCart('${p._id}')">
            <div class="product-name">${escapeHTML(p.name)}</div>
            <div class="product-price">${formatCurrency(p.price)}</div>
          </div>`).join('');
      }
    } catch (err) {
      console.error('Data load error:', err);
    }
  };

  // --- Public API ---
  return {
    render,
    addToCart,
    openCashDrawer,
    openOJ1000Drawer: openCashDrawer,
    resetDrawerSettings,
    onSearch: (v) => {},
    handleChargeClick: () => {},
    clearCart: () => { cart = []; updateCart(); }
  };
})();

// Attach to window so index.html can find it
window.POS = POS;
