const Dashboard = (() => {
  const render = async () => {
    document.getElementById('app').innerHTML = `
      <div class="main-layout">
        <nav class="sidebar">
          <button onclick="App.navigate('dashboard')">Dashboard</button>
          <button onclick="App.navigate('products')">Products</button>
        </nav>
        <div class="content">
          <h1>Dashboard</h1>
          <p>Welcome, ${Auth.getUser()?.name || 'User'}</p>
        </div>
      </div>`;
  };
  return { render };
})();

window.Dashboard = Dashboard; // CRITICAL
