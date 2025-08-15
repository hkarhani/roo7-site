// dashboard-modal.js - Modal and Form Management

class ModalManager {
  constructor(apiBase, marketDataApi) {
    this.API_BASE = apiBase;
    this.MARKET_DATA_API = marketDataApi;
    this.modal = document.getElementById("account-modal");
    this.hedgeModal = document.getElementById("hedge-modal");
    this.strategyModal = document.getElementById("strategy-modal");
    this.accountForm = document.getElementById("account-form");
    this.hedgeForm = document.getElementById("hedge-form");
    this.strategyForm = document.getElementById("strategy-form");
    this.exchangeSelect = document.getElementById("exchange-select");
    this.accountTypeSelect = document.getElementById("account-type-select");
    this.strategySelect = document.getElementById("strategy-select");
    this.strategyParametersForm = document.getElementById("strategy-parameters-form");
    this.portfolioInstruments = document.getElementById("portfolio-instruments");
    this.addPortfolioInstrumentBtn = document.getElementById("add-portfolio-instrument");
    this.cancelEditBtn = document.getElementById("cancel-edit");
    
    this.currentEditingId = null;
    this.currentHedgeAccountId = null;
    this.currentStrategyAccountId = null;
    this.useSameCredentials = false;
    this.binanceSymbols = [];
    this.availableStrategies = [];
    this.currentStrategyConfig = null;
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadStrategies(); // Load available strategies on init
    // Don't load symbols immediately - load them when needed
  }

  // Load available strategies from API
  async loadStrategies() {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.warn('⚠️ No token found for strategies API');
        return;
      }

      console.log('📡 Loading strategies from API...');
      const response = await fetch(`${this.API_BASE}/strategies`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.availableStrategies = data.strategies || [];
      console.log(`✅ Loaded ${this.availableStrategies.length} strategies from API`);
      console.log("🔍 Strategy data structure:", this.availableStrategies);
      
      // Log each strategy's parameters to debug
      this.availableStrategies.forEach((strategy, index) => {
        console.log(`📋 Strategy ${index + 1}:`, strategy.name);
        console.log(`   - Parameters:`, strategy.parameters);
        console.log(`   - Full object:`, strategy);
      });
      
      // Update strategy dropdown with initial selection
      this.updateStrategyOptions();
      
    } catch (error) {
      console.error('❌ Failed to load strategies from API:', error);
      window.showToast('Failed to load trading strategies. Please refresh the page.', 'error');
    }
  }

  // Update strategy options based on selected exchange and account type
  updateStrategyOptions() {
    const selectedExchange = this.exchangeSelect.value;
    const selectedAccountType = this.accountTypeSelect.value;
    
    // Filter strategies based on selection
    const filteredStrategies = this.availableStrategies.filter(strategy => 
      strategy.exchange === selectedExchange && 
      strategy.account_type === selectedAccountType &&
      strategy.is_active === true
    );
    
    // Clear existing options
    this.strategySelect.innerHTML = '<option value="">Select Strategy...</option>';
    
    // Add filtered strategies
    filteredStrategies.forEach(strategy => {
      const option = document.createElement('option');
      option.value = strategy.id;
      option.textContent = strategy.name;
      option.dataset.strategy = JSON.stringify(strategy);
      this.strategySelect.appendChild(option);
    });
    
    console.log(`📊 Updated strategy options: ${filteredStrategies.length} strategies available`);
    
    // Clear strategy parameters when options change
    this.hideStrategyFields();
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
    document.getElementById("strategy-close").onclick = () => this.closeStrategyModal();
    this.accountForm.onsubmit = (e) => this.submitAccount(e);
    this.hedgeForm.onsubmit = (e) => this.updateHedge(e);
    this.strategyForm.onsubmit = (e) => this.submitStrategyAssignment(e);
    
    // Strategy management events
    this.strategySelect.onchange = () => this.handleStrategySelectionChange();
    this.addPortfolioInstrumentBtn.onclick = () => this.addPortfolioInstrument();
    document.getElementById("remove-strategy").onclick = () => this.removeStrategyAssignment();
    document.getElementById("refresh-strategies").onclick = () => this.loadStrategies();
    
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
      if (event.target === this.strategyModal) {
        this.closeStrategyModal();
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
    document.getElementById("exchange-api-key").value = "";
    document.getElementById("exchange-api-secret").value = "";
    this.exchangeSelect.value = "Binance";
    this.accountTypeSelect.value = "SPOT";
    
    // FORCE HIDE the Use Same Credentials button for Add New Account
    const useSameCredButton = document.getElementById("use-same-credentials");
    if (useSameCredButton) {
      useSameCredButton.style.display = "none";
      console.log("🚫 FORCED HIDE Use Same Credentials button for ADD mode");
    }
    
    // Hide edit-specific elements
    this.hideCancelButton();
    
    // Ensure API credential fields are enabled and visible
    const apiKeyField = document.getElementById("exchange-api-key");
    const apiSecretField = document.getElementById("exchange-api-secret");
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
    console.log("📋 Account data:", account);
    
    // Check if modal exists
    if (!this.modal) {
      console.error("❌ Account modal not found!");
      window.showToast("Error: Account modal not found", 'error');
      return;
    }
    
    // Set edit mode
    this.currentEditingId = account.id;
    this.useSameCredentials = false;
    
    try {
      // Set modal title and button
      const modalTitle = document.querySelector("#account-modal h3");
      const submitButton = document.querySelector("#account-modal button[type='submit']");
      
      if (modalTitle) modalTitle.textContent = "Edit Account";
      if (submitButton) submitButton.textContent = "Update Account";
      
      // Fill form with account data
      const nameField = document.getElementById("trading-account-name");
      const apiKeyField = document.getElementById("exchange-api-key");
      const apiSecretField = document.getElementById("exchange-api-secret");
      
      if (nameField) nameField.value = account.account_name || "";
      if (apiKeyField) apiKeyField.value = account.api_key || "";
      if (apiSecretField) apiSecretField.value = account.api_secret || "";
      if (this.exchangeSelect) this.exchangeSelect.value = account.exchange || "Binance";
      if (this.accountTypeSelect) this.accountTypeSelect.value = account.account_type || "SPOT";
      
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
      console.log("✅ Edit Account modal opened successfully");
      
    } catch (error) {
      console.error("❌ Error in openEditAccountModal:", error);
      window.showToast("Error opening edit modal: " + error.message, 'error');
    }
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
    const apiKeyField = document.getElementById("exchange-api-key");
    const apiSecretField = document.getElementById("exchange-api-secret");
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

  // STRATEGY MODAL FUNCTIONS
  openStrategyModal(account) {
    console.log("🎯 Opening strategy assignment modal for:", account.account_name);
    console.log("📋 Account strategy data:", account.strategy);
    console.log("📋 Full account data:", account);
    
    this.currentStrategyAccountId = account.id;
    this.currentAccount = account; // Store current account data for access
    
    // Display account information
    document.getElementById("strategy-account-name").textContent = account.account_name;
    document.getElementById("strategy-account-exchange").textContent = account.exchange || "Binance";
    document.getElementById("strategy-account-type").textContent = account.account_type || "SPOT";
    
    // Filter and populate strategies for this account's exchange and type
    this.updateStrategyOptionsForAccount(account.exchange || "Binance", account.account_type || "SPOT");
    
    // Set current strategy if assigned
    if (account.strategy && account.strategy.trim() !== '') {
      // Try to find strategy by ID first (which is what's stored in account.strategy)
      let strategyConfig = this.availableStrategies.find(s => s.id === account.strategy);
      
      // If not found by ID, try by name as fallback
      if (!strategyConfig) {
        strategyConfig = this.availableStrategies.find(s => s.name === account.strategy);
      }
      
      if (strategyConfig) {
        console.log("🎯 Found strategy config:", strategyConfig.name, "for account strategy:", account.strategy);
        this.strategySelect.value = strategyConfig.id; // Use the strategy ID for the dropdown
        this.currentStrategyConfig = strategyConfig;
        this.ensureStrategyParameters(); // Ensure parameters exist
        this.handleStrategySelectionChange();
        document.getElementById("remove-strategy").style.display = "inline-block";
      } else {
        console.warn("⚠️ Strategy config not found for strategy:", account.strategy);
        console.warn("⚠️ Available strategy IDs:", this.availableStrategies.map(s => s.id));
        console.warn("⚠️ Available strategy names:", this.availableStrategies.map(s => s.name));
        this.strategySelect.value = "";
        this.hideStrategyCustomization();
        document.getElementById("remove-strategy").style.display = "none";
      }
    } else {
      this.strategySelect.value = "";
      this.hideStrategyCustomization();
      document.getElementById("remove-strategy").style.display = "none";
    }
    
    this.strategyModal.style.display = "block";
    console.log("✅ Strategy modal opened");
    
    // Add a small delay to ensure DOM is ready before processing
    setTimeout(() => {
      console.log("🔄 Delayed processing to ensure DOM is ready");
      if (this.currentStrategyConfig) {
        this.showStrategyCustomization();
      }
    }, 100);
  }

  closeStrategyModal() {
    this.strategyModal.style.display = "none";
    this.strategyForm.reset();
    this.currentStrategyAccountId = null;
    this.currentAccount = null; // Reset current account data
    this.hideStrategyCustomization();
    console.log("✅ Strategy modal closed");
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
    
    const apiKeyField = document.getElementById("exchange-api-key");
    const apiSecretField = document.getElementById("exchange-api-secret");
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
  updateStrategyOptionsForAccount(exchange, accountType) {
    // Filter strategies based on exchange and account type
    const filteredStrategies = this.availableStrategies.filter(strategy => 
      strategy.exchange === exchange && 
      strategy.account_type === accountType &&
      strategy.is_active === true
    );
    
    // Clear existing options
    this.strategySelect.innerHTML = '<option value="">Select Strategy...</option>';
    
    // Add filtered strategies
    filteredStrategies.forEach(strategy => {
      const option = document.createElement('option');
      option.value = strategy.id;
      option.textContent = strategy.name;
      option.dataset.strategy = JSON.stringify(strategy);
      this.strategySelect.appendChild(option);
    });
    
    console.log(`📊 Updated strategy options for ${exchange} ${accountType}: ${filteredStrategies.length} strategies available`);
  }

  handleStrategySelectionChange() {
    console.log("🔄 ENTERING handleStrategySelectionChange");
    const selectedStrategyId = this.strategySelect.value;
    const selectedOption = this.strategySelect.selectedOptions[0];
    
    console.log("   - selectedStrategyId:", selectedStrategyId);
    console.log("   - selectedOption:", selectedOption);
    
    if (!selectedOption || !selectedStrategyId) {
      console.log("   - No option or ID selected, hiding customization");
      this.hideStrategyCustomization();
      return;
    }
    
    try {
      // Try to get strategy config from the option dataset first
      if (selectedOption.dataset.strategy) {
        console.log("   - Using dataset strategy");
        this.currentStrategyConfig = JSON.parse(selectedOption.dataset.strategy);
      } else {
        // Fallback: find strategy in availableStrategies array
        console.log("   - Using availableStrategies fallback");
        console.log("   - Available strategies:", this.availableStrategies);
        this.currentStrategyConfig = this.availableStrategies.find(s => s.id === selectedStrategyId);
      }
      
      if (!this.currentStrategyConfig) {
        console.error("❌ Strategy config not found for ID:", selectedStrategyId);
        this.hideStrategyCustomization();
        return;
      }
      
      console.log("🔄 Strategy selected:", this.currentStrategyConfig.name);
      console.log("📋 Strategy config:", this.currentStrategyConfig);
      
      // Add fallback parameters if strategy doesn't have them
      this.ensureStrategyParameters();
      
      this.showStrategyCustomization();
      
    } catch (error) {
      console.error("❌ Error parsing strategy config:", error);
      this.hideStrategyCustomization();
    }
  }

  // Ensure strategy has parameters - add fallback if missing
  ensureStrategyParameters() {
    if (!this.currentStrategyConfig) return;
    
    console.log("🔧 Ensuring strategy parameters for:", this.currentStrategyConfig.name);
    
    // If no parameters exist, create them based on strategy name
    if (!this.currentStrategyConfig.parameters) {
      console.log("⚠️ No parameters found, creating fallback parameters");
      this.currentStrategyConfig.parameters = {};
    }
    
    const strategyName = this.currentStrategyConfig.name;
    
    // Add standard parameters based on strategy type
    if (strategyName.includes("Custom Portfolio")) {
      if (!this.currentStrategyConfig.parameters.custom_instruments) {
        this.currentStrategyConfig.parameters.custom_instruments = {
          description: "Custom Portfolio Instruments",
          default: [
            { symbol: "BTC", weight: 50 },
            { symbol: "ETH", weight: 30 },
            { symbol: "XRP", weight: 20 }
          ]
        };
        console.log("✅ Added custom_instruments parameter");
      }
      
      if (!this.currentStrategyConfig.parameters.rebalance_frequency) {
        this.currentStrategyConfig.parameters.rebalance_frequency = {
          description: "Rebalance Frequency",
          default: "daily",
          options: ["hourly", "daily", "weekly"]
        };
        console.log("✅ Added rebalance_frequency parameter");
      }
    } else {
      // For other strategies, add top_x_count parameter
      if (!this.currentStrategyConfig.parameters.top_x_count) {
        this.currentStrategyConfig.parameters.top_x_count = {
          description: "Number of top instruments to trade (0 = algorithm default)",
          default: 0,
          min: 0,
          max: 50
        };
        console.log("✅ Added top_x_count parameter");
      }
    }
    
    console.log("🔧 Final strategy parameters:", this.currentStrategyConfig.parameters);
  }

  handleStrategyForEdit(account) {
    // Find the strategy config from available strategies
    const strategyConfig = this.availableStrategies.find(s => s.id === account.strategy);
    if (!strategyConfig) {
      console.warn("⚠️ Strategy config not found for:", account.strategy);
      return;
    }
    
    this.currentStrategyConfig = strategyConfig;
    this.showStrategyParameters();
    
    // Populate existing parameter values
    if (strategyConfig.parameters) {
      Object.keys(strategyConfig.parameters).forEach(paramName => {
        const input = document.getElementById(`strategy-${paramName}`);
        if (input) {
          if (paramName === 'top_x_count') {
            input.value = account.top_x_count || 0;
          } else if (paramName === 'custom_instruments') {
            // Handle custom portfolio instruments
            if (account.custom_portfolio && account.custom_portfolio.length > 0) {
              console.log("📋 Loading existing custom portfolio:", account.custom_portfolio);
              account.custom_portfolio.forEach(instrument => {
                this.addInstrumentField(instrument.symbol, instrument.weight);
              });
            }
          }
        }
      });
    }
  }


  // Show strategy parameters form
  showStrategyParameters() {
    if (!this.currentStrategyConfig || !this.currentStrategyConfig.parameters) {
      return;
    }

    const parameters = this.currentStrategyConfig.parameters;
    this.strategyParametersForm.innerHTML = '';

    Object.keys(parameters).forEach(paramName => {
      const param = parameters[paramName];
      
      if (paramName === 'top_x_count') {
        this.showTopXFields();
        const input = document.getElementById('strategy-param-top_x_count');
        if (input && param.default !== undefined) {
          input.value = param.default;
        }
      } else if (paramName === 'custom_instruments') {
        this.showPortfolioFields();
      } else if (paramName === 'rebalance_frequency') {
        const wrapper = document.createElement('div');
        wrapper.className = 'parameter-field';
        wrapper.innerHTML = `
          <label for="strategy-param-${paramName}">Rebalance Frequency:</label>
          <select id="strategy-param-${paramName}" name="${paramName}">
            ${param.options.map(opt => 
              `<option value="${opt}" ${opt === param.default ? 'selected' : ''}>${opt}</option>`
            ).join('')}
          </select>
        `;
        this.strategyParametersForm.appendChild(wrapper);
      }
    });
  }

  // Show strategy customization based on selected strategy
  showStrategyCustomization() {
    console.log("🎨 ENTERING showStrategyCustomization");
    console.log("   - currentStrategyConfig:", this.currentStrategyConfig);
    
    if (!this.currentStrategyConfig) {
      console.warn("❌ No currentStrategyConfig found");
      return;
    }
    
    if (!this.currentStrategyConfig.parameters) {
      console.warn("❌ No parameters found in currentStrategyConfig");
      console.log("   - Available properties:", Object.keys(this.currentStrategyConfig));
      return;
    }
    
    console.log("🎨 Showing strategy customization for:", this.currentStrategyConfig.name);
    console.log("   - Parameters:", this.currentStrategyConfig.parameters);
    
    const customizationDiv = document.getElementById('strategy-customization');
    if (!customizationDiv) {
      console.error("❌ strategy-customization div not found!");
      return;
    }
    
    customizationDiv.style.display = 'block';
    customizationDiv.style.visibility = 'visible';
    customizationDiv.style.opacity = '1';
    console.log("✅ Set strategy-customization display to block with full visibility");
    
    if (!this.strategyParametersForm) {
      console.error("❌ strategyParametersForm element not found!");
      return;
    }
    
    if (!this.portfolioInstruments) {
      console.error("❌ portfolioInstruments element not found!");
      return;
    }
    
    this.strategyParametersForm.innerHTML = '';
    this.portfolioInstruments.innerHTML = '';
    
    console.log("🧹 Cleared form contents");
    
    const parameters = this.currentStrategyConfig.parameters;
    console.log("🔍 Processing parameters:", parameters);
    console.log("🔍 Parameter keys:", Object.keys(parameters));
    
    Object.keys(parameters).forEach(paramName => {
      const param = parameters[paramName];
      console.log(`🔧 Processing parameter: ${paramName}`, param);
      
      if (paramName === 'custom_instruments') {
        // Handle custom portfolio specially
        console.log("📋 Setting up custom portfolio section");
        this.showCustomPortfolioSection();
      } else if (paramName === 'top_x_count') {
        // Handle top X count parameter
        console.log("🔢 Setting up top X count parameter");
        const wrapper = document.createElement('div');
        wrapper.className = 'parameter-field';
        wrapper.innerHTML = `
          <label for="strategy-param-${paramName}">${param.description || 'Top X Count'}</label>
          <input type="number" 
                 id="strategy-param-${paramName}" 
                 name="${paramName}"
                 placeholder="${param.description || 'Enter number of top instruments'}"
                 min="${param.min || 0}" 
                 max="${param.max || 100}"
                 value="${param.default || 0}">
        `;
        this.strategyParametersForm.appendChild(wrapper);
        console.log("✅ Added top_x_count field to form");
      } else if (paramName === 'rebalance_frequency') {
        // Handle rebalance frequency dropdown
        console.log("⏰ Setting up rebalance frequency parameter");
        const wrapper = document.createElement('div');
        wrapper.className = 'parameter-field';
        const options = param.options ? param.options.map(opt => 
          `<option value="${opt}" ${opt === param.default ? 'selected' : ''}>${opt}</option>`
        ).join('') : '<option value="daily">Daily</option>';
        
        wrapper.innerHTML = `
          <label for="strategy-param-${paramName}">${param.description || 'Rebalance Frequency'}</label>
          <select id="strategy-param-${paramName}" name="${paramName}">
            ${options}
          </select>
        `;
        this.strategyParametersForm.appendChild(wrapper);
        console.log("✅ Added rebalance_frequency field to form");
      } else {
        console.log(`⚠️ Unknown parameter type: ${paramName}`, param);
      }
    });
    
    // Force a visual refresh of the customization section
    console.log("🔄 Forcing visual refresh of customization section");
    setTimeout(() => {
      const customizationDiv = document.getElementById('strategy-customization');
      const portfolioSection = document.getElementById('custom-portfolio-section');
      
      if (customizationDiv) {
        customizationDiv.style.setProperty('display', 'block', 'important');
        customizationDiv.style.setProperty('visibility', 'visible', 'important');
        customizationDiv.style.setProperty('opacity', '1', 'important');
        customizationDiv.style.setProperty('height', 'auto', 'important');
        console.log("🔄 Applied delayed visibility fix with !important");
      }
      
      // CRITICAL FIX: Force show the strategy-parameters-form which is hidden
      const parametersForm = document.getElementById('strategy-parameters-form');
      if (parametersForm) {
        parametersForm.style.setProperty('display', 'block', 'important');
        parametersForm.style.setProperty('visibility', 'visible', 'important');
        parametersForm.style.setProperty('opacity', '1', 'important');
        console.log("🔧 FIXED: Force showed strategy-parameters-form");
      }
      
      if (portfolioSection) {
        portfolioSection.style.setProperty('display', 'block', 'important');
        portfolioSection.style.setProperty('visibility', 'visible', 'important');
        portfolioSection.style.setProperty('opacity', '1', 'important');
        console.log("🔄 Applied portfolio section visibility fix");
      }
      
      // CRITICAL FIX: Force show the portfolio-instruments and add button
      const portfolioInstruments = document.getElementById('portfolio-instruments');
      const addButton = document.getElementById('add-portfolio-instrument');
      
      if (portfolioInstruments) {
        portfolioInstruments.style.setProperty('display', 'block', 'important');
        portfolioInstruments.style.setProperty('visibility', 'visible', 'important');
        console.log("🔧 FIXED: Force showed portfolio-instruments");
      }
      
      if (addButton) {
        addButton.style.setProperty('display', 'inline-block', 'important');
        addButton.style.setProperty('visibility', 'visible', 'important');
        console.log("🔧 FIXED: Force showed add-portfolio-instrument button");
      }
      
      // Log all child elements to see what's actually in the customization div
      if (customizationDiv) {
        console.log("🔍 Strategy customization div children:", customizationDiv.children);
        console.log("🔍 Strategy customization div innerHTML:", customizationDiv.innerHTML);
      }
      
      // If we're opening strategy modal for an existing account with data, populate it
      this.populateExistingStrategyData();
    }, 50);
  }
  
  // Populate existing strategy data for accounts that already have strategy assigned
  populateExistingStrategyData() {
    if (!this.currentAccount) {
      console.log("📝 No current account - using defaults");
      return;
    }
    
    console.log("🔍 Populating existing account strategy data:", this.currentAccount);
    
    // Populate top_x_count if exists
    if (this.currentAccount.top_x_count !== undefined && this.currentAccount.top_x_count !== null) {
      const topXInput = document.getElementById("strategy-param-top_x_count");
      if (topXInput) {
        topXInput.value = this.currentAccount.top_x_count;
        console.log("🔢 Set top_x_count to:", this.currentAccount.top_x_count);
      }
    }
    
    // Populate custom portfolio if exists
    if (this.currentAccount.custom_portfolio && Array.isArray(this.currentAccount.custom_portfolio) && this.currentAccount.custom_portfolio.length > 0) {
      console.log("📊 Loading existing custom portfolio:", this.currentAccount.custom_portfolio);
      this.portfolioInstruments.innerHTML = ''; // Clear first
      this.currentAccount.custom_portfolio.forEach(instrument => {
        this.addPortfolioInstrument(instrument.symbol, instrument.weight);
      });
    }
  }

  hideStrategyCustomization() {
    const customizationDiv = document.getElementById('strategy-customization');
    customizationDiv.style.display = 'none';
    document.getElementById('custom-portfolio-section').style.display = 'none';
  }

  showCustomPortfolioSection() {
    console.log("🎨 ENTERING showCustomPortfolioSection");
    
    const portfolioSection = document.getElementById('custom-portfolio-section');
    if (!portfolioSection) {
      console.error("❌ custom-portfolio-section element not found!");
      return;
    }
    
    portfolioSection.style.display = 'block';
    portfolioSection.style.visibility = 'visible';
    portfolioSection.style.opacity = '1';
    console.log("✅ Set custom-portfolio-section display to block with full visibility");
    
    if (!this.portfolioInstruments) {
      console.error("❌ portfolioInstruments element not found!");
      return;
    }
    
    // Load symbols for validation
    this.loadBinanceSymbols();
    
    // Add default instruments if none exist
    console.log("🔍 Current portfolio instruments count:", this.portfolioInstruments.children.length);
    
    if (this.portfolioInstruments.children.length === 0) {
      if (this.currentStrategyConfig && 
          this.currentStrategyConfig.parameters && 
          this.currentStrategyConfig.parameters.custom_instruments &&
          this.currentStrategyConfig.parameters.custom_instruments.default) {
        
        const defaultInstruments = this.currentStrategyConfig.parameters.custom_instruments.default;
        console.log("📋 Using API default instruments:", defaultInstruments);
        
        defaultInstruments.forEach(instrument => {
          console.log("➕ Adding instrument:", instrument.symbol, instrument.weight);
          this.addPortfolioInstrument(instrument.symbol, instrument.weight);
        });
      } else {
        // Fallback to hardcoded defaults
        console.log("📋 Using fallback default instruments");
        this.addPortfolioInstrument("BTC", 50);
        this.addPortfolioInstrument("ETH", 30);
        this.addPortfolioInstrument("XRP", 20);
      }
    }
    
    console.log("✅ showCustomPortfolioSection completed");
  }

  showTopXFields() {
    // Create the top X parameter in the strategy parameters form
    const wrapper = document.createElement('div');
    wrapper.className = 'parameter-field';
    wrapper.innerHTML = `
      <label for="strategy-param-top_x_count">Top X Instruments:</label>
      <input type="number" id="strategy-param-top_x_count" name="top_x_count" placeholder="Number of top instruments (0 = algorithm default)" min="0" max="50" value="0">
      <small>Enter 0 to use algorithm default selection</small>
    `;
    this.strategyParametersForm.appendChild(wrapper);
  }

  hideStrategyCustomization() {
    const customizationDiv = document.getElementById('strategy-customization');
    if (customizationDiv) {
      customizationDiv.style.display = 'none';
    }
    
    const portfolioSection = document.getElementById('custom-portfolio-section');
    if (portfolioSection) {
      portfolioSection.style.display = 'none';
    }
    
    this.strategyParametersForm.innerHTML = '';
    
    if (this.portfolioInstruments) {
      this.portfolioInstruments.innerHTML = '';
    }
  }

  showPortfolioFields() {
    if (this.portfolioInstruments) {
      this.portfolioInstruments.style.display = "flex";
    }
    if (this.addPortfolioInstrumentBtn) {
      this.addPortfolioInstrumentBtn.style.display = "inline-block";
    }
    
    // Load symbols when portfolio fields are shown (lazy loading)
    this.loadBinanceSymbols();
    
    // Only add default instruments for NEW accounts (when not editing)
    if (this.portfolioInstruments && !this.portfolioInstruments.children.length && !this.currentEditingId) {
      console.log("🆕 Adding default instruments for NEW account");
      
      // Get default instruments from API strategy configuration
      if (this.currentStrategyConfig && 
          this.currentStrategyConfig.parameters && 
          this.currentStrategyConfig.parameters.custom_instruments &&
          this.currentStrategyConfig.parameters.custom_instruments.default) {
        
        const defaultInstruments = this.currentStrategyConfig.parameters.custom_instruments.default;
        console.log("📋 Using API default instruments:", defaultInstruments);
        
        defaultInstruments.forEach(instrument => {
          this.addInstrumentField(instrument.symbol, instrument.weight);
        });
      } else {
        // Fallback to hardcoded defaults
        console.log("📋 Using fallback default instruments");
        this.addInstrumentField("BTCUSDT", 50);
        this.addInstrumentField("ETHUSDT", 30);
        this.addInstrumentField("XRPUSDT", 20);
      }
    }
  }

  hideStrategyFields() {
    const topXWrapper = document.getElementById("top-x-wrapper");
    if (topXWrapper) {
      topXWrapper.style.display = "none";
    }
    this.strategyParametersForm.style.display = "none";
    this.strategyParametersForm.innerHTML = "";
    if (this.portfolioInstruments) {
      this.portfolioInstruments.style.display = "none";
      this.portfolioInstruments.innerHTML = "";
    }
    if (this.addPortfolioInstrumentBtn) {
      this.addPortfolioInstrumentBtn.style.display = "none";
    }
  }

  // Portfolio instrument management for strategy modal
  addPortfolioInstrument(sym = "", wt = 0) {
    const div = document.createElement("div");
    div.className = "portfolio-instrument-field";
    div.innerHTML = `
      <div class="instrument-row">
        <input type="text" name="portfolio-symbol" placeholder="Symbol (e.g., BTC)" value="${sym}" class="symbol-input">
        <input type="number" name="portfolio-weight" placeholder="Weight (%)" value="${wt}" step="0.01" min="0" max="100" class="weight-input">
        <button type="button" class="remove-portfolio-instrument">×</button>
      </div>
    `;
    this.portfolioInstruments.appendChild(div);
    
    div.querySelector(".remove-portfolio-instrument").addEventListener("click", () => {
      div.remove();
      this.validateStrategyPortfolio();
    });
    
    // Add validation on input changes
    const symbolInput = div.querySelector('.symbol-input');
    const weightInput = div.querySelector('.weight-input');
    symbolInput.addEventListener('input', () => this.validateStrategyPortfolio());
    weightInput.addEventListener('input', () => this.validateStrategyPortfolio());
  }

  // Portfolio validation for strategy modal
  validateStrategyPortfolio() {
    const instrumentRows = this.portfolioInstruments.querySelectorAll('.portfolio-instrument-field');
    const feedbackDiv = document.getElementById('portfolio-validation-feedback');
    
    if (instrumentRows.length === 0) {
      feedbackDiv.innerHTML = '<div class="portfolio-feedback warning">⚠️ Add at least one instrument</div>';
      return false;
    }
    
    let totalWeight = 0;
    let hasEmptySymbols = false;
    let hasInvalidWeights = false;
    let hasDuplicates = false;
    const symbols = new Set();
    
    instrumentRows.forEach(row => {
      const symbolInput = row.querySelector('.symbol-input');
      const weightInput = row.querySelector('.weight-input');
      
      const symbol = symbolInput.value.trim().toUpperCase();
      const weight = parseFloat(weightInput.value) || 0;
      
      if (!symbol) {
        hasEmptySymbols = true;
        symbolInput.style.borderColor = '#ff4444';
      } else {
        symbolInput.style.borderColor = '';
        if (symbols.has(symbol)) {
          hasDuplicates = true;
          symbolInput.style.borderColor = '#ff4444';
        } else {
          symbols.add(symbol);
        }
      }
      
      if (weight <= 0 || weight > 100) {
        hasInvalidWeights = true;
        weightInput.style.borderColor = '#ff4444';
      } else {
        weightInput.style.borderColor = '';
      }
      
      totalWeight += weight;
    });
    
    const isValidTotal = Math.abs(totalWeight - 100) < 0.01;
    
    if (hasEmptySymbols) {
      feedbackDiv.innerHTML = '<div class="portfolio-feedback error">⚠️ Please fill in all symbol fields</div>';
    } else if (hasDuplicates) {
      feedbackDiv.innerHTML = '<div class="portfolio-feedback error">⚠️ Duplicate symbols found</div>';
    } else if (hasInvalidWeights) {
      feedbackDiv.innerHTML = '<div class="portfolio-feedback error">⚠️ Weights must be between 0.01 and 100</div>';
    } else if (!isValidTotal) {
      feedbackDiv.innerHTML = `<div class="portfolio-feedback warning">⚠️ Total weight: ${totalWeight.toFixed(2)}% (must equal 100%)</div>`;
    } else {
      feedbackDiv.innerHTML = `<div class="portfolio-feedback success">✅ Portfolio balanced: ${totalWeight.toFixed(2)}%</div>`;
    }
    
    return isValidTotal && !hasEmptySymbols && !hasInvalidWeights && !hasDuplicates;
  }

 // addInstrumentField

  // Professional portfolio instrument field
  addPortfolioInstrument(sym = "", wt = 0) {
    const div = document.createElement("div");
    div.className = "portfolio-instrument-field";
    div.innerHTML = `
      <div class="portfolio-row">
        <div class="symbol-input-wrapper">
          <label>Symbol</label>
          <input type="text" class="symbol-input" placeholder="BTCUSDT" value="${sym}">
        </div>
        <div class="weight-input-wrapper">
          <label>Weight (%)</label>
          <input type="number" class="weight-input" placeholder="50.00" value="${wt}" step="0.01" min="0.01" max="100">
        </div>
        <div class="remove-wrapper">
          <button type="button" class="remove-instrument" title="Remove instrument">🗑️</button>
        </div>
      </div>
    `;
    
    if (this.portfolioInstruments) {
      this.portfolioInstruments.appendChild(div);
    }
    
    div.querySelector(".remove-instrument").addEventListener("click", () => {
      div.remove();
      this.validateStrategyPortfolio();
    });
    
    // Add validation on input changes
    const symbolInput = div.querySelector('.symbol-input');
    const weightInput = div.querySelector('.weight-input');
    
    symbolInput.addEventListener('input', () => this.validateStrategyPortfolio());
    weightInput.addEventListener('input', () => this.validateStrategyPortfolio());
    
    // Auto-format symbol to uppercase
    symbolInput.addEventListener('blur', (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
  }

  // Portfolio validation function for strategy modal
  validateStrategyPortfolio() {
    const instrumentRows = this.portfolioInstruments ? this.portfolioInstruments.querySelectorAll('.portfolio-instrument-field') : [];
    if (instrumentRows.length === 0) return true;
    
    let totalWeight = 0;
    let hasEmptySymbols = false;
    let hasInvalidWeights = false;
    
    instrumentRows.forEach(row => {
      const symbolInput = row.querySelector('.symbol-input');
      const weightInput = row.querySelector('.weight-input');
      
      const symbol = symbolInput.value.trim();
      const weight = parseFloat(weightInput.value) || 0;
      
      if (!symbol) {
        hasEmptySymbols = true;
        symbolInput.style.borderColor = '#ff4444';
      } else {
        symbolInput.style.borderColor = '';
      }
      
      if (weight <= 0 || weight > 100) {
        hasInvalidWeights = true;
        weightInput.style.borderColor = '#ff4444';
      } else {
        weightInput.style.borderColor = '';
      }
      
      totalWeight += weight;
    });
    
    // Check total weight
    const isValidTotal = Math.abs(totalWeight - 100) < 0.01; // Allow small floating point differences
    
    // Update UI feedback
    const portfolioFeedback = document.getElementById('portfolio-feedback') || this.createPortfolioFeedback();
    
    if (hasEmptySymbols) {
      portfolioFeedback.textContent = '⚠️ Please fill in all symbol fields';
      portfolioFeedback.className = 'portfolio-feedback error';
    } else if (hasInvalidWeights) {
      portfolioFeedback.textContent = '⚠️ Weights must be between 0.01 and 100';
      portfolioFeedback.className = 'portfolio-feedback error';
    } else if (!isValidTotal) {
      portfolioFeedback.textContent = `⚠️ Total weight: ${totalWeight.toFixed(2)}% (must equal 100%)`;
      portfolioFeedback.className = 'portfolio-feedback warning';
    } else {
      portfolioFeedback.textContent = `✅ Portfolio balanced: ${totalWeight.toFixed(2)}%`;
      portfolioFeedback.className = 'portfolio-feedback success';
    }
    
    return isValidTotal && !hasEmptySymbols && !hasInvalidWeights;
  }
  
  createPortfolioFeedback() {
    const feedback = document.createElement('div');
    feedback.id = 'portfolio-feedback';
    feedback.className = 'portfolio-feedback';
    if (this.portfolioInstruments && this.addPortfolioInstrumentBtn) {
      this.portfolioInstruments.parentNode.insertBefore(feedback, this.addPortfolioInstrumentBtn);
    }
    return feedback;
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
        exchange: this.exchangeSelect.value,
        account_type: this.accountTypeSelect.value,
        strategy: "", // Empty strategy for new separated workflow
        current_value: 0.0,
        hedge_percent: 0.0
      };

      // Only include API credentials if not using same credentials
      if (!this.useSameCredentials) {
        const apiKey = document.getElementById("exchange-api-key").value.trim();
        const apiSecret = document.getElementById("exchange-api-secret").value.trim();
        
        if (!apiKey || !apiSecret) {
          window.showToast("API Key and Secret are required.", 'warning');
          return;
        }
        
        data.api_key = apiKey;
        data.api_secret = apiSecret;
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
        console.error("❌ API Error Data:", errorData);
        
        let errorMessage;
        if (Array.isArray(errorData)) {
          // Handle array of error objects (e.g., validation errors)
          errorMessage = errorData.map(err => {
            const field = err.loc ? err.loc[err.loc.length - 1] : 'unknown field';
            const msg = err.msg || err.message || 'validation error';
            return `${field}: ${msg}`;
          }).join('; ');
        } else if (Array.isArray(errorData.detail)) {
          // Handle when detail is an array
          errorMessage = errorData.detail.map(err => {
            const field = err.loc ? err.loc[err.loc.length - 1] : 'unknown field';
            const msg = err.msg || err.message || 'validation error';
            return `${field}: ${msg}`;
          }).join('; ');
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        
        console.error("❌ Parsed Error Message:", errorMessage);
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

  // STRATEGY ASSIGNMENT FUNCTIONS
  async submitStrategyAssignment(e) {
    e.preventDefault();
    
    const token = localStorage.getItem("token");
    if (!token) {
      window.showToast("You must be logged in to assign strategies.", 'error');
      return;
    }

    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    
    // Prevent multiple submissions
    if (submitButton.disabled) {
      console.log("⚠️ Strategy assignment already in progress, ignoring duplicate click");
      return;
    }
    
    // Set loading state IMMEDIATELY
    submitButton.disabled = true;
    submitButton.style.opacity = "0.6";
    submitButton.style.cursor = "not-allowed";
    submitButton.textContent = "Assigning Strategy...";
    
    // Show loading toast
    window.showToast("Assigning strategy to account...", 'info', 10000); // 10 second duration
    
    try {
      const strategyId = this.strategySelect.value;
      
      if (!strategyId) {
        window.showToast("Please select a strategy.", 'warning');
        return;
      }

      // Build strategy assignment data
      // Use the strategy NAME for backend storage, not the ID
      const selectedStrategy = this.availableStrategies.find(s => s.id === strategyId);
      if (!selectedStrategy) {
        window.showToast("Selected strategy not found.", 'error');
        return;
      }
      
      const data = {
        strategy: selectedStrategy.name  // Use strategy NAME, not ID
      };

      // Handle strategy parameters
      if (this.currentStrategyConfig && this.currentStrategyConfig.parameters) {
        const parameters = this.currentStrategyConfig.parameters;
        
        // Handle top_x_count parameter
        if (parameters.top_x_count) {
          const topXInput = document.getElementById("strategy-param-top_x_count");
          if (topXInput) {
            data.top_x_count = parseInt(topXInput.value) || 0;
          }
        }
        
        // Handle custom portfolio
        if (parameters.custom_instruments) {
          if (!this.validateStrategyPortfolio()) {
            window.showToast("Please fix portfolio issues before saving.", 'warning');
            return;
          }

          const portfolioRows = this.portfolioInstruments.querySelectorAll('.portfolio-instrument-field');
          const customPortfolio = [];
          
          portfolioRows.forEach(row => {
            const symbol = row.querySelector('.symbol-input').value.trim().toUpperCase();
            const weight = parseFloat(row.querySelector('.weight-input').value);
            
            if (symbol && weight > 0) {
              customPortfolio.push({ symbol, weight });
            }
          });
          
          data.custom_portfolio = customPortfolio;
        }
      }

      console.log("📤 Submitting strategy assignment:", data);

      const res = await fetch(`${this.API_BASE}/accounts/${this.currentStrategyAccountId}`, {
        method: "PUT",
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

      window.showToast("✅ Strategy assigned successfully!", 'success');
      this.closeStrategyModal();
      if (window.loadAccounts) window.loadAccounts();
      if (window.loadStrategiesOverview) window.loadStrategiesOverview();

    } catch (err) {
      console.error("❌ Strategy assignment error:", err);
      window.showToast(`❌ Error assigning strategy: ${err.message}`, 'error');
    } finally {
      // Always restore button state
      submitButton.disabled = false;
      submitButton.style.opacity = "1";
      submitButton.style.cursor = "pointer";
      submitButton.textContent = originalButtonText;
    }
  }

  async removeStrategyAssignment() {
    const token = localStorage.getItem("token");
    if (!token) {
      window.showToast("You must be logged in to remove strategies.", 'error');
      return;
    }

    if (!confirm("Are you sure you want to remove the strategy assignment from this account?")) {
      return;
    }

    try {
      const data = {
        strategy: "",  // Empty string to remove strategy
        custom_portfolio: [],
        top_x_count: null
      };

      console.log("📤 Removing strategy assignment");

      const res = await fetch(`${this.API_BASE}/accounts/${this.currentStrategyAccountId}`, {
        method: "PUT",
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

      window.showToast("✅ Strategy removed successfully!", 'success');
      this.closeStrategyModal();
      if (window.loadAccounts) window.loadAccounts();
      if (window.loadStrategiesOverview) window.loadStrategiesOverview();

    } catch (err) {
      console.error("❌ Strategy removal error:", err);
      window.showToast(`❌ Error removing strategy: ${err.message}`, 'error');
    }
  }
}

// Export for use in main dashboard
window.ModalManager = ModalManager;