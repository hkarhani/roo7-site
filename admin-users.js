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

  // 🔒 SECURITY: Verify admin access before loading page
  async function verifyAdminAccess() {
    try {
      console.log('🔐 Verifying admin access...');
      console.log('🔗 AUTH_API_BASE:', AUTH_API_BASE);
      console.log('🔑 Token present:', !!token);
      
      const response = await fetch(`${AUTH_API_BASE}/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📥 Auth response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Auth API error:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const userData = await response.json();
      console.log('👤 User data received:', userData);
      
      if (!userData.is_admin) {
        console.error("🚨 SECURITY VIOLATION: Unauthorized admin access attempt");
        console.log('👤 User is_admin status:', userData.is_admin);
        showSecurityViolationMessage();
        setTimeout(() => {
          window.location.href = "/dashboard.html";
        }, 5000);
        return false;
      }
      
      currentUser = userData;
      console.log('✅ Admin access verified successfully');
      return true;
    } catch (error) {
      console.error("❌ Error verifying admin access:", error);
      showToast('Failed to verify admin access. Redirecting to login...', 'error');
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

  // Test API connectivity
  async function testApiConnectivity() {
    console.log('🧪 Testing API connectivity...');
    
    // Test invoicing API first
    try {
      console.log('📡 Testing invoicing API health endpoint...');
      const healthResponse = await fetch(`${INVOICING_API_BASE}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('📥 Health endpoint response:', healthResponse.status);
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        console.log('✅ Invoicing API health check passed:', healthData);
      } else {
        console.warn('⚠️ Invoicing API health check failed:', healthResponse.status);
      }
    } catch (error) {
      console.error('❌ Invoicing API connectivity test failed:', error);
    }
    
    // Test auth API
    try {
      console.log('📡 Testing auth API...');
      const authTestResponse = await fetch(`${AUTH_API_BASE}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('📥 Auth API health response:', authTestResponse.status);
      
      if (authTestResponse.ok) {
        const authHealthData = await authTestResponse.json();
        console.log('✅ Auth API health check passed:', authHealthData);
      } else {
        console.warn('⚠️ Auth API health check failed:', authTestResponse.status);
      }
    } catch (error) {
      console.error('❌ Auth API connectivity test failed:', error);
    }
    
    // Test authenticated endpoint
    try {
      console.log('📡 Testing authenticated endpoint...');
      const meResponse = await fetch(`${AUTH_API_BASE}/me`, {
        headers: getAuthHeaders(token)
      });
      
      console.log('📥 /me endpoint response:', meResponse.status);
      
      if (meResponse.ok) {
        const userData = await meResponse.json();
        console.log('✅ /me endpoint working:', userData);
      } else {
        const errorText = await meResponse.text();
        console.warn('⚠️ /me endpoint failed:', meResponse.status, errorText);
      }
    } catch (error) {
      console.error('❌ /me endpoint test failed:', error);
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
    try {
      console.log('👥 Loading users...', { searchTerm, statusFilter, tierFilter, offset, limit });
      console.log('🔗 INVOICING_API_BASE:', INVOICING_API_BASE);
      console.log('🔑 Token present:', !!token);
      
      let url = `${INVOICING_API_BASE}/admin/users?limit=${limit}&offset=${offset}`;
      
      // Use search endpoint if search term provided
      if (searchTerm) {
        url = `${INVOICING_API_BASE}/admin/users/search?q=${encodeURIComponent(searchTerm)}`;
      }
      
      console.log('📡 Making request to:', url);
      
      const response = await fetch(url, {
        headers: getAuthHeaders(token)
      });
      
      console.log('📥 Response status:', response.status);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Raw API response:', data);
        
        let users = data.users || [];
        console.log('👥 Users array:', users);
        console.log('📊 Total from API:', data.total);
        
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
        
        currentUsers = users;
        filteredUsers = users;
        totalUsers = data.total || users.length;
        
        console.log('✅ Final users to display:', users.length);
        console.log('✅ Total users count:', totalUsers);
        
        displayUsers(users);
        updatePagination();
        updateUserStats();
        
      } else {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Error loading users:', error);
      document.querySelector('#admin-users-table tbody').innerHTML = 
        '<tr><td colspan="11" class="loading-message">Failed to load users - Check console for details</td></tr>';
      showToast(`Failed to load users: ${error.message}`, 'error');
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
      
      return `
        <tr class="${isDisabled ? 'user-disabled' : ''}" data-user-id="${user._id}">
          <td>
            <input type="checkbox" class="user-checkbox" value="${user._id}" 
                   ${isAdmin ? 'disabled title="Cannot select admin users"' : ''} />
          </td>
          <td>
            <div class="user-info">
              <span class="username" onclick="viewUserDetails('${user._id}')">${user.username || 'N/A'}</span>
              ${isAdmin ? '<span class="admin-badge">ADMIN</span>' : ''}
            </div>
          </td>
          <td>${user.email || 'N/A'}</td>
          <td>${user.full_name || 'N/A'}</td>
          <td>${user.total_accounts || 0}</td>
          <td>${user.strategies_assigned || 0}</td>
          <td>$${(user.active_funds || 0).toLocaleString()}</td>
          <td><span class="tier-badge tier-${user.current_tier}">${user.current_tier || 'Free'}</span></td>
          <td>${statusBadge}</td>
          <td>${createdDate}</td>
          <td>
            <div class="action-buttons">
              <button class="small-btn info-btn" onclick="viewUserDetails('${user._id}')" title="View Details">
                👁️
              </button>
              ${!isAdmin ? `
                ${isDisabled ? 
                  `<button class="small-btn success-btn" onclick="enableUser('${user._id}', '${user.username}')" title="Enable User">✅</button>` :
                  `<button class="small-btn warning-btn" onclick="disableUser('${user._id}', '${user.username}')" title="Disable User">❌</button>`
                }
                <button class="small-btn danger-btn" onclick="deleteUser('${user._id}', '${user.username}')" title="Delete User">🗑️</button>
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
      
      title.textContent = `User Details - ${user.username}`;
      
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
              <span class="detail-value">${user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}</span>
            </div>
          </div>
          
          <div class="detail-section">
            <h4>Account Statistics</h4>
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
  
  // Enter key for search
  document.getElementById('user-search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
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
      console.log('❌ Admin access verification failed');
      return; // Stop execution if not authorized
    }

    console.log('🚀 Initializing admin user management...');
    console.log('🔗 API Base URLs:', {
      INVOICING_API_BASE,
      AUTH_API_BASE
    });
    
    // Initialize with empty state - user must click Load All Users or search
    updateUserStats();
    updatePagination();
    
    console.log('✅ Admin user management initialized successfully');
    
    // DEBUG: Auto-load users to see what happens
    console.log('🔍 DEBUG: Auto-loading users for debugging...');
    
    // First test basic connectivity
    testApiConnectivity().then(() => {
      loadUsers();
    });
  }).catch(error => {
    console.error('❌ Failed to verify admin access:', error);
  });
});