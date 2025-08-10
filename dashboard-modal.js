// dashboard-modal.js - Modal and Form Management

class ModalManager {
  constructor(apiBase, marketDataApi) {
    this.API_BASE = apiBase;
    this.MARKET_DATA_API = marketDataApi; // Changed from BINANCE_API to MARKET_DATA_API
    this.modal = document.getElementById("account-modal");
    this.hedgeModal = document.getElementById("hedge-modal");
    this.accountForm = document.getElementById("account-form");
    this.hedgeForm = document.getElementById("hedge-form");
    this.strategySelect = document.getElementById("trading-strategy");
    this.instrumentsWrap = document.getElementById("instruments-wrapper");
    this.addInstrumentBtn = document.getElementById("add-instrument");
    this.cancelEditBtn = document.getElementById("cancel-edit");
    
    this.currentEditingId = null;
    this.currentHedgeAccountId = null;
    this.useSameCredentials = false;
    this.binanceSymbols = [];
    
    this.init();
  }

  init() {
    this.bindEvents();
    // Don't load symbols immediately - load them when needed
  }

  // Load Binance symbols for validation from market-data-service (lazy loading)
  async loadBinanceSymbols() {
    // If already loaded, don't load again
    if (this.binanceSymbols.length > 0) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.warn('⚠️ No token found for market data API - symbol validation will be skipped');
        return;
      }

      console.log('📡 Loading SPOT symbols from market-data-service...');
      console.log('🔑 Token length:', token.length);
      
      const response = await fetch(`${this.MARKET_DATA_API}/spot-instruments?active_only=true`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Market data service response status:', response.status);

      if (response.status === 401) {
        console.warn('⚠️ Authentication failed for market data API - trying to use fallback');
        // Try to use health endpoint to check if service is accessible
        const healthResponse = await fetch(`${this.MARKET_DATA_API}/health`);
        if (healthResponse.ok) {
          console.log('✅ Market data service is accessible - auth issue confirmed');
          // Fallback: Try to get symbols from auth service instead
          return await this.loadSymbolsFromAuthService();
        }
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.data && Array.isArray(data.data)) {
        // Filter for USDT symbols only and extract symbol names
        this.binanceSymbols = data.data
          .filter(instrument => 
            instrument.symbol && 
            instrument.symbol.endsWith('USDT') && 
            instrument.is_active === true
          )
          .map(instrument => instrument.symbol);
        
        console.log(`✅ Loaded ${this.binanceSymbols.length} active SPOT USDT symbols from market-data-service`);
      } else {
        throw new Error('Invalid response format from market-data-service');
      }
    } catch (error) {
      console.error('❌ Failed to load symbols from market-data-service:', error);
      console.log('🔄 Attempting fallback to direct Binance API...');
      await this.loadSymbolsFromBinanceDirectly();
    }
  }

  // Fallback method: Load symbols from auth service (if available)
  async loadSymbolsFromAuthService() {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${this.API_BASE}/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log('✅ Auth service token validation successful');
        // Token is valid for auth service, but not market-data-service
        console.log('⚠️ Token works for auth but not market-data service - possible JWT secret mismatch');
        window.showToast('Warning: Market data service authentication issue. Using basic validation.', 'warning');
      }
    } catch (error) {
      console.log('❌ Auth service also failing:', error);
    }
  }

  // Final fallback: Load symbols directly from Binance (temporary solution)
  async loadSymbolsFromBinanceDirectly() {
    try {
      console.log('📡 Fallback: Loading symbols directly from Binance API...');
      const response = await fetch('https://api.binance.com/api/v3/exchangeInfo');
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }
      
      const data = await response.json();
      this.binanceSymbols = data.symbols
        .filter(symbol => symbol.status === 'TRADING' && symbol.symbol.endsWith('USDT'))
        .map(symbol => symbol.symbol);
      
      console.log(`✅ Fallback successful: Loaded ${this.binanceSymbols.length} USDT symbols from Binance directly`);
      window.showToast('Using direct Binance API for symbol validation (fallback mode).', 'info');
      
    } catch (error) {
      console.error('❌ All symbol loading methods failed:', error);
      window.showToast('Warning: Could not load trading symbols. Symbol validation will be skipped.', 'warning');
    }
  }

  bindEvents() {
    // Modal events
    document.querySelector(".modal .close").onclick = () => this.closeAccountModal();
    document.getElementById("hedge-close").onclick = () => this.closeHedgeModal();
    this.accountForm.onsubmit = (e) => this.submitAccount(e);
    this.hedgeForm.onsubmit = (e) => this.updateHedge(e);
    
    // Form events
    this.strategySelect.onchange = () => this.handleStrategyChange();
    this.addInstrumentBtn.onclick = () => this.addInstrumentField();
    
    // Cancel button
    if (this.cancelEditBtn) {
      this.cancelEditBtn.onclick = () => this.closeAccountModal();
    }

    // Use same credentials button
    const useSameCredButton = document.getElementById("use-same-credentials");
    if (useSameCredButton) {
      useSameCredButton.onclick = (e) => this.toggleSameCredentials(e);
    }

    // Close modals when clicking outside
    window.onclick = (event) => {
      if (event.target === this.modal) {
        this.closeAccountModal();
      }
      if (event.target === this.hedgeModal) {
        this.closeHedgeModal();
      }
    };
  }

  // ACCOUNT MODAL FUNCTIONS
  openAddAccountModal() {
    console.log("🚀 Opening ADD ACCOUNT modal");
    
    // Reset everything to add mode
    this.currentEditingId = null;
    this.useSameCredentials = false;
    
    // Set modal title and button
    document.querySelector("#account-modal h3").textContent = "Add New Account";
    document.querySelector("#account-modal button[type='submit']").textContent = "Save Account";
    
    // Clear all form fields
    document.getElementById("trading-account-name").value = "";
    document.getElementById("binance-api-key").value = "";
    document.getElementById("binance-api-secret").value = "";
    this.strategySelect.value = "Standard Vapaus";
    
    // FORCE HIDE the Use Same Credentials button for Add New Account
    const useSameCredButton = document.getElementById("use-same-credentials");
    if (useSameCredButton) {
      useSameCredButton.style.display = "none";
      console.log("🚫 FORCED HIDE Use Same Credentials button for ADD mode");
    }
    
    // Hide edit-specific elements
    this.hideCancelButton();
    this.hideStrategyFields();
    
    // Ensure API credential fields are enabled and visible
    const apiKeyField = document.getElementById("binance-api-key");
    const apiSecretField = document.getElementById("binance-api-secret");
    if (apiKeyField && apiSecretField) {
      apiKeyField.disabled = false;
      apiSecretField.disabled = false;
      apiKeyField.style.opacity = "1";
      apiSecretField.style.opacity = "1";
      apiKeyField.required = true;
      apiSecretField.required = true;
    }
    
    // Show modal
    this.modal.style.display = "block";
    console.log("✅ Add Account modal opened");
  }

  openEditAccountModal(account) {
    console.log("✏️ Opening EDIT ACCOUNT modal for:", account.account_name);
    
    // Set edit mode
    this.currentEditingId = account.id;
    this.useSameCredentials = false;
    
    // Set modal title and button
    document.querySelector("#account-modal h3").textContent = "Edit Account";
    document.querySelector("#account-modal button[type='submit']").textContent = "Update Account";
    
    // Fill form with account data
    document.getElementById("trading-account-name").value = account.account_name;
    document.getElementById("binance-api-key").value = account.api_key || "";
    document.getElementById("binance-api-secret").value = account.api_secret || "";
    this.strategySelect.value = account.strategy;
    
    // FORCE SHOW the Use Same Credentials button for Edit mode
    const useSameCredButton = document.getElementById("use-same-credentials");
    if (useSameCredButton) {
      useSameCredButton.style.display = "block";
      useSameCredButton.textContent = "🔒 Use Same API Credentials";
      useSameCredButton.classList.remove("active");
      console.log("✅ FORCED SHOW Use Same Credentials button for EDIT mode");
    }
    
    // Show edit-specific elements
    this.showCancelButton();
    
    // Handle strategy-specific fields
    this.handleStrategyForEdit(account);
    
    // Show modal
    this.modal.style.display = "block";
    console.log("✅ Edit Account modal opened");
  }

  closeAccountModal() {
    console.log("🚪 Closing account modal");
    
    this.modal.style.display = "none";
    this.accountForm.reset();
    
    // Reset all states
    this.currentEditingId = null;
    this.useSameCredentials = false;
    
    // Clear strategy fields
    this.hideStrategyFields();
    
    // Reset field states
    const apiKeyField = document.getElementById("binance-api-key");
    const apiSecretField = document.getElementById("binance-api-secret");
    if (apiKeyField && apiSecretField) {
      apiKeyField.disabled = false;
      apiSecretField.disabled = false;
      apiKeyField.style.opacity = "1";
      apiSecretField.style.opacity = "1";
    }
    
    // Reset Use Same Credentials button
    const useSameCredButton = document.getElementById("use-same-credentials");
    if (useSameCredButton) {
      useSameCredButton.style.display = "none";
      useSameCredButton.classList.remove("active");
    }
    
    console.log("✅ Account modal closed");
  }

  // HEDGE MODAL FUNCTIONS
  openHedgeModal(account) {
    document.getElementById("hedge-account-name").value = account.account_name;
    document.getElementById("hedge-current-value").value = `$${account.current_value || 0}`;
    document.getElementById("hedge-percent-input").value = account.hedge_percent || 0;
    document.getElementById("account-disabled").checked = account.is_disabled || false;
    document.getElementById("account-revoked").checked = account.is_revoked || false;
    this.currentHedgeAccountId = account.id;
    this.hedgeModal.style.display = "block";
  }

  closeHedgeModal() {
    this.hedgeModal.style.display = "none";
    this.hedgeForm.reset();
    this.currentHedgeAccountId = null;
  }

  // UI HELPER FUNCTIONS (keeping these for backward compatibility but using direct style.display now)
  showUseSameCredentialsButton() {
    const button = document.getElementById("use-same-credentials");
    if (button) {
      button.style.display = "block";
      console.log("👁️ Use Same Credentials button shown");
    }
  }

  hideUseSameCredentialsButton() {
    const button = document.getElementById("use-same-credentials");
    if (button) {
      button.style.display = "none";
      console.log("👁️ Use Same Credentials button hidden");
    }
  }

  showCancelButton() {
    if (this.cancelEditBtn) {
      this.cancelEditBtn.classList.remove("hidden");
      this.cancelEditBtn.classList.add("visible");
    }
  }

  hideCancelButton() {
    if (this.cancelEditBtn) {
      this.cancelEditBtn.classList.remove("visible");
      this.cancelEditBtn.classList.add("hidden");
    }
  }

  toggleSameCredentials(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const apiKeyField = document.getElementById("binance-api-key");
    const apiSecretField = document.getElementById("binance-api-secret");
    const button = e.target;
    
    this.useSameCredentials = !this.useSameCredentials;
    
    if (this.useSameCredentials) {
      apiKeyField.disabled = true;
      apiSecretField.disabled = true;
      apiKeyField.style.opacity = "0.5";
      apiSecretField.style.opacity = "0.5";
      button.textContent = "🔓 Change API Credentials";
      button.classList.add("active");
    } else {
      apiKeyField.disabled = false;
      apiSecretField.disabled = false;
      apiKeyField.style.opacity = "1";
      apiSecretField.style.opacity = "1";
      button.textContent = "🔒 Use Same API Credentials";
      button.classList.remove("active");
    }
  }

  // STRATEGY HANDLING
  handleStrategyChange() {
    const selectedStrategy = this.strategySelect.value;
    console.log("🔄 Strategy changed to:", selectedStrategy);
    
    this.hideStrategyFields();
    
    if (selectedStrategy === "Top X Instruments of Vapaus") {
      this.showTopXFields();
    } else if (selectedStrategy === "Custom Portfolio Rebalancing") {
      this.showPortfolioFields();
    }
  }

  handleStrategyForEdit(account) {
    const strategy = account.strategy;
    
    if (strategy === "Top X Instruments of Vapaus") {
      this.showTopXFields();
      const topXInput = document.getElementById("top-x-count");
      if (topXInput) {
        topXInput.value = account.top_x_count || "";
      }
    } else if (strategy === "Custom Portfolio Rebalancing") {
      this.showPortfolioFields();
      
      // ✅ FIX: Only load existing custom portfolio instruments, don't add defaults
      if (account.custom_portfolio && account.custom_portfolio.length > 0) {
        console.log("📋 Loading existing custom portfolio:", account.custom_portfolio);
        account.custom_portfolio.forEach(instrument => {
          this.addInstrumentField(instrument.symbol, instrument.weight);
        });
      } else {
        console.log("📋 No existing custom portfolio found - starting with empty portfolio");
        // Don't add default instruments for edit mode - leave empty
      }
    }
  }

  showTopXFields() {
    let topXWrapper = document.getElementById("top-x-wrapper");
    if (!topXWrapper) {
      topXWrapper = document.createElement("div");
      topXWrapper.id = "top-x-wrapper";
      topXWrapper.innerHTML = `
        <input type="number" id="top-x-count" placeholder="Number of top instruments" min="1" max="50">
      `;
      this.strategySelect.parentNode.insertBefore(topXWrapper, this.strategySelect.nextSibling);
    }
    topXWrapper.style.display = "block";
  }

  showPortfolioFields() {
    this.instrumentsWrap.style.display = "flex";
    this.addInstrumentBtn.style.display = "inline-block";
    
    // Load symbols when portfolio fields are shown (lazy loading)
    this.loadBinanceSymbols();
    
    // Only add default instruments for NEW accounts (when not editing)
    if (!this.instrumentsWrap.children.length && !this.currentEditingId) {
      console.log("🆕 Adding default instruments for NEW account");
      this.addInstrumentField("BTCUSDT", 50);
      this.addInstrumentField("ETHUSDT", 30);
      this.addInstrumentField("BNBUSDT", 20);
    }
  }

  hideStrategyFields() {
    const topXWrapper = document.getElementById("top-x-wrapper");
    if (topXWrapper) {
      topXWrapper.style.display = "none";
    }
    this.instrumentsWrap.style.display = "none";
    this.instrumentsWrap.innerHTML = "";
    this.addInstrumentBtn.style.display = "none";
  }

 // addInstrumentField

  // Updated addInstrumentField function for better mobile layout
// Replace the existing addInstrumentField function in dashboard-modal.js

addInstrumentField(sym = "", wt = 0) {
  const div = document.createElement("div");
  div.className = "instrument-field";
  div.innerHTML = `
    <div class="instrument-row">
      <input type="text" name="symbol" placeholder="Symbol (e.g., BTCUSDT)" value="${sym}">
      <input type="number" name="weight" placeholder="Weight (%)" value="${wt}" step="0.01" min="0" max="100">
      <button type="button" class="remove-instrument">×</button>
    </div>
  `;
  this.instrumentsWrap.appendChild(div);
  
  div.querySelector(".remove-instrument").addEventListener("click", () => div.remove());
}

  // FORM SUBMISSION
  async submitAccount(e) {
    e.preventDefault();
    
    const token = localStorage.getItem("token");
    if (!token) {
      window.showToast("You must be logged in to save an account.", 'error');
      window.location.href = "/auth.html";
      return;
    }

    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    const isEditing = this.currentEditingId;
    
    // Prevent multiple submissions
    if (submitButton.disabled) {
      return;
    }
    
    // Set loading state IMMEDIATELY
    submitButton.disabled = true;
    submitButton.style.opacity = "0.6";
    submitButton.style.cursor = "not-allowed";
    submitButton.textContent = isEditing ? "Updating..." : "Creating...";
    
    // Show loading toast
    const loadingToastMessage = isEditing ? "Updating account..." : "Creating account...";
    window.showToast(loadingToastMessage, 'info', 10000); // 10 second duration

    try {
      const accountName = document.getElementById("trading-account-name").value.trim();
      
      // ✅ Enhanced validation: Check for empty account name
      if (!accountName) {
        window.showToast("Account name is required.", 'warning');
        document.getElementById("trading-account-name").focus();
        return;
      }

      const data = {
        account_name: accountName,
        strategy: this.strategySelect.value,
        custom_portfolio: []
      };

      // Only include API credentials if not using same credentials
      if (!this.useSameCredentials) {
        const apiKey = document.getElementById("binance-api-key").value.trim();
        const apiSecret = document.getElementById("binance-api-secret").value.trim();
        
        if (!apiKey || !apiSecret) {
          window.showToast("API Key and Secret are required.", 'warning');
          return;
        }
        
        data.api_key = apiKey;
        data.api_secret = apiSecret;
      }

      // Handle strategy-specific data
      if (data.strategy === "Top X Instruments of Vapaus") {
        const topXCount = document.getElementById("top-x-count");
        if (!topXCount || !topXCount.value) {
          window.showToast("Please specify the number of top instruments.", 'warning');
          topXCount?.focus();
          return;
        }
        data.top_x_count = parseInt(topXCount.value);
        if (data.top_x_count < 1 || data.top_x_count > 50) {
          window.showToast("Number of top instruments must be between 1 and 50.", 'warning');
          return;
        }
      } else if (data.strategy === "Custom Portfolio Rebalancing") {
        const symbols = this.instrumentsWrap.querySelectorAll("input[name='symbol']");
        const weights = this.instrumentsWrap.querySelectorAll("input[name='weight']");
        
        if (symbols.length === 0) {
          window.showToast("Please add at least one instrument for custom portfolio.", 'warning');
          return;
        }

        // Ensure symbols are loaded before validation
        await this.loadBinanceSymbols();

        // Validate and build portfolio
        let totalWeight = 0;
        const symbolSet = new Set(); // Check for duplicate symbols
        
        for (let i = 0; i < symbols.length; i++) {
          const symbol = symbols[i].value.trim().toUpperCase();
          const weight = parseFloat(weights[i].value);

          if (!symbol) {
            window.showToast("All symbols must be filled in.", 'warning');
            symbols[i].focus();
            return;
          }

          if (symbolSet.has(symbol)) {
            window.showToast(`Duplicate symbol found: ${symbol}. Each symbol can only be used once.`, 'warning');
            symbols[i].focus();
            return;
          }
          symbolSet.add(symbol);

          if (!symbol.endsWith('USDT')) {
            window.showToast(`Symbol ${symbol} must end with USDT.`, 'warning');
            symbols[i].focus();
            return;
          }

          // ✅ UPDATED: Use market-data-service validation instead of direct Binance API
          // Only validate if symbols were successfully loaded
          if (this.binanceSymbols.length > 0 && !this.binanceSymbols.includes(symbol)) {
            window.showToast(`Symbol ${symbol} does not exist or is not active on Binance SPOT.`, 'error');
            symbols[i].focus();
            return;
          } else if (this.binanceSymbols.length === 0) {
            console.warn(`⚠️ Symbol validation skipped for ${symbol} - market data service unavailable`);
          }

          if (isNaN(weight) || weight <= 0 || weight > 100) {
            window.showToast(`Weight for ${symbol} must be between 0 and 100.`, 'warning');
            weights[i].focus();
            return;
          }

          totalWeight += weight;
          data.custom_portfolio.push({ symbol, weight });
        }

        if (Math.abs(totalWeight - 100) > 0.01) {
          window.showToast(`Portfolio weights must sum to 100%. Current total: ${totalWeight.toFixed(2)}%`, 'warning');
          return;
        }
      }

      console.log("📤 Submitting account data:", data);

      const method = this.currentEditingId ? "PUT" : "POST";
      const url = this.currentEditingId 
        ? `${this.API_BASE}/accounts/${this.currentEditingId}`
        : `${this.API_BASE}/accounts`;

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
        const errorMessage = errorData.detail || `HTTP ${res.status}: ${res.statusText}`;
        console.error("❌ API Error:", errorMessage);
        throw new Error(errorMessage);
      }

      const action = this.currentEditingId ? "updated" : "created";
      // Clear any existing toasts first
      document.querySelectorAll('.toast').forEach(toast => toast.remove());
      window.showToast(`✅ Account ${action} successfully!`, 'success');
      this.closeAccountModal();
      if (window.loadAccounts) window.loadAccounts();

    } catch (err) {
      console.error("❌ Submit error:", err);
      // Clear any existing toasts first
      document.querySelectorAll('.toast').forEach(toast => toast.remove());
      window.showToast(`❌ Error ${this.currentEditingId ? 'updating' : 'creating'} account: ${err.message}`, 'error');
    } finally {
      // Always restore button state
      submitButton.disabled = false;
      submitButton.style.opacity = "1";
      submitButton.style.cursor = "pointer";
      submitButton.textContent = originalButtonText;
    }
  }

  async updateHedge(e) {
    e.preventDefault();

    const token = localStorage.getItem("token");
    if (!token) {
      window.showToast("You must be logged in to update account settings.", 'error');
      return;
    }

    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    
    // Prevent multiple submissions
    if (submitButton.disabled) {
      return;
    }
    
    // Set loading state
    submitButton.disabled = true;
    submitButton.textContent = "Updating...";
    
    // Show loading toast
    window.showToast("Updating account settings...", 'info', 10000); // 10 second duration

    try {
      const hedgePercent = parseFloat(document.getElementById("hedge-percent-input").value);
      const isDisabled = document.getElementById("account-disabled").checked;
      const isRevoked = document.getElementById("account-revoked").checked;
      
      if (isNaN(hedgePercent) || hedgePercent < 0 || hedgePercent > 100) {
        window.showToast("Hedge percentage must be a number between 0 and 100.", 'warning');
        return;
      }

      const res = await fetch(`${this.API_BASE}/accounts/${this.currentHedgeAccountId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          hedge_percent: hedgePercent,
          is_disabled: isDisabled,
          is_revoked: isRevoked
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${res.status}: ${res.statusText}`);
      }

      // Clear any existing toasts first
      document.querySelectorAll('.toast').forEach(toast => toast.remove());
      window.showToast("✅ Account settings updated successfully!", 'success');
      this.closeHedgeModal();
      if (window.loadAccounts) window.loadAccounts();

    } catch (err) {
      // Clear any existing toasts first
      document.querySelectorAll('.toast').forEach(toast => toast.remove());
      window.showToast(`❌ Error updating account settings: ${err.message}`, 'error');
    } finally {
      // Always restore button state
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
}

// Export for use in main dashboard
window.ModalManager = ModalManager;