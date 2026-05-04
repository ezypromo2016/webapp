/**
 * Transactions Module
 * Transaction history, void, receipt reprint
 */

const Transactions = (() => {
  let currentPage = 1;

  const formatCurrency = (n) =>
    '₱' + parseFloat(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (d) => new Date(d).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const render = async (highlightId = null) => {
    document.getElementById('app').innerHTML = `
<div class="main-layout">
  ${renderSidebar('transactions')}
  <div class="content-area">
    ${renderTopbar('Transaction History')}
    <div class="page-content page">
      
      <!-- Filters -->
      <div class="card mb-md" style="padding:var(--gap-md);">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
          <div class="input-group" style="flex:1;min-width:200px;">
            <span class="input-icon">🔍</span>
            <input type="search" class="form-input" id="txn-search" placeholder="Search TXN#, customer..."
              oninput="Transactions.search(this.value)">
          </div>
          <input type="date" class="form-input" id="date-from" style="width:150px;" onchange="Transactions.reload()">
          <input type="date" class="form-input" id="date-to" style="width:150px;" onchange="Transactions.reload()">
          <select class="form-select" style="width:130px;" id="status-filter" onchange="Transactions.reload()">
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="voided">Voided</option>
            <option value="refunded">Refunded</option>
          </select>
          <select class="form-select" style="width:120px;" id="payment-filter" onchange="Transactions.reload()">
            <option value="">All Payment</option>
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="card">Card</option>
          </select>
        </div>
      </div>
      
      <!-- Table -->
      <div class="card" style="padding:0;">
        <div id="txn-table">
          <div style="padding:40px;text-align:center;"><div class="spinner" style="margin:0 auto;"></div></div>
        </div>
      </div>
      
      <div id="txn-pagination" style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;"></div>
    </div>
  </div>
</div>`;

    await loadTransactions();
    if (highlightId) setTimeout(() => showTransactionDetail(highlightId), 300);
  };

  const loadTransactions = async (page = 1) => {
    currentPage = page;
    const params = {
      page,
      limit: 20,
      search: document.getElementById('txn-search')?.value || undefined,
      startDate: document.getElementById('date-from')?.value || undefined,
      endDate: document.getElementById('date-to')?.value || undefined,
      status: document.getElementById('status-filter')?.value || undefined,
      paymentMethod: document.getElementById('payment-filter')?.value || undefined,
    };

    try {
      console.log('[Transactions] Loading transactions online...');
      const res = await API.get('/transactions', params);
      console.log('[Transactions] ✓ Loaded online transactions:', res.data.length);
      renderTable(res.data, res.pagination);
    } catch (err) {
      console.log('[Transactions] ✗ Online transactions failed:', err.message);
      // For transactions, we can't easily cache filtered results, so show a message
      Toast.show('⚠ Transaction history not available offline. Connect to internet to view transactions.', 'warning');
      renderTable([], { page: 1, pages: 1, total: 0 });
    }
  };

  const renderTable = (txns, pagination) => {
    document.getElementById('txn-table').innerHTML = txns.length === 0
      ? '<p style="padding:40px;text-align:center;color:var(--c-text-3);">No transactions found</p>'
      : `<div class="table-container" style="border:none;border-radius:0;">
<table>
  <thead><tr>
    <th>TXN#</th><th>Date & Time</th><th>Cashier</th><th>Items</th>
    <th>Total</th><th>Payment</th><th>Status</th><th>Actions</th>
  </tr></thead>
  <tbody>
    ${txns.map(t => `
    <tr onclick="Transactions.showTransactionDetail('${t._id}')" style="cursor:pointer;">
      <td class="text-mono text-sm">${t.transactionNumber}</td>
      <td class="text-sm">${formatDate(t.createdAt)}</td>
      <td>${escapeHTML(t.cashier?.name || t.cashierName || '-')}</td>
      <td class="text-mono">${t.items?.reduce((s, i) => s + i.quantity, 0) || 0}</td>
      <td class="text-mono fw-bold">${formatCurrency(t.total)}</td>
      <td><span class="badge badge-info">${t.paymentMethod?.toUpperCase()}</span></td>
      <td><span class="badge ${t.status === 'completed' ? 'badge-success' : t.status === 'voided' ? 'badge-danger' : 'badge-warning'}">${t.status}</span></td>
      <td onclick="event.stopPropagation()">
        <div style="display:flex;gap:4px;">
          <button class="btn-icon" title="View Receipt" onclick="Transactions.showTransactionDetail('${t._id}')">👁</button>
          ${t.status === 'completed' && Auth.isAdmin() ? `<button class="btn-icon" title="Void" onclick="Transactions.voidTransaction('${t._id}')" style="color:var(--c-red);">⛔</button>` : ''}
        </div>
      </td>
    </tr>`).join('')}
  </tbody>
</table></div>`;

    const pag = document.getElementById('txn-pagination');
    if (pag && pagination && pagination.pages > 1) {
      pag.innerHTML = Array.from({ length: pagination.pages }, (_, i) => i + 1)
        .map(p => `<button class="btn ${p === pagination.page ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="Transactions.loadTransactions(${p})">${p}</button>`)
        .join('');
    }
  };

  const showTransactionDetail = async (txnId) => {
    try {
      const res = await API.get(`/transactions/${txnId}`);
      const t = res.data;
      const bizInfo = {
        name: window._POS_CONFIG?.businessName || 'SwiftPOS Store',
        address: window._POS_CONFIG?.businessAddress || '',
        phone: window._POS_CONFIG?.businessPhone || '',
      };

      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
<div class="modal" style="max-width:420px;">
  <div class="modal-header">
    <span class="modal-title">📄 ${t.transactionNumber}</span>
    <button class="btn-icon" onclick="this.closest('.modal-overlay').remove()">✕</button>
  </div>
  <div class="modal-body">
    ${Receipt.buildHTML(t, bizInfo)}
  </div>
  <div class="modal-footer" style="flex-wrap:wrap;gap:8px;">
    <button class="btn btn-secondary" onclick="Receipt.print(window._viewTxn, ${JSON.stringify(bizInfo).replace(/"/g, '&quot;')})">🖨 Print</button>
    <button class="btn btn-secondary" onclick="Receipt.exportPDF(window._viewTxn, ${JSON.stringify(bizInfo).replace(/"/g, '&quot;')})">📄 PDF</button>
    ${t.status === 'completed' && Auth.isAdmin() ? `<button class="btn btn-danger btn-sm" onclick="Transactions.voidTransaction('${t._id}');this.closest('.modal-overlay').remove()">⛔ Void</button>` : ''}
    <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Close</button>
  </div>
</div>`;

      window._viewTxn = t;
      document.body.appendChild(modal);
    } catch (err) {
      Toast.show('Failed to load transaction', 'error');
    }
  };

  const voidTransaction = async (txnId) => {
    const reason = prompt('Reason for voiding this transaction?');
    if (!reason) return;
    try {
      await API.patch(`/transactions/${txnId}/void`, { reason });
      Toast.show('Transaction voided. Stock restored.', 'success');
      loadTransactions(currentPage);
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  };

  const search = (val) => {
    clearTimeout(search._t);
    search._t = setTimeout(() => loadTransactions(1), 300);
  };

  const reload = () => loadTransactions(1);

  return { render, loadTransactions, showTransactionDetail, voidTransaction, search, reload };
})();
