/**
 * Products Module
 * Admin product management: CRUD, categories, stock adjustments
 */

const Products = (() => {
  let products = [];
  let categories = [];
  let currentPage = 1;
  let currentSearch = '';
  let currentCategory = '';

  const formatCurrency = (n) =>
    '₱' + parseFloat(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const render = async () => {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = `
<div class="main-layout">
  ${renderSidebar('products')}
  <div class="content-area">
    ${renderTopbar('Products', Auth.isAdmin() ? `<button class="btn btn-primary btn-sm" onclick="Products.showProductModal()">+ Add Product</button>` : '')}
    <div class="page-content page">
      
      <!-- Filters -->
      <div class="card mb-md" style="padding:var(--gap-md);">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
          <div class="input-group" style="flex:1;min-width:200px;">
            <span class="input-icon">🔍</span>
            <input type="search" class="form-input" id="prod-search" placeholder="Search products..." 
              oninput="Products.search(this.value)">
          </div>
          <select class="form-select" style="width:160px;" id="cat-filter" onchange="Products.filterCat(this.value)">
            <option value="">All Categories</option>
          </select>
        </div>
      </div>
      
      <!-- Product Table -->
      <div class="card" style="padding:0;">
        <div id="products-table">
          <div style="padding:40px;text-align:center;"><div class="spinner" style="margin:0 auto;"></div></div>
        </div>
      </div>
      
      <div id="pagination" style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;"></div>
    </div>
  </div>
</div>`;

    await loadCategories();
    await loadProducts();
  };

  const loadCategories = async () => {
    try {
      const res = await API.get('/categories');
      categories = res.data;
      const select = document.getElementById('cat-filter');
      if (select) {
        categories.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c._id;
          opt.textContent = `${c.icon || ''} ${c.name}`;
          select.appendChild(opt);
        });
      }
    } catch (err) { console.error("Category load failed", err); }
  };

  const loadProducts = async (page = 1) => {
    currentPage = page;
    try {
      const params = { page, limit: 20, isActive: 'true' };
      if (currentSearch) params.search = currentSearch;
      if (currentCategory) params.category = currentCategory;

      const res = await API.get('/products', params);
      products = res.data;
      renderTable(products, res.pagination);
    } catch (err) {
      Toast.show('Failed to load products', 'error');
    }
  };

  const renderTable = (prods, pagination) => {
    const tableEl = document.getElementById('products-table');
    if (!tableEl) return;

    if (prods.length === 0) {
      tableEl.innerHTML = '<p style="padding:40px;text-align:center;color:var(--c-text-3);">No products found</p>';
      return;
    }

    const isAdmin = Auth.isAdmin();
    tableEl.innerHTML = `
<div class="table-container" style="border:none;border-radius:0;">
<table>
  <thead><tr>
    <th>Product</th><th>Category</th><th>Price</th><th>Stock</th>
    ${isAdmin ? '<th>Actions</th>' : ''}
  </tr></thead>
  <tbody>
    ${prods.map(p => `
      <tr>
        <td>
          <div style="font-weight:500;">${escapeHTML(p.name)}</div>
          <div class="text-mono text-sm text-muted">${p.sku || ''}</div>
        </td>
        <td>${escapeHTML(p.category?.name || '-')}</td>
        <td class="text-mono fw-bold">${formatCurrency(p.price)}</td>
        <td><span class="badge ${p.stock <= p.lowStockThreshold ? 'badge-warning' : 'badge-success'}">${p.stock} ${p.unit}</span></td>
        ${isAdmin ? `<td>
          <button class="btn-icon" onclick="Products.showProductModal('${p._id}')">✏</button>
          <button class="btn-icon" onclick="Products.showStockModal('${p._id}')">📦</button>
        </td>` : ''}
      </tr>`).join('')}
  </tbody>
</table></div>`;
  };

  return {
    render,
    loadProducts,
    search: (val) => {
      currentSearch = val;
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => loadProducts(1), 300);
    },
    filterCat: (catId) => {
      currentCategory = catId;
      loadProducts(1);
    },
    // Adding stubs for the modal triggers to prevent "undefined" errors
    showProductModal: (id) => console.log("Edit product", id),
    showStockModal: (id) => console.log("Adjust stock", id)
  };
})();

// CRITICAL: Export to window so the index.html guard can see it
window.Products = Products;
