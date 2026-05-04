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
  let editingProduct = null;

  const formatCurrency = (n) =>
    '₱' + parseFloat(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const render = async () => {
    document.getElementById('app').innerHTML = `
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
          <select class="form-select" style="width:140px;" onchange="Products.filterStatus(this.value)">
            <option value="true">Active</option>
            <option value="all">All</option>
            <option value="false">Inactive</option>
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
        select.innerHTML = '<option value="">All Categories</option>';
        categories.forEach(c => {
          select.innerHTML += `<option value="${c._id}">${c.icon} ${c.name}</option>`;
        });
      }
    } catch {}
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
    const isAdmin = Auth.isAdmin();
    document.getElementById('products-table').innerHTML = prods.length === 0
      ? '<p style="padding:40px;text-align:center;color:var(--c-text-3);">No products found</p>'
      : `<div class="table-container" style="border:none;border-radius:0;">
<table>
  <thead><tr>
    <th>Product</th><th>Category</th><th>SKU</th><th>Price</th><th>Cost</th><th>Stock</th><th>Status</th>
    ${isAdmin ? '<th>Actions</th>' : ''}
  </tr></thead>
  <tbody>
    ${prods.map(p => {
      const stockBadge = p.stock === 0
        ? '<span class="badge badge-danger">Out of Stock</span>'
        : p.stock <= p.lowStockThreshold
          ? `<span class="badge badge-warning">⚠ ${p.stock} ${p.unit}</span>`
          : `<span class="text-mono text-sm">${p.stock} ${p.unit}</span>`;
      return `<tr>
        <td>
          <div style="font-weight:500;">${escapeHTML(p.name)}</div>
          ${p.barcode ? `<div class="text-mono text-sm text-muted">${p.barcode}</div>` : ''}
        </td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:4px;">
            ${p.category?.icon || ''} ${escapeHTML(p.category?.name || '-')}
          </span>
        </td>
        <td class="text-mono text-sm">${p.sku || '-'}</td>
        <td class="text-mono fw-bold">${formatCurrency(p.price)}</td>
        <td class="text-mono text-muted">${formatCurrency(p.cost)}</td>
        <td>${stockBadge}</td>
        <td><span class="badge ${p.isActive ? 'badge-success' : 'badge-neutral'}">${p.isActive ? 'Active' : 'Inactive'}</span></td>
        ${isAdmin ? `<td>
          <div style="display:flex;gap:4px;">
            <button class="btn-icon" title="Edit" onclick="Products.showProductModal('${p._id}')">✏</button>
            <button class="btn-icon" title="Adjust Stock" onclick="Products.showStockModal('${p._id}')">📦</button>
            <button class="btn-icon" title="Delete" onclick="Products.deleteProduct('${p._id}','${escapeHTML(p.name)}')" style="color:var(--c-red);">🗑</button>
          </div>
        </td>` : ''}
      </tr>`;
    }).join('')}
  </tbody>
</table></div>`;

    // Pagination
    if (pagination) {
      const { pages, page } = pagination;
      const pag = document.getElementById('pagination');
      if (pag && pages > 1) {
        pag.innerHTML = Array.from({ length: pages }, (_, i) => i + 1)
          .map(p => `<button class="btn ${p === page ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="Products.loadProducts(${p})">${p}</button>`)
          .join('');
      }
    }
  };

  // ── Product Modal (Add/Edit) ────────────────────────────────────────────────
  const showProductModal = async (productId = null) => {
    let product = null;
    if (productId) {
      try {
        const res = await API.get(`/products/${productId}`);
        product = res.data;
        editingProduct = product;
      } catch { return Toast.show('Failed to load product', 'error'); }
    } else {
      editingProduct = null;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'product-modal';
    modal.innerHTML = `
<div class="modal" style="max-width:520px;">
  <div class="modal-header">
    <span class="modal-title">${product ? '✏ Edit Product' : '+ New Product'}</span>
    <button class="btn-icon" onclick="document.getElementById('product-modal').remove()">✕</button>
  </div>
  <div class="modal-body">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label">Product Name *</label>
        <input type="text" class="form-input" id="p-name" value="${escapeHTML(product?.name || '')}" placeholder="e.g. Iced Coffee" required>
      </div>
      <div class="form-group">
        <label class="form-label">Price (₱) *</label>
        <input type="number" class="form-input" id="p-price" value="${product?.price || ''}" placeholder="0.00" min="0" step="0.01">
      </div>
      <div class="form-group">
        <label class="form-label">Cost (₱)</label>
        <input type="number" class="form-input" id="p-cost" value="${product?.cost || ''}" placeholder="0.00" min="0" step="0.01">
      </div>
      <div class="form-group">
        <label class="form-label">Category *</label>
        <select class="form-select" id="p-category">
          <option value="">Select Category</option>
          ${categories.map(c => `<option value="${c._id}" ${product?.category?._id === c._id || product?.category === c._id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Unit</label>
        <input type="text" class="form-input" id="p-unit" value="${product?.unit || 'pcs'}" placeholder="pcs">
      </div>
      <div class="form-group">
        <label class="form-label">SKU</label>
        <input type="text" class="form-input" id="p-sku" value="${product?.sku || ''}" placeholder="AUTO-001">
      </div>
      <div class="form-group">
        <label class="form-label">Barcode</label>
        <input type="text" class="form-input" id="p-barcode" value="${product?.barcode || ''}" placeholder="1234567890">
      </div>
      ${!product ? `
      <div class="form-group">
        <label class="form-label">Initial Stock</label>
        <input type="number" class="form-input" id="p-stock" value="0" min="0">
      </div>
      <div class="form-group">
        <label class="form-label">Low Stock Alert</label>
        <input type="number" class="form-input" id="p-low-stock" value="10" min="0">
      </div>` : ''}
      <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="p-desc" placeholder="Optional description...">${product?.description || ''}</textarea>
      </div>
    </div>
    <div id="product-modal-error" class="form-error hidden"></div>
  </div>
  <div class="modal-footer">
    <button class="btn btn-ghost" onclick="document.getElementById('product-modal').remove()">Cancel</button>
    <button class="btn btn-primary" onclick="Products.saveProduct('${productId || ''}')">
      ${product ? 'Update Product' : 'Create Product'}
    </button>
  </div>
</div>`;
    document.body.appendChild(modal);
  };

  const saveProduct = async (productId) => {
    const name = document.getElementById('p-name').value.trim();
    const price = parseFloat(document.getElementById('p-price').value);
    const cost = parseFloat(document.getElementById('p-cost').value) || 0;
    const category = document.getElementById('p-category').value;
    const errEl = document.getElementById('product-modal-error');

    if (!name || !price || !category) {
      errEl.textContent = 'Name, price, and category are required';
      errEl.classList.remove('hidden');
      return;
    }

    const data = {
      name,
      price,
      cost,
      category,
      unit: document.getElementById('p-unit').value || 'pcs',
      sku: document.getElementById('p-sku').value || undefined,
      barcode: document.getElementById('p-barcode').value || undefined,
      description: document.getElementById('p-desc').value || undefined,
      ...(!productId && {
        stock: parseInt(document.getElementById('p-stock')?.value) || 0,
        lowStockThreshold: parseInt(document.getElementById('p-low-stock')?.value) || 10,
      }),
    };

    try {
      if (productId) {
        await API.put(`/products/${productId}`, data);
        Toast.show('Product updated', 'success');
      } else {
        await API.post('/products', data);
        Toast.show('Product created', 'success');
      }
      document.getElementById('product-modal').remove();
      loadProducts();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  };

  const showStockModal = (productId) => {
    const product = products.find(p => p._id === productId);
    if (!product) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'stock-modal';
    modal.innerHTML = `
<div class="modal" style="max-width:360px;">
  <div class="modal-header">
    <span class="modal-title">📦 Adjust Stock</span>
    <button class="btn-icon" onclick="document.getElementById('stock-modal').remove()">✕</button>
  </div>
  <div class="modal-body">
    <p class="text-sm text-muted mb-md">Product: <strong>${escapeHTML(product.name)}</strong></p>
    <p class="text-sm mb-md">Current Stock: <strong class="text-mono">${product.stock} ${product.unit}</strong></p>
    <div class="form-group">
      <label class="form-label">Adjustment (+ to add, - to deduct)</label>
      <input type="number" class="form-input" id="stock-adj" placeholder="e.g. +50 or -10" style="font-family:var(--font-mono);">
    </div>
    <div class="form-group">
      <label class="form-label">Reason (optional)</label>
      <input type="text" class="form-input" id="stock-reason" placeholder="Restock, damaged, etc.">
    </div>
    <div id="stock-modal-error" class="form-error hidden"></div>
  </div>
  <div class="modal-footer">
    <button class="btn btn-ghost" onclick="document.getElementById('stock-modal').remove()">Cancel</button>
    <button class="btn btn-primary" onclick="Products.saveStockAdjustment('${productId}')">Apply</button>
  </div>
</div>`;
    document.body.appendChild(modal);
  };

  const saveStockAdjustment = async (productId) => {
    const adjustment = parseInt(document.getElementById('stock-adj').value);
    const reason = document.getElementById('stock-reason').value;
    const errEl = document.getElementById('stock-modal-error');

    if (isNaN(adjustment) || adjustment === 0) {
      errEl.textContent = 'Please enter a valid adjustment value';
      errEl.classList.remove('hidden');
      return;
    }

    try {
      await API.patch(`/products/${productId}/stock`, { adjustment, reason });
      Toast.show(`Stock adjusted by ${adjustment > 0 ? '+' : ''}${adjustment}`, 'success');
      document.getElementById('stock-modal').remove();
      loadProducts();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  };

  const deleteProduct = async (productId, name) => {
    if (!confirm(`Deactivate "${name}"? It will be hidden but data preserved.`)) return;
    try {
      await API.delete(`/products/${productId}`);
      Toast.show('Product deactivated', 'success');
      loadProducts();
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  };

  const search = (val) => {
    currentSearch = val;
    clearTimeout(search._t);
    search._t = setTimeout(() => loadProducts(1), 300);
  };

  const filterCat = (catId) => {
    currentCategory = catId;
    loadProducts(1);
  };

  const filterStatus = (status) => {
    // Reload with status filter
    loadProducts(1);
  };

  return {
    render, loadProducts, showProductModal, saveProduct,
    showStockModal, saveStockAdjustment, deleteProduct,
    search, filterCat, filterStatus,
  };
})();
