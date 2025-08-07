// dashboard.js - Main Dashboard Logic

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api.roo7.site";
  const BINANCE_API = "https://api.binance.com/api/v3/exchangeInfo";

  // Check authentication
  const token = localStorage.getItem("token");
  if (!token) {
    console.log("❌ No token found, redirecting to auth...");
    setTimeout(() => {
      window.location.href = "/auth.html";
    }, 2000);
    return;
  }

  // Initialize modal manager
  const modalManager = new window.ModalManager(API_BASE, BINANCE_API);

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

  // Load accounts and bind events
  window.loadAccounts = async function() {
    console.log("📋 Loading accounts...");
    
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
      console.log(`✅ Loaded ${accounts.length} accounts`);
      
      updateAccountTables(accounts);
      bindAccountEvents(accounts);

    } catch (error) {
      console.error("❌ Error loading accounts:", error);
      showToast(`Failed to load accounts: ${error.message}`, 'error');
    }
  };

  function updateAccountTables(accounts) {
    const liveTbody = document.querySelector("#accounts-table tbody");
    const settingsTbody = document.querySelector("#settings-table tbody");

    liveTbody.innerHTML = "";
    settingsTbody.innerHTML = "";

    accounts.forEach(acc => {
      // Escape and sanitize account name and other text fields
      const accountName = (acc.account_name || '').replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/\r?\n/g, ' ');
      const strategy = (acc.strategy || '').replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/\r?\n/g, ' ');
      
      // Status badges
      let statusBadges = '';
      if (acc.is_disabled) {
        statusBadges += '<span class="status-badge status-disabled" title="Account Disabled">⏸️</span>';
      }
      if (acc.is_revoked) {
        statusBadges += '<span class="status-badge status-revoked" title="Access Revoked">🚫</span>';
      }

      // Test status formatting
      let testStatusHtml = '';
      switch(acc.test_status) {
        case 'successful':
          testStatusHtml = '<span class="test-status-success">✅ Successful</span>';
          break;
        case 'failed':
          testStatusHtml = '<span class="test-status-failed">❌ Failed</span>';
          break;
        default:
          testStatusHtml = '<span class="test-status-na">⚪ N/A</span>';
          break;
      }

      // Format current value safely
      let currentValueDisplay = 'N/A';
      if (acc.current_value !== undefined && acc.current_value !== null && !isNaN(acc.current_value)) {
        currentValueDisplay = '$' + parseFloat(acc.current_value).toFixed(2);
      }

      // Format hedge percent safely
      let hedgePercentDisplay = 'N/A';
      if (acc.hedge_percent !== undefined && acc.hedge_percent !== null && !isNaN(acc.hedge_percent)) {
        hedgePercentDisplay = parseFloat(acc.hedge_percent).toFixed(1) + '%';
      }

      liveTbody.innerHTML += `
        <tr>
          <td>
            <div class="account-status">
              ${accountName}
              ${statusBadges}
            </div>
          </td>
          <td>${strategy}</td>
          <td>${currentValueDisplay}</td>
          <td>${hedgePercentDisplay}</td>
          <td>${testStatusHtml}</td>
          <td class="account-actions">
            <button class="action-icon troubleshoot-icon" data-account="${accountName}" title="Troubleshoot">🔧</button>
            <button class="action-icon hedge-edit-icon" data-id="${acc.id || ''}" title="Edit Settings">⚙️</button>
          </td>
        </tr>`;

      settingsTbody.innerHTML += `
        <tr>
          <td>${accountName}</td>
          <td>
            <button class="edit-account" data-id="${acc.id || ''}" data-name="${accountName}">Edit</button>
            <button class="delete-account" data-id="${acc.id || ''}">Delete</button>
          </td>
        </tr>`;
    });
  }

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
          console.log(`✏️ EDIT CLICKED for ${accountName}`);
          
          const account = accounts.find(acc => acc.id === accountId);
          if (account) {
            console.log("🎯 Found account data:", account);
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
          const accountName = btn.dataset.account;
          const token = localStorage.getItem("token");
          if (token) {
            window.open(`troubleshoot.html?account=${encodeURIComponent(accountName)}`, '_blank');
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

      console.log("✅ All event listeners bound successfully");
    }, 50);
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

    try {
      const res = await fetch(`${API_BASE}/accounts/${accountId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!res.ok) throw new Error(`Status ${res.status}`);

      showToast("Account deleted successfully!", 'success');
      loadAccounts();

    } catch (err) {
      showToast(`Error deleting account: ${err.message}`, 'error');
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
      } else if (res.status !== 404) {
        localStorage.removeItem("token");
        setTimeout(() => window.location.href = "/auth.html", 2000);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  }

  // Event handlers
  logoutBtn.onclick = logout;
  const openModalBtn = document.getElementById("open-modal");
  openModalBtn.onclick = () => {
    console.log("🆕 ADD NEW ACCOUNT clicked");
    modalManager.openAddAccountModal();
  };

  // Initialize
  fetchUser();
  loadAccounts();
});