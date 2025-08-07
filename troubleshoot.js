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

  // Note: Theme toggle is now handled by theme-manager.js

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

  // Enhanced retry mechanism for loading account details
  async function loadAccountDetails(retryCount = 0) {
    const maxRetries = 3;
    console.log(`📋 Loading account details for: ${accountName} (attempt ${retryCount + 1})`);
    
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("❌ No token available");
        throw new Error("Authentication token not found");
      }

      console.log("🔐 Token found, making API request...");
      
      const res = await fetch(`${API_BASE}/accounts`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      console.log(`📡 API Response status: ${res.status}`);

      if (res.status === 401) {
        console.error("❌ Authentication failed - token expired");
        localStorage.removeItem("token");
        alert("Session expired. Please log in again.");
        window.close();
        return;
      }

      if (!res.ok) {
        console.error("❌ API request failed:", res.status, res.statusText);
        throw new Error(`API request failed: ${res.status} ${res.statusText}`);
      }

      const accounts = await res.json();
      console.log("✅ Retrieved accounts:", accounts.length);
      
      if (!Array.isArray(accounts)) {
        console.error("❌ Invalid response format - expected array");
        throw new Error("Invalid response format");
      }

      const account = accounts.find(acc => acc.account_name === accountName);
      console.log("🎯 Found account:", account ? "Yes" : "No");

      if (!account) {
        console.error("❌ Account not found:", accountName);
        console.log("Available accounts:", accounts.map(a => a.account_name));
        throw new Error(`Account '${accountName}' not found`);
      }

      // Populate account details with safety checks
      const elements = {
        'account-name': account.account_name || 'N/A',
        'strategy': account.strategy || 'N/A',
        'current-value': account.current_value !== undefined ? `$${account.current_value}` : 'N/A',
        'hedge-percent': account.hedge_percent !== undefined ? `${account.hedge_percent}%` : 'N/A',
        'api-key-status': account.api_key ? '✅ Configured' : '❌ Not Configured'
      };

      // Update UI elements with error handling
      for (const [elementId, value] of Object.entries(elements)) {
        const element = document.getElementById(elementId);
        if (element) {
          element.textContent = value;
          console.log(`✅ Updated ${elementId}: ${value}`);
        } else {
          console.warn(`⚠️ Element not found: ${elementId}`);
        }
      }

      // Store account data for troubleshooting
      window.currentAccount = account;
      
      console.log("✅ Account details populated successfully");

    } catch (error) {
      console.error("❌ Error loading account:", error);
      
      // Retry logic for first-load issues
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying in 1 second... (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          loadAccountDetails(retryCount + 1);
        }, 1000);
        return;
      }
      
      // Final failure - show error in UI
      showToast(`Error loading account: ${error.message}`, 'error');
      
      // Show error state in the UI with the account name we do have
      const errorElements = {
        'account-name': accountName,
        'strategy': 'Error loading',
        'current-value': 'Error loading', 
        'hedge-percent': 'Error loading',
        'api-key-status': 'Error loading'
      };

      for (const [elementId, value] of Object.entries(errorElements)) {
        const element = document.getElementById(elementId);
        if (element) {
          element.textContent = value;
          element.style.color = '#dc3545'; // Red color for error state
        }
      }
    }
  }

  // Test Binance connection
  async function testBinanceConnection() {
    const testBtn = document.getElementById('test-connection');
    const testResults = document.getElementById('test-results');
    const diagnosticInfo = document.getElementById('diagnostic-info');

    if (!window.currentAccount) {
      showToast('Account details not loaded. Please wait for account information to load first.', 'error');
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

  // Enhanced initialization with better timing
  console.log("🚀 Starting initialization sequence...");
  
  // Wait a short moment to ensure all scripts are loaded
  setTimeout(() => {
    console.log("🎯 Starting account details load...");
    loadAccountDetails();
  }, 100); // Small delay to ensure DOM is fully ready and scripts loaded
});