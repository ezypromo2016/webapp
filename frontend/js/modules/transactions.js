const Transactions = (() => {
  const render = async () => {
    document.getElementById('app').innerHTML = `
      <div class="main-layout">
        ${renderSidebar('transactions')}
        <div class="content-area">
          ${renderTopbar('History')}
          <div class="page-content" id="txn-table">Loading history...</div>
        </div>
      </div>`;
    await loadTransactions();
  };

  const loadTransactions = async () => {
    try {
      const res = await API.get('/transactions');
      document.getElementById('txn-table').innerHTML = `Count: ${res.data.length}`;
    } catch (err) {}
  };

  return { render, search: (v) => {}, reload: () => {} };
})();

window.Transactions = Transactions;
