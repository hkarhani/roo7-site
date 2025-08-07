document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api.roo7.site";
  const BINANCE_API = "https://api.binance.com/api/v3/exchangeInfo";

  // Check token first
  const token = localStorage.getItem("token");
  console.log("🔍 Initial token check:", token ? "Token found" : "No token found");
  
  if (!token) {
    console.log("❌ No token found, will redirect to auth in 5 seconds...");
    setTimeout(() => {
      window.location.href = "/auth.html";
    }, 5000);
    return;
  }

  // DOM elements
  const logoutBtn = document.getElementById("logout-btn");
  const toggleThemeBtn = document.getElementById("toggle-theme");
  const openModalBtn = document.getElementById("open-modal");
  const modal = document.getElementById("account-modal");
  const closeModalBtn = document.querySelector(".modal .close");
  const accountForm = document.getElementById("account-form");
  const strategySelect = document.getElementById("trading-strategy");
  const instrumentsWrap = document.getElementById("instruments-wrapper");
  const addInstrumentBtn = document.getElementById("add-instrument");
  const hedgeModal = document.getElementById("hedge-modal");
  const hedgeCloseBtn = document.getElementById("hedge-close");
  const hedgeForm = document.getElementById("hedge-form");
  const cancelEditBtn = document.getElementById("cancel-edit");

  // State variables
  let currentEditingId = null;
  let currentHedgeAccountId = null;
  let binanceSymbols = [];
  let useSameCredentials = false;

  // Toast notification system
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

  // Load Binance symbols
  async function loadBinanceSymbols() {
    try {
      const response = await fetch(BINANCE_API);
      const data = await response.json();
      binanceSymbols = data.symbols
        .filter(symbol => symbol.status === 'TRADING' && symbol.symbol.endsWith('USDT'))
        .map(symbol => symbol.symbol);
      console.log(`✅ Loaded ${binanceSymbols.length} Binance USDT symbols`);
    } catch (error) {
      console.error('❌ Failed to load Binance symbols:', error);
      showToast('Warning: Could not load Binance symbols. Symbol validation will be skipped.', 'warning');
    }
  }

  // Basic functions
  function toggleTheme() {
    document.body.classList.toggle("dark-theme");
  }

  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/auth.html";
  }

  function openModal() {
    modal.style.display = "block";
  }

  function setModalToEditMode(accountName) {
    console.log("✏️ Setting modal to Edit mode for:", accountName);
    
    // Update modal title and button
    document.querySelector("#account-modal h3").textContent = "Edit Account";
    document.querySelector("button[type='submit']").textContent = "Update Account";
    
    // Show edit-specific buttons
    showUseSameCredentialsButton();
    if (cancelEditBtn) {
      cancelEditBtn.classList.remove("hidden");
      cancelEditBtn.classList.add("visible");
    }
    
    console.log("✅ Modal set to Edit mode");
  }

  function resetModalToAddMode() {
    console.log("🔄 Resetting modal to Add mode");
    
    // Reset modal title and button
    document.querySelector("#account-modal h3").textContent = "Add New Account";
    document.querySelector("button[type='submit']").textContent = "Save Account";
    
    // Hide edit-specific buttons
    hideUseSameCredentialsButton();
    if (cancelEditBtn) {
      cancelEditBtn.classList.remove("visible");
      cancelEditBtn.classList.add("hidden");
    }
    
    // Reset state
    currentEditingId = null;
    useSameCredentials = false;
    
    console.log("✅ Modal reset to Add mode");
  }

  function closeModal() {
    console.log("🚪 Closing modal and cleaning up state");
    
    modal.style.display = "none";
    accountForm.reset();
    instrumentsWrap.innerHTML = "";
    instrumentsWrap.style.display = "none";
    addInstrumentBtn.style.display = "none";
    
    const topXWrapper = document.getElementById("top-x-wrapper");
    if (topXWrapper) {
      topXWrapper.style.display = "none";
    }

    // Reset all fields to enabled state
    const apiKeyField = document.getElementById("binance-api-key");
    const apiSecretField = document.getElementById("binance-api-secret");
    if (apiKeyField && apiSecretField) {
      apiKeyField.disabled = false;
      apiSecretField.disabled = false;
      apiKeyField.style.opacity = "1";
      apiSecretField.style.opacity = "1";
      apiKeyField.removeAttribute('readonly');
      apiSecretField.removeAttribute('readonly');
    }
    
    // Reset modal to add mode
    resetModalToAddMode();
    
    console.log("✅ Modal closed and state cleaned");
  }

  function openHedgeModal(account) {
    document.getElementById("hedge-account-name").value = account.account_name;
    document.getElementById("hedge-current-value").value = `${account.current_value || 0}`;
    document.getElementById("hedge-percent-input").value = account.hedge_percent || 0;
    document.getElementById("account-disabled").checked = account.is_disabled || false;
    document.getElementById("account-revoked").checked = account.is_revoked || false;
    currentHedgeAccountId = account.id;
    hedgeModal.style.display = "block";
  }

  function closeHedgeModal() {
    hedgeModal.style.display = "none";
    hedgeForm.reset();
    currentHedgeAccountId = null;
  }

  function showUseSameCredentialsButton() {
    console.log("🔍 showUseSameCredentialsButton called");
    const button = document.getElementById("use-same-credentials");
    
    if (!button) {
      console.error("❌ CRITICAL: use-same-credentials button not found in DOM!");
      return;
    }
    
    console.log("✅ Button found, removing hidden class and adding visible class");
    button.classList.remove("hidden");
    button.classList.add("visible");
    
    // Reset the button state
    useSameCredentials = false;
    button.textContent = "🔒 Use Same API Credentials";
    button.classList.remove("active");
    
    console.log("🔄 Button should now be visible with text:", button.textContent);
    
    // Reset field states
    const apiKeyField = document.getElementById("binance-api-key");
    const apiSecretField = document.getElementById("binance-api-secret");
    if (apiKeyField && apiSecretField) {
      apiKeyField.disabled = false;
      apiSecretField.disabled = false;
      apiKeyField.style.opacity = "1";
      apiSecretField.style.opacity = "1";
      apiKeyField.removeAttribute('readonly');
      apiSecretField.removeAttribute('readonly');
      console.log("✅ API fields reset to enabled state");
    }
  }

  function hideUseSameCredentialsButton() {
    const button = document.getElementById("use-same-credentials");
    if (button) {
      console.log("👁️ Hiding use same credentials button");
      button.classList.remove("visible");
      button.classList.add("hidden");
    }
  }

  // Wire up the use same credentials button
  document.getElementById("use-same-credentials").addEventListener('click', function() {
    const apiKeyField = document.getElementById("binance-api-key");
    const apiSecretField = document.getElementById("binance-api-secret");
    const button = this;
    
    useSameCredentials = !useSameCredentials;
    
    if (useSameCredentials) {
      apiKeyField.disabled = true;
      apiSecretField.disabled = true;
      apiKeyField.style.opacity = "0.5";
      apiSecretField.style.opacity = "0.5";
      button.textContent = "Change API Credentials";
      button.classList.add("active");
    } else {
      apiKeyField.disabled = false;
      apiSecretField.disabled = false;
      apiKeyField.style.opacity = "1";
      apiSecretField.style.opacity = "1";
      button.textContent = "Use Same API Credentials";
      button.classList.remove("active");
    }
  });

  // Window click handler
  window.onclick = function(event) {
    if (event.target === modal) {
      closeModal();
    }
    if (event.target === hedgeModal) {
      closeHedgeModal();
    }
  };

  // Validation functions
  function validateSymbol(symbol) {
    if (!binanceSymbols.length) return true;
    return binanceSymbols.includes(symbol.toUpperCase());
  }

  function validatePortfolioWeights() {
    const weights = instrumentsWrap.querySelectorAll("input[name='weight']");
    let total = 0;
    
    for (let weight of weights) {
      const value = parseFloat(weight.value) || 0;
      total += value;
    }
    
    return Math.abs(total - 100) < 0.01;
  }

  // Dynamic form functions
  function addInstrumentField(sym = "", wt = 0) {
    const div = document.createElement("div");
    div.className = "instrument-field";
    div.innerHTML = `
      <input type="text" name="symbol" placeholder="Symbol (e.g., BTCUSDT)" value="${sym}">
      <input type="number" name="weight" placeholder="Weight (%)" value="${wt}" step="0.01" min="0" max="100">
      <button type="button" class="remove-instrument">×</button>
    `;
    instrumentsWrap.appendChild(div);
    
    if (strategySelect.value === "Custom Portfolio Rebalancing") {
      div.querySelectorAll('input').forEach(input => {
        input.setAttribute('required', 'required');
      });
    }
    
    div.querySelector(".remove-instrument").addEventListener("click", () => div.remove());
  }

  function addTopXInput() {
    let topXWrapper = document.getElementById("top-x-wrapper");
    if (!topXWrapper) {
      topXWrapper = document.createElement("div");
      topXWrapper.id = "top-x-wrapper";
      topXWrapper.style.display = "none";
      topXWrapper.innerHTML = `
        <input type="number" id="top-x-count" placeholder="Number of top instruments" min="1" max="50">
      `;
      strategySelect.parentNode.insertBefore(topXWrapper, strategySelect.nextSibling);
    }
    return topXWrapper;
  }

  // Main API functions
  async function loadAccounts() {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/auth.html";
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/accounts`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        localStorage.removeItem("token");
        showToast("Session expired. Please log in again.", 'error');
        setTimeout(() => {
          window.location.href = "/auth.html";
        }, 2000);
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const accounts = await res.json();
      const liveTbody = document.querySelector("#accounts-table tbody");
      const settingsTbody = document.querySelector("#settings-table tbody");

      liveTbody.innerHTML = "";
      settingsTbody.innerHTML = "";

      accounts.forEach(acc => {
        // Create status badges with icons
        let statusBadges = '';
        if (acc.is_disabled) {
          statusBadges += '<span class="status-badge status-disabled" title="Account Disabled">⏸️</span>';
        }
        if (acc.is_revoked) {
          statusBadges += '<span class="status-badge status-revoked" title="Access Revoked">🚫</span>';
        }

        liveTbody.innerHTML += `
          <tr>
            <td>
              <div class="account-status">
                ${acc.account_name}
                ${statusBadges}
              </div>
            </td>
            <td>${acc.strategy}</td>
            <td>${acc.current_value !== undefined && acc.current_value !== null ? acc.current_value : 'N/A'}</td>
            <td>${acc.hedge_percent !== undefined && acc.hedge_percent !== null ? acc.hedge_percent + '%' : 'N/A'}</td>
            <td class="account-actions">
              <button class="action-icon troubleshoot-icon" data-account="${acc.account_name}" title="Troubleshoot">🔧</button>
              <button class="action-icon hedge-edit-icon" data-id="${acc.id}" title="Edit Settings">⚙️</button>
            </td>
          </tr>`;
    
        settingsTbody.innerHTML += `
          <tr>
            <td>${acc.account_name}</td>
            <td>
              <button class="edit-account" data-id="${acc.id}">Edit</button>
              <button class="delete-account" data-id="${acc.id}">Delete</button>
            </td>
          </tr>`;
      });

      // Add event listeners
      document.querySelectorAll('.edit-account').forEach(btn => {
        btn.addEventListener('click', () => editAccount(btn.dataset.id));
      });

      document.querySelectorAll('.delete-account').forEach(btn => {
        btn.addEventListener('click', () => deleteAccount(btn.dataset.id));
      });

      document.querySelectorAll('.troubleshoot-icon').forEach(btn => {
        btn.addEventListener('click', () => {
          const accountName = btn.dataset.account;
          const token = localStorage.getItem("token");
          if (token) {
            window.open(`troubleshoot.html?account=${encodeURIComponent(accountName)}`, '_blank');
          } else {
            showToast("You must be logged in to access troubleshooting.", 'error');
            window.location.href = "/auth.html";
          }
        });
      });

      document.querySelectorAll('.hedge-edit-icon').forEach(btn => {
        btn.addEventListener('click', () => {
          const accountId = btn.dataset.id;
          const account = accounts.find(acc => acc.id === accountId);
          if (account) {
            openHedgeModal(account);
          }
        });
      });

    } catch (error) {
      console.error("Error loading accounts:", error);
      showToast(`Failed to load accounts: ${error.message}`, 'error');
    }
  }

  async function editAccount(accountId) {
    const token = localStorage.getItem("token");
    if (!token) {
      showToast("You must be logged in to edit an account.", 'error');
      window.location.href = "/auth.html";
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/accounts`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error(`Status ${res.status}`);

      const accounts = await res.json();
      const account = accounts.find(acc => acc.id === accountId);

      if (!account) {
        showToast("Account not found.", 'error');
        return;
      }

      currentEditingId = accountId;
      
      document.querySelector("#account-modal h3").textContent = "Edit Account";
      document.querySelector("button[type='submit']").textContent = "Update Account";

      document.getElementById("trading-account-name").value = account.account_name;
      document.getElementById("binance-api-key").value = account.api_key || "";
      document.getElementById("binance-api-secret").value = account.api_secret || "";
      strategySelect.value = account.strategy;

      if (account.strategy === "Top X Instruments of Vapaus") {
        const topXWrapper = addTopXInput();
        topXWrapper.style.display = "block";
        const topXInput = document.getElementById("top-x-count");
        if (topXInput) {
          topXInput.value = account.top_x_count || "";
          topXInput.setAttribute('required', 'required');
        }
      } else if (account.strategy === "Custom Portfolio Rebalancing") {
        instrumentsWrap.style.display = "flex";
        addInstrumentBtn.style.display = "inline-block";
        
        instrumentsWrap.innerHTML = "";
        if (account.custom_portfolio && account.custom_portfolio.length > 0) {
          account.custom_portfolio.forEach(instrument => {
            addInstrumentField(instrument.symbol, instrument.weight);
          });
        } else {
          addInstrumentField("BTCUSDT", 50);
          addInstrumentField("ETHUSDT", 30);
          addInstrumentField("BNBUSDT", 20);
        }
        
        instrumentsWrap.querySelectorAll('input').forEach(input => {
          input.setAttribute('required', 'required');
        });
      }

      openModal();

    } catch (err) {
      showToast(`Error loading account: ${err.message}`, 'error');
    }
  }

  async function deleteAccount(accountId) {
    if (!confirm("Are you sure you want to delete this account? This action cannot be undone.")) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      showToast("You must be logged in to delete an account.", 'error');
      window.location.href = "/auth.html";
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/accounts/${accountId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error(`Status ${res.status}`);

      showToast("Account deleted successfully!", 'success');
      loadAccounts();

    } catch (err) {
      showToast(`Error deleting account: ${err.message}`, 'error');
    }
  }

  async function submitAccount(e) {
    e.preventDefault();

    const token = localStorage.getItem("token");
    if (!token) {
      showToast("You must be logged in to save an account.", 'error');
      window.location.href = "/auth.html";
      return;
    }

    const data = {
      account_name: document.getElementById("trading-account-name").value,
      strategy: strategySelect.value,
      custom_portfolio: []
    };

    // Only include API credentials if not using same credentials
    if (!useSameCredentials) {
      data.api_key = document.getElementById("binance-api-key").value;
      data.api_secret = document.getElementById("binance-api-secret").value;
    }

    if (data.strategy === "Top X Instruments of Vapaus") {
      const topXCount = document.getElementById("top-x-count");
      if (!topXCount || !topXCount.value) {
        showToast("Please specify the number of top instruments.", 'warning');
        if (topXCount) topXCount.focus();
        return;
      }
      data.top_x_count = parseInt(topXCount.value);
      if (data.top_x_count < 1 || data.top_x_count > 50) {
        showToast("Number of top instruments must be between 1 and 50.", 'warning');
        topXCount.focus();
        return;
      }
    }

    if (data.strategy === "Custom Portfolio Rebalancing") {
      const syms = instrumentsWrap.querySelectorAll("input[name='symbol']");
      const weights = instrumentsWrap.querySelectorAll("input[name='weight']");
      
      if (syms.length === 0) {
        showToast("Please add at least one instrument for custom portfolio.", 'warning');
        return;
      }

      for (let i = 0; i < syms.length; i++) {
        const symbol = syms[i].value.trim().toUpperCase();
        const weight = parseFloat(weights[i].value);

        if (!symbol.endsWith('USDT')) {
          showToast(`Symbol ${symbol} must end with USDT.`, 'warning');
          syms[i].focus();
          return;
        }

        if (!validateSymbol(symbol)) {
          showToast(`Symbol ${symbol} does not exist on Binance SPOT or is not trading.`, 'error');
          syms[i].focus();
          return;
        }

        if (isNaN(weight) || weight <= 0 || weight > 100) {
          showToast(`Weight for ${symbol} must be a positive number between 0 and 100.`, 'warning');
          weights[i].focus();
          return;
        }

        data.custom_portfolio.push({
          symbol: symbol,
          weight: weight
        });
      }

      if (!validatePortfolioWeights()) {
        const totalWeight = data.custom_portfolio.reduce((sum, item) => sum + item.weight, 0);
        showToast(`Portfolio weights must sum to 100%. Current total: ${totalWeight.toFixed(2)}%`, 'warning');
        return;
      }
    }

    try {
      const method = currentEditingId ? "PUT" : "POST";
      const url = currentEditingId 
        ? `${API_BASE}/accounts/${currentEditingId}`
        : `${API_BASE}/accounts`;

      const res = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${res.status}: ${res.statusText}`);
      }

      const action = currentEditingId ? "updated" : "created";
      showToast(`Account ${action} successfully!`, 'success');
      closeModal();
      loadAccounts();

    } catch (err) {
      showToast(`Error ${currentEditingId ? 'updating' : 'creating'} account: ${err.message}`, 'error');
    }
  }

  async function updateHedge(e) {
    e.preventDefault();

    const token = localStorage.getItem("token");
    if (!token) {
      showToast("You must be logged in to update account settings.", 'error');
      window.location.href = "/auth.html";
      return;
    }

    const hedgePercent = parseFloat(document.getElementById("hedge-percent-input").value);
    const isDisabled = document.getElementById("account-disabled").checked;
    const isRevoked = document.getElementById("account-revoked").checked;
    
    if (isNaN(hedgePercent) || hedgePercent < 0 || hedgePercent > 100) {
      showToast("Hedge percentage must be a number between 0 and 100.", 'warning');
      return;
    }

    try {
      const updateData = {
        hedge_percent: hedgePercent,
        is_disabled: isDisabled,
        is_revoked: isRevoked
      };

      const res = await fetch(`${API_BASE}/accounts/${currentHedgeAccountId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Update account error response:", errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: `HTTP ${res.status}: ${res.statusText}` };
        }
        
        throw new Error(errorData.detail || errorData.message || `HTTP ${res.status}: ${res.statusText}`);
      }

      showToast("Account settings updated successfully!", 'success');
      closeHedgeModal();
      loadAccounts();

    } catch (err) {
      console.error("Error updating account:", err);
      showToast(`Error updating account settings: ${err.message}`, 'error');
    }
  }

  async function fetchUser() {
    const token = localStorage.getItem("token");
    
    if (!token) {
      setTimeout(() => {
        window.location.href = "/auth.html";
      }, 5000);
      return;
    }

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
      } else if (res.status === 404) {
        document.getElementById("user-fullname").textContent = "User";
      } else {
        localStorage.removeItem("token");
        showToast("Session expired. Redirecting to login...", 'error');
        setTimeout(() => {
          window.location.href = "/auth.html";
        }, 2000);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      showToast("Network error. Please check your connection.", 'error');
    }
  }

  // Strategy change handler
  strategySelect.onchange = () => {
    const topXWrapper = document.getElementById("top-x-wrapper") || addTopXInput();
    const topXInput = document.getElementById("top-x-count");
    
    if (strategySelect.value === "Top X Instruments of Vapaus") {
      topXWrapper.style.display = "block";
      if (topXInput) {
        topXInput.setAttribute('required', 'required');
      }
      instrumentsWrap.style.display = "none";
      addInstrumentBtn.style.display = "none";
      instrumentsWrap.innerHTML = "";
      instrumentsWrap.querySelectorAll('input').forEach(input => {
        input.removeAttribute('required');
      });
    } else if (strategySelect.value === "Custom Portfolio Rebalancing") {
      topXWrapper.style.display = "none";
      if (topXInput) {
        topXInput.removeAttribute('required');
      }
      instrumentsWrap.style.display = "flex";
      addInstrumentBtn.style.display = "inline-block";
      if (!instrumentsWrap.children.length) {
        addInstrumentField("BTCUSDT", 50);
        addInstrumentField("ETHUSDT", 30);
        addInstrumentField("BNBUSDT", 20);
      }
      instrumentsWrap.querySelectorAll('input').forEach(input => {
        input.setAttribute('required', 'required');
      });
    } else {
      topXWrapper.style.display = "none";
      if (topXInput) {
        topXInput.removeAttribute('required');
      }
      instrumentsWrap.style.display = "none";
      addInstrumentBtn.style.display = "none";
      instrumentsWrap.innerHTML = "";
    }
  };

  // Event handlers
  toggleThemeBtn.onclick = toggleTheme;
  logoutBtn.onclick = logout;
  openModalBtn.onclick = openModal;
  closeModalBtn.onclick = closeModal;
  hedgeCloseBtn.onclick = closeHedgeModal;
  accountForm.onsubmit = submitAccount;
  hedgeForm.onsubmit = updateHedge;
  addInstrumentBtn.onclick = () => addInstrumentField();

  // Initialize
  loadBinanceSymbols();

  setTimeout(() => {
    fetchUser();
  }, 100);

  setTimeout(() => {
    loadAccounts();  
  }, 200);
});