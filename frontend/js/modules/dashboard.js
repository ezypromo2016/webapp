/**
 * Dashboard Module
 * KPI stats, sales charts, recent transactions
 */

const Dashboard = (() => {
  let salesChart = null;
  let paymentChart = null;

  const formatCurrency = (n) =>
    '₱' + parseFloat(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (d) => new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const render = async () => {
    const app = document.getElementById('app');
    app.innerHTML = `
<div class="main-layout">
  ${renderSidebar('dashboard')}
  <div class="content-area">
    ${renderTopbar('Dashboard')}
    <div class="page-content page">
      <div class="stats-grid" id="stats-grid">
        ${[1,2,3,4].map(() => `<div class="stat-card" style="--stat-color:var(--c-border2)"><div class="spinner spinner-sm"></div></div>`).join('')}
      </div>
      
      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Sales Overview</span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-ghost btn-sm" onclick="Dashboard.loadChart(7)" id="chart-7">7D</button>
              <button class="btn btn-primary btn-sm" onclick="Dashboard.loadChart(30)" id="chart-30">30D</button>
            </div>
          </div>
          <div class="chart-container"><canvas id="sales-chart"></canvas></div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <span class="card-title">Payment Methods</span>
          </div>
          <div class="chart-container"><canvas id="payment-chart"></canvas></div>
        </div>
      </div>
      
      <div style="margin-top:var(--gap-md);">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Recent Transactions</span>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('transactions')">View All →</button>
          </div>
          <div class="table-container" id="recent-txns">
            <div style="padding:24px;text-align:center;"><div class="spinner spinner-sm" style="margin:0 auto;"></div></div>
          </div>
        </div>
      </div>
      
      <div style="margin-top:var(--gap-md);">
        <div class="card">
          <div class="card-header">
            <span class="card-title">🔥 Top Products (30 days)</span>
          </div>
          <div id="top-products">
            <div style="padding:24px;text-align:center;"><div class="spinner spinner-sm" style="margin:0 auto;"></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;

    await loadData();
  };

  const loadData = async () => {
    try {
      const [summaryRes, chartRes, paymentRes] = await Promise.all([
        API.get('/dashboard/summary'),
        API.get('/dashboard/chart', { days: 30 }),
        API.get('/dashboard/payment-breakdown'),
      ]);

      renderStats(summaryRes.data);
      renderSalesChart(chartRes.data);
      renderPaymentChart(paymentRes.data);
      renderRecentTransactions(summaryRes.data.recentTransactions);
      renderTopProducts(summaryRes.data.topProducts);
    } catch (err) {
      Toast.show('Failed to load dashboard: ' + err.message, 'error');
    }
  };

  const renderStats = (data) => {
    const { today, week, month, inventory } = data;
    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card" style="--stat-color:var(--c-primary)">
        <div class="stat-label">Today's Sales</div>
        <div class="stat-value">${formatCurrency(today.totalSales)}</div>
        <div class="stat-sub">${today.totalTransactions} transaction(s)</div>
        <div class="stat-icon">💰</div>
      </div>
      <div class="stat-card" style="--stat-color:var(--c-green)">
        <div class="stat-label">This Week</div>
        <div class="stat-value">${formatCurrency(week.total)}</div>
        <div class="stat-sub">${week.count} transaction(s)</div>
        <div class="stat-icon">📅</div>
      </div>
      <div class="stat-card" style="--stat-color:var(--c-cyan)">
        <div class="stat-label">This Month</div>
        <div class="stat-value">${formatCurrency(month.total)}</div>
        <div class="stat-sub">${month.count} transaction(s)</div>
        <div class="stat-icon">📊</div>
      </div>
      <div class="stat-card" style="--stat-color:${inventory.outOfStockCount > 0 ? 'var(--c-red)' : 'var(--c-yellow)'}">
        <div class="stat-label">Inventory Alerts</div>
        <div class="stat-value">${inventory.lowStockCount + inventory.outOfStockCount}</div>
        <div class="stat-sub">${inventory.lowStockCount} low · ${inventory.outOfStockCount} out of stock</div>
        <div class="stat-icon">📦</div>
      </div>`;
  };

  const renderSalesChart = (data) => {
    if (salesChart) salesChart.destroy();
    const ctx = document.getElementById('sales-chart');
    if (!ctx) return;

    const labels = data.map(d => {
      const dt = new Date(d.date);
      return dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    });
    const values = data.map(d => d.total);

    salesChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Sales',
          data: values,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#6366f1',
          pointRadius: 3,
          pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => '₱' + ctx.parsed.y.toLocaleString('en-PH', { minimumFractionDigits: 2 }),
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#5a5a78', font: { size: 10 } },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#5a5a78',
              font: { size: 10 },
              callback: (v) => '₱' + v.toLocaleString(),
            },
          },
        },
      },
    });
  };

  const renderPaymentChart = (data) => {
    if (paymentChart) paymentChart.destroy();
    const ctx = document.getElementById('payment-chart');
    if (!ctx) return;

    const colors = { cash: '#22c55e', gcash: '#6366f1', card: '#06b6d4', mixed: '#f59e0b' };
    const labels = data.map(d => d._id?.toUpperCase());
    const values = data.map(d => d.total);
    const bgColors = data.map(d => colors[d._id] || '#9898b0');

    paymentChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: bgColors,
          borderColor: '#111118',
          borderWidth: 3,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#9898b0', font: { size: 11 }, padding: 16 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ₱${ctx.parsed.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
            },
          },
        },
        cutout: '65%',
      },
    });
  };

  const renderRecentTransactions = (txns) => {
    if (!txns || txns.length === 0) {
      document.getElementById('recent-txns').innerHTML = '<p style="padding:24px;text-align:center;color:var(--c-text-3);">No transactions yet</p>';
      return;
    }

    document.getElementById('recent-txns').innerHTML = `
<table>
  <thead><tr>
    <th>TXN#</th><th>Time</th><th>Cashier</th><th>Method</th><th>Total</th><th>Status</th>
  </tr></thead>
  <tbody>
    ${txns.map(t => `<tr onclick="App.navigate('transactions','${t._id}')" style="cursor:pointer;">
      <td class="text-mono">${t.transactionNumber}</td>
      <td class="text-sm">${formatDate(t.createdAt)}</td>
      <td>${t.cashier?.name || '-'}</td>
      <td><span class="badge badge-info">${t.paymentMethod}</span></td>
      <td class="text-mono fw-bold">${formatCurrency(t.total)}</td>
      <td><span class="badge badge-success">${t.status}</span></td>
    </tr>`).join('')}
  </tbody>
</table>`;
  };

  const renderTopProducts = (products) => {
    if (!products || products.length === 0) {
      document.getElementById('top-products').innerHTML = '<p style="padding:24px;text-align:center;color:var(--c-text-3);">No data yet</p>';
      return;
    }

    document.getElementById('top-products').innerHTML = `
<div style="padding:0 var(--gap-md) var(--gap-md);">
  ${products.map((p, i) => `
  <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--c-border);">
    <span style="font-family:var(--font-mono);font-size:1.2rem;color:var(--c-text-3);width:24px;">${i+1}</span>
    <div style="flex:1;">
      <div style="font-weight:500;font-size:0.875rem;">${p.name}</div>
      <div style="font-size:0.75rem;color:var(--c-text-3);">${p.totalQty} units sold</div>
    </div>
    <div class="text-mono fw-bold text-primary">${formatCurrency(p.totalRevenue)}</div>
  </div>`).join('')}
</div>`;
  };

  const loadChart = async (days) => {
    document.getElementById(`chart-${days === 7 ? 30 : 7}`)?.classList.replace('btn-primary', 'btn-ghost');
    document.getElementById(`chart-${days}`)?.classList.replace('btn-ghost', 'btn-primary');
    try {
      const res = await API.get('/dashboard/chart', { days });
      renderSalesChart(res.data);
    } catch (err) {
      Toast.show('Chart update failed', 'error');
    }
  };

  return { render, loadChart };
})();
