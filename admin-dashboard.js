// admin-dashboard.js - Admin Dashboard Logic v3.5

// Import centralized configuration
import CONFIG from './frontend-config.js';

// === UTILITY FUNCTIONS ===

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Invalid Date';
  }
}

function formatNumber(num, decimals = 2) {
  if (!num && num !== 0) return '0.00';
  return parseFloat(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatCrypto(num, decimals = 8) {
  if (!num && num !== 0) return '0';
  return parseFloat(num).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
}

function formatPrice(num, decimals = 4) {
  if (!num && num !== 0) return '0';
  return parseFloat(num).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
}

function formatCurrency(value, decimals = 2, withSign = true) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }
  const numeric = Number(value);
  const formatted = Math.abs(numeric).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  const sign = !withSign || numeric === 0 ? '' : (numeric > 0 ? '+' : '-');
  return `${sign}$${formatted}`;
}

function formatPercentage(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }
  const numeric = Number(value);
  const prefix = numeric > 0 ? '+' : numeric < 0 ? '-' : '';
  const formatted = Math.abs(numeric).toFixed(decimals);
  return `${prefix}${formatted}%`;
}

function pickSummaryValue(summary, keys) {
  if (!summary) return null;
  for (const key of keys) {
    if (summary[key] !== undefined && summary[key] !== null) {
      const numeric = Number(summary[key]);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
    }
  }
  return null;
}

function getAccountTotalValue(account) {
  if (!account || typeof account !== 'object') {
    return null;
  }

  const getByPath = (obj, path) => {
    return path.reduce((acc, key) => {
      if (acc === null || acc === undefined) {
        return null;
      }
      return acc[key];
    }, obj);
  };

  const normalizeNumeric = (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const candidatePaths = [
    ['current_value_with_pnl'],
    ['current_total_value'],
    ['current_value'],
    ['portfolio_total_value'],
    ['total_value'],
    ['total_value_usd'],
    ['total_value_usdt'],
    ['current_value_usdt'],
    ['analytics_total_value_usdt'],
    ['portfolio_value'],
    ['account_value'],
    ['value_usdt'],
    ['summary', 'total_value_usdt'],
    ['summary', 'total_value'],
    ['summary', 'account_value'],
    ['detailed_breakdown', 'summary', 'total_value_usdt'],
    ['metrics', 'total_value'],
    ['analytics', 'value_usdt'],
    ['portfolio', 'total_value_usdt']
  ];

  const candidateEntries = [];
  for (const path of candidatePaths) {
    const candidate = normalizeNumeric(getByPath(account, path));
    if (candidate !== null) {
      candidateEntries.push({ path: path.join('.'), value: candidate });
    }
  }

  if (normalizeNumeric(account.analytics_total_value_usdt) !== null && !candidateEntries.some(entry => entry.path === 'analytics_total_value_usdt')) {
    candidateEntries.push({
      path: 'analytics_total_value_usdt',
      value: normalizeNumeric(account.analytics_total_value_usdt)
    });
  }

  if (normalizeNumeric(account.current_value) !== null && !candidateEntries.some(entry => entry.path === 'current_value')) {
    candidateEntries.push({
      path: 'current_value',
      value: normalizeNumeric(account.current_value)
    });
  }

  const summaryTotal = normalizeNumeric(getByPath(account, ['summary', 'total_value_usdt']));
  if (summaryTotal !== null) {
    candidateEntries.push({
      path: 'summary.total_value_usdt',
      value: summaryTotal,
      includesPnl: true
    });
  }

  if (candidateEntries.length === 0) {
    return null;
  }

  const preferredOrder = [
    'current_value_with_pnl',
    'current_total_value',
    'current_value',
    'total_value_with_pnl',
    'analytics_total_value_usdt',
    'analytics.value_usdt',
    'metrics.total_value',
    'total_value_usdt',
    'total_value',
    'total_value_usd',
    'summary.total_value_usdt',
    'summary.total_value',
    'summary.account_value',
    'portfolio_total_value',
    'portfolio.total_value_usdt',
    'detailed_breakdown.summary.total_value_usdt',
    'portfolio_value',
    'account_value',
    'value_usdt'
  ];

  let baseEntry = null;
  for (const key of preferredOrder) {
    const match = candidateEntries.find(entry => entry.path === key);
    if (match) {
      baseEntry = match;
      break;
    }
  }

  if (!baseEntry) {
    baseEntry = candidateEntries[0];
  }

  let baseValue = baseEntry.value;
  let baseSource = `path:${baseEntry.path}`;
  const baseIncludesPnl = Boolean(baseEntry.includesPnl);

  const componentPaths = [
    ['summary', 'spot_value_usdt'],
    ['summary', 'usdtm_value_usdt'],
    ['summary', 'coinm_value_usdt'],
    ['summary', 'futures_value_usdt'],
    ['summary', 'margin_value_usdt'],
    ['detailed_breakdown', 'summary', 'spot_value_usdt'],
    ['detailed_breakdown', 'summary', 'usdtm_value_usdt'],
    ['detailed_breakdown', 'summary', 'coinm_value_usdt'],
    ['portfolio', 'total_value_usdt']
  ];

  let componentSum = 0;
  let componentsFound = false;
  for (const path of componentPaths) {
    const value = normalizeNumeric(getByPath(account, path));
    if (value !== null) {
      componentSum += value;
      componentsFound = true;
    }
  }

  if ((baseValue === null || baseValue <= 0) && componentsFound && componentSum > 0) {
    baseValue = componentSum;
    baseSource = 'componentSum';
  }

  if (baseValue === null) {
    baseValue = normalizeNumeric(account.current_value);
    if (baseValue !== null) {
      baseSource = 'current_value';
    }
  }

  if (baseValue === null && componentsFound && componentSum !== 0) {
    baseValue = componentSum;
    baseSource = 'componentSum';
  }

  if (baseValue === null) {
    return null;
  }

  const pnlCandidatePaths = [
    ['unrealized_pnl'],
    ['total_unrealized_pnl'],
    ['total_unrealized_pnl_usdt'],
    ['summary', 'unrealized_pnl_usdt'],
    ['summary', 'total_unrealized_pnl_usdt'],
    ['summary', 'spot_unrealized_pnl_usdt'],
    ['summary', 'usdtm_unrealized_pnl_usdt'],
    ['summary', 'coinm_unrealized_pnl_usdt'],
    ['summary', 'futures_unrealized_pnl_usdt'],
    ['portfolio_unrealized_pnl']
  ];

  let pnlTotal = 0;
  let pnlFound = false;
  for (const path of pnlCandidatePaths) {
    const pnl = normalizeNumeric(getByPath(account, path));
    if (pnl !== null) {
      pnlTotal += pnl;
      pnlFound = true;
    }
  }

  const numericBase = normalizeNumeric(baseValue);
  const baseSourceLabel = baseSource || '';
  const baseLikelyIncludesPnl = baseIncludesPnl || (typeof baseSourceLabel === 'string'
    ? /current_value|with_pnl|analytics|metrics/.test(baseSourceLabel)
    : false);
  const combinedFromComponents = componentsFound
    ? normalizeNumeric(componentSum + (pnlFound ? pnlTotal : 0))
    : null;

  if (combinedFromComponents !== null) {
    if (numericBase === null || !Number.isFinite(numericBase)) {
      return combinedFromComponents;
    }

    const tolerance = Math.max(0.5, Math.abs(combinedFromComponents) * 0.005);
    const diff = Math.abs(numericBase - combinedFromComponents);

    if (baseLikelyIncludesPnl) {
      if (diff <= tolerance) {
        return numericBase;
      }
      if (numericBase >= combinedFromComponents - tolerance) {
        return numericBase;
      }
    }

    if (diff <= tolerance) {
      return Math.max(numericBase, combinedFromComponents);
    }

    if (numericBase < combinedFromComponents - tolerance) {
      return combinedFromComponents;
    }

    return numericBase;
  }

  if (pnlFound && numericBase !== null && Number.isFinite(numericBase)) {
    if (!baseLikelyIncludesPnl) {
      return numericBase + pnlTotal;
    }
    return numericBase;
  }

  return numericBase;
}

function getAccountUnrealizedPnl(account) {
  if (!account || typeof account !== 'object') {
    return null;
  }

  const getByPath = (obj, path) => {
    return path.reduce((acc, key) => {
      if (acc === null || acc === undefined) {
        return null;
      }
      return acc[key];
    }, obj);
  };

  const normalizeNumeric = (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const directPaths = [
    ['summary', 'total_unrealized_pnl_usdt'],
    ['summary', 'unrealized_pnl_usdt'],
    ['detailed_breakdown', 'summary', 'total_unrealized_pnl_usdt'],
    ['portfolio', 'total_unrealized_pnl_usdt'],
    ['total_unrealized_pnl_usdt'],
    ['total_unrealized_pnl'],
    ['unrealized_pnl']
  ];

  for (const path of directPaths) {
    const candidate = normalizeNumeric(getByPath(account, path));
    if (candidate !== null) {
      return candidate;
    }
  }

  const componentPaths = [
    ['summary', 'spot_unrealized_pnl_usdt'],
    ['summary', 'usdtm_unrealized_pnl_usdt'],
    ['summary', 'coinm_unrealized_pnl_usdt'],
    ['summary', 'futures_unrealized_pnl_usdt'],
    ['detailed_breakdown', 'summary', 'spot_unrealized_pnl_usdt'],
    ['detailed_breakdown', 'summary', 'usdtm_unrealized_pnl_usdt'],
    ['detailed_breakdown', 'summary', 'coinm_unrealized_pnl_usdt']
  ];

  let componentTotal = 0;
  let foundComponent = false;
  for (const path of componentPaths) {
    const componentValue = normalizeNumeric(getByPath(account, path));
    if (componentValue !== null) {
      componentTotal += componentValue;
      foundComponent = true;
    }
  }

  if (foundComponent) {
    return componentTotal;
  }

  const breakdown = account.detailed_breakdown;
  if (breakdown && typeof breakdown === 'object') {
    let breakdownSum = 0;
    let breakdownFound = false;

    const accumulateFromItems = (items) => {
      if (!Array.isArray(items)) {
        return;
      }

      for (const item of items) {
        if (!item || typeof item !== 'object') {
          continue;
        }

        const pnlKeys = [
          'unrealized_pnl',
          'unrealized_profit',
          'pnl',
          'unrealizedPnl'
        ];

        for (const key of pnlKeys) {
          const value = normalizeNumeric(item[key]);
          if (value !== null) {
            breakdownSum += value;
            breakdownFound = true;
            break;
          }
        }
      }
    };

    for (const section of Object.values(breakdown)) {
      if (!section || typeof section !== 'object') {
        continue;
      }

      accumulateFromItems(section.positions);
      accumulateFromItems(section.assets);
      accumulateFromItems(section.open_orders);
    }

    if (breakdownFound) {
      return breakdownSum;
    }
  }

  const fallback = normalizeNumeric(account.total_unrealized_pnl_usdt ?? account.total_unrealized_pnl ?? account.unrealized_pnl);
  return fallback !== null ? fallback : null;
}

document.addEventListener("DOMContentLoaded", () => {
  // Use centralized API configuration  
  const INVOICING_API_BASE = CONFIG.API_CONFIG.invoicingUrl;
  const AUTH_API_BASE = CONFIG.API_CONFIG.authUrl;
  const JOBS_API_BASE = CONFIG.API_CONFIG.jobsUrl;
  
  // Check authentication
  const token = localStorage.getItem("token");
  if (!token) {
    setTimeout(() => {
      window.location.href = "/auth.html";
    }, 2000);
    return;
  }

  const buildAuthHeaders = (extra = {}) => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra
  });

  const normalizePositiveInt = (value, fallback, max) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    const normalized = Math.floor(parsed);
    if (normalized <= 0) {
      return fallback;
    }
    if (typeof max === 'number' && normalized > max) {
      return max;
    }
    return normalized;
  };

  const normalizeNonNegativeInt = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    const normalized = Math.floor(parsed);
    return normalized < 0 ? fallback : normalized;
  };

  const ACTIVE_ACCOUNTS_PAGE_SIZES = [10, 25, 50, 100];
  const ACTIVE_ACCOUNTS_STATUS_LABELS = {
    healthy: 'Healthy',
    warning: 'Warning',
    error: 'Error',
    disabled: 'Disabled',
    unknown: 'Unknown'
  };

  // Cached account datasets for verification flows
  let currentActiveAccounts = [];
  let currentUsersAccounts = [];

  let activeAccountsSummary = {
    total_accounts: 0,
    unique_users: 0,
    strategy_count: 0
  };

  let activeAccountsPagination = {
    page: 1,
    pageSize: 25,
    totalPages: 1,
    totalItems: 0,
    returnedCount: 0,
    hasNext: false,
    hasPrevious: false
  };

  let activeAccountsFilters = {
    search: '',
    strategy: '',
    status: ''
  };

  const normalizeActiveAccountsFilters = (filters = {}) => ({
    search: typeof filters.search === 'string' ? filters.search.trim() : '',
    strategy: typeof filters.strategy === 'string' ? filters.strategy.trim() : '',
    status: typeof filters.status === 'string' ? filters.status.trim() : ''
  });

  const syncActiveAccountsFilterInputs = () => {
    const searchInput = document.getElementById('active-accounts-search');
    if (searchInput && searchInput.value !== activeAccountsFilters.search) {
      searchInput.value = activeAccountsFilters.search;
    }

    const strategySelect = document.getElementById('active-accounts-strategy-filter');
    if (strategySelect && strategySelect.value !== activeAccountsFilters.strategy) {
      strategySelect.value = activeAccountsFilters.strategy || '';
    }

    const statusSelect = document.getElementById('active-accounts-status-filter');
    if (statusSelect && statusSelect.value !== activeAccountsFilters.status) {
      statusSelect.value = activeAccountsFilters.status || '';
    }
  };

  const updateActiveAccountsFilterOptions = (filtersData = {}) => {
    const strategySelect = document.getElementById('active-accounts-strategy-filter');
    const statusSelect = document.getElementById('active-accounts-status-filter');

    const strategies = Array.isArray(filtersData.available_strategies)
      ? filtersData.available_strategies.filter(Boolean).sort((a, b) => a.localeCompare(b))
      : [];

    const statuses = Array.isArray(filtersData.available_statuses)
      ? filtersData.available_statuses.filter(Boolean).sort((a, b) => a.localeCompare(b))
      : [];

    if (strategySelect) {
      const currentSelection = activeAccountsFilters.strategy;
      strategySelect.innerHTML = ['<option value="">All strategies</option>',
        ...strategies.map(strategyName => {
          const safeName = strategyName || '';
          const isSelected = safeName === currentSelection ? 'selected' : '';
          return `<option value="${safeName}">${safeName}</option>`;
        })
      ].join('');

      if (!strategies.includes(currentSelection)) {
        strategySelect.value = '';
        if (currentSelection) {
          activeAccountsFilters.strategy = '';
        }
      }
    }

    if (statusSelect) {
      const currentStatus = activeAccountsFilters.status;
      const options = ['<option value="">All statuses</option>'];
      statuses.forEach(statusValue => {
        const label = ACTIVE_ACCOUNTS_STATUS_LABELS[statusValue] || statusValue.toUpperCase();
        const selected = statusValue === currentStatus ? 'selected' : '';
        options.push(`<option value="${statusValue}" ${selected}>${label}</option>`);
      });
      statusSelect.innerHTML = options.join('');

      if (!statuses.includes(currentStatus)) {
        statusSelect.value = '';
        if (currentStatus) {
          activeAccountsFilters.status = '';
        }
      }
    }
  };

  const collectActiveAccountsFilters = () => {
    const searchInput = document.getElementById('active-accounts-search');
    const strategySelect = document.getElementById('active-accounts-strategy-filter');
    const statusSelect = document.getElementById('active-accounts-status-filter');

    return normalizeActiveAccountsFilters({
      search: searchInput ? searchInput.value : '',
      strategy: strategySelect ? strategySelect.value : '',
      status: statusSelect ? statusSelect.value : ''
    });
  };

  const applyActiveAccountsFilters = () => {
    activeAccountsFilters = collectActiveAccountsFilters();
    loadActiveAccounts(1, activeAccountsPagination.pageSize, { ...activeAccountsFilters });
  };

  const resetActiveAccountsFilters = () => {
    activeAccountsFilters = { search: '', strategy: '', status: '' };
    syncActiveAccountsFilterInputs();
    loadActiveAccounts(1, activeAccountsPagination.pageSize, { ...activeAccountsFilters });
  };

  const attachActiveAccountsFilterListeners = () => {
    const applyButton = document.getElementById('active-accounts-apply-filters');
    if (applyButton) {
      applyButton.onclick = () => applyActiveAccountsFilters();
    }

    const clearButton = document.getElementById('active-accounts-clear-filters');
    if (clearButton) {
      clearButton.onclick = () => resetActiveAccountsFilters();
    }

    const searchInput = document.getElementById('active-accounts-search');
    if (searchInput) {
      searchInput.onkeydown = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyActiveAccountsFilters();
        }
      };
    }
  };

  // 🔒 SECURITY: Verify admin access before loading dashboard
  async function verifyAdminAccess() {
    try {
      // Get current user info to verify admin status
      const response = await fetch(`${AUTH_API_BASE}/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const userData = await response.json();
      
      // Check if user is admin
      if (!userData.is_admin) {
        // 🚨 SECURITY VIOLATION: Non-admin user trying to access admin dashboard
        console.error("🚨 SECURITY VIOLATION: Unauthorized admin dashboard access attempt");
        
        // Log the unauthorized access attempt
        await logUnauthorizedAccess(userData, token);
        
        // Show security warning and redirect
        showSecurityViolationMessage();
        setTimeout(() => {
          window.location.href = "/dashboard.html";
        }, 5000);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error verifying admin access:", error);
      // showToast may not be defined yet, so use alert as fallback
      if (typeof showToast === 'function') {
        showToast("Authentication error. Redirecting...", 'error');
      } else {
        alert("Authentication error. Redirecting to login...");
      }
      setTimeout(() => {
        window.location.href = "/auth.html";
      }, 2000);
      return false;
    }
  }

  // Log unauthorized access attempt to backend
  async function logUnauthorizedAccess(userData, token) {
    try {
      const accessLog = {
        user_id: userData._id || userData.id,
        username: userData.username,
        email: userData.email,
        full_name: userData.full_name || 'Unknown',
        attempted_resource: 'admin-dashboard',
        timestamp: new Date().toISOString(),
        ip_address: await getClientIP(),
        user_agent: navigator.userAgent,
        referrer: document.referrer || 'direct',
        session_token: token.substring(0, 20) + '...' // Log partial token for tracking
      };

      // Send to backend for logging and email notification
      await fetch(`${INVOICING_API_BASE}/admin/security/unauthorized-access`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(accessLog)
      });
    } catch (error) {
      console.error("Failed to log unauthorized access:", error);
    }
  }

  // Get client IP for logging
  async function getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  // Show security violation message
  function showSecurityViolationMessage() {
    document.body.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100vh;
        background: #f8f9fa;
        color: #721c24;
        text-align: center;
        padding: 20px;
        font-family: 'Segoe UI', sans-serif;
      ">
        <div style="
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          border-radius: 8px;
          padding: 40px;
          max-width: 600px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        ">
          <h1 style="margin-bottom: 20px; color: #721c24;">🚨 Access Denied</h1>
          <h2 style="margin-bottom: 20px; color: #856404;">Unauthorized Access Detected</h2>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            You do not have administrative privileges to access this resource.
            This incident has been logged and security has been notified.
          </p>
          <p style="font-size: 14px; color: #6c757d; margin-bottom: 30px;">
            If you believe this is an error, please contact support immediately.
          </p>
          <p style="font-size: 14px; color: #495057;">
            Redirecting to dashboard in <span id="countdown">5</span> seconds...
          </p>
        </div>
      </div>
    `;
    
    // Countdown timer
    let seconds = 5;
    const countdownElement = document.getElementById('countdown');
    const interval = setInterval(() => {
      seconds--;
      if (countdownElement) {
        countdownElement.textContent = seconds;
      }
      if (seconds <= 0) {
        clearInterval(interval);
      }
    }, 1000);
  }

  // Only proceed with admin dashboard if access is verified
  verifyAdminAccess().then(isAuthorized => {
    if (!isAuthorized) {
      return; // Stop execution if not authorized
    }

    // Continue with normal admin dashboard initialization...

  // Auth headers helper
  function getAuthHeaders(token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

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

  // Global variables for modal management
  let currentWalletVerification = null;
  let currentUpgrade = null;
  let currentInvoice = null;

  // === SYSTEM OVERVIEW FUNCTIONS ===
  // Global variable to store the latest platform analytics value
  let latestPlatformValue = 0;
  const PLATFORM_KPI_PERIODS = [
    { id: '1d', days: 1 },
    { id: '3d', days: 3 },
    { id: '7d', days: 7 },
    { id: '30d', days: 30 }
  ];
  let platformAnalyticsSnapshot = { chart: [], summary: {} };
  const platformKpiCache = new Map();
  let platformKpiLoading = false;

  async function loadSystemOverview() {
    try {
      // Only fetch the dashboard summary, use stored platform analytics value
      const summaryResponse = await fetch(`${INVOICING_API_BASE}/admin/dashboard/summary`, {
        headers: getAuthHeaders(token)
      });

      let summary = {};

      // Handle summary response
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        summary = summaryData.summary || summaryData || {};
      } else {
        console.warn('Failed to load dashboard summary, using defaults');
      }

      // Fetch jobs execution summary from jobs-manager admin API
      try {
        const jobsResponse = await fetch(`${JOBS_API_BASE}/admin/jobs/summary`, {
          headers: getAuthHeaders(token)
        });
        if (jobsResponse.ok) {
          summary.jobs_summary = await jobsResponse.json();
        } else {
          console.warn('Failed to load jobs summary');
        }
      } catch (jobsError) {
        console.warn('Jobs summary request failed:', jobsError);
      }

      // Use the stored platform analytics value (updated by loadPlatformAnalytics)
      summary.total_portfolio_value = latestPlatformValue;
      displaySystemOverview(summary);
    } catch (error) {
      console.error('Error loading system overview:', error);
      document.getElementById('overview-stats').innerHTML = 
        '<div class="empty-state admin"><h4>Failed to Load Overview</h4><p>Please check your admin permissions.</p></div>';
    }
  }

  function displaySystemOverview(summary) {
    const container = document.getElementById('overview-stats');
    
    // Safely extract data with fallbacks
    const users = summary.users || summary.user_stats || {};
    const subscriptions = summary.subscriptions || summary.subscription_stats || {};
    const invoices = summary.invoices || summary.invoice_stats || {};
    const portfolio = summary.portfolio || summary.portfolio_stats || {};
    const jobsSummary = summary.jobs_summary || {};
    
    container.innerHTML = `
      <div class="overview-summary">
        <div class="stat-card admin clickable" onclick="window.location.href='/admin-users.html'">
          <div class="stat-icon">👥</div>
          <div class="stat-label">Total Users</div>
          <div class="stat-value">${users.total || users.count || 0}</div>
          <div class="stat-action">Click to manage →</div>
        </div>
        <div class="stat-card admin clickable" onclick="window.location.href='/admin-accounts.html'">
          <div class="stat-icon">💰</div>
          <div class="stat-label">Total Accounts</div>
          <div class="stat-value">${users.total_accounts || 0}</div>
          <div class="stat-action">Click to manage →</div>
        </div>
        <div class="stat-card admin clickable" onclick="window.location.href='/admin-users.html'">
          <div class="stat-icon">🔄</div>
          <div class="stat-label">Active Subs</div>
          <div class="stat-value">${subscriptions.active || subscriptions.active_count || 0}</div>
          <div class="stat-action">Click to manage →</div>
        </div>
        <div class="stat-card admin clickable" onclick="window.location.href='/admin-users.html'">
          <div class="stat-icon">📄</div>
          <div class="stat-label">Pending Invoices</div>
          <div class="stat-value">${invoices.pending || invoices.pending_count || 0}</div>
          <div class="stat-action">Click to manage →</div>
        </div>
        <div class="stat-card admin clickable" onclick="window.location.href='/admin-users.html'">
          <div class="stat-icon">💰</div>
          <div class="stat-label">Total Revenue</div>
          <div class="stat-value">$${(invoices.total_revenue || invoices.revenue || 0).toLocaleString()}</div>
          <div class="stat-action">Click to manage →</div>
        </div>
        <div class="stat-card admin clickable" onclick="window.location.href='/admin-accounts.html'">
          <div class="stat-icon">📈</div>
          <div class="stat-label">Total Portfolio Value</div>
          <div class="stat-value">$${(summary.total_portfolio_value || 0).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}</div>
          <div class="stat-action">All account values combined →</div>
        </div>
        <div class="stat-card admin clickable" onclick="window.location.href='/admin-jobs-manager.html'">
          <div class="stat-icon">🧮</div>
          <div class="stat-label">Jobs Executed</div>
          <div class="stat-value">${jobsSummary.total_jobs || 0}</div>
          <div class="stat-action">View execution history →</div>
        </div>
        <div class="stat-card admin clickable" onclick="window.location.href='/admin-jobs-manager.html'">
          <div class="stat-icon">🚨</div>
          <div class="stat-label">Job Failures</div>
          <div class="stat-value">${jobsSummary.total_failed || 0}</div>
          <div class="stat-action">Investigate recent failures →</div>
        </div>
      </div>
    `;
  }

  // === ACTIVE ACCOUNTS FUNCTIONS ===
  async function loadActiveAccounts(
    targetPage = activeAccountsPagination.page,
    targetPageSize = activeAccountsPagination.pageSize,
    overrideFilters = null
  ) {
    try {
      if (overrideFilters) {
        activeAccountsFilters = normalizeActiveAccountsFilters(overrideFilters);
      }

      const requestedPage = normalizePositiveInt(targetPage, activeAccountsPagination.page);
      const requestedPageSize = normalizePositiveInt(targetPageSize, activeAccountsPagination.pageSize, 100);

      const params = new URLSearchParams({
        page: String(requestedPage),
        page_size: String(requestedPageSize)
      });

      if (activeAccountsFilters.strategy) {
        params.set('strategy', activeAccountsFilters.strategy);
      }

      if (activeAccountsFilters.status) {
        params.set('status', activeAccountsFilters.status);
      }

      if (activeAccountsFilters.search) {
        params.set('search', activeAccountsFilters.search);
      }

      const response = await fetch(`${AUTH_API_BASE}/admin/accounts/active-trading?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const accounts = Array.isArray(result.accounts) ? result.accounts : [];
      currentActiveAccounts = accounts;

      const summaryData = (result.summary && typeof result.summary === 'object') ? result.summary : {};
      const paginationData = (result.pagination && typeof result.pagination === 'object') ? result.pagination : {};
      const filtersData = (result.filters && typeof result.filters === 'object') ? result.filters : {};
      const appliedFiltersData = normalizeActiveAccountsFilters(result.applied_filters || activeAccountsFilters);

      activeAccountsFilters = appliedFiltersData;
      updateActiveAccountsFilterOptions(filtersData);
      syncActiveAccountsFilterInputs();

      const sanitizedPageSize = normalizePositiveInt(paginationData.page_size, requestedPageSize, 100);
      const fallbackTotalItems = normalizeNonNegativeInt(summaryData.total_accounts, accounts.length);
      const totalItems = normalizeNonNegativeInt(paginationData.total_items, fallbackTotalItems);
      const totalPagesFallback = Math.max(1, Math.ceil((totalItems || accounts.length) / sanitizedPageSize));
      const totalPages = normalizePositiveInt(paginationData.total_pages, totalPagesFallback);

      const rawPage = normalizePositiveInt(paginationData.page, requestedPage);
      const sanitizedPage = Math.min(rawPage, totalPages);
      const returnedCount = accounts.length;

      const fallbackSummaryCounters = {
        total_accounts: totalItems || accounts.length,
        unique_users: (() => {
          const seen = new Set();
          accounts.forEach(acc => {
            const candidate = acc._user_id || acc.user_id || acc.userId || acc.username || acc.email;
            if (candidate !== undefined && candidate !== null && candidate !== '') {
              seen.add(candidate);
            }
          });
          return seen.size;
        })(),
        strategy_count: (() => {
          const seen = new Set();
          accounts.forEach(acc => {
            const strategy = acc.strategy;
            if (strategy !== undefined && strategy !== null && strategy !== '') {
              seen.add(strategy);
            }
          });
          return seen.size;
        })()
      };

      activeAccountsSummary = {
        total_accounts: normalizeNonNegativeInt(summaryData.total_accounts, fallbackSummaryCounters.total_accounts),
        unique_users: normalizeNonNegativeInt(summaryData.unique_users, fallbackSummaryCounters.unique_users),
        strategy_count: normalizeNonNegativeInt(summaryData.strategy_count, fallbackSummaryCounters.strategy_count)
      };

      activeAccountsPagination = {
        page: sanitizedPage,
        pageSize: sanitizedPageSize,
        totalPages,
        totalItems,
        returnedCount,
        hasNext: typeof paginationData.has_next === 'boolean'
          ? paginationData.has_next
          : (totalItems > 0 && sanitizedPage < totalPages),
        hasPrevious: typeof paginationData.has_previous === 'boolean'
          ? paginationData.has_previous
          : sanitizedPage > 1
      };

      displayActiveAccounts(accounts, activeAccountsSummary, activeAccountsPagination);
      attachUserAccountVerifyListeners();
      attachActiveAccountsPaginationListeners();
      attachActiveAccountsFilterListeners();

    } catch (error) {
      console.error('❌ Error loading active trading accounts:', error);
      document.getElementById('active-accounts-container').innerHTML = `
        <div class="error-state">
          <p>❌ Failed to load active trading accounts: ${error.message}</p>
          <button onclick="window.loadActiveAccounts()" class="retry-btn">🔄 Retry</button>
        </div>
      `;
    }
  }

  window.loadActiveAccounts = loadActiveAccounts;

  function displayActiveAccounts(accounts, summary, pagination) {
    const container = document.getElementById('active-accounts-container');

    const safeSummary = summary && typeof summary === 'object' ? summary : activeAccountsSummary;
    const safePagination = pagination && typeof pagination === 'object' ? pagination : activeAccountsPagination;

    const totalAccounts = normalizeNonNegativeInt(safeSummary.total_accounts, Array.isArray(accounts) ? accounts.length : 0);

    const page = normalizePositiveInt(safePagination.page, 1);
    const pageSize = normalizePositiveInt(safePagination.pageSize, Array.isArray(accounts) && accounts.length > 0 ? accounts.length : 25, 100);
    const totalPages = Math.max(1, normalizePositiveInt(safePagination.totalPages, 1));
    const returnedCount = normalizeNonNegativeInt(safePagination.returnedCount, Array.isArray(accounts) ? accounts.length : 0);
    const totalItems = normalizeNonNegativeInt(safePagination.totalItems, totalAccounts);
    const hasNext = Boolean(safePagination.hasNext);
    const hasPrevious = Boolean(safePagination.hasPrevious);

    const startIndex = totalItems === 0 || returnedCount === 0
      ? 0
      : ((page - 1) * pageSize) + 1;
    const endIndex = totalItems === 0 || returnedCount === 0
      ? 0
      : Math.min(totalItems, startIndex + returnedCount - 1);

    const pageSizes = Array.from(new Set([...ACTIVE_ACCOUNTS_PAGE_SIZES, pageSize]))
      .filter(size => Number.isFinite(size) && size > 0)
      .sort((a, b) => a - b);

    const filtersApplied = Boolean(activeAccountsFilters.search || activeAccountsFilters.strategy || activeAccountsFilters.status);

    const tableMarkup = Array.isArray(accounts) && accounts.length > 0
      ? `
        <div class="active-accounts-table-container">
          <table class="active-accounts-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Account Name</th>
                <th>Account Type</th>
                <th>Strategy</th>
                <th>Total Value</th>
                <th>Status</th>
                <th>Revoked</th>
                <th>Disabled</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${accounts.map(account => {
                const totalValue = getAccountTotalValue(account);
                const fallbackValue = totalValue !== null ? totalValue : account.current_value;
                const parsedTooltip = Number(fallbackValue);
                const tooltipValue = Number.isFinite(parsedTooltip) ? parsedTooltip : 0;
                const formattedValue = formatAccountValue(fallbackValue);
                const unrealizedPnl = getAccountUnrealizedPnl(account);
                const tooltipParts = [`Total portfolio value (incl. unrealized PnL): $${formatNumber(tooltipValue)}`];
                if (unrealizedPnl !== null) {
                  tooltipParts.push(`Unrealized PnL: $${formatNumber(unrealizedPnl, 2)}`);
                }
                const tooltipText = tooltipParts.join('\n');

                return `
                <tr>
                  <td class="user-name" title="${account.username || account._id}">
                    ${account.username || account._id || 'Unknown User'}
                  </td>
                  <td class="account-name" title="${account.account_name || 'Unnamed Account'}">
                    ${account.account_name || 'Unnamed Account'}
                  </td>
                  <td class="account-type">
                    <span class="account-type-badge spot">TRADING</span>
                  </td>
                  <td class="account-strategy">
                    <span class="strategy-tag">${account.strategy || 'None'}</span>
                  </td>
                  <td class="account-value center-align" title="${tooltipText}">
                    ${formattedValue}
                  </td>
                  <td>${formatStatusBadge(account.test_status || account.overall_status, account.last_status)}</td>
                  <td>${renderStatePair(account.is_revoked, account.active_job_is_revoked)}</td>
                  <td>${renderStatePair(account.is_disabled, account.active_job_is_disabled)}</td>
                  <td>
                    <button class="verify-user-account-btn action-btn success" data-account-id="${account._id}">🔍 Verify</button>
                  </td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `
      : `
        <div class="empty-state">
          <p>${filtersApplied ? '🔍 No accounts match the current filters' : '📭 No active trading accounts found'}</p>
          <small>${filtersApplied ? 'Adjust filters or reset to see all active trading accounts.' : 'No paying users have active trading accounts at this time.'}</small>
        </div>
      `;

    const paginationMarkup = `
      <div class="active-accounts-pagination">
        <div class="active-accounts-pagination-controls">
          <button id="active-accounts-prev" class="pagination-btn" ${hasPrevious ? '' : 'disabled'}>◀ Prev</button>
          <span class="pagination-info">Page ${Math.min(page, totalPages)} of ${totalPages}</span>
          <button id="active-accounts-next" class="pagination-btn" ${hasNext ? '' : 'disabled'}>Next ▶</button>
        </div>
        <div class="active-accounts-pagination-size">
          <label for="active-accounts-page-size">Rows per page</label>
          <select id="active-accounts-page-size">
            ${pageSizes.map(size => `<option value="${size}" ${size === pageSize ? 'selected' : ''}>${size}</option>`).join('')}
          </select>
          <span class="pagination-count">
            ${totalItems === 0 ? '0-0' : `${startIndex}-${endIndex}`} of ${totalItems}
          </span>
        </div>
      </div>
    `;

    container.innerHTML = `${tableMarkup}${paginationMarkup}`;
  }

  function attachActiveAccountsPaginationListeners() {
    const prevButton = document.getElementById('active-accounts-prev');
    const nextButton = document.getElementById('active-accounts-next');
    const pageSizeSelect = document.getElementById('active-accounts-page-size');

    if (prevButton) {
      prevButton.onclick = () => {
        if (activeAccountsPagination.page > 1) {
          loadActiveAccounts(activeAccountsPagination.page - 1, activeAccountsPagination.pageSize);
        }
      };
    }

    if (nextButton) {
      nextButton.onclick = () => {
        if (activeAccountsPagination.hasNext) {
          loadActiveAccounts(activeAccountsPagination.page + 1, activeAccountsPagination.pageSize);
        }
      };
    }

    if (pageSizeSelect) {
      pageSizeSelect.onchange = (event) => {
        const newSize = normalizePositiveInt(event.target.value, activeAccountsPagination.pageSize, 100);
        if (newSize !== activeAccountsPagination.pageSize) {
          loadActiveAccounts(1, newSize);
        }
      };
    }

    const header = document.getElementById('active-accounts-title');
    if (header) {
      header.textContent = `👥 Active Trading Accounts (${activeAccountsSummary.total_accounts || 0})`;
    }
  }

  // Helper function to format account values
  function formatAccountValue(value) {
    if (!value || value === 0 || value === '0' || value === null || value === undefined) {
      return '<span class="no-value">N/A</span>';
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      return '<span class="no-value">N/A</span>';
    }

    // Show exact amount with 1 decimal place and thousand separators
    return `<span class="account-value-amount">$${numValue.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}</span>`;
  }

  // Helper function to format last updated timestamp
  function formatLastUpdated(timestamp) {
    if (!timestamp) {
      return 'Never updated';
    }
    
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) {
        return 'Just now';
      } else if (diffMins < 60) {
        return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
      } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else if (diffDays < 7) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch (e) {
      return 'Unknown';
    }
  }

  // Helper function to format status badges
  function formatStatusBadge(overallStatus, lastStatus) {
    const statusMap = {
      'healthy': { class: 'status-success', text: 'Healthy' },
      'successful': { class: 'status-success', text: 'Successful' },
      'error': { class: 'status-error', text: 'Error' },
      'warning': { class: 'status-warning', text: 'Warning' },
      'disabled': { class: 'status-error', text: 'Disabled' },
      'unknown': { class: 'status-unknown', text: 'Unknown' }
    };

    const status = overallStatus || 'unknown';
    const statusInfo = statusMap[status] || statusMap['unknown'];
    const tooltip = lastStatus ? `Last status: ${lastStatus}` : 'No status data';

    return `<span class="status-badge ${statusInfo.class}" title="${tooltip}">${statusInfo.text}</span>`;
  }

  function normalizeBoolean(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return ['true', '1', 'yes', 'y'].includes(normalized);
    }
    return false;
  }

  function renderStatePair(accountValue, jobValue) {
    const accountFlag = normalizeBoolean(accountValue);
    const jobFlag = jobValue === null || jobValue === undefined ? null : normalizeBoolean(jobValue);

    const accountBadge = `<span class="state-badge ${accountFlag ? 'state-no' : 'state-yes'}" title="Account flag">${accountFlag ? '❌ Account' : '✅ Account'}</span>`;
    const jobBadge = jobFlag === null
      ? '<span class="state-badge state-unknown" title="No active job">— Job</span>'
      : `<span class="state-badge ${jobFlag ? 'state-no' : 'state-yes'}" title="Active job flag">${jobFlag ? '❌ Job' : '✅ Job'}</span>`;

    return `<div class="state-pair">${accountBadge}${jobBadge}</div>`;
  }

  function formatProfessionalValue(value) {
    if (!value || value === 0) {
      return '<span class="value-zero">$0</span>';
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      return '<span class="value-zero">$0</span>';
    }

    // Format without decimals as requested
    return `<span class="value-amount">$${Math.round(numValue).toLocaleString()}</span>`;
  }

  function getProfessionalStatusBadge(overallStatus, lastStatus) {
    // Determine if status is success/failed based on overall status
    let statusClass, statusText;

    if (overallStatus === 'healthy' || overallStatus === 'successful' || lastStatus === 'healthy' || lastStatus === 'success' || lastStatus === 'successful' || lastStatus === 'active') {
      statusClass = 'status-success';
      statusText = 'Success';
    } else if (overallStatus === 'error' || overallStatus === 'disabled' || lastStatus === 'error' || lastStatus === 'failed') {
      statusClass = 'status-failed';
      statusText = 'Failed';
    } else if (overallStatus === 'warning' || lastStatus === 'warning') {
      statusClass = 'status-warning';
      statusText = 'Warning';
    } else {
      statusClass = 'status-unknown';
      statusText = 'Unknown';
    }

    const tooltip = lastStatus ? `Last status: ${lastStatus}` : 'No status data';
    return `<span class="professional-status ${statusClass}" title="${tooltip}">${statusText}</span>`;
  }

  // === USERS ACCOUNTS FUNCTIONS ===
  async function loadUsersAccounts() {
    try {
      const response = await fetch(`${AUTH_API_BASE}/admin/accounts/users-accounts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      currentUsersAccounts = result.accounts || [];
      displayUsersAccounts(result.accounts || []);
      attachUserAccountVerifyListeners();
      
    } catch (error) {
      console.error('❌ Error loading users accounts:', error);
      document.getElementById('users-accounts-container').innerHTML = `
        <div class="error-state">
          <p>❌ Failed to load users accounts: ${error.message}</p>
          <button onclick="loadUsersAccounts()" class="retry-btn">🔄 Retry</button>
        </div>
      `;
    }
  }

  function displayUsersAccounts(accounts) {
    const container = document.getElementById('users-accounts-container');
    
    if (!accounts || accounts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>📭 No accounts without strategies found</p>
          <small>All paying users have strategies assigned to their accounts</small>
        </div>
      `;
      return;
    }

    // Create summary
    const totalAccounts = accounts.length;
    const uniqueUsers = new Set(accounts.map(acc => acc._user_id)).size;
    const exchangeCounts = accounts.reduce((acc, account) => {
      const exchange = account.exchange || 'Unknown';
      acc[exchange] = (acc[exchange] || 0) + 1;
      return acc;
    }, {});

    container.innerHTML = `
      <div class="users-accounts-summary">
        <span>${totalAccounts}</span> accounts without strategies from <span>${uniqueUsers}</span> paying users
        <div class="exchanges-breakdown">
          ${Object.entries(exchangeCounts).map(([exchange, count]) => `<span class="exchange-tag">${exchange}: ${count}</span>`).join(' ')}
        </div>
      </div>
      <div class="users-accounts-table-container">
        <table class="users-accounts-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Account Name</th>
              <th>Exchange</th>
              <th>Last Value</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${accounts.map(account => {
              const totalValue = getAccountTotalValue(account);
              const fallbackValue = totalValue !== null ? totalValue : (account.current_value ?? account.current_total_value ?? 0);
              const numericValue = Number(fallbackValue) || 0;
              const unrealizedPnl = getAccountUnrealizedPnl(account);
              const tooltipParts = [`Total portfolio value (incl. unrealized PnL): $${formatNumber(numericValue)}`];
              if (unrealizedPnl !== null) {
                tooltipParts.push(`Unrealized PnL: $${formatNumber(unrealizedPnl, 2)}`);
              }
              const tooltipText = tooltipParts.join('\n');

              return `
                <tr>
                  <td class="user-name" title="${account.username || account._id}">
                    ${account.username || account._id || 'Unknown User'}
                  </td>
                  <td class="account-name" title="${account.account_name || 'Unnamed Account'}">
                    ${account.account_name || 'Unnamed Account'}
                  </td>
                  <td class="account-exchange">${account.exchange || 'Binance'}</td>
                  <td class="account-value center-align" title="${tooltipText}">
                    ${formatAccountValue(numericValue)}
                  </td>
                  <td>${formatStatusBadge(account.test_status || account.overall_status, account.last_status)}</td>
                  <td>
                    <button class="verify-user-account-btn action-btn success" data-account-id="${account._id}">🔍 Verify</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // === WALLET VERIFICATION FUNCTIONS ===
  async function loadWalletVerifications() {
    try {
      const response = await fetch(`${INVOICING_API_BASE}/admin/wallet/pending-verifications`, {
        headers: getAuthHeaders(token)
      });

      if (response.ok) {
        const data = await response.json();
        displayWalletVerifications(data.pending_verifications);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading wallet verifications:', error);
      document.getElementById('pending-verifications').innerHTML = 
        '<div class="empty-state admin"><h4>Failed to Load</h4><p>Could not load wallet verifications.</p></div>';
    }
  }

  function displayWalletVerifications(verifications) {
    const container = document.getElementById('pending-verifications');
    
    if (verifications.length === 0) {
      container.innerHTML = '<div class="empty-state admin"><h4>No Pending Verifications</h4><p>All wallet verifications are up to date.</p></div>';
      return;
    }

    container.innerHTML = verifications.map(verification => `
      <div class="wallet-verification-item">
        <div class="wallet-info">
          <div class="user-name">${verification.full_name || verification.username}</div>
          <div class="wallet-address">${verification.wallet_address}</div>
          <div class="request-date">Requested: ${new Date(verification.requested_at).toLocaleDateString()}</div>
        </div>
        <div class="wallet-actions">
          <button class="success-btn" onclick="openWalletModal('${verification.user_id}', '${verification.wallet_address}', '${verification.username}')">
            ✅ Review
          </button>
        </div>
      </div>
    `).join('');
  }

  // Make function global for onclick
  window.openWalletModal = function(userId, address, username) {
    currentWalletVerification = { userId, address, username };
    
    document.getElementById('wallet-verification-details').innerHTML = `
      <div class="detail-row">
        <span class="detail-label">User:</span>
        <span class="detail-value">${username}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Wallet Address:</span>
        <span class="detail-value" style="font-family: monospace;">${address}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Wallet Type:</span>
        <span class="detail-value">Web3 Wallet</span>
      </div>
    `;
    
    document.getElementById('wallet-verification-modal').style.display = 'block';
  };

  async function verifyWallet() {
    if (!currentWalletVerification) return;
    
    try {
      const response = await fetch(`${INVOICING_API_BASE}/admin/wallet/verify/${currentWalletVerification.userId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          verification_method: 'manual_admin'
        })
      });

      if (response.ok) {
        showToast('Wallet verified successfully!', 'success');
        document.getElementById('wallet-verification-modal').style.display = 'none';
        loadWalletVerifications();
      } else {
        const error = await response.json();
        showToast(`Failed to verify wallet: ${error.detail}`, 'error');
      }
    } catch (error) {
      console.error('Error verifying wallet:', error);
      showToast('Error verifying wallet', 'error');
    }
  }

  async function rejectWallet() {
    if (!currentWalletVerification) return;
    
    const reason = prompt('Reason for rejection:') || 'Invalid wallet address';
    
    try {
      const response = await fetch(`${INVOICING_API_BASE}/admin/wallet/reject/${currentWalletVerification.userId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          reason: reason
        })
      });

      if (response.ok) {
        showToast('Wallet verification rejected', 'success');
        document.getElementById('wallet-verification-modal').style.display = 'none';
        loadWalletVerifications();
      } else {
        const error = await response.json();
        showToast(`Failed to reject wallet: ${error.detail}`, 'error');
      }
    } catch (error) {
      console.error('Error rejecting wallet:', error);
      showToast('Error rejecting wallet', 'error');
    }
  }

  // === INVOICE MANAGEMENT FUNCTIONS ===
  async function loadInvoices(status = '') {
    try {
      let url = `${INVOICING_API_BASE}/admin/invoices`;
      if (status) url += `?status=${status}`;
      
      const headers = getAuthHeaders(token);
      const response = await fetch(url, {
        headers: headers
      });

      if (response.ok) {
        const data = await response.json();
        // Handle different possible response structures
        const invoices = data.invoices || data || [];
        displayInvoices(invoices);
        updateInvoiceStats(invoices);
      } else {
        const errorText = await response.text();
        console.error('📄 Error response text:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
      document.querySelector('#admin-invoices-table tbody').innerHTML = 
        `<tr><td colspan="9" class="loading-message">Failed to load invoices: ${error.message}</td></tr>`;
    }
  }

  function displayInvoices(invoices) {
    const tbody = document.querySelector('#admin-invoices-table tbody');
    
    // Ensure invoices is an array
    if (!Array.isArray(invoices)) {
      console.error('Invoices data is not an array:', invoices);
      tbody.innerHTML = '<tr><td colspan="9" class="loading-message">Invalid invoice data format</td></tr>';
      return;
    }
    
    if (invoices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="loading-message">No invoices found</td></tr>';
      return;
    }

    tbody.innerHTML = invoices.map(invoice => {
      const statusClass = getStatusClass(invoice.status);
      const referralInfo = invoice.referral_code ? `${invoice.referral_code} (${invoice.referrer_username || 'Unknown'})` : 'None';
      
      return `
        <tr>
          <td title="${invoice._id}">${invoice.invoice_id || invoice._id?.slice(-8) || 'N/A'}</td>
          <td>${invoice.user_name || invoice.username || 'N/A'}</td>
          <td>${invoice.user_email || 'N/A'}</td>
          <td><strong>$${(invoice.amount || 0).toFixed(2)}</strong></td>
          <td>$${(invoice.portfolio_value || 0).toLocaleString()}</td>
          <td><span class="status-badge ${statusClass}">${invoice.status || 'unknown'}</span></td>
          <td>${formatDate(invoice.created_at)}</td>
          <td title="Referral: ${referralInfo}">${invoice.referral_code || 'None'}</td>
          <td class="actions-cell">
            ${getInvoiceActions(invoice)}
          </td>
        </tr>
      `;
    }).join('');
  }

  function getStatusClass(status) {
    switch(status) {
      case 'pending': return 'status-warning';
      case 'paid': return 'status-success';
      case 'approved': return 'status-success';
      case 'overdue': return 'status-danger';
      case 'cancelled': return 'status-danger';
      case 'rejected': return 'status-danger';
      default: return 'status-neutral';
    }
  }

  function getInvoiceActions(invoice) {
    const actions = [];
    
    if (invoice.status === 'pending') {
      actions.push(`<button class="success-btn small" onclick="approveInvoice('${invoice._id}')" title="Approve Invoice">✅ Approve</button>`);
      actions.push(`<button class="danger-btn small" onclick="rejectInvoice('${invoice._id}')" title="Reject Invoice">❌ Reject</button>`);
    } else if (invoice.status === 'approved' && !invoice.paid_at) {
      actions.push(`<button class="primary-btn small" onclick="markInvoicePaid('${invoice._id}')" title="Mark as Paid">💰 Mark Paid</button>`);
    }
    
    actions.push(`<button class="secondary-btn small" onclick="viewInvoiceDetails('${invoice._id}')" title="View Details">👁️ View</button>`);
    
    return actions.length > 0 ? actions.join(' ') : '<span class="text-muted">No actions</span>';
  }

  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }

  function updateInvoiceStats(invoices) {
    const stats = invoices.reduce((acc, invoice) => {
      if (invoice.status === 'pending') acc.pending++;
      if (invoice.status === 'approved' && isToday(invoice.updated_at)) acc.approvedToday++;
      if (invoice.status === 'paid') acc.totalRevenue += invoice.amount || 0;
      return acc;
    }, { pending: 0, approvedToday: 0, totalRevenue: 0 });

    document.getElementById('pending-invoices-count').textContent = stats.pending;
    document.getElementById('approved-today-count').textContent = stats.approvedToday;
    document.getElementById('total-revenue-amount').textContent = `$${stats.totalRevenue.toLocaleString()}`;
  }

  function isToday(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  // Make functions global for onclick
  window.approveInvoice = async function(invoiceId) {
    if (!confirm('Are you sure you want to approve this invoice?')) return;
    
    try {
      const response = await fetch(`${INVOICING_API_BASE}/admin/invoices/${invoiceId}/approve`, {
        method: 'PATCH',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          payment_method: 'manual_admin_approval',
          notes: 'Approved via admin dashboard'
        })
      });

      if (response.ok) {
        showToast('✅ Invoice approved successfully!', 'success');
        loadInvoices();
      } else {
        const error = await response.json();
        showToast(`Failed to approve invoice: ${error.detail || error.message}`, 'error');
      }
    } catch (error) {
      console.error('Error approving invoice:', error);
      showToast('Error approving invoice', 'error');
    }
  };

  window.rejectInvoice = async function(invoiceId) {
    const reason = prompt('Please provide a reason for rejecting this invoice:');
    if (!reason) return;
    
    try {
      const response = await fetch(`${INVOICING_API_BASE}/admin/invoices/${invoiceId}/cancel`, {
        method: 'PATCH',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          reason: reason,
          notes: 'Rejected via admin dashboard'
        })
      });

      if (response.ok) {
        showToast('❌ Invoice rejected successfully!', 'success');
        loadInvoices();
      } else {
        const error = await response.json();
        showToast(`Failed to reject invoice: ${error.detail || error.message}`, 'error');
      }
    } catch (error) {
      console.error('Error rejecting invoice:', error);
      showToast('Error rejecting invoice', 'error');
    }
  };

  window.markInvoicePaid = async function(invoiceId) {
    if (!confirm('Mark this invoice as paid? This should only be done after payment has been received.')) return;
    
    try {
      const response = await fetch(`${INVOICING_API_BASE}/admin/invoices/${invoiceId}/mark-paid`, {
        method: 'PATCH',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          payment_method: 'manual_admin_confirmation',
          notes: 'Marked as paid via admin dashboard'
        })
      });

      if (response.ok) {
        showToast('💰 Invoice marked as paid!', 'success');
        loadInvoices();
      } else {
        const error = await response.json();
        showToast(`Failed to mark invoice as paid: ${error.detail || error.message}`, 'error');
      }
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      showToast('Error marking invoice as paid', 'error');
    }
  };

  window.viewInvoiceDetails = async function(invoiceId) {
    try {
      const response = await fetch(`${INVOICING_API_BASE}/admin/invoices/${invoiceId}`, {
        headers: getAuthHeaders(token)
      });

      if (response.ok) {
        const invoice = await response.json();
        showInvoiceModal(invoice);
      } else {
        showToast('Failed to load invoice details', 'error');
      }
    } catch (error) {
      console.error('Error loading invoice details:', error);
      showToast('Error loading invoice details', 'error');
    }
  };

  function showInvoiceModal(invoice) {
    const modal = document.getElementById('invoice-modal');
    const detailsDiv = document.getElementById('invoice-details');
    
    detailsDiv.innerHTML = `
      <div class="invoice-detail-grid">
        <div class="detail-group">
          <h4>Invoice Information</h4>
          <p><strong>ID:</strong> ${invoice.invoice_id || invoice._id}</p>
          <p><strong>Status:</strong> <span class="status-badge ${getStatusClass(invoice.status)}">${invoice.status}</span></p>
          <p><strong>Amount:</strong> $${(invoice.amount || 0).toFixed(2)}</p>
          <p><strong>Created:</strong> ${formatDate(invoice.created_at)}</p>
          ${invoice.updated_at ? `<p><strong>Updated:</strong> ${formatDate(invoice.updated_at)}</p>` : ''}
        </div>
        
        <div class="detail-group">
          <h4>User Information</h4>
          <p><strong>Username:</strong> ${invoice.username || 'N/A'}</p>
          <p><strong>Email:</strong> ${invoice.user_email || 'N/A'}</p>
          <p><strong>Portfolio Value:</strong> $${(invoice.portfolio_value || 0).toLocaleString()}</p>
          ${invoice.referral_code ? `<p><strong>Referral Code:</strong> ${invoice.referral_code}</p>` : ''}
        </div>
        
        ${invoice.notes ? `
          <div class="detail-group">
            <h4>Notes</h4>
            <p>${invoice.notes}</p>
          </div>
        ` : ''}
      </div>
    `;
    
    modal.style.display = 'block';
  }

  // === TIER UPGRADES FUNCTIONS ===
  async function loadTierUpgrades() {
    try {
      const response = await fetch(`${INVOICING_API_BASE}/admin/tier-upgrades/pending`, {
        headers: getAuthHeaders(token)
      });

      if (response.ok) {
        const data = await response.json();
        displayTierUpgrades(data.pending_upgrades);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading tier upgrades:', error);
      document.getElementById('pending-upgrades').innerHTML = 
        '<div class="empty-state admin"><h4>Failed to Load</h4><p>Could not load tier upgrades.</p></div>';
    }
  }

  function displayTierUpgrades(upgrades) {
    const container = document.getElementById('pending-upgrades');
    
    if (upgrades.length === 0) {
      container.innerHTML = '<div class="empty-state admin"><h4>No Pending Upgrades</h4><p>All tier upgrades are up to date.</p></div>';
      return;
    }

    container.innerHTML = upgrades.map(upgrade => `
      <div class="upgrade-item">
        <div class="upgrade-info">
          <div class="user-name">${upgrade.user_name}</div>
          <div class="tier-change">${upgrade.current_tier} → ${upgrade.suggested_tier}</div>
          <div class="portfolio-value">Portfolio: $${upgrade.portfolio_value.toLocaleString()}</div>
        </div>
        <div class="wallet-actions">
          <button class="success-btn" onclick="approveUpgrade('${upgrade.upgrade_id}')">✅ Approve</button>
          <button class="danger-btn" onclick="rejectUpgrade('${upgrade.upgrade_id}')">❌ Reject</button>
        </div>
      </div>
    `).join('');
  }

  // Make functions global for onclick
  window.approveUpgrade = async function(upgradeId) {
    if (!confirm('Are you sure you want to approve this tier upgrade?')) return;
    
    try {
      const response = await fetch(`${INVOICING_API_BASE}/admin/tier-upgrades/${upgradeId}/review`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          action: 'approve',
          notes: 'Approved via admin dashboard'
        })
      });

      if (response.ok) {
        showToast('Tier upgrade approved successfully!', 'success');
        loadTierUpgrades();
      } else {
        const error = await response.json();
        showToast(`Failed to approve upgrade: ${error.detail}`, 'error');
      }
    } catch (error) {
      console.error('Error approving upgrade:', error);
      showToast('Error approving upgrade', 'error');
    }
  };

  window.rejectUpgrade = async function(upgradeId) {
    const reason = prompt('Reason for rejection:') || 'Rejected by admin';
    
    try {
      const response = await fetch(`${INVOICING_API_BASE}/admin/tier-upgrades/${upgradeId}/review`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          action: 'reject',
          notes: reason
        })
      });

      if (response.ok) {
        showToast('Tier upgrade rejected', 'success');
        loadTierUpgrades();
      } else {
        const error = await response.json();
        showToast(`Failed to reject upgrade: ${error.detail}`, 'error');
      }
    } catch (error) {
      console.error('Error rejecting upgrade:', error);
      showToast('Error rejecting upgrade', 'error');
    }
  };

  async function scanUpgrades() {
    try {
      showToast('Scanning for tier upgrades...', 'info');
      const response = await fetch(`${INVOICING_API_BASE}/admin/tier-upgrades/scan`, {
        method: 'POST',
        headers: getAuthHeaders(token)
      });

      if (response.ok) {
        const result = await response.json();
        showToast(`Scan completed. ${result.detected_upgrades} upgrades detected.`, 'success');
        loadTierUpgrades();
      } else {
        const error = await response.json();
        showToast(`Scan failed: ${error.detail}`, 'error');
      }
    } catch (error) {
      console.error('Error scanning upgrades:', error);
      showToast('Error scanning for upgrades', 'error');
    }
  }

  // === REFERRALS FUNCTIONS ===
  async function loadReferrals() {
    try {
      const response = await fetch(`${INVOICING_API_BASE}/admin/referrals`, {
        headers: getAuthHeaders(token)
      });

      if (response.ok) {
        const data = await response.json();
        displayReferrals(data);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading referrals:', error);
      document.getElementById('referrals-overview').innerHTML = 
        '<div class="empty-state admin"><h4>Failed to Load</h4><p>Could not load referrals data.</p></div>';
    }
  }

  function displayReferrals(data) {
    const container = document.getElementById('referrals-overview');
    
    // Debug logging to see what data we're getting
    
    // Use the actual referrers array length for accurate count
    const actualReferrersCount = (data.referrers && Array.isArray(data.referrers)) ? data.referrers.length : 0;
    
    const summaryHtml = `
      <div class="referrals-summary">
        <div class="referral-stat">
          <span class="value">${actualReferrersCount}</span>
          <span class="label">Active Referrers</span>
        </div>
        <div class="referral-stat">
          <span class="value">$${(data.total_pending || 0).toFixed(2)}</span>
          <span class="label">Pending Payouts</span>
        </div>
        <div class="referral-stat">
          <span class="value">${data.total_referrals || 0}</span>
          <span class="label">Total Referrals</span>
        </div>
        <div class="referral-stat">
          <span class="value">$${(data.total_paid_amount || 0).toFixed(2)}</span>
          <span class="label">Total Paid Out</span>
        </div>
        <div class="referral-stat">
          <span class="value">${data.total_payouts_count || 0}</span>
          <span class="label">Total Payouts</span>
        </div>
      </div>
    `;
    
    // Show detailed referrers list if available
    let referrersHtml = '';
    if (data.referrers && data.referrers.length > 0) {
      
      try {
        const referrerItems = data.referrers.map((referrer, index) => {
          
          // Determine wallet status and styling
          const hasWallet = referrer.wallet_address && referrer.wallet_address.trim() !== '';
          const isVerified = referrer.wallet_verified === true;
          const walletDisplayClass = hasWallet ? (isVerified ? 'wallet-verified' : 'wallet-unverified') : 'wallet-missing';
          const walletStatusText = hasWallet ? (isVerified ? '✅ Verified' : '⚠️ Unverified') : '❌ No Wallet';
          const walletStatusColor = hasWallet ? (isVerified ? '#28a745' : '#ffc107') : '#dc3545';
          
          // Determine if payout is possible
          const canPayout = hasWallet && isVerified;
          const payoutButtonText = canPayout ? `💰 Pay Out $${(referrer.referral_balance || 0).toFixed(2)}` : '❌ Cannot Pay Out';
          const payoutButtonClass = canPayout ? 'success-btn' : 'danger-btn';
          const payoutButtonOnclick = canPayout ? 
            `processReferralPayout('${referrer._id || referrer.id || 'unknown'}', '${referrer.username || 'unknown'}', ${referrer.referral_balance || 0})` :
            `showWalletRequiredMessage('${referrer.username || 'User'}')`;
          
          return `
            <div class="referrer-item ${walletDisplayClass}">
              <div class="referrer-info">
                <div class="referrer-name">${referrer.full_name || referrer.username || 'Unknown User'}</div>
                <div class="referrer-email">${referrer.email || 'No email'}</div>
                <div class="referrer-wallet">
                  <span class="wallet-label">Wallet:</span>
                  ${hasWallet ? 
                    `<span class="wallet-address" style="color: ${walletStatusColor};">${referrer.wallet_address}</span>` :
                    `<span class="wallet-missing" style="color: ${walletStatusColor};">No wallet address provided</span>`
                  }
                  <span class="wallet-status" style="color: ${walletStatusColor}; font-weight: bold;">${walletStatusText}</span>
                </div>
                <div class="referrer-stats">
                  <span class="stat">Balance: $${(referrer.referral_balance || 0).toFixed(2)}</span>
                  <span class="stat">Referrals: ${referrer.referral_count || 0}</span>
                  <span class="stat">Unpaid: ${referrer.unpaid_referrals || 0}</span>
                </div>
              </div>
              <div class="referrer-actions">
                <button class="${payoutButtonClass}" onclick="${payoutButtonOnclick}">
                  ${payoutButtonText}
                </button>
                ${!canPayout ? `
                  <button class="primary-button admin" onclick="sendWalletReminder('${referrer._id || referrer.id || 'unknown'}', '${referrer.username || 'unknown'}', '${referrer.email || ''}')">
                    📧 Send Wallet Reminder
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        });
        
        referrersHtml = `
          <div class="referrers-list" style="margin-top: 20px;">
            <h4>Pending Payouts</h4>
            ${referrerItems.join('')}
          </div>
        `;
      } catch (error) {
        console.error('❌ Error generating referrers HTML:', error);
        referrersHtml = `
          <div class="empty-state admin" style="margin-top: 20px;">
            <h4>Error Displaying Referrers</h4>
            <p>Failed to render referrers list: ${error.message}</p>
          </div>
        `;
      }
    } else if (data.total_referrers > 0) {
      referrersHtml = `
        <div class="empty-state admin" style="margin-top: 20px;">
          <h4>No Pending Payouts</h4>
          <p>All referral commissions have been paid out.</p>
        </div>
      `;
    } else {
      referrersHtml = `
        <div class="empty-state admin" style="margin-top: 20px;">
          <h4>No Referrals Data</h4>
          <p>No referral activity found.</p>
        </div>
      `;
    }
    
    // Show paid per user section if available
    let paidPerUserHtml = '';
    if (data.paid_per_user && data.paid_per_user.length > 0) {
      paidPerUserHtml = `
        <div class="paid-per-user-section" style="margin-top: 20px;">
          <h4>🏆 Top Paid Out Users</h4>
          <div class="paid-per-user-list">
            ${data.paid_per_user.map(user => `
              <div class="paid-user-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; margin: 8px 0; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #28a745;">
                <div class="user-info">
                  <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${user.username || 'Unknown User'}</div>
                  <div style="font-size: 12px; color: #666;">${user.email || 'No email'}</div>
                </div>
                <div class="payout-stats" style="text-align: right;">
                  <div style="font-size: 16px; font-weight: 700; color: #28a745;">$${(user.total_paid_amount || 0).toFixed(2)}</div>
                  <div style="font-size: 11px; color: #666;">${user.payout_count || 0} payout${user.payout_count === 1 ? '' : 's'}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    
    container.innerHTML = summaryHtml + referrersHtml + paidPerUserHtml;
    
  }

  // Show wallet required message
  window.showWalletRequiredMessage = function(username) {
    showToast(`❌ Cannot process payout for ${username}: Verified wallet address required`, 'error', 6000);
  };

  // Send wallet verification reminder email
  window.sendWalletReminder = async function(userId, username, email) {
    if (!confirm(`Send wallet verification reminder email to ${username} (${email})?`)) {
      return;
    }
    
    try {
      showToast(`📧 Sending wallet reminder to ${username}...`, 'info');
      
      const response = await fetch(`${INVOICING_API_BASE}/admin/referrals/${userId}/send-wallet-reminder`, {
        method: 'POST',
        headers: getAuthHeaders(token)
      });
      
      if (response.ok) {
        const result = await response.json();
        showToast(`✅ Wallet reminder sent successfully to ${email}`, 'success');
      } else {
        const errorText = await response.text();
        console.error('❌ Wallet reminder failed:', response.status, errorText);
        try {
          const error = JSON.parse(errorText);
          showToast(`Failed to send reminder: ${error.detail}`, 'error');
        } catch (e) {
          showToast(`Failed to send reminder: ${response.status} ${response.statusText}`, 'error');
        }
      }
    } catch (error) {
      console.error('Error sending wallet reminder:', error);
      showToast('Error sending wallet reminder', 'error');
    }
  };

  // Process referral payout
  window.processReferralPayout = async function(userId, username, amount) {
    if (!confirm(`Are you sure you want to pay out $${amount.toFixed(2)} to ${username}?`)) {
      return;
    }
    
    try {
      showToast(`Processing payout for ${username}...`, 'info');
      
      const response = await fetch(`${INVOICING_API_BASE}/admin/referrals/${userId}/payout`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          admin_user_id: "admin-dashboard", // Required by model, but backend uses current_user
          payout_method: 'manual',
          notes: `Manual payout processed by admin via dashboard`
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        showToast(`✅ Successfully paid out $${amount.toFixed(2)} to ${username}`, 'success');
        
        // Reload referrals data to update the display
        loadReferrals();
      } else {
        const errorText = await response.text();
        console.error('❌ Payout failed:', response.status, errorText);
        try {
          const error = JSON.parse(errorText);
          showToast(`Failed to process payout: ${error.detail}`, 'error');
        } catch (e) {
          showToast(`Failed to process payout: ${response.status} ${response.statusText}`, 'error');
        }
      }
    } catch (error) {
      console.error('Error processing payout:', error);
      showToast('Error processing payout', 'error');
    }
  };

  // === ACTIVITY LOG FUNCTIONS ===
  async function loadActivity() {
    try {
      const response = await fetch(`${INVOICING_API_BASE}/admin/dashboard/activity`, {
        headers: getAuthHeaders(token)
      });

      if (response.ok) {
        const data = await response.json();
        // Handle different possible response structures
        const activity = data.recent_activity || data.activity || data || {};
        displayActivity(activity);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading activity:', error);
      document.getElementById('activity-log').innerHTML = 
        '<div class="empty-state admin"><h4>Failed to Load</h4><p>Could not load recent activity.</p></div>';
    }
  }

  function displayActivity(activity) {
    const container = document.getElementById('activity-log');
    
    // Safely extract activity data with fallbacks
    const invoices = activity.invoices || [];
    const subscriptions = activity.subscriptions || [];
    
    const allActivity = [
      ...invoices.map(inv => ({
        type: 'Invoice',
        description: `${inv.invoice_id || 'Unknown'} - $${inv.amount || 0}`,
        time: inv.created_at || new Date().toISOString()
      })),
      ...subscriptions.map(sub => ({
        type: 'Subscription',
        description: `New ${sub.tier || 'Unknown'} subscription`,
        time: sub.created_at || new Date().toISOString()
      }))
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);

    if (allActivity.length === 0) {
      container.innerHTML = '<div class="empty-state admin"><h4>No Recent Activity</h4></div>';
      return;
    }

    container.innerHTML = allActivity.map(item => `
      <div class="activity-item">
        <div class="activity-type">${item.type}</div>
        <div class="activity-description">${item.description}</div>
        <div class="activity-time">${new Date(item.time).toLocaleDateString()}</div>
      </div>
    `).join('');
  }

  // === JOBS MANAGER FUNCTIONS ===

  async function loadJobsManagerOverview() {
    const container = document.getElementById('jobs-overview');
    if (!container) {
      return;
    }

    container.innerHTML = '<div class="loading-state"><p>Loading Jobs status...</p></div>';

    try {
      const [summaryResponse, activeJobsResponse] = await Promise.all([
        fetch(`${JOBS_API_BASE}/admin/jobs/summary`, {
          headers: getAuthHeaders(token)
        }),
        fetch(`${JOBS_API_BASE}/admin/active-jobs?limit=5`, {
          headers: getAuthHeaders(token)
        })
      ]);

      let summaryData = {};
      let activeJobs = [];

      if (summaryResponse.ok) {
        summaryData = await summaryResponse.json();
      }

      if (activeJobsResponse.ok) {
        const activePayload = await activeJobsResponse.json();
        if (Array.isArray(activePayload)) {
          activeJobs = activePayload;
        } else {
          activeJobs = activePayload.items || [];
        }
      }

      if (!summaryResponse.ok && !activeJobsResponse.ok) {
        throw new Error('Jobs admin API did not return data');
      }

      renderJobsManagerOverview(summaryData, activeJobs);
      return;

    } catch (jobsError) {
      console.warn('Jobs admin API unavailable, falling back to legacy KPIs endpoint', jobsError);
    }

    try {
      const legacyResponse = await fetch(CONFIG.CONFIG_UTILS.getApiUrl('/admin/analytics/jobs-kpis'), {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        headers: getAuthHeaders(token)
      });

      if (!legacyResponse.ok) {
        throw new Error(`HTTP ${legacyResponse.status}: ${legacyResponse.statusText}`);
      }

      const legacyData = await legacyResponse.json();
      renderLegacyJobsManagerOverview(legacyData);

    } catch (error) {
      console.error('Error loading Jobs KPIs:', error);
      container.innerHTML = `
        <div class="error-state">
          <p>❌ Failed to load Jobs status: ${error.message}</p>
          <button onclick="loadJobsManagerOverview()" class="retry-btn">🔄 Retry</button>
        </div>
      `;
    }
  }

  function renderJobsManagerOverview(summary = {}, activeJobs = []) {
    const container = document.getElementById('jobs-overview');
    if (!container) {
      return;
    }

    const total = summary?.total_jobs ?? summary?.total ?? 0;
    const failures = summary?.total_failed ?? summary?.failed ?? 0;
    const success = summary?.total_success ?? summary?.successful ?? (total - failures);
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
    const lastExecution = summary?.last_execution ? formatDate(summary.last_execution) : '—';
    const lastFailure = summary?.last_failure ? formatDate(summary.last_failure) : '—';

    const overviewCard = `
      <div class="status-card">
        <div class="status-header">
          <span class="status-icon">${total > 0 ? '🟢' : '🟡'}</span>
          <div>
            <h3>Observer Jobs Manager</h3>
            <p>${total} total executions</p>
          </div>
          <button class="secondary-button" onclick="window.open('/admin-jobs-manager.html', '_blank')">📊 Open Jobs Dashboard</button>
        </div>
        <div class="status-details">
          <div class="status-grid">
            <div>
              <strong>${success}</strong>
              <span>Successful</span>
            </div>
            <div>
              <strong>${failures}</strong>
              <span>Failures</span>
            </div>
            <div>
              <strong>${successRate}%</strong>
              <span>Success Rate</span>
            </div>
            <div>
              <strong>${lastExecution}</strong>
              <span>Last Execution</span>
            </div>
            <div>
              <strong>${lastFailure}</strong>
              <span>Last Failure</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const failureStatuses = new Set(['FAILED', 'ERROR', 'STOPPED', 'DISABLED']);
    const jobsWithFailures = Array.isArray(activeJobs)
      ? activeJobs.filter(job => {
          const statusText = (job?.status || '').toString().toUpperCase();
          const failureCount = Number(job?.consecutive_failures ?? job?.failure_count ?? job?.failures ?? 0);
          return failureCount > 0 || failureStatuses.has(statusText);
        })
      : [];

    let trailingMarkup = '';

    if (failures > 0) {
      const jobsAlertList = jobsWithFailures
        .sort((a, b) => {
          const failureA = Number(a?.consecutive_failures ?? a?.failure_count ?? a?.failures ?? 0);
          const failureB = Number(b?.consecutive_failures ?? b?.failure_count ?? b?.failures ?? 0);
          return failureB - failureA;
        })
        .map(job => {
          const name = job.account_name || job.account_id || 'Unknown Account';
          const statusText = (job.status || 'UNKNOWN').toString();
          const normalizedStatus = statusText.toUpperCase();
          const statusClass = ['ACTIVE', 'RUNNING'].includes(normalizedStatus)
            ? 'success'
            : failureStatuses.has(normalizedStatus)
              ? 'danger'
              : 'primary';
          const failuresCount = Number(job.consecutive_failures ?? job.failure_count ?? job.failures ?? 0);
          const failureClass = failuresCount > 0 ? 'danger' : 'success';

          return `
            <div class="jobs-compact-row">
              <span class="jobs-compact-name">${name}</span>
              <div class="jobs-compact-meta">
                <span class="status-badge ${statusClass}">${statusText}</span>
                <span class="status-badge ${failureClass}">Fails: ${failuresCount}</span>
              </div>
            </div>
          `;
        })
        .join('');

      trailingMarkup = `
        <div class="jobs-alert">
          <h4>⚠️ ${failures} job${failures === 1 ? '' : 's'} requiring attention</h4>
          ${jobsWithFailures.length > 0
            ? `<div class="jobs-active-list">${jobsAlertList}</div>`
            : `<p>No job details were returned in the summary. Open the Jobs Dashboard for a detailed view.</p>`}
        </div>
      `;
    } else {
      const activeCount = Array.isArray(activeJobs) ? activeJobs.length : 0;
      const label = activeCount === 1 ? 'job' : 'jobs';
      const summaryMessage = activeCount > 0
        ? `${activeCount} active ${label} running`
        : 'No active jobs currently scheduled.';

      trailingMarkup = `
        <div class="jobs-summary-message">
          ${summaryMessage}
        </div>
      `;
    }

    container.innerHTML = `
      ${overviewCard}
      ${trailingMarkup}
    `;
  }

  function renderLegacyJobsManagerOverview(kpisData) {
    const container = document.getElementById('jobs-overview');

    // Extract KPI data
    const activeJobs = kpisData.total_active_jobs || 0;
    const recentExecutions = kpisData.recent_executions_24h || 0;
    const successRate = kpisData.success_rate_24h || 0;
    const failedJobs = kpisData.failed_jobs_24h || 0;
    const nextRun = kpisData.next_scheduled_run;

    // Status breakdown
    const statusBreakdown = kpisData.status_breakdown || {};
    const runStatusBreakdown = kpisData.run_status_breakdown || {};

    // Determine manager status
    const isRunning = activeJobs > 0;
    const statusIcon = isRunning ? '🟢' : '🔴';
    const statusText = isRunning ? 'Active' : 'No Jobs';

    // Format next run time
    let nextRunText = 'Not scheduled';
    if (nextRun) {
      try {
        const nextRunDate = new Date(nextRun);
        const now = new Date();
        const diffMs = nextRunDate.getTime() - now.getTime();
        const diffMins = Math.round(diffMs / (1000 * 60));

        if (diffMins <= 0) {
          nextRunText = 'Due now';
        } else if (diffMins < 60) {
          nextRunText = `In ${diffMins} min`;
        } else {
          const diffHours = Math.round(diffMins / 60);
          nextRunText = `In ${diffHours}h`;
        }
      } catch (e) {
        nextRunText = 'Invalid time';
      }
    }
    
    const summaryMessage = failedJobs > 0
      ? `
        <div class="jobs-alert">
          <h4>⚠️ Jobs Requiring Attention</h4>
          <p>${failedJobs} job${failedJobs === 1 ? '' : 's'} failed in the last 24h. Review the Jobs Dashboard for details.</p>
        </div>
      `
      : `
        <div class="jobs-summary-message">
          ${activeJobs > 0
            ? `${activeJobs} active job${activeJobs === 1 ? '' : 's'} running`
            : 'No active jobs currently scheduled.'}
        </div>
      `;

    container.innerHTML = `
      <div class="overview-summary">
        <div class="stat-card admin">
          <div class="stat-icon">${statusIcon}</div>
          <div class="stat-label">Jobs Manager</div>
          <div class="stat-value">${statusText}</div>
          <div class="stat-action">${activeJobs} active jobs</div>
        </div>
        <div class="stat-card admin">
          <div class="stat-icon">📈</div>
          <div class="stat-label">Success Rate (24h)</div>
          <div class="stat-value">${successRate}%</div>
          <div class="stat-action">${recentExecutions} executions</div>
        </div>
        <div class="stat-card admin ${failedJobs > 0 ? 'warning' : ''}">
          <div class="stat-icon">${failedJobs > 0 ? '⚠️' : '✅'}</div>
          <div class="stat-label">Failed Jobs (24h)</div>
          <div class="stat-value">${failedJobs}</div>
          <div class="stat-action">${failedJobs > 0 ? 'Needs attention' : 'All good'}</div>
        </div>
        <div class="stat-card admin">
          <div class="stat-icon">⏰</div>
          <div class="stat-label">Next Run</div>
          <div class="stat-value">${nextRunText}</div>
          <div class="stat-action">Scheduled jobs</div>
        </div>
        <div class="stat-card admin">
          <div class="stat-icon">📊</div>
          <div class="stat-label">Status Breakdown</div>
          <div class="stat-value">${Object.keys(statusBreakdown).length} types</div>
          <div class="stat-action">ACTIVE: ${statusBreakdown.ACTIVE || 0}</div>
        </div>
        <div class="stat-card admin clickable" onclick="loadJobsManagerOverview()">
          <div class="stat-icon">🔄</div>
          <div class="stat-label">Refresh</div>
          <div class="stat-value">Update</div>
          <div class="stat-action">Click to refresh →</div>
        </div>
      </div>
      ${summaryMessage}
    `;
  }

  // Helper function for next scheduled run
  function getNextScheduledRun(jobs) {
    if (jobs.length === 0) return 'N/A';
    
    const nextRuns = jobs
      .map(job => job.next_run ? new Date(job.next_run) : null)
      .filter(date => date !== null)
      .sort((a, b) => a - b);
    
    if (nextRuns.length === 0) return 'N/A';
    
    const nextRun = nextRuns[0];
    const now = new Date();
    const diffMs = nextRun - now;
    
    if (diffMs < 0) return 'Overdue';
    if (diffMs < 60000) return `${Math.round(diffMs / 1000)}s`;
    if (diffMs < 3600000) return `${Math.round(diffMs / 60000)}m`;
    if (diffMs < 86400000) return `${Math.round(diffMs / 3600000)}h`;
    return `${Math.round(diffMs / 86400000)}d`;
  }

  // === EVENT LISTENERS ===
  
  // Navigation
  document.getElementById('back-to-dashboard').onclick = () => {
    window.location.href = '/dashboard.html';
  };

  // Logout
  document.getElementById('logout-btn').onclick = () => {
    localStorage.removeItem("token");
    window.location.href = "/auth.html";
  };

  // Refresh buttons
  document.getElementById('refresh-overview').onclick = loadSystemOverview;
  document.getElementById('refresh-active-accounts').onclick = () => loadActiveAccounts(activeAccountsPagination.page, activeAccountsPagination.pageSize);
  document.getElementById('refresh-users-accounts').onclick = loadUsersAccounts;
  document.getElementById('refresh-wallets').onclick = loadWalletVerifications;
  document.getElementById('refresh-referrals').onclick = loadReferrals;
  document.getElementById('refresh-activity').onclick = loadActivity;
  document.getElementById('scan-upgrades').onclick = scanUpgrades;
  document.getElementById('refresh-jobs').onclick = loadJobsManagerOverview;
  
  // Jobs Manager button
  document.getElementById('open-jobs-dashboard').onclick = () => {
    window.location.href = 'admin-jobs-manager.html';
  };

  // Filter invoices
  document.getElementById('filter-invoices').onclick = () => {
    const status = document.getElementById('invoice-status-filter').value;
    loadInvoices(status);
  };

  // Refresh invoices
  document.getElementById('refresh-invoices').onclick = () => {
    const status = document.getElementById('invoice-status-filter').value;
    loadInvoices(status);
    showToast('🔄 Invoices refreshed', 'info');
  };

  attachActiveAccountsFilterListeners();

  // Modal event listeners
  document.getElementById('wallet-modal-close').onclick = () => {
    document.getElementById('wallet-verification-modal').style.display = 'none';
  };

  document.getElementById('verify-wallet-btn').onclick = verifyWallet;
  document.getElementById('reject-wallet-btn').onclick = rejectWallet;

  // Close modals when clicking outside
  window.onclick = (event) => {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    });
  };



  // === NOTIFICATION SYSTEM ===
  
  function showNotification(message, type = 'info') {
    // Simple notification system
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <span>${message}</span>
      <button onclick="this.parentElement.remove()">×</button>
    `;
    
    // Add styles if not already present
    if (!document.querySelector('#notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'notification-styles';
      styles.textContent = `
        .notification {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 16px;
          border-radius: 8px;
          color: white;
          z-index: 10000;
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: 300px;
          animation: slideIn 0.3s ease;
        }
        .notification-success { background-color: #28a745; }
        .notification-error { background-color: #dc3545; }
        .notification-info { background-color: #17a2b8; }
        .notification button {
          background: none;
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  // === SOURCE ACCOUNT MANAGEMENT ===
  
  let currentEditingSourceAccountId = null;
  let sourceStrategies = [];

  // Load source accounts
  async function loadSourceAccounts() {
    try {
      const response = await fetch(`${AUTH_API_BASE}/admin/source-accounts/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (response.ok) {
        displaySourceAccounts(data.source_accounts);
      } else {
        console.error('❌ Failed to load source accounts:', data.detail);
        showNotification(`Failed to load source accounts: ${data.detail}`, 'error');
      }
    } catch (error) {
      console.error('❌ Error loading source accounts:', error);
      showNotification(`Error loading source accounts: ${error.message}`, 'error');
    }
  }

  // Display source accounts in table
  function displaySourceAccounts(sourceAccounts) {
    const tbody = document.querySelector('#source-accounts-table tbody');
    
    if (!sourceAccounts || sourceAccounts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="no-data">No source accounts found</td></tr>';
      return;
    }

    tbody.innerHTML = sourceAccounts.map(account => {
      const totalValue = getAccountTotalValue(account);
      const fallbackValue = totalValue !== null ? totalValue : (account.current_value ?? account.current_total_value ?? 0);
      const numericValue = Number(fallbackValue) || 0;
      const unrealizedPnl = getAccountUnrealizedPnl(account);
      const tooltipParts = [`Total portfolio value (incl. unrealized PnL): $${formatNumber(numericValue)}`];
      if (unrealizedPnl !== null) {
        tooltipParts.push(`Unrealized PnL: $${formatNumber(unrealizedPnl, 2)}`);
      }
      const tooltipText = tooltipParts.join('\n');

      return `
        <tr>
          <td>${account.account_name}</td>
          <td>${account.exchange || 'Binance'}</td>
          <td>
            <span class="strategy-tag">${account.strategy}</span>
          </td>
          <td class="col-value" style="text-align: center;" title="${tooltipText}">${formatProfessionalValue(numericValue)}</td>
          <td class="col-status">${getProfessionalStatusBadge(account.test_status || account.overall_status, account.last_status)}</td>
          <td>${formatDate(account.created_at)}</td>
          <td>
            <button class="edit-source-btn action-btn" data-id="${account.id}">✏️ Edit</button>
            <button class="verify-source-btn action-btn success" data-id="${account.id}">🔍 Verify</button>
            <button class="delete-source-btn action-btn danger" data-id="${account.id}">🗑️ Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    // Add event listeners to action buttons
    document.querySelectorAll('.edit-source-btn').forEach(btn => {
      btn.onclick = () => editSourceAccount(btn.dataset.id);
    });

    document.querySelectorAll('.verify-source-btn').forEach(btn => {
      btn.onclick = () => verifySourceAccount(btn.dataset.id);
    });
    document.querySelectorAll('.delete-source-btn').forEach(btn => {
      btn.onclick = () => deleteSourceAccount(btn.dataset.id);
    });
  }

  // Add event listeners for user account verify buttons
  function attachUserAccountVerifyListeners() {
    document.querySelectorAll('.verify-user-account-btn').forEach(btn => {
      btn.onclick = () => verifyUserAccount(btn.dataset.accountId);
    });
  }

  // Verify user account function - uses same working approach as admin-accounts.js
  async function verifyUserAccount(accountId) {
    try {
      showNotification('Starting user account troubleshoot...', 'info');
      // Use the same working troubleshoot endpoint as admin-accounts.js (it accepts admin tokens)
      const troubleshootUrl = `${AUTH_API_BASE}/troubleshoot/${accountId}`;
      const response = await fetch(troubleshootUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        showTroubleshootResults(data);
        showNotification('User account troubleshoot completed successfully!', 'success');
      } else {
        // Fallback - show basic account info from existing data
        let accountData = currentActiveAccounts.find(acc => 
          (acc.account_id === accountId) || (acc._id === accountId) || (acc.id === accountId)
        );
        
        if (!accountData) {
          accountData = currentUsersAccounts.find(acc => 
            (acc.account_id === accountId) || (acc._id === accountId) || (acc.id === accountId)
          );
        }
        
        if (accountData) {
          showUserAccountDetails(accountData, 'fallback-no-api');
          showNotification('Verification API unavailable - showing basic account info', 'warning');
        } else {
          throw new Error('Account not found and verification API unavailable');
        }
      }
    } catch (error) {
      console.error('❌ Error troubleshooting user account:', error);
      showNotification('Error troubleshooting user account', 'error');
    }
  }

  // Helper formatting functions
  function formatNumber(num, decimals = 2) {
    if (!num && num !== 0) return '0.00';
    return parseFloat(num).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function formatCrypto(num, decimals = 8) {
    if (!num && num !== 0) return '0';
    const formatted = parseFloat(num).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
    return formatted;
  }

  function formatPrice(num, decimals = 4) {
    if (!num && num !== 0) return '0';
    return parseFloat(num).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  }

  // Show troubleshoot results (COMPLETE version from admin-accounts.js)
  function showTroubleshootResults(result) {
    const modal = document.getElementById('troubleshoot-modal');
    const resultsContainer = document.getElementById('troubleshoot-results');
    
    const statusClass = result.success ? 'result-success' : 'result-error';
    const totalUnrealized = (result.total_unrealized_pnl_usdt !== undefined && result.total_unrealized_pnl_usdt !== null)
      ? result.total_unrealized_pnl_usdt
      : (result.detailed_breakdown?.summary?.total_unrealized_pnl_usdt || 0);
    const totalUnrealizedColor = totalUnrealized >= 0 ? '#28a745' : '#dc3545';
    const totalUnrealizedLabel = `${totalUnrealized >= 0 ? '✅' : '⚠️'} $${formatNumber(totalUnrealized || 0)}`;
    
    resultsContainer.innerHTML = `
      ${result.account_status_message ? `
        <div class="result-section result-warning" style="margin-bottom: 15px;">
          <div style="padding: 12px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; color: #856404;">
            <strong>${result.account_status_message}</strong>
          </div>
        </div>
      ` : ''}
      
      <div class="result-section ${statusClass}">
        <h4>📊 Troubleshoot Summary</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; margin: 10px 0;">
          <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid #007bff;">
            <div style="margin-bottom: 8px;"><strong>Account:</strong> ${result.account_name || 'N/A'}</div>
            <div style="margin-bottom: 8px;"><strong>Status:</strong> <span style="color: ${result.success ? '#28a745' : '#dc3545'};">${result.success ? '✅ Success' : '❌ Failed'}</span></div>
            <div style="margin-bottom: 8px;"><strong>Active:</strong> <span style="color: ${result.is_account_active !== false ? '#28a745' : '#dc3545'};">${result.is_account_active !== false ? '✅ Yes' : '❌ Disabled'}</span></div>
            <div><strong>Status Updated:</strong> <span style="color: ${result.status_updated !== false ? '#28a745' : '#6c757d'};">${result.status_updated !== false ? '✅ Yes' : '❌ No (Disabled)'}</span></div>
          </div>
          <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid #28a745;">
            <div style="margin-bottom: 8px;"><strong>API Key:</strong> <span style="color: ${result.api_key_valid ? '#28a745' : '#dc3545'};">${result.api_key_valid ? '✅ Valid' : '❌ Invalid'}</span></div>
            <div style="margin-bottom: 8px;"><strong>IP Whitelist:</strong> <span style="color: ${result.ip_whitelisted ? '#28a745' : '#dc3545'};">${result.ip_whitelisted ? '✅ Yes' : '❌ No'}</span></div>
            <div><strong>Total Value:</strong> <span style="font-size: 1.1em; font-weight: bold; color: #007bff;">$${formatNumber(result.total_usdt_value || 0)}</span></div>
            <div style="margin-top: 8px;"><strong>Unrealized PnL:</strong> <span style="font-weight: bold; color: ${totalUnrealizedColor};">${totalUnrealizedLabel}</span></div>
          </div>
        </div>
      </div>
      
      ${result.recommendations && result.recommendations.length > 0 ? `
        <div class="result-section result-warning">
          <h4>Recommendations</h4>
          <ul>
            ${result.recommendations.map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${result.detailed_breakdown ? `
        <div class="result-section">
          <h4>📊 Account Breakdown</h4>
          
          ${result.detailed_breakdown.summary ? `
            <div class="breakdown-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
              <div><strong>SPOT Value:</strong> $${formatNumber(result.detailed_breakdown.summary.spot_value_usdt || 0)}</div>
              <div><strong>USDT-M Value:</strong> $${formatNumber(result.detailed_breakdown.summary.usdtm_value_usdt || 0)}</div>
              <div><strong>COIN-M Value:</strong> $${formatNumber(result.detailed_breakdown.summary.coinm_value_usdt || 0)}</div>
            </div>
          ` : ''}
          
          ${result.detailed_breakdown.spot ? `
            <div class="result-section">
              <h5>💰 SPOT Account</h5>
              ${result.detailed_breakdown.spot.assets && result.detailed_breakdown.spot.assets.length > 0 ? `
                <div style="max-height: 300px; overflow-y: auto; margin: 10px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 1em;">
                    <thead>
                      <tr style="background: #e9ecef;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Asset</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Total</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">USDT Value</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">% of Account</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${result.detailed_breakdown.spot.assets
                        .map(asset => {
                          const totalValue = result.detailed_breakdown.summary?.total_value_usdt || 1;
                          const percentage = ((asset.usdt_value || 0) / totalValue * 100);
                          return { ...asset, percentage };
                        })
                        .sort((a, b) => b.percentage - a.percentage)
                        .map(asset => {
                          return `
                            <tr>
                              <td style="padding: 10px; border: 1px solid #ddd;"><strong>${asset.asset}</strong></td>
                              <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCrypto(asset.total || 0)}</td>
                              <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>$${formatNumber(asset.usdt_value || 0)}</strong></td>
                              <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: ${asset.percentage >= 10 ? '#28a745' : asset.percentage >= 5 ? '#ffc107' : '#6c757d'};">${asset.percentage.toFixed(1)}%</td>
                            </tr>
                          `;
                        }).join('')}
                    </tbody>
                  </table>
                </div>
              ` : '<p style="margin: 10px 0; font-style: italic;">No SPOT assets found</p>'}
            </div>
          ` : ''}
          
          ${result.detailed_breakdown['USDT-M'] ? `
            <div class="result-section">
              <h5>📈 USDT-M Futures</h5>
              
              <!-- Assets Row -->
              ${result.detailed_breakdown['USDT-M'].assets && result.detailed_breakdown['USDT-M'].assets.length > 0 ? `
                <h6 style="margin: 15px 0 5px 0; color: #495057;">Assets (${result.detailed_breakdown['USDT-M'].assets.length}):</h6>
                <div style="max-height: 200px; overflow-y: auto; margin: 0 0 20px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 1em;">
                    <thead>
                      <tr style="background: #fff3cd;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Asset</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Balance</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Available</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">USDT Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${result.detailed_breakdown['USDT-M'].assets.map(asset => `
                        <tr>
                          <td style="padding: 10px; border: 1px solid #ddd;"><strong>${asset.asset}</strong></td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCrypto(asset.balance || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCrypto(asset.available || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>$${formatNumber(asset.usdt_value || 0)}</strong></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
              
              <!-- Positions Row -->
              ${result.detailed_breakdown['USDT-M'].positions && result.detailed_breakdown['USDT-M'].positions.length > 0 ? `
                <h6 style="margin: 15px 0 5px 0; color: #495057;">Positions (${result.detailed_breakdown['USDT-M'].positions.length}):</h6>
                <div style="max-height: 200px; overflow-y: auto; margin: 0 0 20px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 1em;">
                    <thead>
                      <tr style="background: #fff3cd;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Symbol</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Side</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Size</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Entry Price</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Mark Price</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">PNL</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">USDT Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${result.detailed_breakdown['USDT-M'].positions.map(position => `
                        <tr>
                          <td style="padding: 10px; border: 1px solid #ddd;"><strong>${position.symbol}</strong></td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: ${position.side === 'Long' ? '#28a745' : '#dc3545'};">${position.side}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCrypto(position.positionAmt || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$${formatPrice(position.entryPrice || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$${formatPrice(position.markPrice || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: ${parseFloat(position.unRealizedPnL || 0) >= 0 ? '#28a745' : '#dc3545'};">$${formatNumber(position.unRealizedPnL || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>$${formatNumber(position.usdt_value || 0)}</strong></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
              
              <!-- Open Orders Row -->
              ${result.detailed_breakdown['USDT-M'].open_orders && result.detailed_breakdown['USDT-M'].open_orders.length > 0 ? `
                <h6 style="margin: 15px 0 5px 0; color: #495057;">Open Orders (${result.detailed_breakdown['USDT-M'].open_orders.length}):</h6>
                <div style="max-height: 200px; overflow-y: auto; margin: 0 0 20px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 1em;">
                    <thead>
                      <tr style="background: #fff3cd;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Symbol</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Side</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Type</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Price</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Quantity</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">USDT Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${result.detailed_breakdown['USDT-M'].open_orders.map(order => `
                        <tr>
                          <td style="padding: 10px; border: 1px solid #ddd;"><strong>${order.symbol}</strong></td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: ${order.side === 'BUY' ? '#28a745' : '#dc3545'};">${order.side}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${order.type}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$${formatPrice(order.price || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCrypto(order.origQty || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>$${formatNumber(order.usdt_value || 0)}</strong></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
              
              ${!result.detailed_breakdown['USDT-M'].assets?.length && !result.detailed_breakdown['USDT-M'].positions?.length && !result.detailed_breakdown['USDT-M'].open_orders?.length ? 
                '<p style="margin: 10px 0; font-style: italic;">No USDT-M assets, positions, or orders found</p>' : ''}
            </div>
          ` : ''}
          
          ${result.detailed_breakdown['COIN-M'] ? `
            <div class="result-section">
              <h5>🪙 COIN-M Futures</h5>
              
              <!-- Assets Row -->
              ${result.detailed_breakdown['COIN-M'].assets && result.detailed_breakdown['COIN-M'].assets.length > 0 ? `
                <h6 style="margin: 15px 0 5px 0; color: #495057;">Assets (${result.detailed_breakdown['COIN-M'].assets.length}):</h6>
                <div style="max-height: 200px; overflow-y: auto; margin: 0 0 20px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 1em;">
                    <thead>
                      <tr style="background: #d1ecf1;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Asset</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Balance</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Unrealized PnL</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">USDT Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${result.detailed_breakdown['COIN-M'].assets.map(asset => `
                        <tr>
                          <td style="padding: 10px; border: 1px solid #ddd;"><strong>${asset.asset}</strong></td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCrypto(asset.balance || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: ${parseFloat(asset.unrealized_pnl || 0) >= 0 ? '#28a745' : '#dc3545'};">${formatNumber(asset.unrealized_pnl || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>$${formatNumber(asset.usdt_value || 0)}</strong></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
              
              <!-- Positions Row -->
              ${result.detailed_breakdown['COIN-M'].positions && result.detailed_breakdown['COIN-M'].positions.length > 0 ? `
                <h6 style="margin: 15px 0 5px 0; color: #495057;">Positions (${result.detailed_breakdown['COIN-M'].positions.length}):</h6>
                <div style="max-height: 200px; overflow-y: auto; margin: 0 0 20px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 1em;">
                    <thead>
                      <tr style="background: #d1ecf1;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Symbol</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Side</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Contracts</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Entry Price</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Mark Price</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">PNL (USDT)</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">USD Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${result.detailed_breakdown['COIN-M'].positions.map(position => `
                        <tr>
                          <td style="padding: 10px; border: 1px solid #ddd;"><strong>${position.symbol}</strong></td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: ${position.side === 'Long' ? '#28a745' : '#dc3545'};">${position.side}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${parseFloat(position.positionAmt || 0).toFixed(0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$${formatPrice(position.entryPrice || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$${formatPrice(position.markPrice || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: ${parseFloat(position.unRealizedPnL || 0) >= 0 ? '#28a745' : '#dc3545'};">$${formatNumber(position.unRealizedPnL || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>$${formatNumber(position.usdt_value || 0)}</strong></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
              
              <!-- Open Orders Row -->
              ${result.detailed_breakdown['COIN-M'].open_orders && result.detailed_breakdown['COIN-M'].open_orders.length > 0 ? `
                <h6 style="margin: 15px 0 5px 0; color: #495057;">Open Orders (${result.detailed_breakdown['COIN-M'].open_orders.length}):</h6>
                <div style="max-height: 200px; overflow-y: auto; margin: 0 0 20px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 1em;">
                    <thead>
                      <tr style="background: #d1ecf1;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Symbol</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Side</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Type</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Price</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Contracts</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Reduce Only</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">USD Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${result.detailed_breakdown['COIN-M'].open_orders.map(order => `
                        <tr>
                          <td style="padding: 10px; border: 1px solid #ddd;"><strong>${order.symbol}</strong></td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: ${order.side === 'BUY' ? '#28a745' : '#dc3545'};">${order.side}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${order.type}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$${formatPrice(order.price || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCrypto(order.origQty || 0, 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${order.reduceOnly ? '✅' : '❌'}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>$${formatNumber(order.usdt_value || 0)}</strong></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
              
              ${!result.detailed_breakdown['COIN-M'].assets?.length && !result.detailed_breakdown['COIN-M'].positions?.length && !result.detailed_breakdown['COIN-M'].open_orders?.length ? 
                '<p style="margin: 10px 0; font-style: italic;">No COIN-M assets, positions, or orders found</p>' : ''}
            </div>
          ` : ''}
        </div>
      ` : ''}
    `;

    modal.style.display = 'block';
  }

  // Show user account details in a modal (fallback)
  function showUserAccountDetails(data, endpoint) {
    const modal = document.createElement('div');
    modal.className = 'modal verification-modal';
    modal.style.display = 'block';
    
    const content = `
      <div class="modal-content verification-content">
        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
        <h3>👤 User Account Details</h3>
        
        <div class="result-section">
          <h4>📊 Account Information</h4>
          ${endpoint ? `<p style="font-size: 11px; color: #666; margin-bottom: 10px;"><strong>Data source:</strong> ${endpoint}</p>` : ''}
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; margin: 10px 0;">
            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid #007bff;">
              <div style="margin-bottom: 8px;"><strong>Account ID:</strong> ${data.id || data._id || 'N/A'}</div>
              <div style="margin-bottom: 8px;"><strong>Account Name:</strong> ${data.account_name || 'N/A'}</div>
              <div><strong>Exchange:</strong> ${data.exchange || 'N/A'}</div>
            </div>
            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid #28a745;">
              <div style="margin-bottom: 8px;"><strong>User ID:</strong> ${data.user_id || data._user_id || 'N/A'}</div>
              <div style="margin-bottom: 8px;"><strong>Account Type:</strong> ${data.account_type || 'N/A'}</div>
              <div><strong>Status:</strong> ${data.is_active ? '✅ Active' : '❌ Inactive'}</div>
            </div>
          </div>
          
          ${data.created_at ? `<p><strong>Created:</strong> ${new Date(data.created_at).toLocaleString()}</p>` : ''}
          ${data.last_updated ? `<p><strong>Last Updated:</strong> ${new Date(data.last_updated).toLocaleString()}</p>` : ''}
          
          <div style="margin-top: 15px; padding: 10px; background: #e9ecef; border-radius: 5px;">
            <pre style="margin: 0; font-size: 11px; white-space: pre-wrap; word-wrap: break-word;">${JSON.stringify(data, null, 2)}</pre>
          </div>
        </div>
      </div>
    `;
    
    modal.innerHTML = content;
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    };
  }

  // Load strategies for dropdown
  async function loadSourceStrategies() {
    try {
      const response = await fetch(`${AUTH_API_BASE}/strategies`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (response.ok && data.strategies) {
        // Extract strategy names and filter out custom portfolio strategy for source accounts
        sourceStrategies = data.strategies
          .map(strategy => {
            // Handle both string format and object format
            if (typeof strategy === 'string') {
              return strategy;
            } else if (strategy && strategy.name) {
              return strategy.name;
            } else if (strategy && strategy.id) {
              return strategy.id;
            }
            return null;
          })
          .filter(strategyName => 
            strategyName && !['custom_portfolio', 'Custom Portfolio'].includes(strategyName)
          );
        populateStrategyDropdown();
      } else {
        console.error('❌ Failed to load strategies:', data.detail);
      }
    } catch (error) {
      console.error('❌ Error loading strategies:', error);
    }
  }

  // Populate strategy dropdown
  function populateStrategyDropdown() {
    const select = document.getElementById('source-strategy-select');
    select.innerHTML = '<option value="">Select Strategy</option>';
    
    sourceStrategies.forEach(strategy => {
      const option = document.createElement('option');
      option.value = strategy;
      option.textContent = strategy;
      select.appendChild(option);
    });
  }

  // Open add source account modal
  function openAddSourceAccountModal() {
    currentEditingSourceAccountId = null;
    document.getElementById('source-account-modal-title').textContent = 'Add Source Account';
    document.getElementById('source-account-submit').textContent = 'Create Source Account';
    document.getElementById('source-account-status').style.display = 'none';
    document.getElementById('source-account-form').reset();
    document.getElementById('source-account-modal').style.display = 'block';
  }

  // Edit source account
  async function editSourceAccount(accountId) {
    try {
      const response = await fetch(`${AUTH_API_BASE}/admin/source-accounts/${accountId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const account = await response.json();
      
      if (response.ok) {
        currentEditingSourceAccountId = accountId;
        document.getElementById('source-account-modal-title').textContent = 'Edit Source Account';
        document.getElementById('source-account-submit').textContent = 'Update Source Account';
        document.getElementById('source-account-status').style.display = 'block';
        
        // Populate form
        document.getElementById('source-account-id').value = account.id;
        document.getElementById('source-account-name').value = account.account_name;
        document.getElementById('source-exchange-select').value = account.exchange;
        document.getElementById('source-account-type-select').value = account.account_type;
        document.getElementById('source-strategy-select').value = account.strategy;
        document.getElementById('source-description').value = account.description || '';
        document.getElementById('source-is-active').checked = account.is_active;
        
        // Clear credentials for security
        document.getElementById('source-api-key').value = '';
        document.getElementById('source-api-secret').value = '';
        document.getElementById('source-api-key').placeholder = 'Leave blank to keep existing API Key';
        document.getElementById('source-api-secret').placeholder = 'Leave blank to keep existing API Secret';
        document.getElementById('source-api-key').required = false;
        document.getElementById('source-api-secret').required = false;
        
        document.getElementById('source-account-modal').style.display = 'block';
      } else {
        console.error('❌ Failed to load source account:', account.detail);
        showNotification('Failed to load source account', 'error');
      }
    } catch (error) {
      console.error('❌ Error loading source account:', error);
      showNotification('Error loading source account', 'error');
    }
  }

  // Delete source account
  async function deleteSourceAccount(accountId) {
    try {
      // Get account details first
      const response = await fetch(`${AUTH_API_BASE}/admin/source-accounts/${accountId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const account = await response.json();
      
      if (response.ok) {
        // Populate delete modal
        document.getElementById('delete-account-name').textContent = account.account_name;
        document.getElementById('delete-account-exchange').textContent = account.exchange;
        document.getElementById('delete-account-strategy').textContent = account.strategy;
        
        // Store account ID for deletion
        document.getElementById('confirm-delete-source-account').dataset.accountId = accountId;
        document.getElementById('source-account-delete-modal').style.display = 'block';
      }
    } catch (error) {
      console.error('❌ Error loading source account for deletion:', error);
      showNotification('Error loading source account', 'error');
    }
  }

  // Confirm delete source account
  async function confirmDeleteSourceAccount(accountId) {
    try {
      const response = await fetch(`${AUTH_API_BASE}/admin/source-accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        showNotification('Source account deleted successfully', 'success');
        document.getElementById('source-account-delete-modal').style.display = 'none';
        loadSourceAccounts(); // Reload the list
      } else {
        console.error('❌ Failed to delete source account:', data.detail);
        showNotification('Failed to delete source account', 'error');
      }
    } catch (error) {
      console.error('❌ Error deleting source account:', error);
      showNotification('Error deleting source account', 'error');
    }
  }

  // Verify source account
  async function verifySourceAccount(accountId) {
    try {
      showNotification('Starting comprehensive account verification...', 'info');

      const response = await fetch(`${AUTH_API_BASE}/admin/source-accounts/${accountId}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        showVerificationResults(data);
        showNotification('Account verification completed successfully', 'success');
      } else {
        console.error('❌ Failed to verify source account:', data.detail);
        showNotification('Failed to verify source account', 'error');
      }
    } catch (error) {
      console.error('❌ Error verifying source account:', error);
      showNotification('Error verifying source account', 'error');
    }
  }

  // Show verification results in a modal using admin-accounts troubleshoot format
  function showVerificationResults(data) {
    const modal = document.createElement('div');
    modal.className = 'modal verification-modal';
    modal.style.display = 'block';
    
    const statusClass = data.verification_success ? 'result-success' : 'result-error';
    const computedTotalValue = getAccountTotalValue(data);
    const totalValueNumeric = Number(
      computedTotalValue !== null && computedTotalValue !== undefined
        ? computedTotalValue
        : (data.total_usdt_value ??
          data.total_value ??
          data.detailed_breakdown?.summary?.total_value_usdt ??
          data.account_summary?.total_value_usdt ??
          0)
    ) || 0;
    const totalUnrealized = getAccountUnrealizedPnl(data);
    const totalUnrealizedColor = totalUnrealized !== null
      ? (totalUnrealized >= 0 ? '#28a745' : '#dc3545')
      : '#6c757d';
    const totalUnrealizedLabel = totalUnrealized !== null
      ? `${totalUnrealized >= 0 ? '✅' : '⚠️'} $${formatNumber(totalUnrealized || 0)}`
      : 'Not available';
    
    const content = `
      <div class="modal-content verification-content">
        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
        <h3>🔧 Account Verification Results</h3>
        
        <div class="result-section ${statusClass}">
          <h4>📊 Verification Summary</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; margin: 10px 0;">
            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid #007bff;">
              <div style="margin-bottom: 8px;"><strong>Account:</strong> ${data.account_info?.account_name || data.account_name || 'Source Account'}</div>
              <div style="margin-bottom: 8px;"><strong>Type:</strong> ${data.account_type || 'N/A'}</div>
              <div><strong>Status:</strong> <span style="color: ${data.verification_success ? '#28a745' : '#dc3545'};">${data.verification_success ? '✅ Success' : '❌ Failed'}</span></div>
            </div>
            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid #28a745;">
              <div style="margin-bottom: 8px;"><strong>API Key:</strong> <span style="color: ${data.api_key_valid ? '#28a745' : '#dc3545'};">${data.api_key_valid ? '✅ Valid' : '❌ Invalid'}</span></div>
              <div style="margin-bottom: 8px;"><strong>IP Whitelist:</strong> <span style="color: ${data.ip_whitelisted ? '#28a745' : '#dc3545'};">${data.ip_whitelisted ? '✅ Yes' : '❌ No'}</span></div>
              <div><strong>Total Value:</strong> <span style="font-size: 1.1em; font-weight: bold; color: #007bff;">$${formatNumber(totalValueNumeric)}</span></div>
              <div style="margin-top: 8px;"><strong>Unrealized PnL:</strong> <span style="font-weight: bold; color: ${totalUnrealizedColor};">${totalUnrealizedLabel}</span></div>
            </div>
          </div>
        </div>

        ${data.detailed_breakdown || data.balances || data.balance_details ? `
          <div class="result-section">
            <h4>📊 Account Breakdown</h4>
            
            <div class="breakdown-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
              <div><strong>SPOT Value:</strong> $${formatNumber((data.detailed_breakdown?.SPOT?.assets || []).reduce((sum, asset) => sum + (asset.usdt_value || 0), 0))}</div>
              <div><strong>USDT-M Value:</strong> $${formatNumber((data.detailed_breakdown?.['USDT-M']?.assets || []).reduce((sum, asset) => sum + (asset.usdt_value || 0), 0))}</div>
              <div><strong>COIN-M Value:</strong> $${formatNumber((data.detailed_breakdown?.['COIN-M']?.assets || []).reduce((sum, asset) => sum + (asset.usdt_value || 0), 0))}</div>
            </div>
          ${(data.detailed_breakdown?.SPOT || data.balances || data.balance_details) ? `
            <div class="result-section">
              <h5>💰 SPOT Account</h5>
              ${(data.detailed_breakdown?.SPOT?.assets || data.balances || data.balance_details) && (data.detailed_breakdown?.SPOT?.assets?.length > 0 || data.balances?.length > 0 || data.balance_details?.length > 0) ? `
                <div style="max-height: 300px; overflow-y: auto; margin: 10px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 1em;">
                    <thead>
                      <tr style="background: #e9ecef;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Asset</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Total</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">USDT Value</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">% of Account</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${((data.detailed_breakdown?.SPOT?.assets || data.balances || data.balance_details || [])
                        .map(asset => {
                          const totalValue = data.total_usdt_value || data.detailed_breakdown?.summary?.total_value_usdt || 1;
                          const usdt_value = asset.usdt_value || asset.value_usdt || (asset.total * (asset.price || 1)) || 0;
                          const percentage = (usdt_value / totalValue * 100);
                          return { 
                            asset: asset.asset || asset.symbol || asset.coin,
                            total: asset.total || asset.balance || asset.free + asset.locked || asset.quantity || 0,
                            usdt_value: usdt_value,
                            percentage: percentage
                          };
                        })
                        .filter(asset => asset.usdt_value > 0.01)
                        .sort((a, b) => b.percentage - a.percentage)
                        .map(asset => {
                          return `
                            <tr>
                              <td style="padding: 10px; border: 1px solid #ddd;"><strong>${asset.asset}</strong></td>
                              <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCrypto(asset.total || 0)}</td>
                              <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>$${formatNumber(asset.usdt_value || 0)}</strong></td>
                              <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: ${asset.percentage >= 10 ? '#28a745' : asset.percentage >= 5 ? '#ffc107' : '#6c757d'};">${asset.percentage.toFixed(1)}%</td>
                            </tr>
                          `;
                        }).join(''))}
                    </tbody>
                  </table>
                </div>
              ` : '<p style="margin: 10px 0; font-style: italic;">No SPOT assets found</p>'}
            </div>
          ` : ''}
          
          ${data.detailed_breakdown['USDT-M'] ? `
            <div class="result-section">
              <h5>📈 USDT-M Futures</h5>
              
              <!-- Assets Row -->
              ${data.detailed_breakdown['USDT-M'].assets && data.detailed_breakdown['USDT-M'].assets.length > 0 ? `
                <h6 style="margin: 15px 0 5px 0; color: #495057;">Assets (${data.detailed_breakdown['USDT-M'].assets.length}):</h6>
                <div style="max-height: 200px; overflow-y: auto; margin: 0 0 20px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 1em;">
                    <thead>
                      <tr style="background: #fff3cd;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Asset</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Balance</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Available</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">USDT Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${data.detailed_breakdown['USDT-M'].assets.map(asset => `
                        <tr>
                          <td style="padding: 10px; border: 1px solid #ddd;"><strong>${asset.asset}</strong></td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCrypto(asset.balance || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCrypto(asset.available || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>$${formatNumber(asset.usdt_value || 0)}</strong></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
              
              <!-- Positions Row -->
              ${data.detailed_breakdown['USDT-M'].positions && data.detailed_breakdown['USDT-M'].positions.length > 0 ? `
                <h6 style="margin: 15px 0 5px 0; color: #495057;">Positions (${data.detailed_breakdown['USDT-M'].positions.length}):</h6>
                <div style="max-height: 200px; overflow-y: auto; margin: 0 0 20px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 1em;">
                    <thead>
                      <tr style="background: #fff3cd;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Symbol</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Side</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Size</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Entry Price</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Mark Price</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">PNL</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">USDT Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${data.detailed_breakdown['USDT-M'].positions.map(position => {
                        const side = position.position_amount > 0 ? 'Long' : position.position_amount < 0 ? 'Short' : 'None';
                        return `
                        <tr>
                          <td style="padding: 10px; border: 1px solid #ddd;"><strong>${position.symbol}</strong></td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: ${side === 'Long' ? '#28a745' : '#dc3545'};">${side}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCrypto(Math.abs(position.position_amount || 0))}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$${formatPrice(position.entry_price || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$${formatPrice(position.mark_price || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: ${parseFloat(position.unrealized_pnl || 0) >= 0 ? '#28a745' : '#dc3545'};">$${formatNumber(position.unrealized_pnl || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>$${formatNumber(position.usdt_value || 0)}</strong></td>
                        </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
              
              <!-- Open Orders Row -->
              ${data.detailed_breakdown['USDT-M'].open_orders && data.detailed_breakdown['USDT-M'].open_orders.length > 0 ? `
                <h6 style="margin: 15px 0 5px 0; color: #495057;">Open Orders (${data.detailed_breakdown['USDT-M'].open_orders.length}):</h6>
                <div style="max-height: 200px; overflow-y: auto; margin: 0 0 20px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 1em;">
                    <thead>
                      <tr style="background: #fff3cd;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Symbol</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Side</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Type</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Price</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Quantity</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">USDT Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${data.detailed_breakdown['USDT-M'].open_orders.map(order => `
                        <tr>
                          <td style="padding: 10px; border: 1px solid #ddd;"><strong>${order.symbol}</strong></td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: ${order.side === 'BUY' ? '#28a745' : '#dc3545'};">${order.side}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${order.type}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$${formatPrice(order.price || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCrypto(order.origQty || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>$${formatNumber(order.usdt_value || 0)}</strong></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
              
              ${!data.detailed_breakdown['USDT-M'].assets?.length && !data.detailed_breakdown['USDT-M'].positions?.length && !data.detailed_breakdown['USDT-M'].open_orders?.length ? 
                '<p style="margin: 10px 0; font-style: italic;">No USDT-M assets, positions, or orders found</p>' : ''}
            </div>
          ` : ''}
          
          ${data.detailed_breakdown['COIN-M'] ? `
            <div class="result-section">
              <h5>🪙 COIN-M Futures</h5>
              
              <!-- Assets Row -->
              ${data.detailed_breakdown['COIN-M'].assets && data.detailed_breakdown['COIN-M'].assets.length > 0 ? `
                <h6 style="margin: 15px 0 5px 0; color: #495057;">Assets (${data.detailed_breakdown['COIN-M'].assets.length}):</h6>
                <div style="max-height: 200px; overflow-y: auto; margin: 0 0 20px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 1em;">
                    <thead>
                      <tr style="background: #d1ecf1;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Asset</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Balance</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Unrealized PnL</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">USDT Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${data.detailed_breakdown['COIN-M'].assets.map(asset => `
                        <tr>
                          <td style="padding: 10px; border: 1px solid #ddd;"><strong>${asset.asset}</strong></td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCrypto(asset.balance || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: ${parseFloat(asset.unrealized_pnl || 0) >= 0 ? '#28a745' : '#dc3545'};">${formatNumber(asset.unrealized_pnl || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>$${formatNumber(asset.usdt_value || 0)}</strong></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
              
              <!-- Positions Row -->
              ${data.detailed_breakdown['COIN-M'].positions && data.detailed_breakdown['COIN-M'].positions.length > 0 ? `
                <h6 style="margin: 15px 0 5px 0; color: #495057;">Positions (${data.detailed_breakdown['COIN-M'].positions.length}):</h6>
                <div style="max-height: 200px; overflow-y: auto; margin: 0 0 20px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 1em;">
                    <thead>
                      <tr style="background: #d1ecf1;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Symbol</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Side</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Contracts</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Entry Price</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Mark Price</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">PNL (USDT)</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">USD Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${data.detailed_breakdown['COIN-M'].positions.map(position => {
                        const side = position.position_amount > 0 ? 'Long' : position.position_amount < 0 ? 'Short' : 'None';
                        return `
                        <tr>
                          <td style="padding: 10px; border: 1px solid #ddd;"><strong>${position.symbol}</strong></td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: ${side === 'Long' ? '#28a745' : '#dc3545'};">${side}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${parseFloat(Math.abs(position.position_amount || 0)).toFixed(0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$${formatPrice(position.entry_price || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$${formatPrice(position.mark_price || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: ${parseFloat(position.unrealized_pnl || 0) >= 0 ? '#28a745' : '#dc3545'};">$${formatNumber(position.unrealized_pnl || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>$${formatNumber(position.usdt_value || 0)}</strong></td>
                        </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
              
              <!-- Open Orders Row -->
              ${data.detailed_breakdown['COIN-M'].open_orders && data.detailed_breakdown['COIN-M'].open_orders.length > 0 ? `
                <h6 style="margin: 15px 0 5px 0; color: #495057;">Open Orders (${data.detailed_breakdown['COIN-M'].open_orders.length}):</h6>
                <div style="max-height: 200px; overflow-y: auto; margin: 0 0 20px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 1em;">
                    <thead>
                      <tr style="background: #d1ecf1;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Symbol</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Side</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Type</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Price</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Contracts</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Reduce Only</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">USD Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${data.detailed_breakdown['COIN-M'].open_orders.map(order => `
                        <tr>
                          <td style="padding: 10px; border: 1px solid #ddd;"><strong>${order.symbol}</strong></td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: ${order.side === 'BUY' ? '#28a745' : '#dc3545'};">${order.side}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${order.type}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$${formatPrice(order.price || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCrypto(order.origQty || 0, 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${order.reduceOnly ? '✅' : '❌'}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>$${formatNumber(order.usdt_value || 0)}</strong></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
              
              ${!data.detailed_breakdown['COIN-M'].assets?.length && !data.detailed_breakdown['COIN-M'].positions?.length && !data.detailed_breakdown['COIN-M'].open_orders?.length ? 
                '<p style="margin: 10px 0; font-style: italic;">No COIN-M assets, positions, or orders found</p>' : ''}
            </div>
          ` : ''}
        ` : ''}

        ${data.open_orders && data.open_orders.length > 0 ? `
          <div class="verification-section">
            <h5>📋 Open Orders (${data.open_orders.length})</h5>
            <div class="orders-list">
              ${data.open_orders.slice(0, 8).map(order => {
                const isBuy = order.side === 'BUY';
                const isSell = order.side === 'SELL';
                const sideClass = isBuy ? 'buy-order' : isSell ? 'sell-order' : 'neutral-order';
                const sideIcon = isBuy ? '📈' : isSell ? '📉' : '➖';
                
                return `
                  <div class="order-item ${sideClass}">
                    <span class="symbol">${order.symbol}</span>
                    <span class="side ${sideClass}">
                      ${sideIcon} ${order.side}
                    </span>
                    <span class="type">${order.type}</span>
                    <span class="qty">${order.original_qty}</span>
                    <span class="price">${formatPrice(order.price)}</span>
                    <span class="status">${order.status}</span>
                  </div>
                `;
              }).join('')}
              ${data.open_orders.length > 8 ? `<div class="more-orders">... and ${data.open_orders.length - 8} more orders</div>` : ''}
            </div>
          </div>
        ` : ''}


        <div class="verification-footer">
          <small>📅 Verified on ${new Date(data.verified_at).toLocaleString()} by ${data.verified_by}</small>
          <small>⚡ Execution time: ${data.execution_time_ms.toFixed(0)}ms</small>
        </div>
      </div>
    `;
    
    modal.innerHTML = content;
    document.body.appendChild(modal);
  }


  // Handle source account form submission
  async function handleSourceAccountSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const accountData = Object.fromEntries(formData.entries());
    
    // Handle boolean conversion
    accountData.is_active = document.getElementById('source-is-active').checked;
    
    // Remove empty credentials for updates
    if (currentEditingSourceAccountId && (!accountData.api_key || !accountData.api_secret)) {
      delete accountData.api_key;
      delete accountData.api_secret;
    }

    try {
      const url = currentEditingSourceAccountId 
        ? `${AUTH_API_BASE}/admin/source-accounts/${currentEditingSourceAccountId}`
        : `${AUTH_API_BASE}/admin/source-accounts`;
      
      const method = currentEditingSourceAccountId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(accountData)
      });

      const data = await response.json();
      
      if (response.ok) {
        const action = currentEditingSourceAccountId ? 'updated' : 'created';
        showNotification(`Source account ${action} successfully`, 'success');
        document.getElementById('source-account-modal').style.display = 'none';
        loadSourceAccounts(); // Reload the list
      } else {
        console.error(`❌ Failed to ${method.toLowerCase()} source account:`, data.detail);
        showNotification(`Failed to ${method.toLowerCase()} source account`, 'error');
      }
    } catch (error) {
      console.error('❌ Error submitting source account:', error);
      showNotification('Error submitting source account', 'error');
    }
  }

  // Add event listeners for source account management
  document.getElementById('add-source-account').onclick = openAddSourceAccountModal;
  document.getElementById('source-account-form').onsubmit = handleSourceAccountSubmit;
  
  // Source account modal close events
  document.getElementById('source-account-modal-close').onclick = () => {
    document.getElementById('source-account-modal').style.display = 'none';
  };
  
  document.getElementById('source-account-cancel').onclick = () => {
    document.getElementById('source-account-modal').style.display = 'none';
  };

  // Source account delete modal events
  document.getElementById('source-account-delete-close').onclick = () => {
    document.getElementById('source-account-delete-modal').style.display = 'none';
  };
  
  document.getElementById('cancel-delete-source-account').onclick = () => {
    document.getElementById('source-account-delete-modal').style.display = 'none';
  };
  
  // Troubleshoot modal close handler
  document.getElementById('troubleshoot-modal-close').onclick = () => {
    document.getElementById('troubleshoot-modal').style.display = 'none';
  };
  
  document.getElementById('confirm-delete-source-account').onclick = (event) => {
    const accountId = event.target.dataset.accountId;
    if (accountId) {
      confirmDeleteSourceAccount(accountId);
    }
  };

  // === SOURCE ACCOUNTS ANALYTICS FUNCTIONS ===
  
  let sourceAnalyticsChart = null;
  let currentSourceAnalyticsData = null;

  async function initializeSourceAnalytics() {
    try {
      // Initialize chart if LineChart is available
      if (typeof LineChart !== 'undefined') {
        const container = document.getElementById('source-analytics-chart');
        if (container) {
          // Get container dimensions for responsive chart
          const containerRect = container.getBoundingClientRect();
          
          sourceAnalyticsChart = new LineChart('source-analytics-chart', {
            width: Math.max(300, containerRect.width - 40),
            height: Math.min(320, Math.max(280, containerRect.height - 20)),
            animate: true,
            showGrid: true,
            showTooltip: true,
            margin: { top: 40, right: 30, bottom: 40, left: 60 },
            responsive: true,
            colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
            tooltipFormatter: function(data) {
              const date = new Date(data.x);
              const localTime = date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
              });
              return `${localTime}<br/>Value: ${data.label || data.y}`;
            },
            xAxisFormatter: function(value) {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
            }
          });
          } else {
          console.error('❌ Chart container not found');
        }
      } else {
        console.error('❌ LineChart not available - retrying in 1 second...');
        // Retry after a short delay to allow scripts to load
        setTimeout(async () => {
          await initializeSourceAnalytics();
        }, 1000);
        return; // Exit early to avoid loading data without chart
      }

      // Load source accounts list for dropdown
      await loadSourceAccountsAnalyticsList();

      // Load initial analytics data
      await loadSourceAccountsAnalyticsData();

      // Setup event listeners
      setupSourceAnalyticsEventListeners();

    } catch (error) {
      console.error('❌ Error initializing source analytics:', error);
    }
  }

  async function loadSourceAccountsAnalyticsList() {
    const accountSelect = document.getElementById('source-analytics-account-select');
    
    if (!accountSelect) return;

    try {
      const response = await fetch(`${AUTH_API_BASE}/admin/analytics/source-accounts-list`, {
        headers: getAuthHeaders(token)
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          accountSelect.innerHTML = '<option value="ALL">All Source Accounts</option>';
          
          data.accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.name} (${account.strategy}) - ${account.account_type}`;
            accountSelect.appendChild(option);
          });

          } else {
          throw new Error('Invalid response data');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading source accounts list for analytics:', error);
      accountSelect.innerHTML = '<option value="">Error loading accounts</option>';
    }
  }

  async function loadSourceAccountsAnalyticsData() {
    const accountSelect = document.getElementById('source-analytics-account-select');
    const periodSelect = document.getElementById('source-analytics-period-select');
    
    if (!accountSelect || !periodSelect) return;
    
    const selectedAccount = accountSelect.value;
    const selectedPeriod = parseInt(periodSelect.value);
    
    if (!selectedAccount) return;

    try {
      // Show loading state
      if (sourceAnalyticsChart) {
        sourceAnalyticsChart.showLoadingState();
      }
      
      let response;
      
      if (selectedAccount === 'ALL') {
        // Load aggregated data for all source accounts
        response = await fetch(`${AUTH_API_BASE}/admin/analytics/source-accounts-aggregated?days=${selectedPeriod}`, {
          headers: getAuthHeaders(token)
        });
      } else {
        // Load data for specific source account
        response = await fetch(`${AUTH_API_BASE}/admin/analytics/source-account-values/${selectedAccount}?days=${selectedPeriod}`, {
          headers: getAuthHeaders(token)
        });
      }

      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          currentSourceAnalyticsData = data;
          displaySourceAccountsAnalyticsData(data, selectedAccount);
          } else {
          throw new Error('Invalid response data');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      console.error('Error loading source analytics data:', error);
      showSourceAnalyticsError('Failed to load analytics data');
    }
  }

  function displaySourceAccountsAnalyticsData(data, selectedAccount) {
    try {
      // Update status badges
      updateSourceAnalyticsStatusBadges(data.summary || {});
      
      // Prepare chart data
      const chartData = (data.chart_data || [])
        .map(point => {
          const rawTimestamp = point?.timestamp || point?.date || point?.time;
          const dateObj = rawTimestamp ? new Date(rawTimestamp) : null;
          if (!dateObj || Number.isNaN(dateObj.getTime())) {
            console.warn('Skipping source analytics point with invalid timestamp', point);
            return null;
          }

          const numericValue = typeof point?.value === 'number'
            ? point.value
            : parseFloat(point?.value ?? point?.total_value ?? point?.value_usdt ?? 0);

          if (!Number.isFinite(numericValue)) {
            console.warn('Skipping source analytics point with invalid value', point);
            return null;
          }

          return {
            timestamp: dateObj.toISOString(),
            date: dateObj,
            value: numericValue,
            label: '$' + formatNumber(numericValue),
            breakdown: point.breakdown
          };
        })
        .filter(Boolean);

      // Display chart
      if (sourceAnalyticsChart && chartData.length > 0) {
        sourceAnalyticsChart.setData([{
          name: selectedAccount === 'ALL' ? 'All Source Accounts' : (data.account_name || 'Account'),
          values: chartData,  // Changed from 'data' to 'values' to match LineChart expected format
          color: '#3b82f6'
        }]);
        } else if (sourceAnalyticsChart) {
        sourceAnalyticsChart.showEmptyState();
        }

    } catch (error) {
      console.error('Error displaying source analytics data:', error);
      showSourceAnalyticsError('Failed to display analytics data');
    }
  }


  function updateSourceAnalyticsStatusBadges(summary) {
    const currentTotalBadge = document.getElementById('source-current-total-badge');
    const periodChangeBadge = document.getElementById('source-period-change-badge');
    const changePercentageBadge = document.getElementById('source-change-percentage-badge');

    if (currentTotalBadge) {
      currentTotalBadge.textContent = '$' + formatNumber(summary.current_value || 0);
    }

    if (periodChangeBadge) {
      const periodChange = summary.period_change || 0;
      periodChangeBadge.textContent = '$' + formatNumber(periodChange);
      periodChangeBadge.className = `status-badge ${periodChange >= 0 ? 'success' : 'danger'}`;
    }

    if (changePercentageBadge) {
      const percentageChange = summary.percentage_change || 0;
      changePercentageBadge.textContent = `${percentageChange >= 0 ? '+' : ''}${percentageChange.toFixed(2)}%`;
      changePercentageBadge.className = `status-badge ${percentageChange >= 0 ? 'success' : 'danger'}`;
    }
  }

  function showSourceAnalyticsError(message) {
    if (sourceAnalyticsChart) {
      sourceAnalyticsChart.showEmptyState();
    }
    console.error('Source Analytics Error:', message);
  }

  function setupSourceAnalyticsEventListeners() {
    // Account selector change
    const accountSelect = document.getElementById('source-analytics-account-select');
    if (accountSelect) {
      accountSelect.addEventListener('change', async () => {
        await loadSourceAccountsAnalyticsData();
      });
    }

    // Period selector change  
    const periodSelect = document.getElementById('source-analytics-period-select');
    if (periodSelect) {
      periodSelect.addEventListener('change', async () => {
        await loadSourceAccountsAnalyticsData();
      });
    }

    // Refresh button
    const refreshButton = document.getElementById('refresh-source-analytics');
    if (refreshButton) {
      refreshButton.addEventListener('click', async () => {
        await loadSourceAccountsAnalyticsData();
      });
    }
  }

  // === PLATFORM ANALYTICS FUNCTIONS ===
  let platformAnalyticsChart = null;

  async function loadPlatformAnalytics() {
    try {
      const selectedPeriod = document.getElementById('platform-period-select')?.value || 30;
      const response = await fetch(`${AUTH_API_BASE}/admin/analytics/platform-aggregated?days=${selectedPeriod}`, {
        headers: buildAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Platform analytics API error:', errorData);
        throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        // Update global variable with latest platform value for System Overview
        if (data.summary && data.summary.current_value) {
          latestPlatformValue = data.summary.current_value;
          } else if (data.chart_data && data.chart_data.length > 0) {
          // Fallback: use last chart data entry
          const lastEntry = data.chart_data[data.chart_data.length - 1];
          latestPlatformValue = lastEntry.value || 0;
          }

        // Refresh System Overview to show updated portfolio value (fix race condition)
        if (latestPlatformValue > 0) {
          loadSystemOverview();
        }

        platformAnalyticsSnapshot = {
          chart: Array.isArray(data.chart_data) ? data.chart_data : [],
          summary: data.summary || {}
        };

        const selectedDays = Number(selectedPeriod);
        if (!Number.isNaN(selectedDays)) {
          platformKpiCache.set(selectedDays, data.summary || {});
        }
        updatePlatformKpisFromCache();
        loadPlatformKpiSnapshots(true, selectedDays);

        if (data.chart_data && data.chart_data.length > 0) {
          displayPlatformAnalyticsChart(data.chart_data, data.summary || {});
          updatePlatformSummaryStats(data.summary || {});
        } else {
          console.warn('⚠️ Platform analytics successful but no chart data');
          document.getElementById('platform-analytics-chart').innerHTML = `
            <div class="empty-state">
              <p>📭 No platform analytics data available</p>
              <small>Platform data will appear as users start trading</small>
            </div>
          `;
          updatePlatformSummaryStats(data.summary || {});
        }
      } else {
        throw new Error('Platform analytics API returned success: false');
      }

    } catch (error) {
      console.error('❌ Error loading platform analytics:', error);
      const container = document.getElementById('platform-analytics-chart');
      container.innerHTML = `
        <div class="error-state">
          <p>❌ Failed to load platform analytics: ${error.message}</p>
          <button class="retry-btn platform-analytics-retry">🔄 Retry</button>
        </div>
      `;
      resetPlatformKpis();

      // Add event listener to the retry button
      const retryButton = container.querySelector('.platform-analytics-retry');
      if (retryButton) {
        retryButton.addEventListener('click', async () => {
          await loadPlatformAnalytics();
        });
      }
    }
  }

  function displayPlatformAnalyticsChart(chartData, summary) {
    const container = document.getElementById('platform-analytics-chart');

    if (!chartData || chartData.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>📭 No platform analytics data available</p>
          <small>Platform data will appear as users start trading</small>
        </div>
      `;
      return;
    }

    // Destroy existing chart instance if it exists
    if (platformAnalyticsChart) {
      if (typeof platformAnalyticsChart.destroy === 'function') {
        platformAnalyticsChart.destroy();
      }
      platformAnalyticsChart = null;
    }

    const rawPoints = (chartData || [])
      .map(point => {
        const rawTimestamp = point?.timestamp || point?.date || point?.time;
        const dateObj = rawTimestamp ? new Date(rawTimestamp) : null;
        if (!dateObj || Number.isNaN(dateObj.getTime())) {
          console.warn('Skipping platform analytics point with invalid timestamp', point);
          return null;
        }

        const numericValue = typeof point?.value === 'number'
          ? point.value
          : parseFloat(point?.value ?? point?.total_value ?? point?.value_usdt ?? 0);

        if (!Number.isFinite(numericValue)) {
          console.warn('Skipping platform analytics point with invalid value', point);
          return null;
        }

        return {
          timestamp: dateObj.toISOString(),
          date: dateObj,
          value: numericValue
        };
      })
      .filter(Boolean);

    if (rawPoints.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>📭 No platform analytics data available</p>
          <small>Platform data will appear as users start trading</small>
        </div>
      `;
      return;
    }

    const baseValue = rawPoints[0]?.value || 0;
    const percentSeries = rawPoints.map(point => {
      let percentChange = 0;
      if (Math.abs(baseValue) > 0.0001) {
        percentChange = ((point.value - baseValue) / baseValue) * 100;
      }
      return {
        timestamp: point.timestamp,
        date: point.date,
        value: percentChange,
        usdValue: point.value,
        label: `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%`
      };
    });

    try {
      // Get container dimensions for responsive chart
      const containerRect = container.getBoundingClientRect();
       const dynamicHeight = Math.max(320, containerRect.height || 0);
      const percentFormatter = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      const currencyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      });

      // Create new LineChart instance with same config as Source Accounts
      platformAnalyticsChart = new LineChart('platform-analytics-chart', {
        width: Math.max(300, containerRect.width - 40),
        height: dynamicHeight,
        animate: true,
        showGrid: true,
        showTooltip: true,
        margin: { top: 40, right: 30, bottom: 40, left: 60 },
        responsive: true,
        colors: ['#3b82f6'],
        valueFormat: 'percentage',
        centerZero: true,
        fillArea: false,
        tooltipFormatter: function(data) {
          const date = new Date(data.date);
          const localTime = date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          });
          const percentText = `${data.value >= 0 ? '+' : ''}${percentFormatter.format(data.value)}%`;
          const usdText = currencyFormatter.format(data.usdValue || 0);
          return `${localTime}<br/>Change: ${percentText}<br/>Value: ${usdText}`;
        },
        xAxisFormatter: function(value) {
          const date = new Date(value);
          return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        },
        yAxisFormatter: function(value) {
          return `${value >= 0 ? '' : '-'}${Math.abs(value).toFixed(1)}%`;
        }
      });

      // Set data for the LineChart
      platformAnalyticsChart.setData([{
        name: 'Platform % Change',
        values: percentSeries,
        color: '#3b82f6'
      }]);

    } catch (error) {
      console.error('❌ Error creating Platform Analytics LineChart:', error);
      container.innerHTML = `
        <div class="error-state">
          <p>❌ Failed to create chart: ${error.message}</p>
          <button class="retry-btn platform-analytics-retry">🔄 Retry</button>
        </div>
      `;
    }
  }

  function updatePlatformSummaryStats(summary) {
    if (summary && Object.keys(summary).length > 0) {
      // Update the new badge elements
      const currentTotalBadge = document.getElementById('platform-current-total-badge');
      if (currentTotalBadge) {
        currentTotalBadge.textContent = `$${Math.round(summary.current_value || 0).toLocaleString()}`;
      }

      const change24h = summary.change_24h || 0;
      const changeBadge = document.getElementById('platform-24h-change-badge');
      if (changeBadge) {
        changeBadge.textContent = `${change24h >= 0 ? '+' : ''}$${Math.round(change24h).toLocaleString()}`;
        changeBadge.className = `status-badge ${change24h >= 0 ? 'success' : 'danger'}`;
      }

      const usersBadge = document.getElementById('platform-users-count-badge');
      if (usersBadge) {
        usersBadge.textContent = summary.users_with_value || 0;
      }
    }
  }

  function resetPlatformKpis() {
    PLATFORM_KPI_PERIODS.forEach(({ id }) => {
      const changeEl = document.getElementById(`platform-kpi-${id}-change`);
      const profitEl = document.getElementById(`platform-kpi-${id}-profit`);
      const pctEl = document.getElementById(`platform-kpi-${id}-pct`);
      if (changeEl) changeEl.textContent = '--';
      if (profitEl) profitEl.textContent = '--';
      if (pctEl) {
        pctEl.textContent = '--';
        pctEl.classList.remove('success', 'danger');
      }
    });
  }

  function updatePlatformKpisFromCache() {
    resetPlatformKpis();

    PLATFORM_KPI_PERIODS.forEach(({ id, days }) => {
      const summary = platformKpiCache.get(days);
      if (!summary) {
        return;
      }

      const changeValue = pickSummaryValue(summary, [
        'period_change',
        'change',
        'value_change',
        'change_value',
        `change_${id}`
      ]);

      const pctValue = pickSummaryValue(summary, [
        'percentage_change',
        'change_percentage',
        'percent_change',
        `percentage_change_${id}`
      ]);

      const changeEl = document.getElementById(`platform-kpi-${id}-change`);
      if (changeEl) {
        changeEl.textContent = changeValue !== null ? formatCurrency(changeValue, 2, true) : '--';
      }

      const pctEl = document.getElementById(`platform-kpi-${id}-pct`);
      if (pctEl) {
        pctEl.textContent = pctValue !== null ? formatPercentage(pctValue) : '--';
        pctEl.classList.remove('success', 'danger');
        if (pctValue !== null && pctValue > 0.01) {
          pctEl.classList.add('success');
        } else if (pctValue !== null && pctValue < -0.01) {
          pctEl.classList.add('danger');
        }
      }
    });
  }

  async function loadPlatformKpiSnapshots(forceAll = false, skipDays = null) {
    if (platformKpiLoading) {
      return;
    }

    const periodsToFetch = PLATFORM_KPI_PERIODS.filter(({ days }) => {
      if (!forceAll && platformKpiCache.has(days)) {
        return false;
      }
      if (skipDays !== null && Number(days) === Number(skipDays)) {
        return false;
      }
      return true;
    });

    if (!periodsToFetch.length) {
      updatePlatformKpisFromCache();
      return;
    }

    platformKpiLoading = true;
    try {
      const requests = periodsToFetch.map(({ days }) => (
        fetch(`${AUTH_API_BASE}/admin/analytics/platform-aggregated?days=${days}`, {
          headers: buildAuthHeaders()
        })
          .then(async (response) => {
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
            }
            const payload = await response.json();
            if (!payload.success) {
              throw new Error('API returned success=false');
            }
            platformKpiCache.set(days, payload.summary || {});
          })
          .catch((error) => {
            console.error(`❌ Failed to load KPI snapshot for ${days}d:`, error);
          })
      ));

      await Promise.all(requests);
    } catch (error) {
      console.error('❌ Error loading KPI snapshots:', error);
    } finally {
      platformKpiLoading = false;
      updatePlatformKpisFromCache();
    }
  }

  function refreshPlatformAnalytics() {
    loadPlatformAnalytics();
  }

  function setupPlatformAnalyticsEventListeners() {
    // Period selector change
    const periodSelect = document.getElementById('platform-period-select');
    if (periodSelect) {
      periodSelect.addEventListener('change', async () => {
        await loadPlatformAnalytics();
      });
    }

    // Refresh button
    const refreshButton = document.getElementById('refresh-platform-analytics');
    if (refreshButton) {
      refreshButton.addEventListener('click', async () => {
        await loadPlatformAnalytics();
      });
    }
  }

  // Initialize dashboard
  loadSystemOverview();
  loadActiveAccounts();
  loadUsersAccounts();
  loadWalletVerifications();
  loadInvoices();
  loadTierUpgrades();
  loadReferrals();
  loadJobsManagerOverview();
  loadActivity();
  loadSourceStrategies();
  loadSourceAccounts();
  initializeSourceAnalytics();
  loadPlatformAnalytics();
  setupPlatformAnalyticsEventListeners();
  
  }); // End of authorization check
});
