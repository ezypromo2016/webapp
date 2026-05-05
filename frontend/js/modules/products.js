const Products = (() => {
  let products = [];
  let categories = [];

  const render = async () => {
    document.getElementById('app').innerHTML = `
<div class="main-layout">
  ${renderSidebar('products')}
  <div class="content-area">
    ${renderTopbar('Products', Auth.isAdmin() ? `<button class="btn btn-primary btn-sm" onclick="Products.showProductModal()">+ Add Product</button>` : '')}
    <div class="page-content page">
      <div id="products-table">Loading...</div>
    </div>
  </div>
</div>`;
    await loadProducts();
  };

  const loadProducts = async () => {
    try {
      const res = await API.get('/products');
      products = res.data;
      renderTable(products);
    } catch (err) {
      Toast.show('Failed to load products', 'error');
    }
  };

  const renderTable = (prods) => {
    const isAdmin = Auth.isAdmin();
    document.getElementById('products-table').innerHTML = `
<div class="table-container">
<table>
  <thead><tr><th>Product</th><th>Price</th><th>Stock</th>${isAdmin ? '<th>Actions</th>' : ''}</tr></thead>
  <tbody>
    ${prods.map(p => `
      <tr>
        <td>${p.name}</td>
        <td>₱${p.price.toFixed(2)}</td>
        <td>${p.stock} ${p.unit}</td>
        ${isAdmin ? `<td>
          <button class="btn-icon" onclick="Products.showProductModal('${p._id}')">✏</button>
          <button class="btn-icon" onclick="Products.deleteProduct('${p._id}', '${p.name}')">🗑</button>
        </td>` : ''}
      </tr>`).join('')}
  </tbody>
</table></div>`;
  };

  const showProductModal = async (id = null) => {
    // Modal logic here...
    console.log("Opening modal for ID:", id);
  };

  const deleteProduct = async (id, name) => {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await API.delete(`/products/${id}`);
      Toast.show('Product deleted', 'success');
      loadProducts();
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  };

  return { render, loadProducts, showProductModal, deleteProduct };
})();

window.Products = Products;
