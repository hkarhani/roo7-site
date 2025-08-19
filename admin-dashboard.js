// admin-dashboard.js - Admin Dashboard Logic v2.4

console.log('🚀 Loading admin-dashboard.js v2.4 with wallet verification and email reminders');

// Import centralized configuration
import CONFIG from './frontend-config.js';

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
      console.log('📊 Loading system overview...');
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
      <div class="stat-card admin">
        <div class="stat-icon">👥</div>
        <div class="stat-label">Total Users</div>
        <div class="stat-value">${users.total || users.count || 0}</div>
      </div>
      <div class="stat-card admin">
        <div class="stat-icon">✅</div>
        <div class="stat-label">Verified Users</div>
        <div class="stat-value">${users.verified || users.verified_count || 0}</div>
      </div>
      <div class="stat-card admin">
        <div class="stat-icon">🔄</div>
        <div class="stat-label">Active Subs</div>
        <div class="stat-value">${subscriptions.active || subscriptions.active_count || 0}</div>
      </div>
      <div class="stat-card admin">
        <div class="stat-icon">📄</div>
        <div class="stat-label">Pending Invoices</div>
        <div class="stat-value">${invoices.pending || invoices.pending_count || 0}</div>
      </div>
      <div class="stat-card admin">
        <div class="stat-icon">💰</div>
        <div class="stat-label">Total Revenue</div>
        <div class="stat-value">$${(invoices.total_revenue || invoices.revenue || 0).toLocaleString()}</div>
      </div>
      <div class="stat-card admin">
        <div class="stat-icon">📈</div>
        <div class="stat-label">Portfolio Value</div>
        <div class="stat-value">$${(portfolio.total_value || portfolio.value || 0).toLocaleString()}</div>
      </div>
    `;
  }

  // === WALLET VERIFICATION FUNCTIONS ===
  async function loadWalletVerifications() {
    try {
      console.log('💳 Loading wallet verifications...');
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
      const response = await fetch(`${INVOICING_API_BASE}/admin/invoices/${invoiceId}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(token)
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
      console.log('⬆️ Loading tier upgrades...');
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
      console.log('🎯 Loading referrals... (v2.1 with enhanced debugging)');
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
    console.log('🔍 Referrals data received:', data);
    console.log('🔍 Referrers array:', data.referrers);
    console.log('🔍 Referrers length:', data.referrers ? data.referrers.length : 'undefined');
    console.log('🔍 First referrer details:', data.referrers && data.referrers[0] ? data.referrers[0] : 'no first referrer');
    console.log('🔍 Data type check - is array?', Array.isArray(data.referrers));
    
    const summaryHtml = `
      <div class="referrals-summary">
        <div class="referral-stat">
          <span class="value">${data.total_referrers || 0}</span>
          <span class="label">Total Referrers</span>
        </div>
        <div class="referral-stat">
          <span class="value">$${(data.total_pending || 0).toFixed(2)}</span>
          <span class="label">Pending Payouts</span>
        </div>
        <div class="referral-stat">
          <span class="value">${data.total_referrals || 0}</span>
          <span class="label">Total Referrals</span>
        </div>
      </div>
    `;
    
    // Show detailed referrers list if available
    let referrersHtml = '';
    if (data.referrers && data.referrers.length > 0) {
      console.log('✅ Showing referrers list with', data.referrers.length, 'referrers');
      console.log('🔍 About to generate HTML for referrers:', data.referrers);
      
      try {
        const referrerItems = data.referrers.map((referrer, index) => {
          console.log(`🔍 Processing referrer ${index}:`, referrer);
          
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
        console.log('🔍 Generated referrers HTML length:', referrersHtml.length);
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
      console.log('ℹ️ No referrers with pending payouts, but total_referrers > 0');
      referrersHtml = `
        <div class="empty-state admin" style="margin-top: 20px;">
          <h4>No Pending Payouts</h4>
          <p>All referral commissions have been paid out.</p>
        </div>
      `;
    } else {
      console.log('ℹ️ No referrers data at all');
      referrersHtml = `
        <div class="empty-state admin" style="margin-top: 20px;">
          <h4>No Referrals Data</h4>
          <p>No referral activity found.</p>
        </div>
      `;
    }
    
    console.log('🔍 Final summaryHtml length:', summaryHtml.length);
    console.log('🔍 Final referrersHtml length:', referrersHtml.length);
    console.log('🔍 Final combined HTML length:', (summaryHtml + referrersHtml).length);
    
    container.innerHTML = summaryHtml + referrersHtml;
    
    console.log('🔍 Container after innerHTML set:', container.innerHTML.length, 'chars');
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
        console.log('✅ Payout successful:', result);
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
      console.log('📋 Loading activity...');
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

  // Initialize dashboard
  console.log('🚀 Initializing admin dashboard...');
  loadSystemOverview();
  loadWalletVerifications();
  loadInvoices();
  loadTierUpgrades();
  loadReferrals();
  loadActivity();
  
  }); // End of authorization check
});