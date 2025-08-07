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

  // Toast notification system (same as dashboard)
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

  // Enhanced Binance connection test with comprehensive result display
  async function testBinanceConnection() {
    const testBtn = document.getElementById('test-connection');
    const testResults = document.getElementById('test-results');
    const diagnosticInfo = document.getElementById('diagnostic-info');

    if (!window.currentAccount) {
      showToast('Please wait for account information to load first.', 'warning');
      return;
    }

    // Show loading state
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    
    // Clear previous results
    testResults.innerHTML = '<div class="testing">🔄 Running connectivity tests...</div>';
    diagnosticInfo.innerHTML = '<div class="diagnostic-content">🔍 Running comprehensive diagnostics...</div>';
    
    // Show loading toast
    showToast('Testing Binance connection...', 'info', 3000);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for comprehensive test

      console.log(`🚀 Starting troubleshoot test for account ID: ${window.currentAccount.id}`);
      
      const res = await fetch(`${API_BASE}/troubleshoot/${window.currentAccount.id}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}: ${res.statusText}` }));
        throw new Error(errorData.error || errorData.detail || `API Error: ${res.status} ${res.statusText}`);
      }

      const results = await res.json();
      console.log("✅ Troubleshoot results received:", results);

      // Display summary results
      displayTestSummary(results, testResults);
      
      // Display portfolio section with pie chart
      displayPortfolioSection(results);
      
      // Display detailed diagnostics
      displayDetailedDiagnostics(results, diagnosticInfo);
      
      // Show completion toast
      if (results.success) {
        showToast('Connection test completed successfully! ✅', 'success');
      } else {
        showToast('Connection test found issues. Check diagnostics below.', 'warning');
      }

    } catch (error) {
      console.error("❌ Connection test failed:", error);
      
      if (error.name === 'AbortError') {
        showToast('Test timed out. This may indicate network connectivity issues.', 'error');
        testResults.innerHTML = `<div class="test-failure">❌ Test Timed Out</div>`;
        diagnosticInfo.innerHTML = getTimeoutDiagnostics();
      } else {
        showToast(`Test failed: ${error.message}`, 'error');
        testResults.innerHTML = `<div class="test-failure">❌ Test Failed: ${error.message}</div>`;
        diagnosticInfo.innerHTML = getErrorDiagnostics(error);
      }
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Test Binance Connection';
    }
  }

  function displayTestSummary(results, container) {
    let summaryHtml = '<div class="test-summary">';
    
    // Overall status
    if (results.success) {
      summaryHtml += '<div class="test-success">✅ Connection Successful</div>';
    } else {
      summaryHtml += '<div class="test-failure">❌ Connection Issues Detected</div>';
    }
    
    // Key metrics
    summaryHtml += '<div class="summary-metrics">';
    
    if (results.total_usdt_value !== null && results.total_usdt_value !== undefined) {
      summaryHtml += `<div class="metric"><strong>Portfolio Value:</strong> ${parseFloat(results.total_usdt_value).toFixed(2)} USDT</div>`;
    }
    
    if (results.execution_time_ms) {
      summaryHtml += `<div class="metric"><strong>Test Duration:</strong> ${results.execution_time_ms.toFixed(0)}ms</div>`;
    }
    
    summaryHtml += `<div class="metric"><strong>API Key Valid:</strong> ${results.api_key_valid ? '✅ Yes' : '❌ No'}</div>`;
    summaryHtml += `<div class="metric"><strong>IP Whitelisted:</strong> ${results.ip_whitelisted ? '✅ Yes' : '❌ No'}</div>`;
    
    // Asset count
    if (results.balances && results.balances.length > 0) {
      const nonZeroAssets = results.balances.filter(b => b.total > 0).length;
      summaryHtml += `<div class="metric"><strong>Active Assets:</strong> ${nonZeroAssets}</div>`;
    }
    
    summaryHtml += '</div></div>';
    
    container.innerHTML = summaryHtml;
  }

  function displayPortfolioSection(results) {
    // Find or create portfolio section after summary
    const testResults = document.getElementById('test-results');
    let portfolioSection = document.getElementById('portfolio-section');
    
    if (!portfolioSection && results.balances && results.balances.length > 0) {
      portfolioSection = document.createElement('div');
      portfolioSection.id = 'portfolio-section';
      portfolioSection.className = 'portfolio-section';
      
      // Insert after test results
      testResults.parentNode.insertBefore(portfolioSection, testResults.nextSibling);
    }
    
    if (!portfolioSection || !results.balances || results.balances.length === 0) {
      return;
    }

    const nonZeroBalances = results.balances.filter(b => b.total > 0 && b.percentage > 0);
    
    if (nonZeroBalances.length === 0) {
      portfolioSection.innerHTML = '<div class="portfolio-empty">No assets with value found</div>';
      return;
    }

    let portfolioHtml = '<div class="portfolio-header">';
    portfolioHtml += '<h3>💰 Portfolio Assets</h3>';
    portfolioHtml += `<p>Total Value: <strong>${parseFloat(results.total_usdt_value).toFixed(2)} USDT</strong></p>`;
    portfolioHtml += '</div>';
    
    // Create container for chart and table
    portfolioHtml += '<div class="portfolio-content">';
    
    // Pie chart container
    portfolioHtml += '<div class="portfolio-chart-container">';
    portfolioHtml += '<div id="portfolio-pie-chart" class="portfolio-pie-chart"></div>';
    portfolioHtml += '</div>';
    
    // Asset table
    portfolioHtml += '<div class="portfolio-table-container">';
    portfolioHtml += '<table class="portfolio-table">';
    portfolioHtml += '<thead><tr><th>Asset</th><th>Amount</th><th>Value (USDT)</th><th>%</th></tr></thead>';
    portfolioHtml += '<tbody>';
    
    nonZeroBalances.forEach(balance => {
      const usdtValue = balance.usdt_value ? parseFloat(balance.usdt_value).toFixed(2) : 'N/A';
      const total = parseFloat(balance.total);
      const displayTotal = total < 0.001 ? total.toExponential(3) : total.toFixed(6);
      
      portfolioHtml += '<tr>';
      portfolioHtml += `<td><strong>${balance.asset}</strong></td>`;
      portfolioHtml += `<td>${displayTotal}</td>`;
      portfolioHtml += `<td>${usdtValue}</td>`;
      portfolioHtml += `<td><span class="percentage-badge">${balance.percentage}%</span></td>`;
      portfolioHtml += '</tr>';
    });
    
    portfolioHtml += '</tbody></table>';
    portfolioHtml += '</div>';
    portfolioHtml += '</div>';
    
    portfolioSection.innerHTML = portfolioHtml;
    
    // Initialize pie chart
    setTimeout(() => {
      initializePortfolioPieChart(nonZeroBalances);
    }, 100);
  }

  function initializePortfolioPieChart(balances) {
    const chartContainer = document.getElementById('portfolio-pie-chart');
    if (!chartContainer || typeof PieChart === 'undefined') {
      console.warn('PieChart not available or container not found');
      return;
    }
    
    // Prepare data for pie chart
    const chartData = balances.map(balance => ({
      label: balance.asset,
      value: balance.usdt_value || 0,
      percentage: balance.percentage
    }));
    
    // Create pie chart
    const pieChart = new PieChart('portfolio-pie-chart', {
      width: 300,
      height: 300,
      radius: 100,
      showLegend: true,
      legendPosition: 'right',
      title: 'Asset Allocation',
      minSlicePercentage: 2, // Group assets smaller than 2%
      showTooltip: true
    });
    
    pieChart.setData(chartData);
    
    // Store reference for cleanup
    window.currentPieChart = pieChart;
  }

  function displayDetailedDiagnostics(results, container) {
    let diagnosticHtml = '<div class="diagnostic-results">';
    
    // Test stages results
    if (results.test_results && results.test_results.length > 0) {
      diagnosticHtml += '<div class="diagnostic-section">';
      diagnosticHtml += '<h4>🔍 Diagnostic Tests</h4>';
      
      results.test_results.forEach(test => {
        const statusIcon = test.success ? '✅' : '❌';
        const itemClass = test.success ? 'diagnostic-item' : 'diagnostic-item error';
        
        diagnosticHtml += `<div class="${itemClass}">`;
        diagnosticHtml += `<strong>${statusIcon} ${formatStageTitle(test.stage)}</strong>`;
        diagnosticHtml += `<div class="test-message">${test.message}</div>`;
        
        if (test.latency_ms) {
          diagnosticHtml += `<div class="test-detail">Latency: ${test.latency_ms.toFixed(1)}ms</div>`;
        }
        
        if (test.error_code) {
          diagnosticHtml += `<div class="test-detail error-code">Error Code: ${test.error_code}</div>`;
        }
        
        diagnosticHtml += '</div>';
      });
      
      diagnosticHtml += '</div>';
    }

    // Asset balances
    if (results.balances && results.balances.length > 0) {
      const nonZeroBalances = results.balances.filter(b => b.total > 0);
      
      if (nonZeroBalances.length > 0) {
        diagnosticHtml += '<div class="diagnostic-section">';
        diagnosticHtml += `<h4>💰 Portfolio Assets (${nonZeroBalances.length})</h4>`;
        
        // Sort by USDT value descending
        nonZeroBalances.sort((a, b) => (b.usdt_value || 0) - (a.usdt_value || 0));
        
        diagnosticHtml += '<div class="balance-list">';
        nonZeroBalances.slice(0, 10).forEach(balance => { // Show top 10
          const usdtValue = balance.usdt_value ? parseFloat(balance.usdt_value).toFixed(2) : 'N/A';
          const total = parseFloat(balance.total).toFixed(8);
          
          diagnosticHtml += '<div class="diagnostic-item">';
          diagnosticHtml += `<strong>${balance.asset}</strong>`;
          diagnosticHtml += `<div class="balance-details">`;
          diagnosticHtml += `<span class="balance-amount">${total} ${balance.asset}</span>`;
          if (balance.usdt_value) {
            diagnosticHtml += `<span class="balance-value">≈ $${usdtValue} USDT</span>`;
          }
          diagnosticHtml += `</div>`;
          diagnosticHtml += '</div>';
        });
        
        if (nonZeroBalances.length > 10) {
          diagnosticHtml += `<div class="diagnostic-item">... and ${nonZeroBalances.length - 10} more assets</div>`;
        }
        
        diagnosticHtml += '</div>';
        diagnosticHtml += '</div>';
      }
    }

    // Recommendations
    if (results.recommendations && results.recommendations.length > 0) {
      diagnosticHtml += '<div class="diagnostic-section">';
      diagnosticHtml += '<h4>💡 Recommendations</h4>';
      diagnosticHtml += '<div class="diagnostic-item">';
      diagnosticHtml += '<ul>';
      results.recommendations.forEach(rec => {
        diagnosticHtml += `<li>${rec}</li>`;
      });
      diagnosticHtml += '</ul>';
      diagnosticHtml += '</div>';
      diagnosticHtml += '</div>';
    }

    diagnosticHtml += '</div>';
    container.innerHTML = diagnosticHtml;
  }

  function formatStageTitle(stage) {
    return stage.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }

  function getTimeoutDiagnostics() {
    return `<div class="diagnostic-results">
      <div class="diagnostic-item error">
        <strong>⏱️ Connection Timeout</strong>
        <div>The test took too long to complete, which may indicate:</div>
        <ul>
          <li>Network connectivity issues</li>
          <li>Binance API is responding slowly</li>
          <li>Firewall blocking the connection</li>
          <li>DNS resolution problems</li>
        </ul>
      </div>
      <div class="diagnostic-item">
        <strong>🔧 Troubleshooting Steps:</strong>
        <ul>
          <li>Check your internet connection</li>
          <li>Try again in a few minutes</li>
          <li>Verify that api.binance.com is accessible</li>
          <li>Contact your network administrator if issues persist</li>
        </ul>
      </div>
    </div>`;
  }

  function getErrorDiagnostics(error) {
    return `<div class="diagnostic-results">
      <div class="diagnostic-item error">
        <strong>❌ Test Error</strong>
        <div>Error: ${error.message}</div>
      </div>
      <div class="diagnostic-item">
        <strong>🔧 Troubleshooting Steps:</strong>
        <ul>
          <li>Verify your API credentials are correct</li>
          <li>Check if your account has the required permissions</li>
          <li>Ensure your IP is whitelisted in Binance API settings</li>
          <li>Try refreshing the page and testing again</li>
          <li>Contact support if the error persists</li>
        </ul>
      </div>
    </div>`;
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