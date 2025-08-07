document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api.roo7.site";
  const BINANCE_API = "https://api.binance.com/api/v3/exchangeInfo";

  // First, check if token exists before doing anything else
  const token = localStorage.getItem("token");
  console.log("🔍 Initial token check:", token ? "Token found" : "No token found");
  console.log("🔍 Token value:", token);
  console.log("🔍 All localStorage keys:", Object.keys(localStorage));
  console.log("🔍 All localStorage:", localStorage);
  
  if (!token) {
    console.log("❌ No token found, will redirect to auth in 5 seconds...");
    setTimeout(() => {
      window.location.href = "/auth.html";
    }, 5000);
    return;
  }

  // grab these once
  const logoutBtn       = document.getElementById("logout-btn");
  const toggleThemeBtn  = document.getElementById("toggle-theme");
  const openModalBtn    = document.getElementById("open-modal");
  const modal           = document.getElementById("account-modal");
  const closeModalBtn   = document.querySelector(".modal .close");
  const accountForm     = document.getElementById("account-form");
  const strategySelect  = document.getElementById("trading-strategy");
  const instrumentsWrap = document.getElementById("instruments-wrapper");
  const addInstrumentBtn= document.getElementById("add-instrument");

  let currentEditingId = null; // Track which account is being edited
  let binanceSymbols = []; // Cache Binance symbols

  // Toast notification system
  function showToast(message, type = 'info', duration = 4000) {
    // Remove existing toasts
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

    // Show toast
    setTimeout(() => toast.classList.add('toast-show'), 100);

    // Auto-hide after duration
    const autoHide = setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }, duration);

    // Manual close
    toast.querySelector('.toast-close').addEventListener('click', () => {
      clearTimeout(autoHide);
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    });
  }

  // Load Binance symbols on startup
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

  function closeModal() {
    modal.style.display = "none";
    accountForm.reset();
    instrumentsWrap.innerHTML = "";
    instrumentsWrap.style.display = "none";
    addInstrumentBtn.style.display = "none";
    
    // Reset Top X input
    const topXWrapper = document.getElementById("top-x-wrapper");
    if (topXWrapper) {
      topXWrapper.style.display = "none";
    }
    
    currentEditingId = null;
    
    // Reset modal title
    document.querySelector("#account-modal h3").textContent = "Add New Account";
    document.querySelector("button[type='submit']").textContent = "Save Account";
  }

  // Close modal when clicking outside of it
  window.onclick = function(event) {
    if (event.target === modal) {
      closeModal();
    }
  }

  function validateSymbol(symbol) {
    if (!binanceSymbols.length) return true; // Skip validation if symbols not loaded
    return binanceSymbols.includes(symbol.toUpperCase());
  }

  function validatePortfolioWeights() {
    const weights = instrumentsWrap.querySelectorAll("input[name='weight']");
    let total = 0;
    
    for (let weight of weights) {
      const value = parseFloat(weight.value) || 0;
      total += value;
    }
    
    return Math.abs(total - 100) < 0.01; // Allow for small floating point errors
  }

  function addInstrumentField(sym = "", wt = 0) {
    const div = document.createElement("div");
    div.className = "instrument-field";
    div.innerHTML = `
      <input type="text" name="symbol"  placeholder="Symbol (e.g., BTCUSDT)" value="${sym}">
      <input type="number" name="weight" placeholder="Weight (%)" value="${wt}" step="0.01" min="0" max="100">
      <button type="button" class="remove-instrument">×</button>
    `;
    instrumentsWrap.appendChild(div);
    
    // Add required attribute if the portfolio is currently visible
    if (strategySelect.value === "Custom Portfolio Rebalancing") {
      div.querySelectorAll('input').forEach(input => {
        input.setAttribute('required', 'required');
      });
    }
    
    div.querySelector(".remove-instrument")
       .addEventListener("click", () => div.remove());
  }

  function addTopXInput() {
    // Check if Top X wrapper already exists
    let topXWrapper = document.getElementById("top-x-wrapper");
    if (!topXWrapper) {
      topXWrapper = document.createElement("div");
      topXWrapper.id = "top-x-wrapper";
      topXWrapper.style.display = "none";
      topXWrapper.innerHTML = `
        <input type="number" id="top-x-count" placeholder="Number of top instruments" min="1" max="50">
      `;
      // Insert after strategy select
      strategySelect.parentNode.insertBefore(topXWrapper, strategySelect.nextSibling);
    }
    return topXWrapper;
  }

  async function loadAccounts() {
    const token = localStorage.getItem("token");
    console.log("▶️ loadAccounts() token:", token);
    if (!token) {
      console.error("No token found in localStorage, redirecting to login.");
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

      console.log("⏳ /accounts status:", res.status);
      
      if (res.status === 401) {
        console.warn("Unauthorized — clearing token & bouncing back.");
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
      const liveTbody     = document.querySelector("#accounts-table tbody");
      const settingsTbody = document.querySelector("#settings-table tbody");

      liveTbody.innerHTML = "";
      settingsTbody.innerHTML = "";

      accounts.forEach(acc => {
        liveTbody.innerHTML += `
          <tr>
            <td>${acc.account_name}</td>
            <td>${acc.strategy}</td>
            <td>${acc.current_value !== undefined && acc.current_value !== null ? acc.current_value : 'N/A'}</td>
            <td>${acc.hedge_percent !== undefined && acc.hedge_percent !== null ? acc.hedge_percent + '%' : 'N/A'}</td>
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

      // Add event listeners to edit and delete buttons
      document.querySelectorAll('.edit-account').forEach(btn => {
        btn.addEventListener('click', () => editAccount(btn.dataset.id));
      });

      document.querySelectorAll('.delete-account').forEach(btn => {
        btn.addEventListener('click', () => deleteAccount(btn.dataset.id));
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
      // First, get the account data
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

      // Set editing mode
      currentEditingId = accountId;
      
      // Update modal title and button
      document.querySelector("#account-modal h3").textContent = "Edit Account";
      document.querySelector("button[type='submit']").textContent = "Update Account";

      // Fill form with existing data
      document.getElementById("trading-account-name").value = account.account_name;
      document.getElementById("binance-api-key").value = account.api_key || "";
      document.getElementById("binance-api-secret").value = account.api_secret || "";
      strategySelect.value = account.strategy;

      // Handle strategy-specific fields
      if (account.strategy === "Top X Instruments of Vapaus") {
        const topXWrapper = addTopXInput();
        topXWrapper.style.display = "block";
        const topXInput = document.getElementById("top-x-count");
        if (topXInput) {
          topXInput.value = account.top_x_count || "";
        }
      } else if (account.strategy === "Custom Portfolio Rebalancing") {
        instrumentsWrap.style.display = "flex";
        addInstrumentBtn.style.display = "inline-block";
        
        // Clear existing instruments and add the saved ones
        instrumentsWrap.innerHTML = "";
        if (account.custom_portfolio && account.custom_portfolio.length > 0) {
          account.custom_portfolio.forEach(instrument => {
            addInstrumentField(instrument.symbol, instrument.weight);
          });
        } else {
          // Add default instruments if none exist
          addInstrumentField("BTCUSDT", 50);
          addInstrumentField("ETHUSDT", 30);
          addInstrumentField("BNBUSDT", 20);
        }
      }

      // Open the modal
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
    console.log("▶️ submitAccount() token:", token);

    if (!token) {
      showToast("You must be logged in to save an account.", 'error');
      window.location.href = "/auth.html";
      return;
    }

    const data = {
      account_name: document.getElementById("trading-account-name").value,
      api_key:       document.getElementById("binance-api-key").value,
      api_secret:    document.getElementById("binance-api-secret").value,
      strategy:      strategySelect.value,
      custom_portfolio: []
    };

    // Handle Top X Instruments
    if (data.strategy === "Top X Instruments of Vapaus") {
      const topXCount = document.getElementById("top-x-count");
      if (!topXCount || !topXCount.value) {
        showToast("Please specify the number of top instruments.", 'warning');
        topXCount?.focus();
        return;
      }
      data.top_x_count = parseInt(topXCount.value);
      if (data.top_x_count < 1 || data.top_x_count > 50) {
        showToast("Number of top instruments must be between 1 and 50.", 'warning');
        topXCount.focus();
        return;
      }
    }

    // Handle Custom Portfolio
    if (data.strategy === "Custom Portfolio Rebalancing") {
      const syms    = instrumentsWrap.querySelectorAll("input[name='symbol']");
      const weights = instrumentsWrap.querySelectorAll("input[name='weight']");
      
      if (syms.length === 0) {
        showToast("Please add at least one instrument for custom portfolio.", 'warning');
        return;
      }

      // Validate symbols and weights
      for (let i = 0; i < syms.length; i++) {
        const symbol = syms[i].value.trim().toUpperCase();
        const weight = parseFloat(weights[i].value);

        // Check if symbol ends with USDT
        if (!symbol.endsWith('USDT')) {
          showToast(`Symbol ${symbol} must end with USDT.`, 'warning');
          syms[i].focus();
          return;
        }

        // Check if symbol exists on Binance
        if (!validateSymbol(symbol)) {
          showToast(`Symbol ${symbol} does not exist on Binance SPOT or is not trading.`, 'error');
          syms[i].focus();
          return;
        }

        // Check weight
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

      // Validate total weights sum to 100%
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
          "Content-Type":  "application/json",
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

  const fetchUser = async () => {
    const token = localStorage.getItem("token");
    console.log("▶️ fetchUser() token:", token);
    
    if (!token) {
      console.error("No token found in localStorage for fetchUser");
      console.log("Will redirect in 5 seconds...");
      setTimeout(() => {
        window.location.href = "/auth.html";
      }, 5000);
      return;
    }

    try {
      console.log("🔗 Making request to:", `${API_BASE}/me`);
      const res = await fetch(`${API_BASE}/me`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      console.log("⏳ /me status:", res.status);

      if (res.ok) {
        const data = await res.json();
        console.log("✅ User data:", data);
        document.getElementById("user-fullname").textContent = data.full_name || data.username || "User";
      } else if (res.status === 404) {
        console.warn("⚠️ /me endpoint not found (404) - this might be normal if endpoint doesn't exist");
        document.getElementById("user-fullname").textContent = "User";
      } else {
        console.warn("Failed to fetch user data, status:", res.status);
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
  };

  // wire up UI
  toggleThemeBtn.onclick    = toggleTheme;
  logoutBtn.onclick         = logout;
  openModalBtn.onclick      = openModal;
  closeModalBtn.onclick     = closeModal;
  accountForm.onsubmit      = submitAccount;
  
  strategySelect.onchange   = () => {
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
      // Remove required from instrument inputs
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
      // Add required to instrument inputs
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
  
  addInstrumentBtn.onclick = () => addInstrumentField();

  // Initialize
  loadBinanceSymbols();

  // fetch the user with a small delay to ensure DOM is ready
  setTimeout(() => {
    console.log("🚀 Starting fetchUser...");
    fetchUser();
  }, 100);

  // initial load with delay
  setTimeout(() => {
    console.log("🚀 Starting loadAccounts...");
    loadAccounts();  
  }, 200);
});