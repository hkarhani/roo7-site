document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api.roo7.site";
  
  // Check authentication
  const token = localStorage.getItem("token");
  if (!token) {
    alert("You must be logged in to access this page.");
    window.close();
    return;
  }

  // Get account name from URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const accountName = urlParams.get('account');
  
  if (!accountName) {
    alert("No account specified.");
    window.close();
    return;
  }

  document.getElementById('account-name-display').textContent = accountName;

  // Theme toggle
  document.getElementById('toggle-theme').onclick = () => {
    document.body.classList.toggle("dark-theme");
  };

  // Toast notification system (reuse from dashboard)
  function showToast(message, type = 'info', duration = 4000) {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-message">${message}</span>
        <button class="toast-close">&times;</button>
      </div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-show'), 100);

    const autoHide = setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }, duration);

    toast.querySelector('.toast-close').addEventListener('click', () => {
      clearTimeout(autoHide);
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    });
  }

  // Load account details
  async function loadAccountDetails() {
    try {
      const res = await fetch(`${API_BASE}/accounts`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }

      const accounts = await res.json();
      const account = accounts.find(acc => acc.account_name === accountName);

      if (!account) {
        throw new Error("Account not found");
      }

      // Populate account details
      document.getElementById('account-name').textContent = account.account_name;
      document.getElementById('strategy').textContent = account.strategy;
      document.getElementById('current-value').textContent = `$${account.current_value || 0}`;
      document.getElementById('hedge-percent').textContent = `${account.hedge_percent || 0}%`;
      document.getElementById('api-key-status').textContent = account.api_key ? '✓ Configured' : '✗ Not Configured';

      // Store account ID for troubleshooting
      window.currentAccount = account;

    } catch (error) {
      showToast(`Error loading account: ${error.message}`, 'error');
    }
  }

  // Test Binance connection
  async function testBinanceConnection() {
    const testBtn = document.getElementById('test-connection');
    const testResults = document.getElementById('test-results');
    const diagnosticInfo = document.getElementById('diagnostic-info');

    if (!window.currentAccount) {
      showToast('Account details not loaded', 'error');
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    testResults.innerHTML = '<div class="testing">Running connectivity tests...</div>';

    try {
      // Call backend troubleshoot endpoint (you'll need to create this)
      const res = await fetch(`${API_BASE}/troubleshoot/${window.currentAccount.id}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }

      const results = await res.json();

      // Display results
      let resultsHtml = '<div class="test-summary">';
      
      if (results.success) {
        resultsHtml += '<div class="test-success">✅ Connection Successful</div>';
      } else {
        resultsHtml += '<div class="test-failure">❌ Connection Failed</div>';
      }

      resultsHtml += '</div>';

      testResults.innerHTML = resultsHtml;

      // Display diagnostic information
      let diagnosticHtml = '<div class="diagnostic-results">';
      
      diagnosticHtml += `<div class="diagnostic-item">
        <strong>API Key Status:</strong> ${results.api_key_valid ? '✅ Valid' : '❌ Invalid'}
      </div>`;
      
      diagnosticHtml += `<div class="diagnostic-item">
        <strong>Account Balance:</strong> ${results.balance_info || 'Unable to retrieve'}
      </div>`;
      
      diagnosticHtml += `<div class="diagnostic-item">
        <strong>Network Latency:</strong> ${results.latency || 'N/A'}ms
      </div>`;

      if (results.error_message) {
        diagnosticHtml += `<div class="diagnostic-item error">
          <strong>Error Details:</strong> ${results.error_message}
        </div>`;
      }

      if (results.recommendations && results.recommendations.length > 0) {
        diagnosticHtml += '<div class="diagnostic-item"><strong>Recommendations:</strong><ul>';
        results.recommendations.forEach(rec => {
          diagnosticHtml += `<li>${rec}</li>`;
        });
        diagnosticHtml += '</ul></div>';
      }

      diagnosticHtml += '</div>';
      diagnosticInfo.innerHTML = diagnosticHtml;

      if (results.success) {
        showToast('Connection test completed successfully', 'success');
      } else {
        showToast('Connection test found issues', 'warning');
      }

    } catch (error) {
      testResults.innerHTML = `<div class="test-failure">❌ Test Failed: ${error.message}</div>`;
      diagnosticInfo.innerHTML = `<div class="diagnostic-results">
        <div class="diagnostic-item error">
          <strong>Error:</strong> Unable to perform connectivity test. Please check your network connection and try again.
        </div>
      </div>`;
      showToast(`Test failed: ${error.message}`, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Test Binance Connection';
    }
  }

  // Wire up events
  document.getElementById('test-connection').onclick = testBinanceConnection;

  // Load account details on page load
  loadAccountDetails();
});