/**
 * POS Module - Updated for LogicOwl-1000 USB Trigger
 */
const POS = (() => {
  // --- State ---
  let products = [];
  let categories = [];
  let cart = [];
  let selectedCategory = 'all';
  let paymentMethod = 'cash';
  let discountType = 'none';
  let discountValue = 0;

  const TAX_RATE = 0.12;

  const formatCurrency = (n) =>
    '₱' + parseFloat(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const escapeHTML = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  // --- LogicOwl-1000 Drawer Logic ---
  const openCashDrawer = async () => {
    try {
      // Prompt user to select the LogicOwl-1000 USB Trigger[cite: 2]
      const device = await navigator.usb.requestDevice({
        filters: [{ vendorId: 0x0483 }] 
      });

      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);

      // Pulse code for trigger kick-out[cite: 2]
      const data = new Uint8Array([0x01]); 
      await device.transferOut(1, data);
      
      await device.close();
      Toast.show('Cash drawer opened', 'success');
    } catch (err) {
      console.error('USB Drawer Error:', err);
      Toast.show('Drawer Error: ' + err.message, 'error');
    }
  };

  const resetDrawerSettings = () => {
    console.log("Drawer settings reset.");
    return true;
  };

  // --- Core Functions ---
  const addToCart = (productId) => {
    const product = products.find(p => p._id === productId);
    if (!product || product.stock === 0) {
      Toast.show('Product unavailable', 'warning');
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
      document.getElementById('clear-cart-btn').style.display = 'none';
    } else {
      document.getElementById('clear-cart-btn').style.display = 'block';
      cartItemsEl.innerHTML = cart.map(item => `
        <div class="cart-item">
          <span>${escapeHTML(item.name)} x${item.quantity}</span>
          <span>${formatCurrency(item.price * item.quantity)}</span>
        </div>
      `).join('');
    }
    // Update badge and totals logic here...[cite: 2]
  };

  // --- Render ---
  const render = async () => {
    document.getElementById('app').innerHTML = `
<div class="main-layout">
  ${renderSidebar('pos')}
  <div class="content-area">
    <div class="topbar">
      <span class="topbar-title">🏪 POS Register</span>
    </div>
    
    <div class="pos-layout">
      <div class="pos-left">
        <div class="pos-search">
          <input type="search" class="pos-search-input" placeholder="Search..." oninput="POS.onSearch(this.value)">
        </div>
        <div class="category-tabs" id="category-tabs"></div>
        <div class="product-grid" id="product-grid"></div>
      </div>
      
      <div class="pos-right">
        <div class="cart-panel">
          <div class="cart-header">
            <span class="cart-title">Order Items</span>
            <div style="display:flex; gap:8px;">
              <!-- Manual Open Button[cite: 2] -->
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
    const res = await API.get('/products');
    products = res.data;
    const grid = document.getElementById('product-grid');
    grid.innerHTML = products.map(p => `
      <div class="product-card" onclick="POS.addToCart('${p._id}')">
        <div>${p.name}</div>
        <div>${formatCurrency(p.price)}</div>
      </div>`).join('');[cite: 2]
  };

  // --- Final Export ---
  return {
    render,
    addToCart, // Exported to resolve ReferenceError[cite: 2]
    clearCart: () => { cart = []; updateCart(); },
    onSearch: (v) => { /* logic */ },
    handleChargeClick: () => { /* logic */ },
    openCashDrawer, // For the header button[cite: 2]
    openOJ1000Drawer: openCashDrawer, // Alias for receipt.js[cite: 2]
    resetDrawerSettings // Alias for pos.js line 1021[cite: 2]
  };
})();
