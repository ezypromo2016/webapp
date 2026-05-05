const Products = (() => {
  let products = [];

  const render = async () => {
    document.getElementById('app').innerHTML = `
      <div class="main-layout">
        ${renderSidebar('products')}
        <div class="content-area">
          ${renderTopbar('Products', Auth.isAdmin() ? '<button onclick="Products.showModal()">+ Add</button>' : '')}
          <div id="prod-list" class="page-content">Loading...</div>
        </div>
      </div>`;
    await load();
  };

  const load = async () => {
    try {
      const res = await API.get('/products');
      products = res.data;
      document.getElementById('prod-list').innerHTML = `
        <table>
          ${products.map(p => `<tr><td>${p.name}</td><td>₱${p.price}</td></tr>`).join('')}
        </table>`;
    } catch { Toast.show('Error loading products', 'error'); }
  };

  return { render, showModal: () => console.log("Modal opened") };
})();

window.Products = Products; // Export for index.html check[cite: 6, 8]
