/**
 * Inventory Module
 * Stock overview, low stock alerts, inventory value
 */

const Inventory = (() => {
  const formatCurrency = (n) =>
    '₱' + parseFloat(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const render = async () => {
    document.getElementById('app').innerHTML = `
<div class="main-layout">
  ${renderSidebar('inventory')}
  <div class="content-area">
    ${renderTopbar('Inventory')}
    <div class="page-content page">
      
      <!-- Summary Cards -->
      <div class="stats-grid mb-md" id="inv-stats">
        <div class="stat-card"><div class="spinner spinner-sm"></div></div>
        <div class="stat-card"><div class="spinner spinner-sm"></div></div>
        <div class="stat-card"><div class="spinner spinner-sm"></div></div>
        <div class="stat-card"><div class="spinner spinner-sm"></div></div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--gap-md);">
        <!-- Low Stock -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">⚠ Low Stock Items</span>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('products')">Manage →</button>
          </div>
          <div id="low-stock-list">
            <div style="padding:24px;text-align:center;"><div class="spinner spinner-sm" style="margin:0 auto;"></div></div>
          </div>
        </div>
        
        <!-- Out of Stock -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">🚫 Out of Stock</span>
          </div>
          <div id="out-of-stock-list">
            <div style="padding:24px;text-align:center;"><div class="spinner spinner-sm" style="margin:0 auto;"></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;

    await loadData();
  };

  const loadData = async () => {
    try {
      const [summaryRes, lowRes, outRes] = await Promise.all([
        API.get('/inventory/summary'),
        API.get('/inventory/low-stock'),
        API.get('/inventory/out-of-stock'),
      ]);

      renderStats(summaryRes.data);
      renderLowStock(lowRes.data);
      renderOutOfStock(outRes.data);
    } catch (err) {
      Toast.show('Failed to load inventory: ' + err.message, 'error');
    }
  };

  const renderStats = (data) => {
    document.getElementById('inv-stats').innerHTML = `
<div class="stat-card" style="--stat-color:var(--c-primary)">
  <div class="stat-label">Total Products</div>
  <div class="stat-value">${data.totalProducts}</div>
  <div class="stat-sub">Active products</div>
  <div class="stat-icon">📦</div>
</div>
<div class="stat-card" style="--stat-color:var(--c-yellow)">
  <div class="stat-label">Low Stock</div>
  <div class="stat-value">${data.lowStockCount}</div>
  <div class="stat-sub">Below threshold</div>
  <div class="stat-icon">⚠</div>
</div>
<div class="stat-card" style="--stat-color:var(--c-red)">
  <div class="stat-label">Out of Stock</div>
  <div class="stat-value">${data.outOfStockCount}</div>
  <div class="stat-sub">Needs restock</div>
  <div class="stat-icon">🚫</div>
</div>
<div class="stat-card" style="--stat-color:var(--c-green)">
  <div class="stat-label">Retail Value</div>
  <div class="stat-value" style="font-size:1.2rem;">${formatCurrency(data.totalRetailValue)}</div>
  <div class="stat-sub">Cost: ${formatCurrency(data.totalCostValue)}</div>
  <div class="stat-icon">💰</div>
</div>`;
  };

  const renderLowStock = (products) => {
    const el = document.getElementById('low-stock-list');
    if (!products || products.length === 0) {
      el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--c-green);">✓ All stock levels are good</div>';
      return;
    }

    el.innerHTML = `
<div style="padding:0 var(--gap-md) var(--gap-md);">
  ${products.map(p => `
  <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--c-border);">
    <span style="font-size:1.3rem;">${p.category?.icon || '📦'}</span>
    <div style="flex:1;">
      <div style="font-size:0.875rem;font-weight:500;">${escapeHTML(p.name)}</div>
      <div style="font-size:0.75rem;color:var(--c-text-3);">Threshold: ${p.lowStockThreshold} ${p.unit}</div>
    </div>
    <span class="badge badge-warning">${p.stock} ${p.unit}</span>
    ${Auth.isAdmin() ? `<button class="btn-icon" onclick="Products.showStockModal('${p._id}')" title="Restock">+</button>` : ''}
  </div>`).join('')}
</div>`;
  };

  const renderOutOfStock = (products) => {
    const el = document.getElementById('out-of-stock-list');
    if (!products || products.length === 0) {
      el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--c-green);">✓ No out-of-stock items</div>';
      return;
    }

    el.innerHTML = `
<div style="padding:0 var(--gap-md) var(--gap-md);">
  ${products.map(p => `
  <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--c-border);">
    <span style="font-size:1.3rem;">${p.category?.icon || '📦'}</span>
    <div style="flex:1;">
      <div style="font-size:0.875rem;font-weight:500;">${escapeHTML(p.name)}</div>
      <div style="font-size:0.75rem;color:var(--c-text-3);">${escapeHTML(p.category?.name || '-')}</div>
    </div>
    <span class="badge badge-danger">Out</span>
    ${Auth.isAdmin() ? `<button class="btn-icon" onclick="Products.showStockModal('${p._id}')" title="Restock">+</button>` : ''}
  </div>`).join('')}
</div>`;
  };

  return { render };
})();
