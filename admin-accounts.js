import CONFIG from './frontend-config.js';

const INVOICING_API_BASE = CONFIG.API_CONFIG.invoicingUrl;
const AUTH_API_BASE = CONFIG.API_CONFIG.authUrl;

console.log('🔧 Admin Accounts Debug Info:');
console.log('INVOICING_API_BASE:', INVOICING_API_BASE);
console.log('AUTH_API_BASE:', AUTH_API_BASE);
console.log('Config loaded:', CONFIG);
console.log('🔧 Full API Config:', CONFIG.API_CONFIG);

let token = null;
let allAccounts = [];
let filteredAccounts = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize theme
  initializeTheme();
  
  // Get token from localStorage
  token = localStorage.getItem('token');
  console.log('🔑 Token from localStorage:', token ? 'Present' : 'Missing');
  if (!token) {
    console.log('❌ No token found, redirecting to auth...');
    window.location.href = '/auth.html';
    return;
  }

  // Verify admin access first
  console.log('🔐 Verifying admin access...');
  try {
    const userResponse = await fetch(`${AUTH_API_BASE}/me`, {
      headers: getAuthHeaders(token)
    });
    
    console.log('🔐 User verification status:', userResponse.status);
    
    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log('👤 Current user data:', userData);
      console.log('👤 Is admin:', userData.is_admin);
      
      if (!userData.is_admin) {
        console.log('❌ User is not admin, redirecting...');
        showToast('Access denied: Admin privileges required', 'error');
        setTimeout(() => window.location.href = '/dashboard.html', 2000);
        return;
      }
    } else {
      console.log('❌ User verification failed, status:', userResponse.status);
      const errorText = await userResponse.text();
      console.log('❌ Auth error response:', errorText);
      window.location.href = '/auth.html';
      return;
    }
  } catch (error) {
    console.error('❌ Admin verification error:', error);
    window.location.href = '/auth.html';
    return;
  }

  // Initialize event listeners
  initializeEventListeners();
  
  // Load accounts
  await loadAccounts();
});

function initializeEventListeners() {
  console.log('🔧 Initializing event listeners...');
  
  // Navigation
  const backBtn = document.getElementById('back-to-dashboard');
  console.log('📤 Back button found:', !!backBtn);
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      console.log('📤 Back to dashboard clicked');
      window.location.href = '/admin-dashboard.html';
    });
  }

  // Theme toggle
  const themeToggle = document.getElementById('toggle-theme');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  console.log('🚪 Logout button found:', !!logoutBtn);
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      console.log('🚪 Logout button clicked');
      localStorage.removeItem('token');
      window.location.href = '/auth.html';
    });
  }

  // Filter controls
  const applyFiltersBtn = document.getElementById('apply-account-filters');
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', applyFilters);
  }

  const clearFiltersBtn = document.getElementById('clear-account-filters');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', clearFilters);
  }

  // Search input
  const searchInput = document.getElementById('search-account');
  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  // Modal close buttons
  const closeAccountModal = document.getElementById('close-account-modal');
  if (closeAccountModal) {
    closeAccountModal.addEventListener('click', () => {
      document.getElementById('account-modal').style.display = 'none';
    });
  }

  const closeTroubleshootModal = document.getElementById('close-troubleshoot-modal');
  if (closeTroubleshootModal) {
    closeTroubleshootModal.addEventListener('click', () => {
      document.getElementById('troubleshoot-modal').style.display = 'none';
    });
  }

  const closeDetailedTroubleshootModal = document.getElementById('close-detailed-troubleshoot-modal');
  if (closeDetailedTroubleshootModal) {
    closeDetailedTroubleshootModal.addEventListener('click', () => {
      document.getElementById('detailed-troubleshoot-modal').style.display = 'none';
    });
  }

  // Modal action buttons
  const troubleshootBtn = document.getElementById('troubleshoot-account');
  if (troubleshootBtn) {
    troubleshootBtn.addEventListener('click', troubleshootCurrentAccount);
  }

  const detailedTroubleshootBtn = document.getElementById('detailed-troubleshoot-account');
  if (detailedTroubleshootBtn) {
    detailedTroubleshootBtn.addEventListener('click', detailedTroubleshootCurrentAccount);
  }

  const verifyBtn = document.getElementById('verify-account');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', verifyCurrentAccount);
  }

  const disableBtn = document.getElementById('disable-account');
  if (disableBtn) {
    disableBtn.addEventListener('click', disableCurrentAccount);
  }

  const enableBtn = document.getElementById('enable-account');
  if (enableBtn) {
    enableBtn.addEventListener('click', enableCurrentAccount);
  }
}

// Theme functions
function initializeTheme() {
  const isDark = localStorage.getItem('theme') === 'dark';
  document.body.className = isDark ? 'dark-theme' : '';
}

function toggleTheme() {
  const isDark = document.body.classList.contains('dark-theme');
  document.body.className = isDark ? '' : 'dark-theme';
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

// Auth helper
function getAuthHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };
}

// Load accounts from API
async function loadAccounts() {
  try {
    const fullUrl = `${INVOICING_API_BASE}/admin/accounts`;
    console.log('🔄 Loading accounts from:', fullUrl);
    console.log('🔑 Token present:', !!token);
    console.log('🔑 Token preview:', token ? token.substring(0, 20) + '...' : 'none');
    
    // Test network connectivity first
    console.log('🌐 Testing network connectivity...');
    try {
      const testResponse = await fetch('https://api.roo7.site:8003/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('🌐 Health check status:', testResponse.status);
    } catch (healthError) {
      console.error('🌐 Health check failed:', healthError.message);
    }
    
    const headers = getAuthHeaders(token);
    console.log('📤 Request headers:', headers);
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: headers,
      mode: 'cors'
    });

    console.log('📡 API Response Status:', response.status);
    console.log('📡 API Response Headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Accounts data received:', data);
      console.log('📊 Number of accounts:', data.accounts ? data.accounts.length : 0);
      
      // Debug: Log first account to see data structure
      if (data.accounts && data.accounts.length > 0) {
        console.log('🔍 First account debug data:', data.accounts[0]);
        console.log('🔍 Portfolio value:', data.accounts[0].portfolio_value);
        console.log('🔍 Test status:', data.accounts[0].test_status);
        console.log('🔍 Status:', data.accounts[0].status);
        console.log('🔍 Full name:', data.accounts[0].full_name);
      }
      
      allAccounts = data.accounts || [];
      filteredAccounts = [...allAccounts];
      displayAccounts();
    } else {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }
  } catch (error) {
    console.error('❌ Error loading accounts:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack || 'No stack trace available');
    
    // Show more specific error messages
    if (error.name === 'TypeError' && error.message.includes('NetworkError')) {
      showToast('Network error - check if API server is running and accessible', 'error');
    } else {
      showToast(`Failed to load accounts: ${error.message}`, 'error');
    }
  }
}

// Display accounts in table
function displayAccounts() {
  const tbody = document.querySelector('#accounts-table tbody');
  
  if (filteredAccounts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-message">No accounts found</td></tr>';
    return;
  }

  tbody.innerHTML = filteredAccounts.map(account => `
    <tr>
      <td><strong>${account.account_name || 'Unknown Account'}</strong></td>
      <td>${account.username || 'N/A'}</td>
      <td>${account.email || 'N/A'}</td>
      <td><span class="exchange-badge">${account.exchange || 'N/A'}</span></td>
      <td><span class="status-badge status-${account.test_status === 'successful' ? 'active' : account.test_status === 'failed' ? 'inactive' : 'disabled'}">${account.test_status || 'inactive'}</span></td>
      <td>$${(account.portfolio_value || 0).toFixed(2)}</td>
      <td class="account-actions">
        <button class="account-action-btn" onclick="viewAccountDetails('${account.account_id}')">
          👁️ View
        </button>
        <button class="account-action-btn troubleshoot" onclick="troubleshootAccount('${account.account_id}')">
          🔧 Troubleshoot
        </button>
        <span class="status-badge status-${account.test_status === 'successful' ? 'active' : account.test_status === 'failed' ? 'inactive' : 'disabled'}" style="font-size: 10px; margin-left: 5px;">
          ${account.test_status || 'N/A'}
        </span>
      </td>
    </tr>
  `).join('');
}

// Filter functions
function applyFilters() {
  const searchTerm = document.getElementById('search-account').value.toLowerCase();
  const statusFilter = document.getElementById('account-status-filter').value;
  const verificationFilter = document.getElementById('verification-filter').value;

  filteredAccounts = allAccounts.filter(account => {
    // Search filter
    const matchesSearch = !searchTerm || 
      (account.username || '').toLowerCase().includes(searchTerm) ||
      (account.email || '').toLowerCase().includes(searchTerm) ||
      (account.account_name || '').toLowerCase().includes(searchTerm);

    // Status filter
    const matchesStatus = !statusFilter || account.status === statusFilter;

    // Verification filter
    let matchesVerification = true;
    if (verificationFilter === 'verified') {
      matchesVerification = account.email_verified === true;
    } else if (verificationFilter === 'unverified') {
      matchesVerification = account.email_verified === false;
    }

    return matchesSearch && matchesStatus && matchesVerification;
  });

  displayAccounts();
}

function clearFilters() {
  document.getElementById('search-account').value = '';
  document.getElementById('account-status-filter').value = '';
  document.getElementById('verification-filter').value = '';
  filteredAccounts = [...allAccounts];
  displayAccounts();
}

// Account actions
let currentAccount = null;

window.viewAccountDetails = function(accountId) {
  currentAccount = allAccounts.find(acc => acc.account_id === accountId);
  if (!currentAccount) return;

  const modal = document.getElementById('account-modal');
  const detailsContainer = document.getElementById('account-details');
  
  detailsContainer.innerHTML = `
    <div class="detail-group">
      <h4>User Information</h4>
      <div class="detail-item">
        <span class="detail-label">Username:</span>
        <span class="detail-value">${currentAccount.username || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Email:</span>
        <span class="detail-value">${currentAccount.email || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Full Name:</span>
        <span class="detail-value">${currentAccount.full_name || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Email Verified:</span>
        <span class="detail-value">${currentAccount.email_verified ? 'Yes' : 'No'}</span>
      </div>
    </div>
    <div class="detail-group">
      <h4>Account Information</h4>
      <div class="detail-item">
        <span class="detail-label">Account Name:</span>
        <span class="detail-value">${currentAccount.account_name || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Exchange:</span>
        <span class="detail-value">${currentAccount.exchange || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Account Type:</span>
        <span class="detail-value">${currentAccount.account_type || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Test Status:</span>
        <span class="detail-value">${currentAccount.test_status || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Last Test:</span>
        <span class="detail-value">${currentAccount.last_test_date ? formatDate(currentAccount.last_test_date) : 'Never'}</span>
      </div>
    </div>
    <div class="detail-group">
      <h4>Portfolio Information</h4>
      <div class="detail-item">
        <span class="detail-label">Portfolio Value:</span>
        <span class="detail-value">$${(currentAccount.portfolio_value || 0).toFixed(2)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Troubleshoot Count:</span>
        <span class="detail-value">${currentAccount.troubleshoot_count || 0}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Created:</span>
        <span class="detail-value">${formatDate(currentAccount.created_at)}</span>
      </div>
    </div>
  `;

  // Show/hide action buttons based on account status
  const disableBtn = document.getElementById('disable-account');
  const enableBtn = document.getElementById('enable-account');
  
  if (currentAccount.status === 'disabled') {
    disableBtn.style.display = 'none';
    enableBtn.style.display = 'inline-block';
  } else {
    disableBtn.style.display = 'inline-block';
    enableBtn.style.display = 'none';
  }

  modal.style.display = 'block';
};

window.troubleshootAccount = async function(accountId) {
  showToast('Starting account troubleshoot...', 'info');
  
  try {
    const troubleshootUrl = `${AUTH_API_BASE}/troubleshoot/${accountId}`;
    console.log('🔧 Troubleshoot URL:', troubleshootUrl);
    
    const response = await fetch(troubleshootUrl, {
      method: 'POST',
      headers: getAuthHeaders(token)
    });

    if (response.ok) {
      const result = await response.json();
      showTroubleshootResults(result);
      showToast('Troubleshoot completed successfully!', 'success');
      await loadAccounts(); // Reload to see updated status
    } else {
      const error = await response.json();
      showToast(`Troubleshoot failed: ${error.detail}`, 'error');
    }
  } catch (error) {
    console.error('Error troubleshooting account:', error);
    showToast('Error troubleshooting account', 'error');
  }
};

window.detailedTroubleshootAccount = async function(accountId) {
  showToast('Starting detailed account analysis...', 'info');
  
  try {
    const response = await fetch(`${INVOICING_API_BASE}/admin/accounts/${accountId}/troubleshoot`, {
      method: 'POST',
      headers: getAuthHeaders(token)
    });

    if (response.ok) {
      const result = await response.json();
      showDetailedTroubleshootResults(result);
      showToast('Detailed analysis completed successfully!', 'success');
    } else {
      const error = await response.json();
      showToast(`Detailed analysis failed: ${error.detail}`, 'error');
    }
  } catch (error) {
    console.error('Error performing detailed analysis:', error);
    showToast('Error performing detailed analysis', 'error');
  }
};

function showTroubleshootResults(result) {
  const modal = document.getElementById('troubleshoot-modal');
  const resultsContainer = document.getElementById('troubleshoot-results');
  
  const statusClass = result.success ? 'result-success' : 'result-error';
  
  resultsContainer.innerHTML = `
    <div class="result-section ${statusClass}">
      <h4>Troubleshoot Summary</h4>
      <p><strong>Account:</strong> ${result.account_name || 'N/A'}</p>
      <p><strong>Status:</strong> ${result.success ? 'Success' : 'Failed'}</p>
      <p><strong>Test Status:</strong> ${result.test_status || 'N/A'}</p>
      <p><strong>API Key Valid:</strong> ${result.api_key_valid ? 'Yes' : 'No'}</p>
      <p><strong>IP Whitelisted:</strong> ${result.ip_whitelisted ? 'Yes' : 'No'}</p>
      <p><strong>Total Value:</strong> $${(result.total_usdt_value || 0).toFixed(2)}</p>
    </div>
    
    ${result.test_results && result.test_results.length > 0 ? `
      <div class="result-section">
        <h4>Test Results</h4>
        ${result.test_results.map(test => `
          <div class="result-section ${test.success ? 'result-success' : 'result-error'}">
            <strong>${test.stage}:</strong> ${test.message}
            ${test.details ? `<br><small>${test.details}</small>` : ''}
          </div>
        `).join('')}
      </div>
    ` : ''}
    
    ${result.recommendations && result.recommendations.length > 0 ? `
      <div class="result-section result-warning">
        <h4>Recommendations</h4>
        <ul>
          ${result.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  `;

  modal.style.display = 'block';
}

function showDetailedTroubleshootResults(result) {
  const modal = document.getElementById('detailed-troubleshoot-modal');
  const resultsContainer = document.getElementById('detailed-troubleshoot-results');
  
  const statusClass = result.success ? 'result-success' : 'result-error';
  
  resultsContainer.innerHTML = `
    <div class="result-section ${statusClass}">
      <h4>📊 Account Summary</h4>
      <div class="summary-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin: 15px 0;">
        <div class="summary-card">
          <strong>Account Name:</strong> ${result.account_summary.account_name}<br>
          <strong>Exchange:</strong> ${result.account_summary.exchange}<br>
          <strong>Test Status:</strong> ${result.account_summary.test_status}<br>
          <strong>Total USDT Value:</strong> $${(result.account_summary.total_usdt_value || 0).toFixed(2)}
        </div>
        <div class="summary-card">
          <strong>API Key Valid:</strong> ${result.account_summary.api_key_valid ? '✅ Yes' : '❌ No'}<br>
          <strong>IP Whitelisted:</strong> ${result.account_summary.ip_whitelisted ? '✅ Yes' : '❌ No'}<br>
          <strong>Analysis Time:</strong> ${new Date(result.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
    
    ${result.detailed_data.spot_account && Object.keys(result.detailed_data.spot_account).length > 0 ? `
      <div class="result-section">
        <h4>💰 SPOT Account</h4>
        <div class="account-details" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
          ${result.detailed_data.spot_account.balances ? `
            <h5>Assets:</h5>
            <div style="max-height: 200px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #e9ecef;">
                    <th style="padding: 8px; border: 1px solid #ddd;">Asset</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Free</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Locked</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">USDT Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${result.detailed_data.spot_account.balances.map(balance => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;">${balance.asset}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(balance.free || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(balance.locked || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">$${(balance.usdt_value || 0).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p>No SPOT balances found</p>'}
        </div>
      </div>
    ` : ''}
    
    ${result.detailed_data.usdm_account && Object.keys(result.detailed_data.usdm_account).length > 0 ? `
      <div class="result-section">
        <h4>📈 USDT-M Futures</h4>
        <div class="account-details" style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 10px 0;">
          ${result.detailed_data.usdm_account.assets ? `
            <h5>Assets:</h5>
            <div style="max-height: 150px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #ffeaa7;">
                    <th style="padding: 8px; border: 1px solid #ddd;">Asset</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Wallet Balance</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Unrealized PNL</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Available Balance</th>
                  </tr>
                </thead>
                <tbody>
                  ${result.detailed_data.usdm_account.assets.map(asset => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;">${asset.asset}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(asset.walletBalance || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(asset.unrealizedProfit || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(asset.availableBalance || 0).toFixed(8)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
          
          ${result.detailed_data.usdm_account.positions ? `
            <h5>Positions:</h5>
            <div style="max-height: 200px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #ffeaa7;">
                    <th style="padding: 8px; border: 1px solid #ddd;">Symbol</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Size</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Entry Price</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Mark Price</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">PNL</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">ROE</th>
                  </tr>
                </thead>
                <tbody>
                  ${result.detailed_data.usdm_account.positions.filter(pos => parseFloat(pos.positionAmt || 0) !== 0).map(position => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;">${position.symbol}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(position.positionAmt || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">$${parseFloat(position.entryPrice || 0).toFixed(4)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">$${parseFloat(position.markPrice || 0).toFixed(4)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd; color: ${parseFloat(position.unRealizedProfit || 0) >= 0 ? 'green' : 'red'};">$${parseFloat(position.unRealizedProfit || 0).toFixed(2)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd; color: ${parseFloat(position.percentage || 0) >= 0 ? 'green' : 'red'};">${parseFloat(position.percentage || 0).toFixed(2)}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p>No active USDT-M positions</p>'}
        </div>
      </div>
    ` : ''}
    
    ${result.detailed_data.coinm_account && Object.keys(result.detailed_data.coinm_account).length > 0 ? `
      <div class="result-section">
        <h4>🪙 COIN-M Futures</h4>
        <div class="account-details" style="background: #d1ecf1; padding: 15px; border-radius: 8px; margin: 10px 0;">
          ${result.detailed_data.coinm_account.assets ? `
            <h5>Assets:</h5>
            <div style="max-height: 150px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #bee5eb;">
                    <th style="padding: 8px; border: 1px solid #ddd;">Asset</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Wallet Balance</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Unrealized PNL</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Available Balance</th>
                  </tr>
                </thead>
                <tbody>
                  ${result.detailed_data.coinm_account.assets.map(asset => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;">${asset.asset}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(asset.walletBalance || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(asset.unrealizedProfit || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(asset.availableBalance || 0).toFixed(8)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
          
          ${result.detailed_data.coinm_account.positions ? `
            <h5>Positions:</h5>
            <div style="max-height: 200px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #bee5eb;">
                    <th style="padding: 8px; border: 1px solid #ddd;">Symbol</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Size</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Entry Price</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Mark Price</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">PNL</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">ROE</th>
                  </tr>
                </thead>
                <tbody>
                  ${result.detailed_data.coinm_account.positions.filter(pos => parseFloat(pos.positionAmt || 0) !== 0).map(position => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;">${position.symbol}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(position.positionAmt || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">$${parseFloat(position.entryPrice || 0).toFixed(4)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">$${parseFloat(position.markPrice || 0).toFixed(4)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd; color: ${parseFloat(position.unRealizedProfit || 0) >= 0 ? 'green' : 'red'};">$${parseFloat(position.unRealizedProfit || 0).toFixed(2)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd; color: ${parseFloat(position.percentage || 0) >= 0 ? 'green' : 'red'};">${parseFloat(position.percentage || 0).toFixed(2)}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p>No active COIN-M positions</p>'}
        </div>
      </div>
    ` : ''}
    
    ${result.basic_troubleshoot && result.basic_troubleshoot.recommendations && result.basic_troubleshoot.recommendations.length > 0 ? `
      <div class="result-section result-warning">
        <h4>💡 Recommendations</h4>
        <ul>
          ${result.basic_troubleshoot.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  `;

  modal.style.display = 'block';
}

function troubleshootCurrentAccount() {
  if (currentAccount && currentAccount.account_id) {
    troubleshootAccount(currentAccount.account_id);
    document.getElementById('account-modal').style.display = 'none';
  }
}

function detailedTroubleshootCurrentAccount() {
  if (currentAccount && currentAccount.account_id) {
    detailedTroubleshootAccount(currentAccount.account_id);
    document.getElementById('account-modal').style.display = 'none';
  }
}

function verifyCurrentAccount() {
  showToast('Account verification functionality coming soon', 'info');
}

function disableCurrentAccount() {
  showToast('Account disable functionality coming soon', 'info');
}

function enableCurrentAccount() {
  showToast('Account enable functionality coming soon', 'info');
}

// Utility functions
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return 'Invalid Date';
  }
}

function showToast(message, type = 'info') {
  // Simple toast implementation
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 6px;
    color: white;
    font-weight: 600;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  
  // Set background color based on type
  const colors = {
    info: '#007bff',
    success: '#28a745',
    error: '#dc3545',
    warning: '#ffc107'
  };
  toast.style.backgroundColor = colors[type] || colors.info;
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => toast.style.opacity = '1', 100);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 3000);
}