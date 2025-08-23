// admin-dashboard.js - Admin Dashboard Logic v2.4


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

document.addEventListener("DOMContentLoaded", () => {
  // Use centralized API configuration  
  const INVOICING_API_BASE = CONFIG.API_CONFIG.invoicingUrl;
  const AUTH_API_BASE = CONFIG.API_CONFIG.authUrl;
  
  // Check authentication
  const token = localStorage.getItem("token");
  if (!token) {
    console.log("❌ No token found, redirecting to auth...");
    setTimeout(() => {
      window.location.href = "/auth.html";
    }, 2000);
    return;
  }

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
  async function loadSystemOverview() {
    try {
      const response = await fetch(`${INVOICING_API_BASE}/admin/dashboard/summary`, {
        headers: getAuthHeaders(token)
      });

      if (response.ok) {
        const data = await response.json();
        // Handle different possible response structures
        const summary = data.summary || data || {};
        displaySystemOverview(summary);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
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
        <div class="stat-card admin clickable" onclick="window.location.href='/admin-users.html'">
          <div class="stat-icon">📈</div>
          <div class="stat-label">Portfolio Value</div>
          <div class="stat-value">$${(portfolio.total_value || portfolio.value || 0).toLocaleString()}</div>
          <div class="stat-action">Click to manage →</div>
        </div>
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
      console.log('📄 Loading invoices...');
      let url = `${INVOICING_API_BASE}/admin/invoices`;
      if (status) url += `?status=${status}`;

      const response = await fetch(url, {
        headers: getAuthHeaders(token)
      });

      if (response.ok) {
        const data = await response.json();
        // Handle different possible response structures
        const invoices = data.invoices || data || [];
        displayInvoices(invoices);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
      document.querySelector('#admin-invoices-table tbody').innerHTML = 
        '<tr><td colspan="6" class="loading-message">Failed to load invoices</td></tr>';
    }
  }

  function displayInvoices(invoices) {
    const tbody = document.querySelector('#admin-invoices-table tbody');
    
    // Ensure invoices is an array
    if (!Array.isArray(invoices)) {
      console.error('Invoices data is not an array:', invoices);
      tbody.innerHTML = '<tr><td colspan="6" class="loading-message">Invalid invoice data format</td></tr>';
      return;
    }
    
    if (invoices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-message">No invoices found</td></tr>';
      return;
    }

    tbody.innerHTML = invoices.map(invoice => `
      <tr>
        <td>${invoice.invoice_id}</td>
        <td>${invoice.user_email || 'N/A'}</td>
        <td>$${invoice.amount.toFixed(2)}</td>
        <td><span class="status-badge status-${invoice.status}">${invoice.status}</span></td>
        <td>${new Date(invoice.created_at).toLocaleDateString()}</td>
        <td>
          ${invoice.status === 'pending' ? 
            `<button class="success-btn" onclick="approveInvoice('${invoice._id}')">✅ Approve</button>` : 
            '<span class="text-muted">No actions</span>'
          }
        </td>
      </tr>
    `).join('');
  }

  // Make function global for onclick
  window.approveInvoice = async function(invoiceId) {
    if (!confirm('Are you sure you want to approve this invoice?')) return;
    
    try {
      // Log the invoice ID for debugging
      console.log('Approving invoice with ID:', invoiceId);
      
      const response = await fetch(`${INVOICING_API_BASE}/admin/invoices/${invoiceId}/approve`, {
        method: 'PATCH',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          payment_method: 'manual_admin_approval',
          notes: 'Approved via admin dashboard'
        })
      });

      if (response.ok) {
        showToast('Invoice approved successfully!', 'success');
        loadInvoices();
      } else {
        const error = await response.json();
        showToast(`Failed to approve invoice: ${error.detail}`, 'error');
      }
    } catch (error) {
      console.error('Error approving invoice:', error);
      showToast('Error approving invoice', 'error');
    }
  };

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
      
      console.log('📤 Sending payout request for user:', userId, 'amount:', amount);
      
      const response = await fetch(`${INVOICING_API_BASE}/admin/referrals/${userId}/payout`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          admin_user_id: "admin-dashboard", // Required by model, but backend uses current_user
          payout_method: 'manual',
          notes: `Manual payout processed by admin via dashboard`
        })
      });
      
      console.log('📥 Payout response status:', response.status, response.statusText);
      
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
  document.getElementById('refresh-wallets').onclick = loadWalletVerifications;
  document.getElementById('refresh-referrals').onclick = loadReferrals;
  document.getElementById('refresh-activity').onclick = loadActivity;
  document.getElementById('scan-upgrades').onclick = scanUpgrades;

  // Filter invoices
  document.getElementById('filter-invoices').onclick = () => {
    const status = document.getElementById('invoice-status-filter').value;
    loadInvoices(status);
  };

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
      const response = await fetch(`${AUTH_API_BASE}/admin/source-accounts`, {
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
        showNotification('Failed to load source accounts', 'error');
      }
    } catch (error) {
      console.error('❌ Error loading source accounts:', error);
      showNotification('Error loading source accounts', 'error');
    }
  }

  // Display source accounts in table
  function displaySourceAccounts(sourceAccounts) {
    const tbody = document.querySelector('#source-accounts-table tbody');
    
    if (!sourceAccounts || sourceAccounts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="no-data">No source accounts found</td></tr>';
      return;
    }

    tbody.innerHTML = sourceAccounts.map(account => `
      <tr>
        <td>${account.account_name}</td>
        <td>${account.exchange}</td>
        <td>${account.account_type}</td>
        <td>${account.strategy}</td>
        <td>
          <span class="status-badge ${account.is_active ? 'active' : 'inactive'}">
            ${account.is_active ? '✅ Active' : '⏸️ Inactive'}
          </span>
        </td>
        <td>${formatDate(account.created_at)}</td>
        <td>
          <button class="edit-source-btn action-btn" data-id="${account.id}">✏️ Edit</button>
          <button class="verify-source-btn action-btn success" data-id="${account.id}">🔍 Verify</button>
          <button class="delete-source-btn action-btn danger" data-id="${account.id}">🗑️ Delete</button>
        </td>
      </tr>
    `).join('');

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
    
    const content = `
      <div class="modal-content verification-content">
        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
        <h3>🔧 Account Verification Results</h3>
        
        <div class="result-section ${statusClass}">
          <h4>📊 Verification Summary</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; margin: 10px 0;">
            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid #007bff;">
              <div style="margin-bottom: 8px;"><strong>Account:</strong> ${data.account_name || 'N/A'}</div>
              <div style="margin-bottom: 8px;"><strong>Type:</strong> ${data.account_type || 'N/A'}</div>
              <div><strong>Status:</strong> <span style="color: ${data.verification_success ? '#28a745' : '#dc3545'};">${data.verification_success ? '✅ Success' : '❌ Failed'}</span></div>
            </div>
            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid #28a745;">
              <div style="margin-bottom: 8px;"><strong>API Key:</strong> <span style="color: ${data.api_key_valid ? '#28a745' : '#dc3545'};">${data.api_key_valid ? '✅ Valid' : '❌ Invalid'}</span></div>
              <div style="margin-bottom: 8px;"><strong>IP Whitelist:</strong> <span style="color: ${data.ip_whitelisted ? '#28a745' : '#dc3545'};">${data.ip_whitelisted ? '✅ Yes' : '❌ No'}</span></div>
              <div><strong>Total Value:</strong> <span style="font-size: 1.1em; font-weight: bold; color: #007bff;">$${formatNumber(data.total_usdt_value || 0)}</span></div>
            </div>
          </div>
        </div>

        ${data.detailed_breakdown ? `
          <div class="result-section">
            <h4>📊 Account Breakdown</h4>
            
            <div class="breakdown-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
              <div><strong>SPOT Value:</strong> $${formatNumber(data.detailed_breakdown.summary?.spot_value_usdt || data.spot_value || 0)}</div>
              <div><strong>USDT-M Value:</strong> $${formatNumber(data.detailed_breakdown.summary?.usdtm_value_usdt || data.futures_value || 0)}</div>
              <div><strong>COIN-M Value:</strong> $${formatNumber(data.detailed_breakdown.summary?.coinm_value_usdt || 0)}</div>
            </div>
        
        ${data.detailed_breakdown ? `
          ${data.detailed_breakdown.spot ? `
            <div class="result-section">
              <h5>💰 SPOT Account</h5>
              ${data.detailed_breakdown.spot.assets && data.detailed_breakdown.spot.assets.length > 0 ? `
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
                      ${data.detailed_breakdown.spot.assets
                        .map(asset => {
                          const totalValue = data.detailed_breakdown.summary?.total_value_usdt || 1;
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
                      ${data.detailed_breakdown['USDT-M'].positions.map(position => `
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
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCrypto(asset.walletBalance || 0)}</td>
                          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: ${parseFloat(asset.unrealizedPnL || 0) >= 0 ? '#28a745' : '#dc3545'};">${formatNumber(asset.unrealizedPnL || 0)}</td>
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
                      ${data.detailed_breakdown['COIN-M'].positions.map(position => `
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
                    <span class="price">${formatCurrency(order.price)}</span>
                    <span class="status">${order.status}</span>
                  </div>
                `;
              }).join('')}
              ${data.open_orders.length > 8 ? `<div class="more-orders">... and ${data.open_orders.length - 8} more orders</div>` : ''}
            </div>
          </div>
        ` : ''}

        <div class="verification-section">
          <h5>🔧 Technical Verification</h5>
          <div class="test-results">
            ${data.test_results.map(test => `
              <div class="test-item ${test.success ? 'success' : 'error'}">
                <span class="status">${test.success ? '✅' : '❌'}</span>
                <span class="stage">${test.stage.replace(/_/g, ' ')}</span>
                <span class="message">${test.message}</span>
                ${test.latency_ms ? `<span class="latency">${test.latency_ms}ms</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

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
  
  document.getElementById('confirm-delete-source-account').onclick = (event) => {
    const accountId = event.target.dataset.accountId;
    if (accountId) {
      confirmDeleteSourceAccount(accountId);
    }
  };

  // Initialize dashboard
  loadSystemOverview();
  loadWalletVerifications();
  loadInvoices();
  loadTierUpgrades();
  loadReferrals();
  loadActivity();
  loadSourceStrategies();
  loadSourceAccounts();
  
  }); // End of authorization check
});