const Inventory = (() => {
  const render = async () => {
    document.getElementById('app').innerHTML = `
      <div class="main-layout">
        ${renderSidebar('inventory')}
        <div class="content-area">
          ${renderTopbar('Inventory')}
          <div class="page-content" id="inv-stats">Loading...</div>
        </div>
      </div>`;
  };

  return { render };
})();

window.Inventory = Inventory;
