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
  
  console.log("🔍 Troubleshoot page loaded for account:", accountName);
  
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
    console.log("📋 Loading account details for:", accountName);
    
    try {
      const res = await fetch(`${API_BASE}/accounts`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!res.ok) {
        console.error("❌ Failed to fetch accounts:", res.status);
        throw new Error(`Status ${res.status}`);
      }

      const accounts = await res.json();
      console.log("✅ Retrieved accounts:", accounts.length);
      
      const account = accounts.find(acc => acc.account_name === accountName);
      console.log("🎯 Found account:", account);

      if (!account) {
        console.error("❌ Account not found:", accountName);
        throw new Error("Account not found");
      }

      // Populate account details
      document.getElementById('account-name').textContent = account.account_name || 'N/A';
      document.getElementById('strategy').textContent = account.strategy || 'N/A';
      document.getElementById('current-value').textContent = account.current_value !== undefined ? `${account.current_value}` : 'N/A';
      document.getElementById('hedge-percent').textContent = account.hedge_percent !== undefined ? `${account.hedge_percent}%` : 'N/A';
      document.getElementById('api-key-status').textContent = account.api_key ? '✅ Configured' : '❌ Not Configured';

      // Store account data for troubleshooting
      window.currentAccount = account;
      
      console.log("✅ Account details populated successfully");

    } catch (error) {
      console.error("❌ Error loading account:", error);
      showToast(`Error loading account: ${error.message}`, 'error');
      
      // Show error state in the UI
      document.getElementById('account-name').textContent = accountName;
      document.getElementById('strategy').textContent = 'Error loading';
      document.getElementById('current-value').textContent = 'Error loading';
      document.getElementById('hedge-percent').textContent = 'Error loading';
      document.getElementById('api-key-status').textContent = 'Error loading';
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
    diagnosticInfo.innerHTML = '<div class="diagnostic-content">Running diagnostics...</div>';

    try {
      // Call backend troubleshoot endpoint
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
        showToast('Connection test completed successfully', 'success');
      } else {
        resultsHtml += '<div class="test-failure">❌ Connection Failed</div>';
        showToast('Connection test found issues', 'warning');
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

    } catch (error) {
      console.error("❌ Test failed:", error);
      testResults.innerHTML = `<div class="test-failure">❌ Test Failed: ${error.message}</div>`;
      diagnosticInfo.innerHTML = `<div class="diagnostic-results">
        <div class="diagnostic-item error">
          <strong>Error:</strong> Unable to perform connectivity test. ${error.message}
        </div>
        <div class="diagnostic-item">
          <strong>Possible Causes:</strong>
          <ul>
            <li>Network connectivity issues</li>
            <li>Invalid API credentials</li>
            <li>Binance API temporarily unavailable</li>
            <li>Account permissions insufficient</li>
          </ul>
        </div>
        <div class="diagnostic-item">
          <strong>Troubleshooting Steps:</strong>
          <ul>
            <li>Verify your internet connection</li>
            <li>Check your API key and secret are correct</li>
            <li>Ensure API key has required permissions</li>
            <li>Try again in a few minutes</li>
          </ul>
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

  // Load account details immediately when page loads
  console.log("🚀 Starting to load account details...");
  loadAccountDetails();
});