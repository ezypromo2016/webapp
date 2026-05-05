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

  // --- Cash Drawer Logic ---
  const openCashDrawer = async () => {
    try {
      // LogicOwl-1000 typically uses a generic USB HID or Serial profile
      // Using requestDevice to allow user to pair the trigger[cite: 2]
      const device = await navigator.usb.requestDevice({
        filters: [{ vendorId: 0x0483 }] // Standard VID for many USB triggers; adjust if specific PID is known
      });

      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);

      // Send the signal to the LogicOwl-1000 to trigger the drawer kick[cite: 2]
      const data = new Uint8Array([0x01]); 
      await device.transferOut(1, data);
      
      await device.close();
      Toast.show('Cash drawer opened', 'success');
    } catch (err) {
      console.error('USB Drawer Error:', err);
      Toast.show('Drawer Error: ' + err.message, 'error');
    }
  };

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
      <div class="pos-tab-bar" id="pos-tab-bar" style="display:none;">
        <button class="pos-tab-btn active" id="tab-products" onclick="POS.switchTab('products')">🛍 Products</button>
        <button class="pos-tab-btn" id="tab-cart" onclick="POS.switchTab('cart')">
          🛒 Cart <span class="tab-badge" id="cart-badge-tab">0</span>
        </button>
      </div>

      <div class="pos-left" id="pos-products-panel">
        <div class="pos-search">
          <span class="pos-search-icon">🔍</span>
          <input type="search" class="pos-search-input" id="product-search"
            placeholder="Search products..." autocomplete="off"
            oninput="POS.onSearch(this.value)" onkeydown="POS.onSearchKey(event)">
        </div>
        <div class="category-tabs" id="category-tabs"><div class="spinner spinner-sm"></div></div>
        <div class="product-grid" id="product-grid"></div>
      </div>
      
      <div class="pos-right" id="pos-cart-panel">
        <div class="cart-panel" style="flex:1;min-height:0;">
          <div class="cart-header">
            <span class="cart-title">Order Items</span>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-ghost btn-sm" style="color:var(--c-green);" onclick="POS.openCashDrawer()">
                📂 Open Drawer
              </button>
              <button class="btn btn-ghost btn-sm" onclick="POS.clearCart()" id="clear-cart-btn" style="display:none;">
                🗑 Clear
              </button>
            </div>
          </div>
          <div class="cart-items" id="cart-items">
            <div class="cart-empty">
              <div class="cart-empty-icon">🛒</div>
              <div>Cart is empty</div>
            </div>
          </div>
          <div class="cart-totals" id="cart-totals"></div>
        </div>
        
        <div class="card" style="padding:var(--gap-sm) var(--gap-md); display:none;" id="discount-section">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="text-sm text-muted">Discount:</span>
            <select class="form-select" id="discount-type" onchange="POS.setDiscountType(this.value)">
              <option value="none">None</option>
              <option value="percentage">%</option>
              <option value="fixed">₱ Fixed</option>
            </select>
            <input type="number" class="form-input" id="discount-value" oninput="POS.setDiscountValue(this.value)" value="0">
          </div>
        </div>
        
        <div class="payment-section">
          <div class="payment-methods">
            <button class="payment-method-btn active" onclick="POS.selectPayment('cash')" id="pm-cash">💵 Cash</button>
            <button class="payment-method-btn" onclick="POS.selectPayment('gcash')" id="pm-gcash">📱 GCash</button>
            <button class="payment-method-btn" onclick="POS.selectPayment('card')" id="pm-card">💳 Card</button>
          </div>
          <div id="ref-input-section" style="display:none;">
            <input type="text" class="form-input" id="payment-reference" placeholder="Reference #">
          </div>
          <button class="charge-btn" id="charge-btn" disabled onclick="POS.handleChargeClick()">
            <span id="charge-btn-text">Charge ₱0.00</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>`;

    await loadData();
    initMobileTabBar();
  };

  // ... (loadData, renderCategoryTabs, filterCategory, renderProducts remain same as[cite: 2])

  const confirmCashPayment = (total) => {
    const tendered = parseFloat(document.getElementById('cash-tendered-modal')?.value) || 0;
    if (tendered < total) {
      Toast.show('Cash amount is less than total!', 'error');
      return;
    }
    document.getElementById('cash-modal')?.remove();
    
    // Automatically trigger the drawer for cash payments[cite: 2]
    openCashDrawer(); 
    processPayment(tendered);
  };

  // ... (Keep existing processPayment, updateCart, and supporting functions from[cite: 2])

  return {
    render, 
    addToCart, 
    updateQuantity, 
    removeFromCart, 
    clearCart,
    filterCategory, 
    onSearch, 
    onSearchKey,
    setDiscountType, 
    setDiscountValue, 
    selectPayment, 
    handleChargeClick, 
    showCashModal, 
    updateCashModal, 
    setCashAmount, 
    confirmCashPayment,
    processPayment, 
    switchTab,
    openCashDrawer // Exporting for the header button[cite: 2]
  };
})();
