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
  
  // Don't auto-load accounts - wait for user action
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

  const loadAllAccountsBtn = document.getElementById('load-all-accounts-btn');
  if (loadAllAccountsBtn) {
    loadAllAccountsBtn.addEventListener('click', loadAllAccounts);
  }

  // Search input - only trigger search when there are accounts loaded
  const searchInput = document.getElementById('search-account');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (allAccounts.length > 0) {
        applyFilters();
      }
    });
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

  // Modal close buttons
  const closeTroubleshootBtn = document.getElementById('close-troubleshoot-btn');
  if (closeTroubleshootBtn) {
    closeTroubleshootBtn.addEventListener('click', () => {
      document.getElementById('troubleshoot-modal').style.display = 'none';
    });
  }

  const closeDetailedTroubleshootBtn = document.getElementById('close-detailed-troubleshoot-btn');
  if (closeDetailedTroubleshootBtn) {
    closeDetailedTroubleshootBtn.addEventListener('click', () => {
      document.getElementById('detailed-troubleshoot-modal').style.display = 'none';
    });
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

// Load all accounts
async function loadAllAccounts() {
  showToast('Loading all accounts...', 'info');
  await loadAccounts();
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
      updateAccountStats();
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
  
  showToast('Applying filters...', 'info');

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
  updateAccountStats();
  
  const showingCount = filteredAccounts.length;
  const totalCount = allAccounts.length;
  showToast(`Filters applied - showing ${showingCount} of ${totalCount} accounts`, 'success');
}

function clearFilters() {
  showToast('Clearing filters...', 'info');
  
  document.getElementById('search-account').value = '';
  document.getElementById('account-status-filter').value = '';
  document.getElementById('verification-filter').value = '';
  filteredAccounts = [...allAccounts];
  displayAccounts();
  updateAccountStats();
  
  showToast('Filters cleared - showing all accounts', 'success');
}

// Update account statistics
function updateAccountStats() {
  const totalCount = allAccounts.length;
  const showingCount = filteredAccounts.length;
  const activeCount = allAccounts.filter(account => 
    account.test_status === 'successful' || account.status === 'active'
  ).length;
  const inactiveCount = totalCount - activeCount;

  document.getElementById('total-accounts-count').textContent = totalCount;
  document.getElementById('showing-accounts-count').textContent = showingCount;
  document.getElementById('active-accounts-count').textContent = activeCount;
  document.getElementById('inactive-accounts-count').textContent = inactiveCount;
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
  // Disable troubleshoot buttons
  const troubleshootBtn = document.getElementById('troubleshoot-account');
  const detailedTroubleshootBtn = document.getElementById('detailed-troubleshoot-account');
  
  if (troubleshootBtn) {
    troubleshootBtn.disabled = true;
    troubleshootBtn.innerHTML = '🔄 Troubleshooting...';
  }
  if (detailedTroubleshootBtn) {
    detailedTroubleshootBtn.disabled = true;
  }
  
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
  } finally {
    // Re-enable troubleshoot buttons
    if (troubleshootBtn) {
      troubleshootBtn.disabled = false;
      troubleshootBtn.innerHTML = '🔧 Troubleshoot';
    }
    if (detailedTroubleshootBtn) {
      detailedTroubleshootBtn.disabled = false;
    }
  }
};

window.detailedTroubleshootAccount = async function(accountId) {
  // Disable both troubleshoot buttons
  const troubleshootBtn = document.getElementById('troubleshoot-account');
  const detailedTroubleshootBtn = document.getElementById('detailed-troubleshoot-account');
  
  if (detailedTroubleshootBtn) {
    detailedTroubleshootBtn.disabled = true;
    detailedTroubleshootBtn.innerHTML = '🔄 Analyzing...';
  }
  if (troubleshootBtn) {
    troubleshootBtn.disabled = true;
  }
  
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
  } finally {
    // Re-enable both buttons
    if (detailedTroubleshootBtn) {
      detailedTroubleshootBtn.disabled = false;
      detailedTroubleshootBtn.innerHTML = '🔍 Detailed Troubleshoot';
    }
    if (troubleshootBtn) {
      troubleshootBtn.disabled = false;
    }
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
  
  // Debug logging to see what data we're receiving
  console.log('🔍 Detailed troubleshoot result:', result);
  console.log('🔍 Detailed breakdown:', result.detailed_breakdown);
  if (result.detailed_breakdown) {
    console.log('🔍 SPOT data:', result.detailed_breakdown.spot);
    console.log('🔍 USDT-M data:', result.detailed_breakdown['USDT-M']);
    console.log('🔍 COIN-M data:', result.detailed_breakdown['COIN-M']);
    console.log('🔍 Summary data:', result.detailed_breakdown.summary);
  }
  
  const statusClass = result.success ? 'result-success' : 'result-error';
  const breakdown = result.detailed_breakdown || {};
  const summary = breakdown.summary || {};
  
  resultsContainer.innerHTML = `
    <div class="result-section ${statusClass}">
      <h4>📊 Account Summary</h4>
      <div class="summary-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin: 15px 0;">
        <div class="summary-card">
          <strong>Account Name:</strong> ${result.account_name || 'N/A'}<br>
          <strong>Exchange:</strong> ${result.account_summary?.exchange || 'Binance'}<br>
          <strong>Test Status:</strong> ${result.test_status || 'N/A'}<br>
          <strong>Total USDT Value:</strong> $${(summary.total_value_usdt || 0).toFixed(2)}
        </div>
        <div class="summary-card">
          <strong>API Key Valid:</strong> ${result.api_key_valid ? '✅ Yes' : '❌ No'}<br>
          <strong>IP Whitelisted:</strong> ${result.ip_whitelisted ? '✅ Yes' : '❌ No'}<br>
          <strong>Total Unrealized PnL:</strong> <span style="color: ${(summary.total_unrealized_pnl_usdt || 0) >= 0 ? 'green' : 'red'};">$${(summary.total_unrealized_pnl_usdt || 0).toFixed(2)}</span><br>
          <strong>Analysis Time:</strong> ${result.timestamp ? new Date(result.timestamp).toLocaleString() : 'N/A'}
        </div>
      </div>
      
      <div class="breakdown-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
        <div><strong>SPOT Value:</strong> $${(summary.spot_value_usdt || 0).toFixed(2)}</div>
        <div><strong>USDT-M Value:</strong> $${(summary.usdtm_value_usdt || 0).toFixed(2)}</div>
        <div><strong>COIN-M Value:</strong> $${(summary.coinm_value_usdt || 0).toFixed(2)}</div>
      </div>
    </div>
    
    ${breakdown.spot ? `
      <div class="result-section">
        <h4>💰 SPOT Account</h4>
        <div class="account-details" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
          ${breakdown.spot.assets && breakdown.spot.assets.length > 0 ? `
            <h5>Assets (${breakdown.spot.assets.length}):</h5>
            <div style="max-height: 200px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #e9ecef;">
                    <th style="padding: 8px; border: 1px solid #ddd;">Asset</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Free</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Locked</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Total</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">USDT Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${breakdown.spot.assets.map(asset => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>${asset.asset}</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(asset.free || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(asset.locked || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(asset.total || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>$${(asset.usdt_value || 0).toFixed(2)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
          
          ${breakdown.spot.open_orders && breakdown.spot.open_orders.length > 0 ? `
            <h5>Open Orders (${breakdown.spot.open_orders.length}):</h5>
            <div style="max-height: 200px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #e9ecef;">
                    <th style="padding: 8px; border: 1px solid #ddd;">Symbol</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Side</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Type</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Price</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Quantity</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">USDT Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${breakdown.spot.open_orders.map(order => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>${order.symbol}</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd; color: ${order.side === 'BUY' ? 'green' : 'red'};">${order.side}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${order.type}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">$${parseFloat(order.price || 0).toFixed(4)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(order.origQty || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>$${(order.usdt_value || 0).toFixed(2)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
          
          ${breakdown.spot.assets.length === 0 && breakdown.spot.open_orders.length === 0 ? '<p>No SPOT assets or orders found</p>' : ''}
        </div>
      </div>
    ` : ''}
    
    ${breakdown['USDT-M'] ? `
      <div class="result-section">
        <h4>📈 USDT-M Futures</h4>
        <div class="account-details" style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 10px 0;">
          ${breakdown['USDT-M'].assets && breakdown['USDT-M'].assets.length > 0 ? `
            <h5>Assets (${breakdown['USDT-M'].assets.length}):</h5>
            <div style="max-height: 150px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #ffeaa7;">
                    <th style="padding: 8px; border: 1px solid #ddd;">Asset</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Balance</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Available</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">USDT Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${breakdown['USDT-M'].assets.map(asset => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>${asset.asset}</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(asset.balance || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(asset.available || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>$${(asset.usdt_value || 0).toFixed(2)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
          
          ${breakdown['USDT-M'].positions && breakdown['USDT-M'].positions.length > 0 ? `
            <h5>Positions (${breakdown['USDT-M'].positions.length}):</h5>
            <div style="max-height: 200px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #ffeaa7;">
                    <th style="padding: 8px; border: 1px solid #ddd;">Symbol</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Side</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Size</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Entry Price</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Mark Price</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Leverage</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Margin</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">PNL</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">USDT Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${breakdown['USDT-M'].positions.map(position => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>${position.symbol}</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd; color: ${position.side === 'Long' ? 'green' : 'red'};">${position.side}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(position.positionAmt || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">$${parseFloat(position.entryPrice || 0).toFixed(4)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">$${parseFloat(position.markPrice || 0).toFixed(4)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${position.leverage || 'N/A'}x</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${position.marginType || 'N/A'}</td>
                      <td style="padding: 8px; border: 1px solid #ddd; color: ${parseFloat(position.unRealizedPnL || 0) >= 0 ? 'green' : 'red'};">$${parseFloat(position.unRealizedPnL || 0).toFixed(2)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>$${(position.usdt_value || 0).toFixed(2)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
          
          ${breakdown['USDT-M'].open_orders && breakdown['USDT-M'].open_orders.length > 0 ? `
            <h5>Open Orders (${breakdown['USDT-M'].open_orders.length}):</h5>
            <div style="max-height: 200px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #ffeaa7;">
                    <th style="padding: 8px; border: 1px solid #ddd;">Symbol</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Side</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Type</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Price</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Quantity</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Reduce Only</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">USDT Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${breakdown['USDT-M'].open_orders.map(order => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>${order.symbol}</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd; color: ${order.side === 'Long' ? 'green' : 'red'};">${order.side}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${order.type}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">$${parseFloat(order.price || 0).toFixed(4)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(order.origQty || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${order.reduceOnly ? '✅' : '❌'}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>$${(order.usdt_value || 0).toFixed(2)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
          
          ${breakdown['USDT-M'].assets.length === 0 && breakdown['USDT-M'].positions.length === 0 && breakdown['USDT-M'].open_orders.length === 0 ? '<p>No USDT-M assets, positions, or orders found</p>' : ''}
        </div>
      </div>
    ` : ''}
    
    ${breakdown['COIN-M'] ? `
      <div class="result-section">
        <h4>🪙 COIN-M Futures</h4>
        <div class="account-details" style="background: #d1ecf1; padding: 15px; border-radius: 8px; margin: 10px 0;">
          ${breakdown['COIN-M'].assets && breakdown['COIN-M'].assets.length > 0 ? `
            <h5>Assets (${breakdown['COIN-M'].assets.length}):</h5>
            <div style="max-height: 150px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #bee5eb;">
                    <th style="padding: 8px; border: 1px solid #ddd;">Asset</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Wallet Balance</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Unrealized PNL</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">USDT Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${breakdown['COIN-M'].assets.map(asset => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>${asset.asset}</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(asset.walletBalance || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd; color: ${parseFloat(asset.unrealizedPnL || 0) >= 0 ? 'green' : 'red'};">${parseFloat(asset.unrealizedPnL || 0).toFixed(8)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>$${(asset.usdt_value || 0).toFixed(2)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
          
          ${breakdown['COIN-M'].positions && breakdown['COIN-M'].positions.length > 0 ? `
            <h5>Positions (${breakdown['COIN-M'].positions.length}):</h5>
            <div style="max-height: 200px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #bee5eb;">
                    <th style="padding: 8px; border: 1px solid #ddd;">Symbol</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Side</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Contracts</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Entry Price</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Mark Price</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Leverage</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Margin</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">PNL (USDT)</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">USD Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${breakdown['COIN-M'].positions.map(position => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>${position.symbol}</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd; color: ${position.side === 'Long' ? 'green' : 'red'};">${position.side}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(position.positionAmt || 0).toFixed(0)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">$${parseFloat(position.entryPrice || 0).toFixed(4)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">$${parseFloat(position.markPrice || 0).toFixed(4)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${position.leverage || 'N/A'}x</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${position.marginType || 'N/A'}</td>
                      <td style="padding: 8px; border: 1px solid #ddd; color: ${parseFloat(position.unRealizedPnL || 0) >= 0 ? 'green' : 'red'};">$${parseFloat(position.unRealizedPnL || 0).toFixed(2)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>$${(position.usdt_value || 0).toFixed(2)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
          
          ${breakdown['COIN-M'].open_orders && breakdown['COIN-M'].open_orders.length > 0 ? `
            <h5>Open Orders (${breakdown['COIN-M'].open_orders.length}):</h5>
            <div style="max-height: 200px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #bee5eb;">
                    <th style="padding: 8px; border: 1px solid #ddd;">Symbol</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Side</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Type</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Price</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Contracts</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Reduce Only</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">USD Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${breakdown['COIN-M'].open_orders.map(order => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>${order.symbol}</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd; color: ${order.side === 'Long' ? 'green' : 'red'};">${order.side}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${order.type}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">$${parseFloat(order.price || 0).toFixed(4)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${parseFloat(order.origQty || 0).toFixed(0)}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${order.reduceOnly ? '✅' : '❌'}</td>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>$${(order.usdt_value || 0).toFixed(2)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
          
          ${breakdown['COIN-M'].assets.length === 0 && breakdown['COIN-M'].positions.length === 0 && breakdown['COIN-M'].open_orders.length === 0 ? '<p>No COIN-M assets, positions, or orders found</p>' : ''}
        </div>
      </div>
    ` : ''}
    
    ${result.test_results && result.test_results.length > 0 ? `
      <div class="result-section">
        <h4>🔧 Troubleshoot Diagnostic Steps</h4>
        <div class="diagnostic-steps" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
          ${result.test_results.map(test => `
            <div class="diagnostic-step" style="margin: 10px 0; padding: 10px; border-left: 4px solid ${test.success ? '#28a745' : '#dc3545'}; background: ${test.success ? '#d4edda' : '#f8d7da'}; border-radius: 4px;">
              <div class="step-header" style="font-weight: bold; color: ${test.success ? '#155724' : '#721c24'};">
                ${test.success ? '✅' : '❌'} ${test.stage}: ${test.message}
              </div>
              ${test.details ? `
                <div class="step-details" style="margin-top: 5px; font-size: 0.9em; color: ${test.success ? '#155724' : '#721c24'};">
                  ${typeof test.details === 'object' ? JSON.stringify(test.details, null, 2) : test.details}
                </div>
              ` : ''}
              ${test.latency_ms ? `
                <div class="step-timing" style="margin-top: 5px; font-size: 0.8em; color: #6c757d;">
                  Execution time: ${test.latency_ms.toFixed(1)}ms
                </div>
              ` : ''}
            </div>
          `).join('')}
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
    
    <!-- Debug section to show raw data structure -->
    <div class="result-section" style="margin-top: 20px; background: #f8f9fa; padding: 10px; border-radius: 8px;">
      <h4>🐛 Debug Info</h4>
      <details style="margin: 10px 0;">
        <summary style="cursor: pointer; font-weight: bold;">Raw Breakdown Data</summary>
        <pre style="background: #fff; padding: 10px; border-radius: 4px; overflow: auto; max-height: 300px; font-size: 12px;">${JSON.stringify(breakdown, null, 2)}</pre>
      </details>
    </div>
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