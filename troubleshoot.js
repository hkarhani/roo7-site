// Wait for both DOM and window to be fully loaded
function initializeTroubleshootPage() {
  const API_BASE = "https://api.roo7.site";
  
  console.log("🔍 Troubleshoot page initialization started");
  
  // Check authentication
  const token = localStorage.getItem("token");
  if (!token) {
    console.error("❌ No authentication token found");
    alert("You must be logged in to access this page.");
    window.close();
    return;
  }

  // Get account name from URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const accountName = urlParams.get('account');
  
  console.log("🔍 Account name from URL:", accountName);
  
  if (!accountName) {
    console.error("❌ No account name in URL parameters");
    alert("No account specified.");
    window.close();
    return;
  }

  // Set the account name in header immediately
  const headerElement = document.getElementById('account-name-display');
  if (headerElement) {
    headerElement.textContent = accountName;
    console.log("✅ Header updated with account name");
  } else {
    console.error("❌ Header element not found");
  }

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

  // Load account details with enhanced error handling
  async function loadAccountDetails() {
    console.log("📋 Starting to load account details...");
    
    // Verify all required DOM elements exist first
    const requiredElements = ['account-name', 'strategy', 'current-value', 'hedge-percent', 'api-key-status'];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
      console.error("❌ Missing DOM elements:", missingElements);
      setTimeout(loadAccountDetails, 500); // Retry after 500ms
      return;
    }
    
    try {
      console.log("🔐 Using token for API request");
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const res = await fetch(`${API_BASE}/accounts`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log(`📡 API Response received - Status: ${res.status}`);

      if (res.status === 401) {
        console.error("❌ Authentication failed");
        localStorage.removeItem("token");
        showToast("Session expired. Please log in again.", 'error');
        setTimeout(() => window.close(), 2000);
        return;
      }

      if (!res.ok) {
        console.error(`❌ API Error: ${res.status} ${res.statusText}`);
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }

      const accounts = await res.json();
      console.log(`✅ Accounts loaded: ${accounts.length} total`);
      console.log("🔍 Looking for account:", accountName);
      
      if (!Array.isArray(accounts)) {
        throw new Error("Invalid API response format");
      }

      // Find account with exact name match (case sensitive)
      let account = accounts.find(acc => acc.account_name === accountName);
      
      // If not found, try case-insensitive search
      if (!account) {
        account = accounts.find(acc => 
          acc.account_name && acc.account_name.toLowerCase() === accountName.toLowerCase()
        );
        console.log("🔍 Case-insensitive search result:", account ? "Found" : "Not found");
      }

      if (!account) {
        console.error("❌ Account not found");
        console.log("Available accounts:", accounts.map(a => `"${a.account_name}"`));
        throw new Error(`Account "${accountName}" not found`);
      }

      console.log("🎯 Account found:", account.account_name);

      // Populate UI elements
      const updates = {
        'account-name': account.account_name || 'N/A',
        'strategy': account.strategy || 'N/A', 
        'current-value': account.current_value !== undefined && account.current_value !== null ? `$${account.current_value}` : 'N/A',
        'hedge-percent': account.hedge_percent !== undefined && account.hedge_percent !== null ? `${account.hedge_percent}%` : 'N/A',
        'api-key-status': account.api_key ? '✅ Configured' : '❌ Not Configured'
      };

      let updateCount = 0;
      for (const [elementId, value] of Object.entries(updates)) {
        const element = document.getElementById(elementId);
        if (element) {
          element.textContent = value;
          element.style.color = ''; // Reset any error styling
          updateCount++;
          console.log(`✅ Updated ${elementId}: "${value}"`);
        } else {
          console.error(`❌ Element not found: ${elementId}`);
        }
      }

      console.log(`✅ Updated ${updateCount}/${Object.keys(updates).length} UI elements`);

      // Store account data globally
      window.currentAccount = account;
      console.log("✅ Account data stored globally");
      
      // Show success message
      showToast("Account details loaded successfully", 'success', 2000);

    } catch (error) {
      console.error("❌ Failed to load account details:", error);
      
      if (error.name === 'AbortError') {
        showToast("Request timed out. Please check your connection.", 'error');
      } else {
        showToast(`Failed to load account: ${error.message}`, 'error');
      }
      
      // Show error state in UI
      const errorUpdates = {
        'account-name': accountName,
        'strategy': 'Failed to load',
        'current-value': 'Failed to load',
        'hedge-percent': 'Failed to load', 
        'api-key-status': 'Failed to load'
      };

      for (const [elementId, value] of Object.entries(errorUpdates)) {
        const element = document.getElementById(elementId);
        if (element) {
          element.textContent = value;
          element.style.color = '#dc3545';
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
      showToast('Please wait for account information to load first.', 'warning');
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    testResults.innerHTML = '<div class="testing">Running connectivity tests...</div>';
    diagnosticInfo.innerHTML = '<div class="diagnostic-content">Running diagnostics...</div>';

    try {
      const res = await fetch(`${API_BASE}/troubleshoot/${window.currentAccount.id}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!res.ok) {
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
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
      console.error("❌ Connection test failed:", error);
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
  const testButton = document.getElementById('test-connection');
  if (testButton) {
    testButton.onclick = testBinanceConnection;
    console.log("✅ Test button event wired");
  } else {
    console.error("❌ Test connection button not found");
  }

  // Start loading account details
  console.log("🚀 Starting account details load...");
  loadAccountDetails();
}

// Multiple initialization strategies to ensure it works
console.log("📄 Script loaded, setting up initialization...");

// Strategy 1: DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log("🎯 DOMContentLoaded fired");
    setTimeout(initializeTroubleshootPage, 100);
  });
} else if (document.readyState === 'interactive' || document.readyState === 'complete') {
  // Strategy 2: DOM already ready
  console.log("🎯 DOM already ready, initializing immediately");
  setTimeout(initializeTroubleshootPage, 100);
}

// Strategy 3: Window load as fallback
window.addEventListener('load', () => {
  console.log("🎯 Window load event fired");
  // Only initialize if not already done
  if (!window.troubleshootInitialized) {
    window.troubleshootInitialized = true;
    setTimeout(initializeTroubleshootPage, 100);
  }
});

// Strategy 4: Immediate execution with longer delay as final fallback
setTimeout(() => {
  if (!window.troubleshootInitialized) {
    console.log("🎯 Fallback initialization after 1 second");
    window.troubleshootInitialized = true;
    initializeTroubleshootPage();
  }
}, 1000);