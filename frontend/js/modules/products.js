/**
 * Products Module
 * Handles product listing and management
 */
const Products = (() => {
  let products = [];

  // ── Main Render Function ──────────────────────────────────────────────────
  const render = async () => {
    // Inject the main layout structure into the app container[cite: 5]
    document.getElementById('app').innerHTML = `
      <div class="main-layout">
        <div class="content-area">
          <div class="topbar">
            <h2 class="page-title">Products</h2>
            ${Auth.isAdmin() ? '<button class="btn btn-primary btn-sm" onclick="Products.showModal()">+ Add Product</button>' : ''}
          </div>
          <div id="products-list" class="page-content">
            <div class="spinner"></div>
            <p>Loading products...</p>
          </div>
        </div>
      </div>`;
    
    await load(); // Fetch data after rendering the frame[cite: 5]
  };

  // ── Data Fetching ─────────────────────────────────────────────────────────
  const load = async () => {
    try {
      const res = await API.get('/products');
      products = res.data;
      renderTable(products);
    } catch (err) {
      console.error('Failed to load products:', err);
      const listEl = document.getElementById('products-list');
      if (listEl) listEl.innerHTML = '<p class="text-error">Error loading product data.</p>';
    }
  };

  // ── Sub-component Rendering ───────────────────────────────────────────────
  const renderTable = (items) => {
    const listEl = document.getElementById('products-list');
    if (!listEl) return;

    if (items.length === 0) {
      listEl.innerHTML = '<p class="text-muted">No products found.</p>';
      return;
    }

    listEl.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(p => `
              <tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.category || 'General'}</td>
                <td>₱${parseFloat(p.price).toFixed(2)}</td>
                <td>${p.stock} ${p.unit || 'pcs'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  };

  const showModal = () => {
    console.log("Add Product modal triggered");
    // Implementation for adding products goes here
  };

  return {
    render,
    load,
    showModal
  };
})();

// ── CRITICAL EXPORT ──────────────────────────────────────────────────────────
// This line allows app.js and index.html to "see" the Products object
window.Products = Products;
