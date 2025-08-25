// dashboard.js - Main Dashboard Logic (Mobile Optimized)

// Import centralized configuration
import CONFIG from './frontend-config.js';

document.addEventListener("DOMContentLoaded", () => {
  // Use centralized API configuration
  const API_BASE = CONFIG.API_CONFIG.authUrl;      // auth endpoints (port 443)
  const MARKET_DATA_API = CONFIG.API_CONFIG.marketUrl;
  
  // Update page title
  document.getElementById('page-title').textContent = CONFIG.PAGE_CONFIG.titles.dashboard;

  // Check authentication
  const token = localStorage.getItem("token");
  if (!token) {
    console.log("❌ No token found, redirecting to auth...");
    setTimeout(() => {
      window.location.href = "/auth.html";
    }, 2000);
    return;
  }

  // Initialize modal manager with market data API
  const modalManager = new window.ModalManager(API_BASE, MARKET_DATA_API);
  
  // Setup event delegation for strategy buttons (handles all buttons including dynamically added ones)
  setupEventDelegation();

  // DOM elements
  const logoutBtn = document.getElementById("logout-btn");
  // Note: theme toggle is now handled by theme-manager.js

  // Toast notification system
  window.showToast = function(message, type = 'info', duration = 4000) {
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
  };

  // Basic functions
  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/auth.html";
  }

  // Updated mobile-optimized updateAccountTables function
  function updateAccountTables(accounts) {
    const liveTbody = document.querySelector("#accounts-table tbody");

    if (!liveTbody) {
      console.error("❌ Accounts table not found");
      return;
    }

    liveTbody.innerHTML = "";

    accounts.forEach(acc => {
      // Escape and sanitize account name and other text fields
      const accountName = (acc.account_name || '').replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/\r?\n/g, ' ');
      const strategy = (acc.strategy || '').replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/\r?\n/g, ' ');
      const exchange = (acc.exchange || 'Binance').replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/\r?\n/g, ' ');
      const accountType = (acc.account_type || 'SPOT').replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/\r?\n/g, ' ');
      
      // Strategy display with better names
      let strategyDisplay = 'No Strategy';
      if (strategy && strategy.trim() !== '') {
        if (window.innerWidth <= 768) {
          // Mobile abbreviations
          switch(strategy) {
            case 'High Risk / High Returns Long SPOT':
              strategyDisplay = 'High RR';
              break;
            case 'Medium Risk / Medium Returns Long SPOT':
              strategyDisplay = 'Med RR';
              break;
            case 'Low Risk / Low Returns Fixed Income':
              strategyDisplay = 'Low RR';
              break;
            case 'Custom Portfolio Rebalance':
              strategyDisplay = 'Custom';
              break;
            default:
              strategyDisplay = strategy.length > 8 ? strategy.substring(0, 8) + '...' : strategy;
          }
        } else {
          // Desktop display names
          switch(strategy) {
            case 'High Risk / High Returns Long SPOT':
              strategyDisplay = 'High RR Long';
              break;
            case 'Medium Risk / Medium Returns Long SPOT':
              strategyDisplay = 'Med RR Long';
              break;
            case 'Low Risk / Low Returns Fixed Income':
              strategyDisplay = 'Low RR Fixed';
              break;
            case 'Custom Portfolio Rebalance':
              strategyDisplay = 'Custom Portfolio';
              break;
            default:
              strategyDisplay = strategy;
          }
        }
      }
      
      // Status badges
      let statusBadges = '';
      if (acc.is_disabled) {
        statusBadges += '<span class="status-badge status-disabled" title="Account Disabled">⏸️</span>';
      }
      if (acc.is_revoked) {
        statusBadges += '<span class="status-badge status-revoked" title="Access Revoked">🚫</span>';
      }

      // Test status formatting - mobile optimized
      let testStatusHtml = '';
      switch(acc.test_status) {
        case 'successful':
          testStatusHtml = '<span class="test-status-success">✅ Success</span>';
          break;
        case 'failed':
          testStatusHtml = '<span class="test-status-failed">❌ Failed</span>';
          break;
        default:
          testStatusHtml = '<span class="test-status-na">⚪ N/A</span>';
          break;
      }

      // Format current value safely - mobile optimized
      let currentValueDisplay = 'N/A';
      if (acc.current_value !== undefined && acc.current_value !== null && !isNaN(acc.current_value)) {
        const value = parseFloat(acc.current_value);
        if (window.innerWidth <= 768) {
          // Mobile: Show abbreviated format
          if (value >= 1000000) {
            currentValueDisplay = '$' + (value / 1000000).toFixed(1) + 'M';
          } else if (value >= 1000) {
            currentValueDisplay = '$' + (value / 1000).toFixed(1) + 'K';
          } else {
            currentValueDisplay = '$' + value.toFixed(0);
          }
        } else {
          // Desktop: Show full value with comma separators
          currentValueDisplay = '$' + value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
        }
      }

      // Format hedge percent safely - mobile optimized
      let hedgePercentDisplay = 'N/A';
      if (acc.hedge_percent !== undefined && acc.hedge_percent !== null && !isNaN(acc.hedge_percent)) {
        hedgePercentDisplay = parseFloat(acc.hedge_percent).toFixed(1) + '%';
      }

      // Mobile-friendly account name (truncate if too long)
      let accountNameDisplay = accountName;
      if (window.innerWidth <= 768 && accountName.length > 12) {
        accountNameDisplay = accountName.substring(0, 12) + '...';
      }

      // Format hedge display
      let hedgeDisplay = '';
      if (acc.hedge_percent !== undefined && acc.hedge_percent !== null && !isNaN(acc.hedge_percent)) {
        const hedgeValue = parseFloat(acc.hedge_percent);
        if (hedgeValue === 0) {
          hedgeDisplay = '<div class="hedge-info default"><em>Default Hedge</em></div>';
        } else {
          hedgeDisplay = `<div class="hedge-info active"><em>${hedgeValue.toFixed(1)}% Hedge</em></div>`;
        }
      } else {
        hedgeDisplay = '<div class="hedge-info default"><em>Default Hedge</em></div>';
      }

      liveTbody.innerHTML += `
        <tr>
          <td>
            <div class="account-status">
              <span title="${accountName}">${accountNameDisplay}</span>
              ${statusBadges}
              ${hedgeDisplay}
            </div>
          </td>
          <td title="${exchange}">${exchange}</td>
          <td title="${accountType}">${accountType}</td>
          <td title="${strategy}">${strategyDisplay}</td>
          <td>${currentValueDisplay}</td>
          <td>${testStatusHtml}</td>
          <td class="account-actions">
            <button class="action-icon troubleshoot-icon" data-account-id="${acc.id || ''}" title="Troubleshoot">🔧</button>
            <button class="action-icon hedge-edit-icon" data-id="${acc.id || ''}" title="Edit Settings">⚙️</button>
            <button class="assign-strategy-btn" data-id="${acc.id || ''}" data-name="${accountName}" data-exchange="${exchange}" data-type="${accountType}" title="Assign Strategy">📋</button>
            <button class="edit-account action-icon" data-id="${acc.id || ''}" data-name="${accountName}" title="Edit Account">✏️</button>
            <button class="delete-account action-icon" data-id="${acc.id || ''}" title="Delete Account">🗑️</button>
          </td>
        </tr>`;
    });
  }

  // Load accounts and bind events
  window.loadAccounts = async function() {
    
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/auth.html";
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/accounts`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.status === 401) {
        localStorage.removeItem("token");
        showToast("Session expired. Please log in again.", 'error');
        setTimeout(() => window.location.href = "/auth.html", 2000);
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const accounts = await res.json();
      
      // Store accounts globally for modal access
      window.lastLoadedAccounts = accounts;
      
      updateAccountTables(accounts);
      bindAccountEvents(accounts);
      updateStrategyManagement(accounts);

    } catch (error) {
      console.error("❌ Error loading accounts:", error);
      showToast(`Failed to load accounts: ${error.message}`, 'error');
    }
  };

  function bindAccountEvents(accounts) {
    // Clear any existing event listeners and bind fresh ones
    setTimeout(() => {
      console.log("🔗 Binding fresh event listeners...");

      // Edit account buttons
      document.querySelectorAll('.edit-account').forEach((btn, index) => {
        const accountId = btn.dataset.id;
        const accountName = btn.dataset.name;
        
        console.log(`📝 Binding edit button ${index + 1} for ${accountName} (ID: ${accountId})`);
        
        btn.onclick = function(e) {
          e.preventDefault();
          e.stopImmediatePropagation();
          
          const account = accounts.find(acc => acc.id === accountId);
          if (account) {
            modalManager.openEditAccountModal(account);
          } else {
            console.error("❌ Account not found for ID:", accountId);
            showToast("Account not found", 'error');
          }
        };
      });

      // Delete account buttons  
      document.querySelectorAll('.delete-account').forEach(btn => {
        btn.onclick = function(e) {
          e.preventDefault();
          e.stopImmediatePropagation();
          deleteAccount(btn.dataset.id);
        };
      });

      // Troubleshoot buttons
      document.querySelectorAll('.troubleshoot-icon').forEach(btn => {
        btn.onclick = function() {
          const accountId = btn.dataset.accountId;
          const token = localStorage.getItem("token");
          if (token) {
            window.open(`troubleshoot.html?accountId=${encodeURIComponent(accountId)}`, '_blank');
          } else {
            showToast("You must be logged in to access troubleshooting.", 'error');
          }
        };
      });

      // Hedge edit buttons
      document.querySelectorAll('.hedge-edit-icon').forEach(btn => {
        btn.onclick = function() {
          const accountId = btn.dataset.id;
          const account = accounts.find(acc => acc.id === accountId);
          if (account) {
            modalManager.openHedgeModal(account);
          }
        };
      });

      // Strategy assignment buttons with debug logging
      const strategyButtons = document.querySelectorAll('.assign-strategy-btn');
      console.log(`🔧 Debug: Found ${strategyButtons.length} strategy assignment buttons`);
      
      strategyButtons.forEach((btn, index) => {
        const accountId = btn.dataset.id;
        const accountName = btn.dataset.name;
        console.log(`🔧 Debug: Attaching event listener to button ${index + 1}: ${accountName} (ID: ${accountId})`);
        
        btn.onclick = function() {
          console.log(`🔧 Debug: Strategy button clicked for account: ${accountName} (ID: ${accountId})`);
          
          const account = accounts.find(acc => acc.id === accountId);
          if (account) {
            console.log(`🔧 Debug: Account found, opening modal for: ${account.account_name}`);
            modalManager.openStrategyModal(account);
          } else {
            console.error(`🔧 Debug: Account NOT found for ID: ${accountId}`);
            console.log(`🔧 Debug: Available account IDs:`, accounts.map(acc => acc.id));
            showToast("Account not found", 'error');
          }
        };
      });

    }, 200); // Increased delay for better DOM readiness
  }

  // Add event delegation for strategy buttons as backup (handles dynamically added buttons)
  function setupEventDelegation() {
    const tableContainer = document.querySelector('#accounts-table');
    if (tableContainer) {
      tableContainer.addEventListener('click', function(event) {
        if (event.target.classList.contains('assign-strategy-btn')) {
          console.log(`🔧 Delegation Debug: Strategy button clicked via delegation`);
          
          const btn = event.target;
          const accountId = btn.dataset.id;
          const accountName = btn.dataset.name;
          
          console.log(`🔧 Delegation Debug: Looking for account ID: ${accountId}`);
          
          const account = accounts.find(acc => acc.id === accountId);
          if (account) {
            console.log(`🔧 Delegation Debug: Account found via delegation, opening modal`);
            modalManager.openStrategyModal(account);
          } else {
            console.error(`🔧 Delegation Debug: Account NOT found via delegation for ID: ${accountId}`);
            showToast("Account not found", 'error');
          }
        }
      });
      console.log(`🔧 Delegation Debug: Event delegation setup complete`);
    }
  }

  async function deleteAccount(accountId) {
    if (!confirm("Are you sure you want to delete this account? This action cannot be undone.")) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      showToast("You must be logged in to delete an account.", 'error');
      return;
    }

    // Find the delete button that was clicked
    const deleteButton = document.querySelector(`button.delete-account[data-id="${accountId}"]`);
    if (!deleteButton) {
      console.error("Delete button not found");
      return;
    }

    const originalButtonText = deleteButton.textContent;
    
    // Prevent multiple submissions
    if (deleteButton.disabled) {
      return;
    }

    // Set loading state IMMEDIATELY
    deleteButton.disabled = true;
    deleteButton.style.opacity = "0.6";
    deleteButton.style.cursor = "not-allowed";
    deleteButton.textContent = "Deleting...";
    
    // Show loading toast
    showToast("Deleting account...", 'info', 10000); // 10 second duration

    try {
      const res = await fetch(`${API_BASE}/accounts/${accountId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!res.ok) throw new Error(`Status ${res.status}`);

      // Clear any existing toasts first
      document.querySelectorAll('.toast').forEach(toast => toast.remove());
      showToast("✅ Account deleted successfully!", 'success');
      loadAccounts();

    } catch (err) {
      // Clear any existing toasts first
      document.querySelectorAll('.toast').forEach(toast => toast.remove());
      showToast(`❌ Error deleting account: ${err.message}`, 'error');
    } finally {
      // Always restore button state
      deleteButton.disabled = false;
      deleteButton.style.opacity = "1";
      deleteButton.style.cursor = "pointer";
      deleteButton.textContent = originalButtonText;
    }
  }

  async function fetchUser() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/me`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (res.ok) {
        const data = await res.json();
        document.getElementById("user-fullname").textContent = data.full_name || data.username || "User";
        
        // Check if user is admin and show admin button
        if (data.is_admin) {
          const adminBtn = document.getElementById("admin-btn");
          if (adminBtn) {
            adminBtn.style.display = "inline-block";
          }
        }
        
        // Check subscription status
        await checkSubscriptionStatus();
      } else if (res.status !== 404) {
        localStorage.removeItem("token");
        setTimeout(() => window.location.href = "/auth.html", 2000);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  }

  async function checkSubscriptionStatus() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      // Use invoicing API to get subscription data
      const INVOICING_API_BASE = CONFIG.API_CONFIG.invoicingUrl;
      const res = await fetch(`${INVOICING_API_BASE}/subscriptions/me`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (res.ok) {
        const subscription = await res.json();
        console.log('Subscription data:', subscription);
        
        // Check if user has active subscription
        if (subscription && subscription.status === 'active') {
          const expiresAt = new Date(subscription.expires_at);
          const now = new Date();
          const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
          
          if (daysRemaining > 0) {
            // Show subscription status
            const statusElement = document.getElementById('subscription-status');
            const daysElement = document.getElementById('subscription-days');
            
            if (statusElement && daysElement) {
              daysElement.textContent = `(${daysRemaining} remaining days)`;
              statusElement.style.display = 'block';
            }
          }
        }
      } else if (res.status === 404) {
        // No subscription found - this is normal for users without subscriptions
        console.log('No subscription found for user');
      }
    } catch (error) {
      console.error("Error fetching subscription status:", error);
    }
  }

  // Add resize handler for mobile optimization
  function handleResize() {
    // Reload tables on resize to update mobile/desktop formatting
    if (window.loadAccounts) {
      window.loadAccounts();
    }
  }

  // Debounce function to limit resize event calls
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Event handlers
  logoutBtn.onclick = logout;
  const openModalBtn = document.getElementById("open-modal");
  openModalBtn.onclick = () => {
    console.log("🆕 ADD NEW ACCOUNT clicked");
    modalManager.openAddAccountModal();
  };

  // Market Insights button handler
  // Market Insights button handler
    const marketInsightsBtn = document.getElementById("market-insights-btn");
    if (marketInsightsBtn) {
      marketInsightsBtn.onclick = () => {
        window.location.href = "/market-insights.html";
      };
    }

    // Invoices button handler
    const invoicesBtn = document.getElementById("invoices-btn");
    if (invoicesBtn) {
      invoicesBtn.onclick = () => {
        console.log("📄 INVOICES clicked");
        window.location.href = "/invoices.html";
      };
    }

    // Referrals button handler
    const referralsBtn = document.getElementById("referrals-btn");
    if (referralsBtn) {
      referralsBtn.onclick = () => {
        window.location.href = "/referrals.html";
      };
    }

    // Admin button handler
    const adminBtn = document.getElementById("admin-btn");
    if (adminBtn) {
      adminBtn.onclick = () => {
        console.log("🔧 ADMIN clicked");
        window.location.href = "/admin-dashboard.html";
      };
    }



  // Strategy management functions
  async function updateStrategyManagement(accounts) {
    const totalStrategiesEl = document.getElementById('total-strategies');
    const assignedAccountsEl = document.getElementById('assigned-accounts');
    const strategyListEl = document.getElementById('strategy-list');
    
    if (!totalStrategiesEl || !assignedAccountsEl || !strategyListEl) {
      console.log("Strategy management elements not found");
      return;
    }

    try {
      // Load available strategies
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/strategies`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const strategiesResponse = await response.json();
        const strategies = strategiesResponse.strategies || [];
        
        // Update summary
        totalStrategiesEl.textContent = strategies.length;
        const assignedCount = accounts.filter(acc => acc.strategy && acc.strategy.trim() !== '').length;
        assignedAccountsEl.textContent = assignedCount;
        
        // Update strategy list
        strategyListEl.innerHTML = '';
        
        if (strategies.length === 0) {
          strategyListEl.innerHTML = '<div class="loading-state"><p>No strategies available</p></div>';
        } else {
          strategies.forEach(strategy => {
            const strategyItem = document.createElement('div');
            strategyItem.className = 'strategy-item';
            
            // Add coming soon styling if applicable
            if (strategy.coming_soon === true) {
              strategyItem.classList.add('coming-soon');
            }
            
            let description = 'Standard trading strategy';
            switch(strategy.name) {
              case 'High Risk / High Returns Long SPOT':
                description = 'Aggressive growth strategy for maximum returns';
                break;
              case 'Medium Risk / Medium Returns Long SPOT':
                description = 'Balanced growth with moderate risk';
                break;
              case 'Low Risk / Low Returns Fixed Income':
                description = strategy.coming_soon === true ? 
                  `Conservative strategy for stable returns - ${strategy.note || '🔜 Coming Soon'}` :
                  'Conservative strategy for stable returns';
                break;
              case 'Custom Portfolio Rebalance':
                description = 'Fully customizable asset allocation';
                break;
            }
            
            // Display strategy name with coming soon indicator
            const displayName = strategy.coming_soon === true ? 
              `${strategy.name} ${strategy.note || '🔜 Coming Soon'}` : 
              strategy.name;
            
            strategyItem.innerHTML = `
              <div class="strategy-info">
                <div class="strategy-name">${displayName}</div>
                <div class="strategy-description">${description}</div>
              </div>
            `;
            
            strategyListEl.appendChild(strategyItem);
          });
        }
      } else {
        strategyListEl.innerHTML = '<div class="loading-state"><p>Failed to load strategies</p></div>';
        totalStrategiesEl.textContent = '-';
        assignedAccountsEl.textContent = '-';
      }
    } catch (error) {
      console.error('Error updating strategy management:', error);
      strategyListEl.innerHTML = '<div class="loading-state"><p>Error loading strategies</p></div>';
      totalStrategiesEl.textContent = '-';
      assignedAccountsEl.textContent = '-';
    }
  }

  // Refresh strategies button handler
  const refreshStrategiesBtn = document.getElementById('refresh-strategies');
  if (refreshStrategiesBtn) {
    refreshStrategiesBtn.onclick = async () => {
      showToast("Refreshing strategies...", 'info', 2000);
      
      // Reload strategies by calling loadAccounts which will trigger updateStrategyManagement
      await loadAccounts();
      showToast("Strategies refreshed", 'success');
    };
  }

  // Add event listener for window resize
  window.addEventListener('resize', debounce(handleResize, 250));

  // === ANALYTICS FUNCTIONALITY ===
  
  let analyticsChart = null;
  let currentAnalyticsData = null;

  // Initialize analytics
  async function initializeAnalytics() {
    try {
      // Initialize chart
      if (typeof LineChart !== 'undefined') {
        // Get container dimensions for responsive chart
        const container = document.getElementById('analytics-chart');
        const containerRect = container.getBoundingClientRect();
        
        analyticsChart = new LineChart('analytics-chart', {
          width: Math.max(300, containerRect.width - 40),
          height: Math.min(320, Math.max(280, containerRect.height - 20)),
          animate: true,
          showGrid: true,
          showTooltip: true,
          margin: { top: 20, right: 30, bottom: 40, left: 60 },
          responsive: true
        });
        console.log('📊 Analytics chart initialized');
      } else {
        console.warn('LineChart class not available');
      }

      // Load accounts list for dropdown
      await loadAnalyticsAccountsList();
      
      // Load initial analytics data
      await loadAnalyticsData();
      
      // Set up event listeners
      setupAnalyticsEventListeners();
      
    } catch (error) {
      console.error('Error initializing analytics:', error);
    }
  }

  async function loadAnalyticsAccountsList() {
    try {
      const response = await fetch(`${API_BASE}/analytics/user-accounts-list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Analytics accounts response:', data);
        const select = document.getElementById('analytics-account-select');
        
        // Clear existing options
        select.innerHTML = '';
        
        // Add "ALL" option
        const allOption = document.createElement('option');
        allOption.value = 'ALL';
        allOption.textContent = 'All Accounts';
        select.appendChild(allOption);
        
        // Add individual accounts
        if (data.success && data.accounts) {
          console.log('🔍 Processing accounts:', data.accounts);
          data.accounts.forEach((account, index) => {
            console.log(`🔍 Account ${index}:`, account);
            const option = document.createElement('option');
            option.value = account.account_id;
            option.textContent = account.account_name;
            select.appendChild(option);
          });
          
          console.log(`📊 Loaded ${data.accounts.length} accounts for analytics`);
        } else {
          console.warn('🔍 No accounts found in response:', data);
        }
        
        // Select "ALL" by default
        select.value = 'ALL';
        
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading analytics accounts list:', error);
      const select = document.getElementById('analytics-account-select');
      select.innerHTML = '<option value="">Error loading accounts</option>';
    }
  }

  async function loadAnalyticsData() {
    const accountSelect = document.getElementById('analytics-account-select');
    const periodSelect = document.getElementById('analytics-period-select');
    
    if (!accountSelect || !periodSelect) return;
    
    const selectedAccount = accountSelect.value;
    const selectedPeriod = parseInt(periodSelect.value);
    
    if (!selectedAccount) return;
    
    try {
      // Show loading state
      if (analyticsChart) {
        analyticsChart.showLoadingState();
      }
      
      let response;
      
      if (selectedAccount === 'ALL') {
        // Load aggregated data for all accounts
        response = await fetch(`${API_BASE}/analytics/user-aggregated-values?days=${selectedPeriod}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      } else {
        // Load data for specific account
        response = await fetch(`${API_BASE}/analytics/account-values/${selectedAccount}?days=${selectedPeriod}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }

      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          currentAnalyticsData = data;
          displayAnalyticsData(data, selectedAccount);
          console.log(`📊 Loaded analytics data: ${data.data_points || 0} points`);
        } else {
          throw new Error('Invalid response data');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      console.error('Error loading analytics data:', error);
      showAnalyticsError('Failed to load analytics data');
    }
  }

  function displayAnalyticsData(data, selectedAccount) {
    try {
      // Update summary cards
      updateAnalyticsSummary(data, selectedAccount);
      
      // Prepare chart data
      let chartData = [];
      
      if (selectedAccount === 'ALL') {
        // Aggregated data format
        if (data.values && data.values.length > 0) {
          chartData = [{
            name: 'Total Portfolio',
            color: '#3b82f6',
            values: data.values.map(point => ({
              timestamp: point.timestamp,
              value_usdt: point.total_value,
              date: new Date(point.timestamp)
            }))
          }];
        }
      } else {
        // Single account data format
        if (data.values && data.values.length > 0) {
          chartData = [{
            name: data.account_name || 'Account',
            color: '#10b981',
            values: data.values
          }];
        }
      }
      
      // Update chart
      if (analyticsChart && chartData.length > 0) {
        analyticsChart.setData(chartData);
      } else if (analyticsChart) {
        analyticsChart.showEmptyState();
      }
      
    } catch (error) {
      console.error('Error displaying analytics data:', error);
      showAnalyticsError('Error displaying data');
    }
  }

  function updateAnalyticsSummary(data, selectedAccount) {
    try {
      const currentTotalEl = document.getElementById('current-total-badge');
      const periodChangeEl = document.getElementById('period-change-badge');
      const changePercentageEl = document.getElementById('change-percentage-badge');
      let values = [];
      let dataPoints = 0;
      
      if (selectedAccount === 'ALL') {
        values = data.values || [];
        dataPoints = data.data_points || 0;
      } else {
        values = data.values || [];
        dataPoints = data.data_points || 0;
      }
      
      // Calculate summary metrics
      let currentTotal = 0;
      let periodChange = 0;
      let changePercentage = 0;
      
      if (values.length > 0) {
        const latestValue = values[values.length - 1];
        const earliestValue = values[0];
        
        currentTotal = selectedAccount === 'ALL' ? 
          latestValue.total_value : 
          latestValue.value_usdt || latestValue.value;
          
        const earliestAmount = selectedAccount === 'ALL' ? 
          earliestValue.total_value : 
          earliestValue.value_usdt || earliestValue.value;
        
        periodChange = currentTotal - earliestAmount;
        changePercentage = earliestAmount > 0 ? (periodChange / earliestAmount) * 100 : 0;
      }
      
      // Update UI
      currentTotalEl.textContent = formatCurrency(currentTotal);
      periodChangeEl.textContent = formatCurrency(periodChange);
      periodChangeEl.className = 'status-badge ' + (periodChange >= 0 ? 'positive' : 'negative');
      
      changePercentageEl.textContent = formatPercentage(changePercentage);
      changePercentageEl.className = 'status-badge ' + (changePercentage >= 0 ? 'positive' : 'negative');
      
    } catch (error) {
      console.error('Error updating analytics summary:', error);
    }
  }

  function showAnalyticsError(message) {
    if (analyticsChart) {
      analyticsChart.clear();
    }
    
    // Update summary cards with error state
    document.getElementById('current-total-badge').textContent = 'Error';
    document.getElementById('period-change-badge').textContent = 'Error';
    document.getElementById('change-percentage-badge').textContent = 'Error';
    
    showToast(message, 'error');
  }

  function setupAnalyticsEventListeners() {
    // Account selection change
    const accountSelect = document.getElementById('analytics-account-select');
    if (accountSelect) {
      accountSelect.addEventListener('change', async () => {
        console.log('📊 Account selection changed:', accountSelect.value);
        await loadAnalyticsData();
      });
    }
    
    // Period selection change
    const periodSelect = document.getElementById('analytics-period-select');
    if (periodSelect) {
      periodSelect.addEventListener('change', async () => {
        console.log('📊 Period selection changed:', periodSelect.value);
        await loadAnalyticsData();
      });
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-analytics');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        showToast('Refreshing analytics...', 'info', 1000);
        await loadAnalyticsData();
        showToast('Analytics refreshed', 'success');
      });
    }
  }

  // Utility functions
  function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  }

  function formatPercentage(value) {
    return (value || 0).toFixed(2) + '%';
  }

  // Initialize
  fetchUser();
  loadAccounts();
  
  // Initialize analytics after a short delay to ensure DOM is ready
  setTimeout(initializeAnalytics, 1000);
});