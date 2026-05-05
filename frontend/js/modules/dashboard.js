const Dashboard = (() => {
  let salesChart = null;
  let paymentChart = null;

  const formatCurrency = (n) => '₱' + parseFloat(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

  const render = async () => {
    document.getElementById('app').innerHTML = `
      <div class="main-layout">
        ${renderSidebar('dashboard')}
        <div class="content-area">
          ${renderTopbar('Dashboard')}
          <div class="page-content page">
            <div class="stats-grid" id="stats-grid">Loading stats...</div>
            <div class="dashboard-grid">
              <div class="card"><canvas id="sales-chart"></canvas></div>
              <div class="card"><canvas id="payment-chart"></canvas></div>
            </div>
          </div>
        </div>
      </div>`;
    await loadData();
  };

  const loadData = async () => {
    try {
      const summary = await API.get('/dashboard/summary');
      renderStats(summary.data);
    } catch (err) {
      Toast.show('Dashboard error: ' + err.message, 'error');
    }
  };

  const renderStats = (data) => {
    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card" style="--stat-color:var(--c-primary)">
        <div class="stat-label">Today's Sales</div>
        <div class="stat-value">${formatCurrency(data.today.totalSales)}</div>
      </div>`;
  };

  return { render, loadChart: async (days) => {} };
})();

window.Dashboard = Dashboard;
