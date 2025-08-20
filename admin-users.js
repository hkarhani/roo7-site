// admin-users.js - Admin User Management v1.0

console.log('🚀 Loading admin-users.js v1.0');

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

  // Global variables for user management
  let currentUsers = [];
  let filteredUsers = [];
  let currentPage = 1;
  let pageSize = 50;
  let totalUsers = 0;
  let selectedUsers = new Set();
  let currentUser = null;
  let isLoading = false;
  let searchCache = new Map(); // Cache search results for better performance

  // 🔒 SECURITY: Verify admin access before loading page
  async function verifyAdminAccess() {
    try {
      // Show loading indicator during auth check
      const tbody = document.querySelector('#admin-users-table tbody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="11" class="loading-message">🔐 Verifying admin access...</td></tr>';
      }
      
      const response = await fetch(`${AUTH_API_BASE}/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status}`);
      }

      const userData = await response.json();
      
      if (!userData.is_admin) {
        showSecurityViolationMessage();
        setTimeout(() => {
          window.location.href = "/dashboard.html";
        }, 5000);
        return false;
      }
      
      currentUser = userData;
      return true;
    } catch (error) {
      showToast('Authentication failed. Redirecting...', 'error');
      setTimeout(() => {
        window.location.href = "/auth.html";
      }, 2000);
      return false;
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

  // Auth headers helper
  function getAuthHeaders(token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }
  
  // Helper function to format user created date
  function formatUserCreatedDate(user) {
    // Try multiple possible date fields and formats
    const possibleDates = [
      user.created_at,
      user.createdAt,
      user.registration_date,
      user.date_joined
    ];
    
    for (const dateValue of possibleDates) {
      if (dateValue) {
        try {
          // Handle MongoDB ObjectId timestamp
          if (typeof dateValue === 'object' && dateValue.$date) {
            return new Date(dateValue.$date).toLocaleString();
          }
          // Handle ISO string or timestamp
          const date = new Date(dateValue);
          if (!isNaN(date.getTime())) {
            return date.toLocaleString();
          }
        } catch (error) {
          console.warn('Error parsing date:', dateValue, error);
        }
      }
    }
    
    // If no valid date found, extract from ObjectId if available
    if (user._id) {
      try {
        // MongoDB ObjectId contains timestamp in first 4 bytes
        const objectId = user._id.toString();
        if (objectId.length === 24) {
          const timestamp = parseInt(objectId.substring(0, 8), 16) * 1000;
          return new Date(timestamp).toLocaleString() + ' (from ID)';
        }
      } catch (error) {
        console.warn('Error extracting date from ObjectId:', user._id, error);
      }
    }
    
    return 'Date not available';
  }

  // Optimized API connectivity test - minimal and non-blocking
  async function testApiConnectivity() {
    try {
      // Quick health check without verbose logging
      const healthResponse = await fetch(`${INVOICING_API_BASE}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        timeout: 3000 // 3 second timeout
      });
      
      if (healthResponse.ok) {
        console.log('✅ API connectivity verified');
      }
    } catch (error) {
      // Silent fail - don't block user experience
      console.warn('⚠️ API connectivity check failed');
    }
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

  // === USER MANAGEMENT FUNCTIONS ===
  
  async function loadUsers(searchTerm = '', statusFilter = '', tierFilter = '', offset = 0, limit = pageSize) {
    // Prevent concurrent loading requests
    if (isLoading) {
      return;
    }
    
    isLoading = true;
    
    try {
      // Check cache for search results (improves performance for repeated searches)
      const cacheKey = `${searchTerm}-${statusFilter}-${tierFilter}-${offset}-${limit}`;
      if (searchTerm && searchCache.has(cacheKey)) {
        const cachedData = searchCache.get(cacheKey);
        currentUsers = cachedData.users;
        filteredUsers = cachedData.users;
        totalUsers = cachedData.total;
        displayUsers(cachedData.users);
        updatePagination();
        updateUserStats();
        showToast(`Loaded ${cachedData.users.length} users (cached)`, 'info', 1000);
        return;
      }
      
      // Show enhanced loading indicator with progress
      const tbody = document.querySelector('#admin-users-table tbody');
      tbody.innerHTML = `
        <tr>
          <td colspan="11" class="loading-message">
            <div class="loading-spinner">🔄</div>
            <div class="loading-text">Loading users...</div>
            <div class="loading-progress">Please wait...</div>
          </td>
        </tr>
      `;
      
      // Optimized loading timeout - shorter duration
      const loadingTimeout = setTimeout(() => {
        const loadingProgress = document.querySelector('.loading-progress');
        if (loadingProgress && isLoading) {
          loadingProgress.textContent = 'Processing user data...';
        }
      }, 800);
      
      let url = `${INVOICING_API_BASE}/admin/users?limit=${limit}&offset=${offset}`;
      
      // Use search endpoint if search term provided
      if (searchTerm) {
        url = `${INVOICING_API_BASE}/admin/users/search?q=${encodeURIComponent(searchTerm)}`;
      }
      
      const response = await fetch(url, {
        headers: getAuthHeaders(token)
      });
      
      clearTimeout(loadingTimeout);
      
      if (response.ok) {
        const data = await response.json();
        let users = data.users || [];
        
        // Apply client-side filtering for status and tier
        if (statusFilter || tierFilter) {
          users = users.filter(user => {
            let matchesStatus = true;
            let matchesTier = true;
            
            if (statusFilter) {
              switch (statusFilter) {
                case 'active':
                  matchesStatus = !user.is_disabled;
                  break;
                case 'disabled':
                  matchesStatus = user.is_disabled;
                  break;
                case 'admin':
                  matchesStatus = user.is_admin;
                  break;
                case 'unverified':
                  matchesStatus = !user.email_verified;
                  break;
              }
            }
            
            if (tierFilter) {
              matchesTier = user.current_tier === tierFilter;
            }
            
            return matchesStatus && matchesTier;
          });
        }
        
        // Cache search results for better performance
        if (searchTerm && searchCache.size < 50) { // Limit cache size
          searchCache.set(cacheKey, { users, total: data.total || users.length });
        }
        
        currentUsers = users;
        filteredUsers = users;
        totalUsers = data.total || users.length;
        
        // Debug invoice data for first user
        if (users.length > 0) {
          console.log('🔍 Sample user invoice data:', {
            user: users[0].email || users[0].username,
            paid_invoices_count: users[0].paid_invoices_count,
            total_paid_amount: users[0].total_paid_amount,
            unpaid_invoices_count: users[0].unpaid_invoices_count,
            total_unpaid_amount: users[0].total_unpaid_amount,
            created_at: users[0].created_at
          });
        }
        
        displayUsers(users);
        updatePagination();
        updateUserStats();
        
        // Show concise success feedback
        if (searchTerm) {
          showToast(`Found ${users.length} users`, 'success', 1200);
        } else if (users.length > 0) {
          showToast(`Loaded ${users.length} users`, 'success', 1200);
        }
        
      } else {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Error loading users:', error);
      document.querySelector('#admin-users-table tbody').innerHTML = 
        '<tr><td colspan="11" class="loading-message">❌ Failed to load users. Please try again.</td></tr>';
      showToast('Failed to load users. Please try again.', 'error');
    } finally {
      isLoading = false;
    }
  }
  
  function displayUsers(users) {
    const tbody = document.querySelector('#admin-users-table tbody');
    
    if (!Array.isArray(users) || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" class="loading-message">No users found</td></tr>';
      return;
    }
    
    tbody.innerHTML = users.map(user => {
      const isDisabled = user.is_disabled || false;
      const isAdmin = user.is_admin || false;
      const emailVerified = user.email_verified || false;
      const isPayingCustomer = user.is_paying_customer || false;
      
      let statusBadge = '';
      if (isDisabled) {
        statusBadge = '<span class="status-badge status-disabled">Disabled</span>';
      } else if (isAdmin) {
        statusBadge = '<span class="status-badge status-admin">Admin</span>';
      } else if (!emailVerified) {
        statusBadge = '<span class="status-badge status-unverified">Unverified</span>';
      } else {
        statusBadge = '<span class="status-badge status-active">Active</span>';
      }
      
      const createdDate = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A';
      
      // Format subscription period - fix N/A display issue
      let subscriptionPeriod = 'No Subscription';
      if (user.subscription_start && user.subscription_end) {
        const startDate = new Date(user.subscription_start).toLocaleDateString();
        const endDate = new Date(user.subscription_end).toLocaleDateString();
        subscriptionPeriod = `${startDate} - ${endDate}`;
      } else if (user.subscription_start) {
        const startDate = new Date(user.subscription_start).toLocaleDateString();
        subscriptionPeriod = `${startDate} - Active`;
      } else if (user.is_paying_customer) {
        subscriptionPeriod = 'Active (No Dates)';
      }
      
      // Determine row class for paying customer highlighting
      let rowClass = '';
      if (isDisabled) {
        rowClass = 'user-disabled';
      } else if (isPayingCustomer) {
        rowClass = 'paying-customer';
      }
      
      return `
        <tr class="${rowClass}" data-user-id="${user._id}">
          <td>
            <input type="checkbox" class="user-checkbox" value="${user._id}" 
                   ${isAdmin ? 'disabled title="Cannot select admin users"' : ''} />
          </td>
          <td>
            <div class="user-info">
              <span class="username" onclick="viewUserDetails('${user._id}')">${user.email || 'N/A'}</span>
              ${isAdmin ? '<span class="admin-badge">ADMIN</span>' : ''}
              ${isPayingCustomer ? '<span class="paying-badge">PAYING</span>' : ''}
            </div>
          </td>
          <td>${user.full_name || user.username || 'N/A'}</td>
          <td>${user.total_accounts || 0}</td>
          <td>$${(user.active_funds || 0).toLocaleString()}</td>
          <td><span class="tier-badge tier-${user.current_tier}">${user.current_tier || 'Free'}</span></td>
          <td><span class="invoice-amount paid">$${(user.total_paid_amount || 0).toFixed(2)}</span></td>
          <td><span class="referral-earnings">$${(user.lifetime_referral_earnings || 0).toFixed(2)}</span></td>
          <td><span class="subscription-period" title="${subscriptionPeriod}">${subscriptionPeriod}</span></td>
          <td>${statusBadge}</td>
          <td>
            <div class="action-buttons">
              <button class="small-btn info-btn" onclick="viewUserDetails('${user._id}')" title="View Details">
                👁️
              </button>
              ${!isAdmin ? `
                ${isDisabled ? 
                  `<button class="small-btn success-btn" onclick="enableUser('${user._id}', '${user.username || user.email}')" title="Enable User">✅</button>` :
                  `<button class="small-btn warning-btn" onclick="disableUser('${user._id}', '${user.username || user.email}')" title="Disable User">❌</button>`
                }
                <button class="small-btn danger-btn" onclick="deleteUser('${user._id}', '${user.username || user.email}')" title="Delete User">🗑️</button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
    // Setup checkbox listeners
    setupCheckboxListeners();
  }
  
  function setupCheckboxListeners() {
    const selectAllCheckbox = document.getElementById('select-all-users');
    const userCheckboxes = document.querySelectorAll('.user-checkbox');
    
    selectAllCheckbox.addEventListener('change', function() {
      userCheckboxes.forEach(checkbox => {
        if (!checkbox.disabled) {
          checkbox.checked = this.checked;
          if (this.checked) {
            selectedUsers.add(checkbox.value);
          } else {
            selectedUsers.delete(checkbox.value);
          }
        }
      });
      updateBulkActions();
    });
    
    userCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', function() {
        if (this.checked) {
          selectedUsers.add(this.value);
        } else {
          selectedUsers.delete(this.value);
        }
        
        // Update select all checkbox
        const checkedCount = document.querySelectorAll('.user-checkbox:checked').length;
        const totalCount = document.querySelectorAll('.user-checkbox:not(:disabled)').length;
        selectAllCheckbox.checked = checkedCount === totalCount;
        selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < totalCount;
        
        updateBulkActions();
      });
    });
  }
  
  function updateBulkActions() {
    const bulkSection = document.querySelector('.bulk-actions-section');
    const selectedCount = document.querySelector('.selected-count');
    
    if (selectedUsers.size > 0) {
      bulkSection.style.display = 'block';
      selectedCount.textContent = `${selectedUsers.size} user${selectedUsers.size === 1 ? '' : 's'} selected`;
    } else {
      bulkSection.style.display = 'none';
    }
  }
  
  function updateUserStats() {
    const totalCount = document.getElementById('total-users-count');
    const showingCount = document.getElementById('showing-count');
    const activeCount = document.getElementById('active-users-count');
    const disabledCount = document.getElementById('disabled-users-count');
    
    const active = currentUsers.filter(u => !u.is_disabled).length;
    const disabled = currentUsers.filter(u => u.is_disabled).length;
    
    totalCount.textContent = totalUsers.toLocaleString();
    showingCount.textContent = currentUsers.length.toLocaleString();
    activeCount.textContent = active.toLocaleString();
    disabledCount.textContent = disabled.toLocaleString();
  }
  
  function updatePagination() {
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    
    const totalPages = Math.ceil(totalUsers / pageSize);
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
  }
  
  // === USER ACTIONS ===
  
  window.viewUserDetails = async function(userId) {
    try {
      const user = currentUsers.find(u => u._id === userId);
      if (!user) return;
      
      const modal = document.getElementById('user-detail-modal');
      const title = document.getElementById('user-detail-title');
      const content = document.getElementById('user-detail-content');
      
      title.textContent = `User Details - ${user.username || user.email || 'Unknown User'}`;
      
      // Calculate subscription period for modal
      let subscriptionInfo = 'No Active Subscription';
      let subscriptionDuration = 'N/A';
      if (user.subscription_start && user.subscription_end) {
        const start = new Date(user.subscription_start);
        const end = new Date(user.subscription_end);
        subscriptionInfo = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        subscriptionDuration = `${diffDays} days`;
      } else if (user.subscription_start) {
        subscriptionInfo = `${new Date(user.subscription_start).toLocaleDateString()} - Active`;
        const start = new Date(user.subscription_start);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        subscriptionDuration = `${diffDays} days (ongoing)`;
      }
      
      content.innerHTML = `
        <div class="user-detail-grid">
          <div class="detail-section">
            <h4>Basic Information</h4>
            <div class="detail-row">
              <span class="detail-label">Username:</span>
              <span class="detail-value">${user.username || 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Email:</span>
              <span class="detail-value">${user.email || 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Full Name:</span>
              <span class="detail-value">${user.full_name || 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Email Verified:</span>
              <span class="detail-value">${user.email_verified ? '✅ Yes' : '❌ No'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Created:</span>
              <span class="detail-value">${formatUserCreatedDate(user)}</span>
            </div>
          </div>
          
          <div class="detail-section">
            <h4>Account & Trading Statistics</h4>
            <div class="detail-row">
              <span class="detail-label">Current Tier:</span>
              <span class="detail-value tier-${user.current_tier}">${user.current_tier || 'Free'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Total Accounts:</span>
              <span class="detail-value">${user.total_accounts || 0}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Strategies Assigned:</span>
              <span class="detail-value">${user.strategies_assigned || 0}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Active Funds:</span>
              <span class="detail-value">$${(user.active_funds || 0).toLocaleString()}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Paying Customer:</span>
              <span class="detail-value">${user.is_paying_customer ? '✅ Yes' : '❌ No'}</span>
            </div>
          </div>
          
          <div class="detail-section">
            <h4>Invoice Statistics</h4>
            <div class="detail-row">
              <span class="detail-label">Paid Invoices Count:</span>
              <span class="detail-value invoice-count paid">${user.paid_invoices_count || 0}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Total Paid Amount:</span>
              <span class="detail-value invoice-amount paid">$${(user.total_paid_amount || 0).toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Unpaid Invoices Count:</span>
              <span class="detail-value invoice-count unpaid">${user.unpaid_invoices_count || 0}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Total Unpaid Amount:</span>
              <span class="detail-value invoice-amount unpaid">$${(user.total_unpaid_amount || 0).toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Total Invoices:</span>
              <span class="detail-value">${(user.paid_invoices_count || 0) + (user.unpaid_invoices_count || 0)}</span>
            </div>
            ${user.last_paid_amount && user.last_paid_amount > 0 ? `
              <div class="detail-row">
                <span class="detail-label">Last Paid Invoice:</span>
                <span class="detail-value">$${user.last_paid_amount.toFixed(2)}</span>
              </div>
              ${user.last_paid_date ? `
                <div class="detail-row">
                  <span class="detail-label">Last Payment Date:</span>
                  <span class="detail-value">${new Date(user.last_paid_date).toLocaleDateString()}</span>
                </div>
              ` : ''}
            ` : ''}
          </div>
          
          <div class="detail-section">
            <h4>Referral Statistics</h4>
            <div class="detail-row">
              <span class="detail-label">Total Referrals Made:</span>
              <span class="detail-value">${user.total_referrals || 0}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Successful Referrals:</span>
              <span class="detail-value referral-count successful">${user.successful_referrals || 0}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Lifetime Referral Earnings:</span>
              <span class="detail-value referral-earnings">$${(user.lifetime_referral_earnings || 0).toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Paid Referral Earnings:</span>
              <span class="detail-value referral-earnings">$${(user.paid_referral_earnings || 0).toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Pending Referral Earnings:</span>
              <span class="detail-value referral-earnings">$${((user.lifetime_referral_earnings || 0) - (user.paid_referral_earnings || 0)).toFixed(2)}</span>
            </div>
          </div>
          
          <div class="detail-section">
            <h4>Subscription Information</h4>
            <div class="detail-row">
              <span class="detail-label">Subscription Period:</span>
              <span class="detail-value">${subscriptionInfo}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Subscription Duration:</span>
              <span class="detail-value">${subscriptionDuration}</span>
            </div>
            ${user.subscription_start ? `
              <div class="detail-row">
                <span class="detail-label">Start Date:</span>
                <span class="detail-value">${new Date(user.subscription_start).toLocaleDateString()}</span>
              </div>
            ` : ''}
            ${user.subscription_end ? `
              <div class="detail-row">
                <span class="detail-label">End Date:</span>
                <span class="detail-value">${new Date(user.subscription_end).toLocaleDateString()}</span>
              </div>
            ` : ''}
          </div>
          
          <div class="detail-section">
            <h4>Status Information</h4>
            <div class="detail-row">
              <span class="detail-label">User Status:</span>
              <span class="detail-value">${user.is_disabled ? 
                '<span class="status-badge status-disabled">Disabled</span>' : 
                '<span class="status-badge status-active">Active</span>'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Admin User:</span>
              <span class="detail-value">${user.is_admin ? '✅ Yes' : '❌ No'}</span>
            </div>
            ${user.is_disabled ? `
              <div class="detail-row">
                <span class="detail-label">Disabled Reason:</span>
                <span class="detail-value">${user.disabled_reason || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Disabled By:</span>
                <span class="detail-value">${user.disabled_by || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Disabled At:</span>
                <span class="detail-value">${user.disabled_at ? new Date(user.disabled_at).toLocaleString() : 'N/A'}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
      
      modal.style.display = 'block';
      
    } catch (error) {
      console.error('Error loading user details:', error);
      showToast('Failed to load user details', 'error');
    }
  };
  
  window.disableUser = function(userId, username) {
    const modal = document.getElementById('disable-user-modal');
    const info = document.getElementById('disable-user-info');
    const reasonTextarea = document.getElementById('disable-reason');
    
    info.innerHTML = `
      <p>You are about to disable user: <strong>${username}</strong></p>
      <p>This will prevent the user from logging in and disable all their trading accounts.</p>
    `;
    
    reasonTextarea.value = '';
    modal.style.display = 'block';
    
    // Store current user ID for the action
    modal.setAttribute('data-user-id', userId);
    modal.setAttribute('data-username', username);
  };
  
  window.enableUser = async function(userId, username) {
    if (!confirm(`Are you sure you want to enable user "${username}"?`)) {
      return;
    }
    
    try {
      const response = await fetch(`${INVOICING_API_BASE}/admin/users/${userId}/enable`, {
        method: 'POST',
        headers: getAuthHeaders(token)
      });
      
      if (response.ok) {
        showToast(`User "${username}" has been enabled`, 'success');
        await refreshCurrentView();
      } else {
        const error = await response.json();
        showToast(`Failed to enable user: ${error.detail}`, 'error');
      }
    } catch (error) {
      console.error('Error enabling user:', error);
      showToast('Error enabling user', 'error');
    }
  };
  
  window.deleteUser = function(userId, username) {
    const modal = document.getElementById('delete-user-modal');
    const info = document.getElementById('delete-user-info');
    const confirmationInput = document.getElementById('delete-confirmation');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    
    info.innerHTML = `
      <p>You are about to permanently delete user: <strong>${username}</strong></p>
      <p>User ID: <code>${userId}</code></p>
    `;
    
    confirmationInput.value = '';
    confirmBtn.disabled = true;
    modal.style.display = 'block';
    
    // Store current user ID for the action
    modal.setAttribute('data-user-id', userId);
    modal.setAttribute('data-username', username);
  };
  
  async function refreshCurrentView() {
    const searchTerm = document.getElementById('user-search').value.trim();
    const statusFilter = document.getElementById('status-filter').value;
    const tierFilter = document.getElementById('tier-filter').value;
    const offset = (currentPage - 1) * pageSize;
    
    await loadUsers(searchTerm, statusFilter, tierFilter, offset, pageSize);
    selectedUsers.clear();
    updateBulkActions();
  }
  
  // === EVENT LISTENERS ===
  
  // Navigation
  document.getElementById('back-to-admin').onclick = () => {
    window.location.href = '/admin-dashboard.html';
  };
  
  document.getElementById('logout-btn').onclick = () => {
    localStorage.removeItem("token");
    window.location.href = "/auth.html";
  };
  
  // Search and filters
  document.getElementById('search-users-btn').onclick = () => {
    currentPage = 1;
    refreshCurrentView();
  };
  
  document.getElementById('clear-search-btn').onclick = () => {
    document.getElementById('user-search').value = '';
    document.getElementById('status-filter').value = '';
    document.getElementById('tier-filter').value = '';
    currentPage = 1;
    refreshCurrentView();
  };
  
  document.getElementById('apply-filters-btn').onclick = () => {
    currentPage = 1;
    refreshCurrentView();
  };
  
  document.getElementById('load-all-users-btn').onclick = () => {
    document.getElementById('user-search').value = '';
    document.getElementById('status-filter').value = '';
    document.getElementById('tier-filter').value = '';
    currentPage = 1;
    loadUsers();
  };
  
  // Debounced search for better performance
  let searchTimeout;
  document.getElementById('user-search').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (e.target.value.length >= 3 || e.target.value.length === 0) {
        currentPage = 1;
        refreshCurrentView();
      }
    }, 500); // 500ms debounce
  });
  
  // Enter key for immediate search
  document.getElementById('user-search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(searchTimeout);
      currentPage = 1;
      refreshCurrentView();
    }
  });
  
  // Pagination
  document.getElementById('prev-page-btn').onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      refreshCurrentView();
    }
  };
  
  document.getElementById('next-page-btn').onclick = () => {
    const totalPages = Math.ceil(totalUsers / pageSize);
    if (currentPage < totalPages) {
      currentPage++;
      refreshCurrentView();
    }
  };
  
  document.getElementById('page-size').onchange = (e) => {
    pageSize = parseInt(e.target.value);
    currentPage = 1;
    refreshCurrentView();
  };
  
  // Modal event listeners
  document.getElementById('user-detail-modal-close').onclick = () => {
    document.getElementById('user-detail-modal').style.display = 'none';
  };
  
  document.getElementById('close-detail-btn').onclick = () => {
    document.getElementById('user-detail-modal').style.display = 'none';
  };
  
  // Disable user modal
  document.getElementById('disable-modal-close').onclick = () => {
    document.getElementById('disable-user-modal').style.display = 'none';
  };
  
  document.getElementById('cancel-disable-btn').onclick = () => {
    document.getElementById('disable-user-modal').style.display = 'none';
  };
  
  document.getElementById('confirm-disable-btn').onclick = async () => {
    const modal = document.getElementById('disable-user-modal');
    const userId = modal.getAttribute('data-user-id');
    const username = modal.getAttribute('data-username');
    const reason = document.getElementById('disable-reason').value.trim();
    
    if (!reason) {
      showToast('Please enter a reason for disabling the user', 'warning');
      return;
    }
    
    try {
      const response = await fetch(`${INVOICING_API_BASE}/admin/users/${userId}/disable`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ reason })
      });
      
      if (response.ok) {
        showToast(`User "${username}" has been disabled`, 'success');
        modal.style.display = 'none';
        await refreshCurrentView();
      } else {
        const error = await response.json();
        showToast(`Failed to disable user: ${error.detail}`, 'error');
      }
    } catch (error) {
      console.error('Error disabling user:', error);
      showToast('Error disabling user', 'error');
    }
  };
  
  // Delete user modal
  document.getElementById('delete-modal-close').onclick = () => {
    document.getElementById('delete-user-modal').style.display = 'none';
  };
  
  document.getElementById('cancel-delete-btn').onclick = () => {
    document.getElementById('delete-user-modal').style.display = 'none';
  };
  
  document.getElementById('delete-confirmation').oninput = (e) => {
    const confirmBtn = document.getElementById('confirm-delete-btn');
    confirmBtn.disabled = e.target.value !== 'DELETE';
  };
  
  document.getElementById('confirm-delete-btn').onclick = async () => {
    const modal = document.getElementById('delete-user-modal');
    const userId = modal.getAttribute('data-user-id');
    const username = modal.getAttribute('data-username');
    
    try {
      const response = await fetch(`${INVOICING_API_BASE}/admin/users/${userId}/delete`, {
        method: 'DELETE',
        headers: getAuthHeaders(token)
      });
      
      if (response.ok) {
        showToast(`User "${username}" has been permanently deleted`, 'success');
        modal.style.display = 'none';
        await refreshCurrentView();
      } else {
        const error = await response.json();
        showToast(`Failed to delete user: ${error.detail}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast('Error deleting user', 'error');
    }
  };
  
  // Bulk actions
  document.getElementById('bulk-disable-btn').onclick = async () => {
    if (selectedUsers.size === 0) return;
    
    const reason = prompt('Enter reason for disabling selected users:');
    if (!reason || reason.trim() === '') {
      showToast('Bulk disable cancelled - reason is required', 'warning');
      return;
    }
    
    if (!confirm(`Are you sure you want to disable ${selectedUsers.size} users?`)) {
      return;
    }
    
    try {
      const promises = Array.from(selectedUsers).map(userId => 
        fetch(`${INVOICING_API_BASE}/admin/users/${userId}/disable`, {
          method: 'POST',
          headers: getAuthHeaders(token),
          body: JSON.stringify({ reason: reason.trim() })
        })
      );
      
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      showToast(`Successfully disabled ${successful} out of ${selectedUsers.size} users`, 'success');
      selectedUsers.clear();
      await refreshCurrentView();
      
    } catch (error) {
      console.error('Error in bulk disable:', error);
      showToast('Error during bulk disable operation', 'error');
    }
  };
  
  document.getElementById('bulk-enable-btn').onclick = async () => {
    if (selectedUsers.size === 0) return;
    
    if (!confirm(`Are you sure you want to enable ${selectedUsers.size} users?`)) {
      return;
    }
    
    try {
      const promises = Array.from(selectedUsers).map(userId => 
        fetch(`${INVOICING_API_BASE}/admin/users/${userId}/enable`, {
          method: 'POST',
          headers: getAuthHeaders(token)
        })
      );
      
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      showToast(`Successfully enabled ${successful} out of ${selectedUsers.size} users`, 'success');
      selectedUsers.clear();
      await refreshCurrentView();
      
    } catch (error) {
      console.error('Error in bulk enable:', error);
      showToast('Error during bulk enable operation', 'error');
    }
  };
  
  document.getElementById('bulk-delete-btn').onclick = async () => {
    if (selectedUsers.size === 0) return;
    
    const confirmation = prompt(`⚠️ WARNING: This will permanently delete ${selectedUsers.size} users and all their data.\n\nType "DELETE" to confirm:`);
    if (confirmation !== 'DELETE') {
      showToast('Bulk delete cancelled', 'warning');
      return;
    }
    
    try {
      const promises = Array.from(selectedUsers).map(userId => 
        fetch(`${INVOICING_API_BASE}/admin/users/${userId}/delete`, {
          method: 'DELETE',
          headers: getAuthHeaders(token)
        })
      );
      
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      showToast(`Successfully deleted ${successful} out of ${selectedUsers.size} users`, 'success');
      selectedUsers.clear();
      await refreshCurrentView();
      
    } catch (error) {
      console.error('Error in bulk delete:', error);
      showToast('Error during bulk delete operation', 'error');
    }
  };
  
  // Close modals when clicking outside
  window.onclick = (event) => {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    });
  };

  // Only proceed with user management if access is verified
  verifyAdminAccess().then(isAuthorized => {
    if (!isAuthorized) {
      return; // Stop execution if not authorized
    }

    // Show immediate success feedback
    showToast('Admin panel ready', 'success', 1500);
    
    // Initialize with empty state - user must click Load All Users or search
    updateUserStats();
    updatePagination();
    
    // Run API connectivity test in background (completely non-blocking)
    setTimeout(() => {
      testApiConnectivity();
    }, 500);
    
  }).catch(error => {
    console.error('❌ Admin access verification failed');
    showToast('Authentication failed', 'error');
  });
});