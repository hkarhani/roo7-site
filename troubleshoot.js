// Wait for both DOM and window to be fully loaded
import CONFIG from './frontend-config.js';

function initializeTroubleshootPage() {
  const API_BASE = CONFIG.API_CONFIG.authUrl;      // auth endpoints (port 443)
  
  
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

  // Update API connection status
  function updateAPIConnectionStatus(status, message) {
    const testResults = document.getElementById('test-results');
    if (!testResults) return;

    let statusClass, statusText;
    
    switch(status) {
      case 'connected':
        statusClass = 'status-connected';
        statusText = '✅ API Connected';
        break;
      case 'failed':
        statusClass = 'status-failed';
        statusText = '❌ API Connection Failed';
        break;
      case 'testing':
        statusClass = 'status-testing';
        statusText = '🔄 Testing Connection...';
        break;
      default:
        statusClass = 'status-testing';
        statusText = '⏳ Ready to Test';
    }

    const statusDiv = `<div class="api-connection-status ${statusClass}">${statusText}</div>`;
    testResults.innerHTML = statusDiv + (message ? `<div class="test-details">${message}</div>` : '');
  }

  // Update API Key Status in Account Details section
  function updateAPIKeyStatus(isConfigured, isValid) {
    const apiKeyStatusElement = document.getElementById('api-key-status');
    if (!apiKeyStatusElement) return;

    if (isValid) {
      apiKeyStatusElement.textContent = '✅ Valid & Working';
      apiKeyStatusElement.style.color = '#28a745';
    } else if (isConfigured) {
      apiKeyStatusElement.textContent = '⚠️ Configured (Not Tested)';
      apiKeyStatusElement.style.color = '#ffc107';
    } else {
      apiKeyStatusElement.textContent = '❌ Not Configured';
      apiKeyStatusElement.style.color = '#dc3545';
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
    
    return summaryHtml;
  }

  // Load account details with enhanced error handling
  async function loadAccountDetails() {
    
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
      }

      if (!account) {
        console.error("❌ Account not found");
        console.log("Available accounts:", accounts.map(a => `"${a.account_name}"`));
        throw new Error(`Account "${accountName}" not found`);
      }


      // Populate UI elements with proper formatting
      const updates = {
        'account-name': account.account_name || 'N/A',
        'strategy': account.strategy || 'N/A', 
        'current-value': account.current_value !== undefined && account.current_value !== null ? `${parseFloat(account.current_value).toFixed(2)}` : 'N/A',
        'hedge-percent': account.hedge_percent !== undefined && account.hedge_percent !== null ? `${account.hedge_percent}%` : 'N/A'
      };

      // Set account type badge
      const accountTypeElement = document.getElementById('account-type');
      const accountType = account.account_type || 'SPOT';
      if (accountTypeElement) {
        accountTypeElement.textContent = accountType;
        accountTypeElement.className = `account-type-badge ${accountType.toLowerCase()}`;
      }

      document.getElementById('api-key-status').textContent = '✅ Configured'

      let updateCount = 0;
      for (const [elementId, value] of Object.entries(updates)) {
        const element = document.getElementById(elementId);
        if (element) {
          element.textContent = value;
          element.style.color = ''; // Reset any error styling
          updateCount++;
        } else {
          console.error(`❌ Element not found: ${elementId}`);
        }
      }


      // Store account data globally
      window.currentAccount = account;
      
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

      // Reset account type to unknown
      const accountTypeElement = document.getElementById('account-type');
      if (accountTypeElement) {
        accountTypeElement.textContent = 'UNKNOWN';
        accountTypeElement.className = 'account-type-badge';
      }

      for (const [elementId, value] of Object.entries(errorUpdates)) {
        const element = document.getElementById(elementId);
        if (element) {
          element.textContent = value;
          element.style.color = '#dc3545';
        }
      }
    }
  }

  // Initialize FUTURES tabs functionality
  function initializeTabs() {
    document.querySelectorAll('.futures-tab').forEach(tab => {
      tab.addEventListener('click', function() {
        const tabType = this.dataset.tab;
        const parentContainer = this.closest('.portfolio-content');
        
        // Update tab states
        parentContainer.querySelectorAll('.futures-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        // Update content visibility
        parentContainer.querySelectorAll('.futures-tab-content').forEach(content => {
          content.classList.remove('active');
        });
        
        const targetContent = document.getElementById(`${tabType}-content`);
        if (targetContent) {
          targetContent.classList.add('active');
        }
      });
    });
  }

  // Enhanced Binance connection test with reorganized display
  async function testBinanceConnection() {
    const testBtn = document.getElementById('test-connection');
    const diagnosticInfo = document.getElementById('diagnostic-info');

    if (!window.currentAccount) {
      showToast('Please wait for account information to load first.', 'warning');
      return;
    }

    // Show loading state
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    
    // Update connection status
    updateAPIConnectionStatus('testing');
    
    // Hide all portfolio sections and clear diagnostics
    const spotSection = document.getElementById('spot-portfolio-section');
    const coinmAssetsSection = document.getElementById('coinm-assets-section');
    const coinmPositionsSection = document.getElementById('coinm-positions-section');
    const coinmOrdersSection = document.getElementById('coinm-orders-section');
    
    if (spotSection) spotSection.style.display = 'none';
    if (coinmAssetsSection) coinmAssetsSection.style.display = 'none';
    if (coinmPositionsSection) coinmPositionsSection.style.display = 'none';
    if (coinmOrdersSection) coinmOrdersSection.style.display = 'none';
    
    if (diagnosticInfo) {
      diagnosticInfo.innerHTML = '<div class="diagnostic-content">🔍 Running comprehensive diagnostics...</div>';
    }
    
    // Show loading toast
    showToast('Testing Binance connection...', 'info', 3000);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      
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

      // Update API connection status and Account Details based on results
      if (results.success && results.api_key_valid && results.ip_whitelisted) {
        updateAPIConnectionStatus('connected'); // Remove total value from here
        updateAPIKeyStatus(true, true); // Update Account Details API Key Status
      } else {
        const issues = [];
        if (!results.api_key_valid) issues.push('Invalid API Key');
        if (!results.ip_whitelisted) issues.push('IP Not Whitelisted');
        updateAPIConnectionStatus('failed', issues.join(', '));
        updateAPIKeyStatus(true, false); // Configured but not working
      }
      
      // Display test summary in test results
      const testResults = document.getElementById('test-results');
      const summaryHtml = displayTestSummary(results, testResults);
      const currentStatus = testResults.innerHTML;
      testResults.innerHTML = currentStatus + summaryHtml;
      
      // Display portfolio sections based on account type and available data
      displayEnhancedPortfolioSections(results);
      
      // Display detailed diagnostics
      if (diagnosticInfo) {
        displayDetailedDiagnostics(results, diagnosticInfo);
      }
      
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
        updateAPIConnectionStatus('failed', 'Connection Timeout');
        if (diagnosticInfo) {
          diagnosticInfo.innerHTML = getTimeoutDiagnostics();
        }
      } else {
        showToast(`Test failed: ${error.message}`, 'error');
        updateAPIConnectionStatus('failed', error.message);
        if (diagnosticInfo) {
          diagnosticInfo.innerHTML = getErrorDiagnostics(error);
        }
      }
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Test Binance Connection';
    }
  }

  // Enhanced portfolio display function for both SPOT and FUTURES accounts
  function displayEnhancedPortfolioSections(results) {
    const accountType = results.account_type || 'SPOT';
    
    // Use detailed snapshot data if available, otherwise fall back to basic balances
    if (results.detailed_snapshot) {
      displayDetailedSnapshot(results.detailed_snapshot, accountType);
    } else {
      // Legacy fallback for SPOT accounts or incomplete data
      displayBasicPortfolio(results, accountType);
    }
  }

  function displayDetailedSnapshot(snapshot, accountType) {
    console.log('📊 Processing detailed snapshot:', snapshot);
    
    // Always display SPOT assets if available
    if (snapshot.spot_assets && snapshot.spot_assets.length > 0) {
      const nonZeroSpotAssets = snapshot.spot_assets.filter(asset => parseFloat(asset.total) > 0);
      if (nonZeroSpotAssets.length > 0) {
        console.log('💰 Displaying SPOT assets:', nonZeroSpotAssets.length);
        displaySpotAssets(nonZeroSpotAssets);
      }
    }
    
    // Display FUTURES assets, positions, and orders in separate sections
    displayCoinMAssets(snapshot.futures_coinm_assets);
    displayCoinMPositions(snapshot.futures_coinm_positions);
    displayCoinMOrders(snapshot.open_orders_futures_coinm);
    
    console.log('✅ Detailed snapshot processing complete');
  }

  function displayCoinMAssets(coinmAssets) {
    const section = document.getElementById('coinm-assets-section');
    const tableBody = document.querySelector('#coinm-assets-table tbody');
    
    if (!coinmAssets || coinmAssets.length === 0) {
      section.style.display = 'none';
      return;
    }
    
    const nonZeroAssets = coinmAssets.filter(asset => parseFloat(asset.total || asset.wallet_balance || 0) > 0);
    if (nonZeroAssets.length === 0) {
      section.style.display = 'none';
      return;
    }
    
    console.log('💰 Displaying Coin-M assets:', nonZeroAssets.length);
    section.style.display = 'block';
    tableBody.innerHTML = '';
    
    nonZeroAssets.forEach(asset => {
      const walletBalance = asset.wallet_balance !== undefined ? 
        parseFloat(asset.wallet_balance).toFixed(6) : 
        parseFloat(asset.total || asset.free || 0).toFixed(6);
      
      const marginBalance = asset.margin_balance !== undefined ? 
        parseFloat(asset.margin_balance).toFixed(6) : 
        parseFloat(asset.total || 0).toFixed(6);
      
      const availableBalance = asset.available_balance !== undefined ? 
        parseFloat(asset.available_balance).toFixed(6) : 
        parseFloat(asset.free || 0).toFixed(6);
      
      const usdtValue = asset.usdt_value ? parseFloat(asset.usdt_value).toFixed(2) : 'N/A';
      const percentage = asset.percentage_of_total ? parseFloat(asset.percentage_of_total).toFixed(2) : '0';
      
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td><strong>${asset.asset}</strong></td>
        <td>${walletBalance}</td>
        <td>${marginBalance}</td>
        <td>${availableBalance}</td>
        <td>${usdtValue}</td>
        <td><span class="percentage-badge">${percentage}%</span></td>
      `;
    });
  }

  function displayCoinMPositions(coinmPositions) {
    const section = document.getElementById('coinm-positions-section');
    const tableBody = document.querySelector('#coinm-positions-table tbody');
    
    if (!coinmPositions || coinmPositions.length === 0) {
      section.style.display = 'none';
      return;
    }
    
    const activePositions = coinmPositions.filter(pos => parseFloat(pos.position_amt) !== 0);
    if (activePositions.length === 0) {
      section.style.display = 'none';
      return;
    }
    
    console.log('📈 Displaying Coin-M positions:', activePositions.length);
    section.style.display = 'block';
    tableBody.innerHTML = '';
    
    activePositions.forEach((position, index) => {
      // Debug: log the first position structure
      if (index === 0) {
        console.log('🔍 First position structure:', position);
        console.log('🔍 Available position fields:', Object.keys(position));
      }
      
      const positionAmt = parseFloat(position.position_amt);
      const isLong = positionAmt > 0;
      const direction = isLong ? 'long' : 'short';
      const directionText = isLong ? 'LONG' : 'SHORT';
      
      const entryPrice = parseFloat(position.entry_price).toFixed(4);
      const markPrice = parseFloat(position.mark_price).toFixed(4);
      const unrealizedPnl = parseFloat(position.unrealized_pnl);
      const pnlClass = unrealizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative';
      
      // Enhanced value calculation for Coin-M positions
      const usdtValue = position.usdt_value !== undefined && position.usdt_value !== null ? 
        parseFloat(position.usdt_value).toFixed(2) : 
        position.notional !== undefined && position.notional !== null ?
        parseFloat(position.notional).toFixed(2) :
        position.notionalValue !== undefined && position.notionalValue !== null ?
        parseFloat(position.notionalValue).toFixed(2) :
        position.value !== undefined && position.value !== null ?
        parseFloat(position.value).toFixed(2) :
        // For Coin-M, calculate notional value: position_amt * mark_price
        Math.abs(positionAmt) * parseFloat(position.mark_price) ? 
        (Math.abs(positionAmt) * parseFloat(position.mark_price)).toFixed(2) : 'N/A';
      
      const percentage = position.percentage_of_total ? parseFloat(position.percentage_of_total).toFixed(2) : '0';
      
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td><strong>${position.symbol}</strong></td>
        <td><span class="position-direction ${direction}">${directionText}</span></td>
        <td>${Math.abs(positionAmt).toFixed(6)}</td>
        <td>${entryPrice}</td>
        <td>${markPrice}</td>
        <td class="${pnlClass}">${unrealizedPnl.toFixed(4)}</td>
        <td>${usdtValue}</td>
        <td><span class="percentage-badge">${percentage}%</span></td>
      `;
    });
  }

  function displayCoinMOrders(coinmOrders) {
    const section = document.getElementById('coinm-orders-section');
    const tableBody = document.querySelector('#coinm-orders-table tbody');
    
    if (!coinmOrders || coinmOrders.length === 0) {
      section.style.display = 'none';
      return;
    }
    
    console.log('📋 Displaying Coin-M orders:', coinmOrders.length);
    section.style.display = 'block';
    tableBody.innerHTML = '';
    
    coinmOrders.forEach(order => {
      const side = order.side.toLowerCase();
      const originalQty = parseFloat(order.original_qty).toFixed(3);
      const price = parseFloat(order.price).toFixed(4);
      
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td><strong>${order.symbol}</strong></td>
        <td><span class="order-side ${side}">${order.side}</span></td>
        <td>${order.type}</td>
        <td>${originalQty}</td>
        <td>${price}</td>
        <td>${order.status}</td>
      `;
    });
  }

  function displayBasicPortfolio(results, accountType) {
    if (!results.balances || results.balances.length === 0) {
      return;
    }
    
    const nonZeroBalances = results.balances.filter(b => b.total > 0);
    if (nonZeroBalances.length === 0) {
      return;
    }
    
    // For basic portfolio, show in SPOT section regardless of account type
    displaySpotAssets(nonZeroBalances);
  }

  function displayComprehensiveFuturesSection(snapshot) {
    console.log('🔮 Building comprehensive FUTURES section...');
    
    // Analyze available data
    const usdtmAssets = snapshot.futures_usdtm_assets?.filter(asset => parseFloat(asset.total || asset.wallet_balance || 0) > 0) || [];
    const coinmAssets = snapshot.futures_coinm_assets?.filter(asset => parseFloat(asset.total || asset.wallet_balance || 0) > 0) || [];
    const usdtmPositions = snapshot.futures_usdtm_positions?.filter(pos => parseFloat(pos.position_amt) !== 0) || [];
    const coinmPositions = snapshot.futures_coinm_positions?.filter(pos => parseFloat(pos.position_amt) !== 0) || [];
    const spotOrders = snapshot.open_orders_spot || [];
    const usdtmOrders = snapshot.open_orders_futures_usdtm || [];
    const coinmOrders = snapshot.open_orders_futures_coinm || [];
    
    console.log('📊 FUTURES data summary:', {
      usdtmAssets: usdtmAssets.length,
      coinmAssets: coinmAssets.length,
      usdtmPositions: usdtmPositions.length,
      coinmPositions: coinmPositions.length,
      spotOrders: spotOrders.length,
      usdtmOrders: usdtmOrders.length,
      coinmOrders: coinmOrders.length
    });
    
    // Check if we have any FUTURES data to display
    const hasFuturesData = usdtmAssets.length > 0 || coinmAssets.length > 0 || 
                          usdtmPositions.length > 0 || coinmPositions.length > 0 ||
                          usdtmOrders.length > 0 || coinmOrders.length > 0;
    
    const section = document.getElementById('futures-comprehensive-section');
    if (!section) {
      console.error('❌ futures-comprehensive-section not found');
      return;
    }
    
    if (!hasFuturesData) {
      console.log('❌ No FUTURES data to display');
      section.style.display = 'none';
      return;
    }
    
    console.log('✅ Displaying comprehensive FUTURES section');
    section.style.display = 'block';
    
    // Build dynamic tabs and content
    const tabsContainer = document.getElementById('futures-dynamic-tabs');
    const contentContainer = document.getElementById('futures-dynamic-content');
    
    if (!tabsContainer || !contentContainer) {
      console.error('❌ Dynamic containers not found');
      return;
    }
    
    // Clear existing content
    tabsContainer.innerHTML = '';
    contentContainer.innerHTML = '';
    
    const tabs = [];
    let firstTab = null;
    
    // Add USDⓈ-M tabs if data exists
    if (usdtmAssets.length > 0 || usdtmPositions.length > 0 || usdtmOrders.length > 0) {
      if (usdtmAssets.length > 0) {
        tabs.push({ id: 'usdtm-assets', label: 'USDⓈ-M Assets', type: 'assets', data: usdtmAssets });
      }
      if (usdtmPositions.length > 0) {
        tabs.push({ id: 'usdtm-positions', label: 'USDⓈ-M Positions', type: 'positions', data: usdtmPositions });
      }
      if (usdtmOrders.length > 0) {
        tabs.push({ id: 'usdtm-orders', label: 'USDⓈ-M Orders', type: 'orders', data: usdtmOrders });
      }
    }
    
    // Add Coin-M tabs if data exists
    if (coinmAssets.length > 0 || coinmPositions.length > 0 || coinmOrders.length > 0) {
      if (coinmAssets.length > 0) {
        tabs.push({ id: 'coinm-assets', label: 'Coin-M Assets', type: 'assets', data: coinmAssets });
      }
      if (coinmPositions.length > 0) {
        tabs.push({ id: 'coinm-positions', label: 'Coin-M Positions', type: 'positions', data: coinmPositions });
      }
      if (coinmOrders.length > 0) {
        tabs.push({ id: 'coinm-orders', label: 'Coin-M Orders', type: 'orders', data: coinmOrders });
      }
    }
    
    // Add SPOT orders if they exist (for consistency)
    if (spotOrders.length > 0) {
      tabs.push({ id: 'spot-orders', label: 'SPOT Orders', type: 'orders', data: spotOrders });
    }
    
    console.log(`📋 Creating ${tabs.length} dynamic tabs:`, tabs.map(t => t.label));
    
    // Create tab buttons
    tabs.forEach((tab, index) => {
      const tabButton = document.createElement('button');
      tabButton.className = `futures-tab ${index === 0 ? 'active' : ''}`;
      tabButton.setAttribute('data-tab', tab.id);
      tabButton.textContent = tab.label;
      tabsContainer.appendChild(tabButton);
      
      if (index === 0) firstTab = tab.id;
    });
    
    // Create tab content areas
    tabs.forEach((tab, index) => {
      const contentDiv = document.createElement('div');
      contentDiv.id = `${tab.id}-content`;
      contentDiv.className = `futures-tab-content ${index === 0 ? 'active' : ''}`;
      
      const tableWrapper = document.createElement('div');
      tableWrapper.className = 'portfolio-table-wrapper';
      
      const table = document.createElement('table');
      table.id = `${tab.id}-table`;
      table.className = 'portfolio-table futures-table';
      
      // Create appropriate table headers based on type
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      
      if (tab.type === 'assets') {
        headerRow.innerHTML = '<th>Asset</th><th>Wallet Balance</th><th>Margin Balance</th><th>Available</th><th>Value (USDT)</th><th>%</th>';
      } else if (tab.type === 'positions') {
        headerRow.innerHTML = '<th>Symbol</th><th>Direction</th><th>Position</th><th>Entry Price</th><th>Mark Price</th><th>PnL</th><th>Value (USDT)</th><th>%</th>';
      } else if (tab.type === 'orders') {
        headerRow.innerHTML = '<th>Symbol</th><th>Side</th><th>Type</th><th>Amount</th><th>Executed</th><th>Price</th><th>Status</th><th>Value</th>';
      }
      
      thead.appendChild(headerRow);
      table.appendChild(thead);
      
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      
      tableWrapper.appendChild(table);
      contentDiv.appendChild(tableWrapper);
      contentContainer.appendChild(contentDiv);
      
      // Populate table with data
      if (tab.type === 'assets') {
        populateAssetsTable(`${tab.id}-table`, tab.data);
      } else if (tab.type === 'positions') {
        populatePositionsTable(`${tab.id}-table`, tab.data);
      } else if (tab.type === 'orders') {
        populateOrdersTable(`${tab.id}-table`, tab.data);
      }
    });
    
    // Re-initialize tab functionality for dynamic tabs
    initializeDynamicTabs();
  }

  function displaySpotAssets(assets) {
    const section = document.getElementById('spot-portfolio-section');
    const tableBody = document.querySelector('#spot-portfolio-table tbody');
    
    if (!assets || assets.length === 0) {
      section.style.display = 'none';
      return;
    }
    
    const nonZeroAssets = assets.filter(asset => asset.total > 0);
    if (nonZeroAssets.length === 0) {
      section.style.display = 'none';
      return;
    }
    
    section.style.display = 'block';
    tableBody.innerHTML = '';
    
    nonZeroAssets.forEach(asset => {
      const free = parseFloat(asset.free || 0).toFixed(6);
      const locked = parseFloat(asset.locked || 0).toFixed(6);
      const total = parseFloat(asset.total || 0);
      const displayTotal = total < 0.001 ? total.toExponential(3) : total.toFixed(6);
      const usdtValue = asset.usdt_value ? parseFloat(asset.usdt_value).toFixed(2) : 'N/A';
      const percentage = asset.percentage_of_total ? parseFloat(asset.percentage_of_total).toFixed(2) : '0';
      
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td><strong>${asset.asset}</strong></td>
        <td>${free}</td>
        <td>${locked}</td>
        <td>${displayTotal}</td>
        <td>${usdtValue}</td>
        <td><span class="percentage-badge">${percentage}%</span></td>
      `;
    });
    
    // Initialize pie chart for SPOT assets
    setTimeout(() => {
      initializeSpotPieChart(nonZeroAssets);
    }, 300);
  }

  function displayFuturesAssets(usdtmAssets, coinmAssets) {
    // First add a FUTURES Assets section to the HTML if it doesn't exist
    addFuturesAssetsSection();
    
    const section = document.getElementById('futures-assets-section');
    if (!section) {
      console.error('❌ FUTURES assets section not found');
      return;
    }

    const hasUSDTMAssets = usdtmAssets && usdtmAssets.length > 0;
    const hasCoinMAssets = coinmAssets && coinmAssets.length > 0;

    if (!hasUSDTMAssets && !hasCoinMAssets) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    // Display USDⓈ-M assets
    displayAssetsInTable('futures-usdtm-assets-table', usdtmAssets);

    // Display Coin-M assets
    displayAssetsInTable('futures-coinm-assets-table', coinmAssets);
  }

  function addFuturesAssetsSection() {
    if (document.getElementById('futures-assets-section')) {
      return; // Already exists
    }

    // Create the FUTURES assets section
    const futuresAssetsHtml = `
    <section id="futures-assets-section" class="dashboard-card portfolio-section" style="display: none;">
      <h2>🔮 FUTURES Assets</h2>
      <div id="futures-assets-content" class="portfolio-content">
        <div class="futures-tabs">
          <button class="futures-tab active" data-tab="usdtm-assets">USDⓈ-M Assets</button>
          <button class="futures-tab" data-tab="coinm-assets">Coin-M Assets</button>
        </div>
        <div id="usdtm-assets-content" class="futures-tab-content active">
          <div class="portfolio-table-wrapper">
            <table id="futures-usdtm-assets-table" class="portfolio-table">
              <thead>
                <tr><th>Asset</th><th>Wallet Balance</th><th>Unrealized PnL</th><th>Margin Balance</th><th>Available</th><th>Value (USDT)</th><th>%</th></tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
        <div id="coinm-assets-content" class="futures-tab-content">
          <div class="portfolio-table-wrapper">
            <table id="futures-coinm-assets-table" class="portfolio-table">
              <thead>
                <tr><th>Asset</th><th>Wallet Balance</th><th>Unrealized PnL</th><th>Margin Balance</th><th>Available</th><th>Value (USDT)</th><th>%</th></tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>
    </section>`;

    // Insert the FUTURES assets section after SPOT assets
    const spotSection = document.getElementById('spot-portfolio-section');
    if (spotSection) {
      spotSection.insertAdjacentHTML('afterend', futuresAssetsHtml);
      
      // Re-initialize tabs for the new section
      setTimeout(() => {
        initializeTabs();
      }, 100);
    }
  }

  function displayAssetsInTable(tableId, assets) {
    const tableBody = document.querySelector(`#${tableId} tbody`);
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (!assets || assets.length === 0) {
      const row = tableBody.insertRow();
      row.innerHTML = '<td colspan="7" class="empty-portfolio-message">No assets available</td>';
      return;
    }

    assets.forEach(asset => {
      // Handle different asset formats - check if it has wallet_balance or just balance data
      const walletBalance = asset.wallet_balance !== undefined ? 
        parseFloat(asset.wallet_balance).toFixed(6) : 
        parseFloat(asset.free || 0).toFixed(6);
      
      const unrealizedPnl = asset.unrealized_pnl !== undefined ? 
        parseFloat(asset.unrealized_pnl).toFixed(4) : 'N/A';
      
      const marginBalance = asset.margin_balance !== undefined ? 
        parseFloat(asset.margin_balance).toFixed(6) : 
        parseFloat(asset.total || 0).toFixed(6);
      
      const availableBalance = asset.available_balance !== undefined ? 
        parseFloat(asset.available_balance).toFixed(6) : 
        parseFloat(asset.free || 0).toFixed(6);
      
      const usdtValue = asset.usdt_value ? parseFloat(asset.usdt_value).toFixed(2) : 'N/A';
      const percentage = asset.percentage_of_total ? parseFloat(asset.percentage_of_total).toFixed(2) : '0';
      
      // PnL styling
      const pnlClass = unrealizedPnl !== 'N/A' && parseFloat(unrealizedPnl) >= 0 ? 'pnl-positive' : 'pnl-negative';

      const row = tableBody.insertRow();
      row.innerHTML = `
        <td><strong>${asset.asset}</strong></td>
        <td>${walletBalance}</td>
        <td class="${pnlClass}">${unrealizedPnl}</td>
        <td>${marginBalance}</td>
        <td>${availableBalance}</td>
        <td>${usdtValue}</td>
        <td><span class="percentage-badge">${percentage}%</span></td>
      `;
    });
  }

  function displayFuturesPositions(usdtmPositions, coinmPositions) {
    console.log('🔧 displayFuturesPositions called with:', {
      usdtm: usdtmPositions?.length || 0,
      coinm: coinmPositions?.length || 0
    });
    
    const section = document.getElementById('futures-positions-section');
    if (!section) {
      console.error('❌ futures-positions-section element not found!');
      return;
    }
    
    if ((!usdtmPositions || usdtmPositions.length === 0) && 
        (!coinmPositions || coinmPositions.length === 0)) {
      console.log('❌ No positions to display, hiding section');
      section.style.display = 'none';
      return;
    }
    
    console.log('✅ Showing FUTURES positions section');
    section.style.display = 'block';
    
    // Display USDⓈ-M positions
    displayPositionsInTable('futures-usdtm-table', usdtmPositions);
    
    // Display Coin-M positions
    displayPositionsInTable('futures-coinm-table', coinmPositions);
  }

  function displayPositionsInTable(tableId, positions) {
    const tableBody = document.querySelector(`#${tableId} tbody`);
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (!positions || positions.length === 0) {
      const row = tableBody.insertRow();
      row.innerHTML = '<td colspan="8" class="empty-portfolio-message">No active positions</td>';
      return;
    }
    
    positions.forEach(position => {
      const positionAmt = parseFloat(position.position_amt);
      const isLong = positionAmt > 0;
      const direction = isLong ? 'long' : 'short';
      const directionText = isLong ? 'LONG' : 'SHORT';
      
      const entryPrice = parseFloat(position.entry_price).toFixed(4);
      const markPrice = parseFloat(position.mark_price).toFixed(4);
      const unrealizedPnl = parseFloat(position.unrealized_pnl);
      const pnlClass = unrealizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative';
      const usdtValue = position.usdt_value ? parseFloat(position.usdt_value).toFixed(2) : 'N/A';
      const percentage = position.percentage_of_total ? parseFloat(position.percentage_of_total).toFixed(2) : '0';
      
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td><strong>${position.symbol}</strong></td>
        <td><span class="position-direction ${direction}">${directionText}</span></td>
        <td>${Math.abs(positionAmt).toFixed(6)}</td>
        <td>${entryPrice}</td>
        <td>${markPrice}</td>
        <td class="${pnlClass}">${unrealizedPnl.toFixed(4)}</td>
        <td>${usdtValue}</td>
        <td><span class="percentage-badge">${percentage}%</span></td>
      `;
    });
  }

  function displayOpenOrders(spotOrders, usdtmOrders, coinmOrders) {
    const section = document.getElementById('open-orders-section');
    
    if ((!spotOrders || spotOrders.length === 0) &&
        (!usdtmOrders || usdtmOrders.length === 0) &&
        (!coinmOrders || coinmOrders.length === 0)) {
      section.style.display = 'none';
      return;
    }
    
    section.style.display = 'block';
    
    // Display orders in respective tables
    displayOrdersInTable('spot-orders-table', spotOrders);
    displayOrdersInTable('usdtm-orders-table', usdtmOrders);
    displayOrdersInTable('coinm-orders-table', coinmOrders);
  }

  function displayOrdersInTable(tableId, orders) {
    const tableBody = document.querySelector(`#${tableId} tbody`);
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (!orders || orders.length === 0) {
      const row = tableBody.insertRow();
      row.innerHTML = '<td colspan="8" class="empty-portfolio-message">No open orders</td>';
      return;
    }
    
    orders.forEach(order => {
      const side = order.side.toLowerCase();
      const originalQty = parseFloat(order.original_qty).toFixed(6);
      const executedQty = parseFloat(order.executed_qty).toFixed(6);
      const price = parseFloat(order.price).toFixed(6);
      const usdtValue = order.usdt_value ? parseFloat(order.usdt_value).toFixed(2) : 'N/A';
      
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td><strong>${order.symbol}</strong></td>
        <td><span class="order-side ${side}">${order.side}</span></td>
        <td>${order.type}</td>
        <td>${originalQty}</td>
        <td>${executedQty}</td>
        <td>${price}</td>
        <td>${order.status}</td>
        <td>${usdtValue}</td>
      `;
    });
  }

  function initializeSpotPieChart(assets) {
    const chartContainer = document.getElementById('spot-portfolio-pie-chart');
    if (!chartContainer || typeof PieChart === 'undefined') {
      return;
    }
    
    chartContainer.innerHTML = '';
    
    if (!assets || assets.length === 0) {
      return;
    }
    
    const chartData = assets.slice(0, 10).map(asset => ({
      label: asset.asset,
      value: parseFloat(asset.usdt_value) || 0.01,
      percentage: parseFloat(asset.percentage_of_total) || 0.01
    }));
    
    try {
      const pieChart = new PieChart('spot-portfolio-pie-chart', {
        width: 280,
        height: 280,
        radius: 100,
        showLegend: false,
        showTooltip: true,
        title: null,
        minSlicePercentage: 0.1,
        showPercentages: true,
        colors: [
          '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
          '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ]
      });
      
      pieChart.setData(chartData);
      window.currentSpotPieChart = pieChart;
    } catch (error) {
      console.error('Error creating SPOT pie chart:', error);
      chartContainer.innerHTML = '<div class="chart-error">Chart loading failed</div>';
    }
  }

  // Legacy function name for compatibility
  function initializePortfolioPieChart(balances) {
    const chartContainer = document.getElementById('portfolio-pie-chart');
    if (!chartContainer) {
      console.warn('Pie chart container not found');
      return;
    }

    if (typeof PieChart === 'undefined') {
      console.warn('PieChart class not available - check if pie-chart.js is loaded');
      return;
    }
    
    // Clear existing chart completely
    chartContainer.innerHTML = '';
    
    // Show all assets, even very small ones
    const allAssets = balances.slice(0, 10);
    
    if (allAssets.length === 0) {
      console.warn('No assets to display in pie chart');
      return;
    }
    
    console.log('Initializing pie chart with', allAssets.length, 'assets');
    
    // Prepare data for pie chart - ensure all assets are visible
    const chartData = allAssets.map(balance => ({
      label: balance.asset,
      value: parseFloat(balance.usdt_value) || 0.01, // Minimum value to ensure visibility
      percentage: parseFloat(balance.percentage) || 0.01 // Minimum percentage
    }));
    
    console.log('Chart data prepared:', chartData);
    
    try {
      // Create pie chart with settings optimized for showing small slices
      const pieChart = new PieChart('portfolio-pie-chart', {
        width: 280,
        height: 280,
        radius: 100,
        showLegend: false,
        showTooltip: true,
        title: null,
        minSlicePercentage: 0.1, // Show slices as small as 0.1%
        showPercentages: true,
        colors: [
          '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
          '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ]
      });
      
      pieChart.setData(chartData);
      
      // Store reference for cleanup
      window.currentPieChart = pieChart;
      
    } catch (error) {
      console.error('❌ Error creating pie chart:', error);
      chartContainer.innerHTML = '<div class="chart-error">Chart loading failed</div>';
    }
  }

  function displayDetailedDiagnostics(results, container) {
    let diagnosticHtml = '<div class="diagnostic-content">';
    
    // Left column: Connection Tests
    diagnosticHtml += '<div class="diagnostic-checklist">';
    diagnosticHtml += '<h4>🔍 Connection Tests</h4>';
    diagnosticHtml += '<ul class="diagnostic-checklist-items">';
    
    if (results.test_results && results.test_results.length > 0) {
      results.test_results.forEach(test => {
        const statusClass = test.success ? 'success' : 'error';
        const statusIcon = test.success ? '✓' : '✗';
        
        diagnosticHtml += `<li>`;
        diagnosticHtml += `<div class="diagnostic-status-icon ${statusClass}">${statusIcon}</div>`;
        diagnosticHtml += `<div>`;
        diagnosticHtml += `<strong>${formatStageTitle(test.stage)}</strong>`;
        if (test.latency_ms) {
          diagnosticHtml += `<div style="font-size: 12px; color: #666;">Latency: ${test.latency_ms.toFixed(1)}ms</div>`;
        }
        diagnosticHtml += `</div>`;
        diagnosticHtml += `</li>`;
      });
    }
    
    diagnosticHtml += '</ul>';
    diagnosticHtml += '</div>';
    
    // Right column: Account Status
    diagnosticHtml += '<div class="diagnostic-checklist">';
    diagnosticHtml += '<h4>📊 Account Status</h4>';
    diagnosticHtml += '<ul class="diagnostic-checklist-items">';
    
    // API Key Status
    const apiKeyClass = results.api_key_valid ? 'success' : 'error';
    const apiKeyIcon = results.api_key_valid ? '✓' : '✗';
    diagnosticHtml += `<li>`;
    diagnosticHtml += `<div class="diagnostic-status-icon ${apiKeyClass}">${apiKeyIcon}</div>`;
    diagnosticHtml += `<div><strong>API Key Valid</strong></div>`;
    diagnosticHtml += `</li>`;
    
    // IP Whitelist Status
    const ipClass = results.ip_whitelisted ? 'success' : 'error';
    const ipIcon = results.ip_whitelisted ? '✓' : '✗';
    diagnosticHtml += `<li>`;
    diagnosticHtml += `<div class="diagnostic-status-icon ${ipClass}">${ipIcon}</div>`;
    diagnosticHtml += `<div><strong>IP Whitelisted</strong></div>`;
    diagnosticHtml += `</li>`;
    
    // Portfolio Value
    if (results.total_usdt_value !== null && results.total_usdt_value !== undefined) {
      diagnosticHtml += `<li>`;
      diagnosticHtml += `<div class="diagnostic-status-icon success">$</div>`;
      diagnosticHtml += `<div><strong>Total Value</strong><div style="font-size: 12px; color: #666;">$${parseFloat(results.total_usdt_value).toFixed(2)}</div></div>`;
      diagnosticHtml += `</li>`;
    }
    
    // Execution Time
    if (results.execution_time_ms) {
      diagnosticHtml += `<li>`;
      diagnosticHtml += `<div class="diagnostic-status-icon success">⚡</div>`;
      diagnosticHtml += `<div><strong>Test Duration</strong><div style="font-size: 12px; color: #666;">${results.execution_time_ms.toFixed(0)}ms</div></div>`;
      diagnosticHtml += `</li>`;
    }
    
    // Asset count
    if (results.detailed_snapshot) {
      const spotCount = results.detailed_snapshot.spot_assets?.length || 0;
      const coinmCount = results.detailed_snapshot.futures_coinm_assets?.length || 0;
      const positionCount = results.detailed_snapshot.futures_coinm_positions?.filter(p => parseFloat(p.position_amt) !== 0).length || 0;
      
      if (spotCount > 0 || coinmCount > 0) {
        diagnosticHtml += `<li>`;
        diagnosticHtml += `<div class="diagnostic-status-icon success">#</div>`;
        diagnosticHtml += `<div><strong>Active Assets</strong><div style="font-size: 12px; color: #666;">SPOT: ${spotCount}, Coin-M: ${coinmCount}</div></div>`;
        diagnosticHtml += `</li>`;
      }
      
      if (positionCount > 0) {
        diagnosticHtml += `<li>`;
        diagnosticHtml += `<div class="diagnostic-status-icon success">📈</div>`;
        diagnosticHtml += `<div><strong>Active Positions</strong><div style="font-size: 12px; color: #666;">${positionCount} Coin-M positions</div></div>`;
        diagnosticHtml += `</li>`;
      }
    }
    
    diagnosticHtml += '</ul>';
    diagnosticHtml += '</div>';
    
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
  } else {
    console.error("❌ Test connection button not found");
  }

  // Initialize alignment fix
  function fixSectionAlignment() {
    console.log("🔧 Applying section alignment fixes...");
    
    // Force grid layout recalculation
    const grid = document.querySelector('.troubleshoot-grid');
    if (grid) {
      grid.style.display = 'grid';
      grid.style.gridTemplateRows = 'auto auto';
      grid.style.minHeight = 'calc(100vh - 120px)';
      grid.style.alignItems = 'start';
    }
    
    // Force table to full width
    const table = document.querySelector('#portfolio-section .portfolio-table');
    if (table) {
      table.style.width = '100%';
      table.style.maxWidth = '100%';
      table.style.tableLayout = 'fixed';
      table.style.display = 'table';
    }
    
  }

  // Helper functions for dynamic table population
  function populateAssetsTable(tableId, assets) {
    const tableBody = document.querySelector(`#${tableId} tbody`);
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    assets.forEach(asset => {
      const walletBalance = asset.wallet_balance !== undefined ? 
        parseFloat(asset.wallet_balance).toFixed(6) : 
        parseFloat(asset.total || asset.free || 0).toFixed(6);
      
      const marginBalance = asset.margin_balance !== undefined ? 
        parseFloat(asset.margin_balance).toFixed(6) : 
        parseFloat(asset.total || 0).toFixed(6);
      
      const availableBalance = asset.available_balance !== undefined ? 
        parseFloat(asset.available_balance).toFixed(6) : 
        parseFloat(asset.free || 0).toFixed(6);
      
      const usdtValue = asset.usdt_value ? parseFloat(asset.usdt_value).toFixed(2) : 'N/A';
      const percentage = asset.percentage_of_total ? parseFloat(asset.percentage_of_total).toFixed(2) : '0';
      
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td><strong>${asset.asset}</strong></td>
        <td>${walletBalance}</td>
        <td>${marginBalance}</td>
        <td>${availableBalance}</td>
        <td>${usdtValue}</td>
        <td><span class="percentage-badge">${percentage}%</span></td>
      `;
    });
  }
  
  function populatePositionsTable(tableId, positions) {
    const tableBody = document.querySelector(`#${tableId} tbody`);
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    positions.forEach((position, index) => {
      // Debug: log the first position structure to understand the data format
      if (index === 0) {
        console.log('🔍 First position structure:', position);
        console.log('🔍 Available position fields:', Object.keys(position));
      }
      const positionAmt = parseFloat(position.position_amt);
      const isLong = positionAmt > 0;
      const direction = isLong ? 'long' : 'short';
      const directionText = isLong ? 'LONG' : 'SHORT';
      
      const entryPrice = parseFloat(position.entry_price).toFixed(4);
      const markPrice = parseFloat(position.mark_price).toFixed(4);
      const unrealizedPnl = parseFloat(position.unrealized_pnl);
      const pnlClass = unrealizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative';
      
      // Check multiple possible field names for position value
      const usdtValue = position.usdt_value !== undefined && position.usdt_value !== null ? 
        parseFloat(position.usdt_value).toFixed(2) : 
        position.notional !== undefined && position.notional !== null ?
        parseFloat(position.notional).toFixed(2) :
        position.notionalValue !== undefined && position.notionalValue !== null ?
        parseFloat(position.notionalValue).toFixed(2) :
        position.value !== undefined && position.value !== null ?
        parseFloat(position.value).toFixed(2) :
        // For Coin-M, calculate notional value: position_amt * mark_price
        Math.abs(positionAmt) * parseFloat(position.mark_price) ? 
        (Math.abs(positionAmt) * parseFloat(position.mark_price)).toFixed(2) : 'N/A';
      
      const percentage = position.percentage_of_total ? parseFloat(position.percentage_of_total).toFixed(2) : '0';
      
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td><strong>${position.symbol}</strong></td>
        <td><span class="position-direction ${direction}">${directionText}</span></td>
        <td>${Math.abs(positionAmt).toFixed(6)}</td>
        <td>${entryPrice}</td>
        <td>${markPrice}</td>
        <td class="${pnlClass}">${unrealizedPnl.toFixed(4)}</td>
        <td>${usdtValue}</td>
        <td><span class="percentage-badge">${percentage}%</span></td>
      `;
    });
  }
  
  function populateOrdersTable(tableId, orders) {
    const tableBody = document.querySelector(`#${tableId} tbody`);
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    orders.forEach(order => {
      const side = order.side.toLowerCase();
      const originalQty = parseFloat(order.original_qty).toFixed(6);
      const executedQty = parseFloat(order.executed_qty).toFixed(6);
      const price = parseFloat(order.price).toFixed(6);
      const usdtValue = order.usdt_value ? parseFloat(order.usdt_value).toFixed(2) : 'N/A';
      
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td><strong>${order.symbol}</strong></td>
        <td><span class="order-side ${side}">${order.side}</span></td>
        <td>${order.type}</td>
        <td>${originalQty}</td>
        <td>${executedQty}</td>
        <td>${price}</td>
        <td>${order.status}</td>
        <td>${usdtValue}</td>
      `;
    });
  }
  
  function initializeDynamicTabs() {
    document.querySelectorAll('#futures-dynamic-tabs .futures-tab').forEach(tab => {
      tab.addEventListener('click', function() {
        const tabId = this.dataset.tab;
        const parentContainer = this.closest('#futures-comprehensive-content');
        
        // Update tab states
        parentContainer.querySelectorAll('.futures-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        // Update content visibility
        parentContainer.querySelectorAll('.futures-tab-content').forEach(content => {
          content.classList.remove('active');
        });
        
        const targetContent = document.getElementById(`${tabId}-content`);
        if (targetContent) {
          targetContent.classList.add('active');
        }
      });
    });
  }

  // Initialize tab functionality
  initializeTabs();

  // Initialize alignment fix
  fixSectionAlignment();

  // Initialize connection status
  updateAPIConnectionStatus('ready', 'Ready to test connection');

  // Start loading account details
  loadAccountDetails();
}

// Multiple initialization strategies to ensure it works
console.log("📄 Script loaded, setting up initialization...");

// Strategy 1: DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeTroubleshootPage, 100);
  });
} else if (document.readyState === 'interactive' || document.readyState === 'complete') {
  // Strategy 2: DOM already ready
  setTimeout(initializeTroubleshootPage, 100);
}

// Strategy 3: Window load as fallback
window.addEventListener('load', () => {
  // Only initialize if not already done
  if (!window.troubleshootInitialized) {
    window.troubleshootInitialized = true;
    setTimeout(initializeTroubleshootPage, 100);
  }
});

// Strategy 4: Immediate execution with longer delay as final fallback
setTimeout(() => {
  if (!window.troubleshootInitialized) {
    window.troubleshootInitialized = true;
    initializeTroubleshootPage();
  }
}, 1000);