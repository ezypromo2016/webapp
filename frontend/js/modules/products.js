/**
 * Products Module
 * Handles product listing and UI rendering
 */
const Products = (() => {
  let products = [];

  const render = async () => {
    // Inject the layout structure into the main #app div
    const appEl = document.getElementById('app');
    if (!appEl) return;

    appEl.innerHTML = `
      <div class="main-layout">
        <div class="content-area">
          <div class="topbar">
            <h2 class="page-title">Products</h2>
            <button class="btn btn-primary btn-sm" onclick="Products.load()">Refresh List</button>
          </div>
          <div id="products-list" class="page-content">
            <p class="text-muted">Loading products...</p>
          </div>
        </div>
      </div>`;
    
    await load();
  };

  const load = async () => {
    try {
      const res = await API.get('/products');
      products = res.data || [];
      renderTable(products);
    } catch (err) {
      console.error('Products load error:', err);
      const listEl = document.getElementById('products-list');
      if (listEl) listEl.innerHTML = '<p class="text-error">Failed to load products.</p>';
    }
  };

  const renderTable = (items) => {
    const listEl = document.getElementById('products-list');
    if (!listEl) return;

    if (!items || items.length === 0) {
      listEl.innerHTML = '<p>No products available.</p>';
      return;
    }

    listEl.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr><th>Name</th><th>Price</th><th>Stock</th></tr>
          </thead>
          <tbody>
            ${items.map(p => `
              <tr>
                <td>${p.name}</td>
                <td>₱${p.price.toFixed(2)}</td>
                <td>${p.stock}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  };

  return { render, load };
})();

// CRITICAL: This line is mandatory to pass the (index) missing modules check
window.Products = Products;
