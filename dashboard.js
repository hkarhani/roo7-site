// dashboard.js

const API_BASE = 'https://api.roo7.site';
let token = localStorage.getItem('access_token');

// === Auth Check ===
async function fetchUserProfile() {
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Unauthorized');
    const user = await res.json();
    document.getElementById('username-display').textContent = user.username;
    loadAccounts();
  } catch (err) {
    console.warn('Auth failed, redirecting to auth.html');
    localStorage.removeItem('access_token');
    window.location.href = '/auth.html';
  }
}

// === Logout ===
document.getElementById('logout-btn').onclick = () => {
  localStorage.removeItem('access_token');
  location.href = '/auth.html';
};

// === Load Accounts ===
async function loadAccounts() {
  const tableBody = document.querySelector('#account-table tbody');
  tableBody.innerHTML = '';
  const res = await fetch(`${API_BASE}/accounts`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const accounts = await res.json();

  let totalValue = 0;
  accounts.forEach(acc => {
    const row = document.createElement('tr');
    totalValue += acc.current_value || 0;

    row.innerHTML = `
      <td>${acc.account_name}</td>
      <td>${acc.strategy}</td>
      <td>$${acc.current_value.toFixed(2)}</td>
    `;
    tableBody.appendChild(row);
  });

  document.getElementById('total-value').textContent = `$${totalValue.toFixed(2)}`;
  renderAccountSettings(accounts);
}

// === Render Account Settings Table ===
function renderAccountSettings(accounts) {
  const settingsBody = document.querySelector('#account-settings-table tbody');
  settingsBody.innerHTML = '';

  accounts.forEach(acc => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${acc.account_name}</td>
      <td>
        <button class="edit-btn" data-id="${acc.id}">✏️</button>
        <button class="delete-btn" data-id="${acc.id}">🗑️</button>
      </td>
    `;
    settingsBody.appendChild(row);
  });
}

// === Modal ===
const modal = document.getElementById('account-modal');
const form = document.getElementById('account-form');

// Open Modal
window.openAddModal = () => {
  form.reset();
  modal.style.display = 'block';
};

// Close Modal
window.closeModal = () => {
  modal.style.display = 'none';
};

// === Submit New Account ===
form.onsubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(form);

  const data = {
    account_name: formData.get('account_name'),
    api_key: formData.get('api_key'),
    api_secret: formData.get('api_secret'),
    strategy: formData.get('strategy'),
    hedge_percent: parseFloat(formData.get('hedge_percent')) || 0.0,
    custom_portfolio: []
  };

  if (data.strategy === 'Custom Portfolio Rebalancing') {
    document.querySelectorAll('.custom-asset-row').forEach(row => {
      const symbol = row.querySelector('.symbol').value;
      const weight = parseFloat(row.querySelector('.weight').value);
      if (symbol && weight) data.custom_portfolio.push({ symbol, weight });
    });
  }

  const res = await fetch(`${API_BASE}/accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    closeModal();
    loadAccounts();
  } else {
    alert('Failed to add account');
  }
};

// === Toggle Custom Portfolio ===
document.getElementById('strategy').onchange = (e) => {
  const portfolioDiv = document.getElementById('custom-portfolio');
  portfolioDiv.style.display = (e.target.value === 'Custom Portfolio Rebalancing') ? 'block' : 'none';
};

// === Add Instrument Row ===
window.addPortfolioRow = () => {
  const container = document.getElementById('portfolio-list');
  const row = document.createElement('div');
  row.className = 'custom-asset-row';
  row.innerHTML = `
    <input class="symbol" placeholder="Symbol (e.g. BTCUSDT)" />
    <input class="weight" placeholder="Weight %" type="number" />
    <button onclick="this.parentNode.remove()">❌</button>
  `;
  container.appendChild(row);
};

// === Init ===
window.onload = fetchUserProfile;
