// referrals.js - Referral Program Page Logic
import CONFIG from './frontend-config.js';

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = CONFIG.API_CONFIG.authUrl;      // auth endpoints (port 443)
  const INVOICING_API_BASE = CONFIG.API_CONFIG.invoicingUrl;  // invoicing endpoints (port 8003)

  // Check authentication
  const token = localStorage.getItem("token");
  if (!token) {
    console.log("❌ No token found, redirecting to auth...");
    setTimeout(() => {
      window.location.href = "/auth.html";
    }, 2000);
    return;
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

  // API Helper Functions
  const getAuthHeaders = (token) => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  });

  // State management
  let referralData = null;
  let allReferrals = [];
  let filteredReferrals = [];

  // Check if invoicing API is available
  async function checkServiceStatus() {
    try {
      
      // Set a shorter timeout for the health check
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${INVOICING_API_BASE}/health`, {
        method: 'GET',
        headers: {'Content-Type': 'application/json'},
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        return true;
      } else {
        console.warn('⚠️ Invoicing service health check failed:', response.status);
        return false;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('⚠️ Invoicing service health check timed out after 5 seconds');
      } else {
        console.warn('⚠️ Invoicing service health check failed:', error.message);
      }
      return false;
    }
  }

  // Load initial data
  async function initializePage() {
    try {
      // Check service status first (but don't let it block the page)
      checkServiceStatus().then(serviceAvailable => {
        if (!serviceAvailable) {
          console.warn('⚠️ Health check failed, but continuing to load referral data...');
          // Don't show a warning toast immediately, let the data load first
        }
      }).catch(error => {
        console.warn('⚠️ Health check error:', error);
      });
      
      // Always try to load referral data regardless of health check
      await loadReferralData();
      updateUI();
      setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize page:', error);
      showToast('Failed to load referral data. Please check if the service is running.', 'error');
    }
  }

  // Load referral dashboard data
  async function loadReferralData() {
    try {
      
      const response = await fetch(`${INVOICING_API_BASE}/referrals/me`, {
        headers: getAuthHeaders(token)
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No referral code yet - that's OK
          referralData = {
            referral_code: null,
            referral_balance: 0,
            total_referral_earned: 0,
            referrals_count: 0,
            referral_link: '',
            referred_users: []
          };
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      referralData = await response.json();
      allReferrals = referralData.referred_users || [];
      filteredReferrals = [...allReferrals];
      
      
    } catch (error) {
      console.error('Error loading referral data:', error);
      
      // Check if it's a network connectivity issue
      if (error instanceof TypeError && error.message.includes('NetworkError')) {
        console.warn('⚠️ Invoicing API service appears to be unavailable');
        showToast('Referral service is currently unavailable. Please try again later.', 'warning', 6000);
      } else {
        showToast(`Failed to load referral data: ${error.message}`, 'error');
      }
      
      // Set default empty state
      referralData = {
        referral_code: null,
        referral_balance: 0,
        total_referral_earned: 0,
        referrals_count: 0,
        referral_link: '',
        referred_users: []
      };
    }
  }

  // Update UI with loaded data
  function updateUI() {
    if (!referralData) return;

    // Update overview stats
    document.getElementById('current-balance').textContent = `$${referralData.referral_balance.toFixed(2)}`;
    document.getElementById('total-earned').textContent = `$${referralData.total_referral_earned.toFixed(2)}`;
    document.getElementById('referrals-count').textContent = referralData.referrals_count;

    // Update referral code section
    const codeInput = document.getElementById('referral-code-input');
    
    if (referralData.referral_code) {
      codeInput.value = referralData.referral_code;
      codeInput.placeholder = referralData.referral_code;
    } else {
      codeInput.placeholder = 'No code generated yet';
    }

    // Update referral history table
    updateReferralTable();
  }

  // Update referral history table
  function updateReferralTable() {
    const tbody = document.querySelector('#referrals-table tbody');
    
    if (filteredReferrals.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            <h3>🎯 No Referrals Yet</h3>
            <p>Start sharing your referral code to see your referrals here!</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredReferrals.map(referral => {
      const status = getReferralStatus(referral);
      const statusClass = status.toLowerCase();
      
      return `
        <tr>
          <td><strong>${referral.user_name || 'Anonymous'}</strong></td>
          <td>${referral.user_email}</td>
          <td>${formatDate(referral.created_at)}</td>
          <td><strong>$${referral.earned_amount.toFixed(2)}</strong></td>
          <td><span class="referral-status ${statusClass}">${status}</span></td>
        </tr>
      `;
    }).join('');
  }

  // Get referral status
  function getReferralStatus(referral) {
    if (referral.paid_out) {
      return 'Paid';
    }
    
    // Check if 30 days have passed since creation
    const createdDate = new Date(referral.created_at);
    const now = new Date();
    const daysDiff = (now - createdDate) / (1000 * 60 * 60 * 24);
    
    if (daysDiff >= 30) {
      return 'Qualified';
    } else {
      return 'Pending';
    }
  }

  // Format date helper
  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Generate new referral code
  async function generateReferralCode() {
    const generateBtn = document.getElementById('generate-code-btn');
    const originalText = generateBtn.textContent;
    
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    
    try {
      console.log('🔑 Token exists:', !!token);
      
      const response = await fetch(`${INVOICING_API_BASE}/referrals/generate-code`, {
        method: 'POST',
        headers: getAuthHeaders(token)
      });


      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || `HTTP ${response.status}: ${response.statusText}`;
          console.error('❌ Error response:', errorData);
        } catch (parseError) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          console.error('❌ Could not parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (data.referral_code) {
        // Update local data
        referralData.referral_code = data.referral_code;
        
        // Update UI
        updateUI();
        
        showToast('Referral code generated successfully!', 'success');
      } else {
        console.error('❌ Invalid response - no referral_code field:', data);
        throw new Error('Invalid response from server - missing referral_code');
      }
      
    } catch (error) {
      console.error('❌ Error generating referral code:', error);
      
      // Check if it's a network connectivity issue
      if (error instanceof TypeError && error.message.includes('NetworkError')) {
        console.warn('⚠️ Invoicing API service appears to be unavailable');
        showToast('Referral service is currently unavailable. Please check if the invoicing service is running.', 'error', 8000);
      } else {
        showToast(`Failed to generate code: ${error.message}`, 'error');
      }
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = originalText;
    }
  }

  // Copy to clipboard function
  async function copyToClipboard(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage, 'success', 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast(successMessage, 'success', 2000);
    }
  }

  // Social sharing functions
  function shareViaEmail() {
    if (!referralData?.referral_code) {
      showToast('Please generate a referral code first', 'warning');
      return;
    }

    const subject = encodeURIComponent(`${CONFIG.BRAND_CONFIG.name} - ${CONFIG.BRAND_CONFIG.tagline} Referral`);
    const body = encodeURIComponent(`Hi there!

I've been using ${CONFIG.BRAND_CONFIG.name}'s automated trading platform and thought you might be interested. It's been great for managing my crypto portfolio with minimal effort.

When you pay your first invoice, use my referral code: ${referralData.referral_code}

This will give you access to professional automated trading strategies while I earn a small commission.

Sign up at: ${CONFIG.PAGE_CONFIG.pages.home}

Best regards`);
    
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  }


  // Filter referrals
  function filterReferrals() {
    const statusFilter = document.getElementById('status-filter').value;
    
    if (!statusFilter) {
      filteredReferrals = [...allReferrals];
    } else {
      filteredReferrals = allReferrals.filter(referral => {
        const status = getReferralStatus(referral).toLowerCase();
        return status === statusFilter;
      });
    }
    
    updateReferralTable();
    showToast(`Found ${filteredReferrals.length} matching referrals`, 'info', 2000);
  }

  // Setup event listeners
  function setupEventListeners() {
    // Navigation
    document.getElementById('back-to-dashboard').onclick = () => {
      window.location.href = '/dashboard.html';
    };

    // Generate code
    document.getElementById('generate-code-btn').onclick = generateReferralCode;

    // Copy buttons
    document.getElementById('copy-code-btn').onclick = () => {
      if (referralData?.referral_code) {
        copyToClipboard(referralData.referral_code, 'Referral code copied!');
      } else {
        showToast('No referral code to copy', 'warning');
      }
    };


    // Share buttons
    document.getElementById('share-email').onclick = shareViaEmail;

    // Filter
    document.getElementById('filter-btn').onclick = filterReferrals;

    // Load wallet information
    loadWalletInfo();

    // Setup wallet event listeners
    setupWalletEventListeners();
  }

  // === WEB3 WALLET MANAGEMENT FUNCTIONS ===

  // Web3 wallet state
  let connectedWallet = {
    address: null,
    provider: null,
    network: null,
    connectedAt: null
  };

  // Check if wallet is already connected from localStorage
  function loadStoredWalletInfo() {
    try {
      const stored = localStorage.getItem('connectedWallet');
      if (stored) {
        connectedWallet = JSON.parse(stored);
        if (connectedWallet.address) {
          updateWalletDisplay();
          showConnectedState();
        }
      }
    } catch (error) {
      console.error('Error loading stored wallet info:', error);
    }
  }

  // Store wallet info in localStorage
  function storeWalletInfo() {
    try {
      localStorage.setItem('connectedWallet', JSON.stringify(connectedWallet));
    } catch (error) {
      console.error('Error storing wallet info:', error);
    }
  }

  // Check if we're on mobile device
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // Check if MetaMask is available
  function isMetaMaskAvailable() {
    return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
  }

  // Connect to MetaMask
  async function connectMetaMask() {
    const isMobile = isMobileDevice();
    
    if (!isMetaMaskAvailable()) {
      if (isMobile) {
        // On mobile, try to open MetaMask app
        showToast('Opening MetaMask app...', 'info', 3000);
        const metamaskAppUrl = `https://metamask.app.link/dapp/${window.location.hostname}${window.location.pathname}`;
        
        // Try to open MetaMask app
        window.location.href = metamaskAppUrl;
        
        // Fallback: show instructions after a delay
        setTimeout(() => {
          if (!connectedWallet.address) {
            showToast('Please install MetaMask app or use MetaMask mobile browser.', 'warning', 8000);
          }
        }, 3000);
        
        return;
      } else {
        showToast('MetaMask is not installed. Please install MetaMask browser extension.', 'error', 6000);
        return;
      }
    }

    try {
      showToast('Connecting to MetaMask...', 'info', 3000);
      
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length === 0) {
        showToast('No accounts found. Please unlock MetaMask.', 'warning');
        return;
      }

      // Get network info
      const chainId = await window.ethereum.request({
        method: 'eth_chainId'
      });

      // Update wallet state
      connectedWallet = {
        address: accounts[0],
        provider: 'MetaMask',
        network: getNetworkName(chainId),
        connectedAt: new Date().toISOString()
      };

      // Store and update UI
      storeWalletInfo();
      updateWalletDisplay();
      showConnectedState();
      
      // Save to backend
      await saveWalletToBackend();

      showToast('Successfully connected to MetaMask!', 'success');

    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      
      if (error.code === 4001) {
        showToast('Connection cancelled by user', 'warning');
      } else if (error.code === -32002) {
        showToast('MetaMask is already processing a connection request', 'warning');
      } else {
        showToast(`Failed to connect: ${error.message}`, 'error');
      }
    }
  }

  // Connect to other wallets (generic WalletConnect or similar)
  async function connectGenericWallet() {
    const isMobile = isMobileDevice();
    
    if (isMobile) {
      // On mobile, provide deep links to popular wallets
      showToast('Choose your wallet app:', 'info', 2000);
      
      // Create wallet selection modal for mobile
      const walletOptions = [
        { name: 'Trust Wallet', url: `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(window.location.href)}` },
        { name: 'Coinbase Wallet', url: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(window.location.href)}` },
        { name: 'Rainbow', url: `https://rnbwapp.com/` },
        { name: 'MetaMask', url: `https://metamask.app.link/dapp/${window.location.hostname}${window.location.pathname}` }
      ];
      
      // Show wallet selection
      let message = 'Select your wallet:\n\n';
      walletOptions.forEach((wallet, index) => {
        message += `${index + 1}. ${wallet.name}\n`;
      });
      
      // For now, open Trust Wallet as default
      setTimeout(() => {
        window.location.href = walletOptions[0].url;
      }, 1500);
      
      showToast('Opening Trust Wallet... If you have a different wallet, please open this page in your wallet\'s browser.', 'info', 6000);
      
    } else {
      // On desktop, suggest WalletConnect (not implemented yet)
      showToast('WalletConnect integration coming soon. Please use MetaMask browser extension for now.', 'info', 5000);
    }
  }

  // Get network name from chain ID
  function getNetworkName(chainId) {
    const networks = {
      '0x1': 'Ethereum',
      '0x38': 'BSC',
      '0x89': 'Polygon',
      '0xa': 'Optimism',
      '0xa4b1': 'Arbitrum'
    };
    return networks[chainId] || 'Unknown Network';
  }

  // Format wallet address for display (first 3 + last 4 characters)
  function formatWalletAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  // Update wallet display in UI
  function updateWalletDisplay() {
    if (!connectedWallet.address) return;

    const addressElement = document.getElementById('connected-wallet-address');
    const networkBadge = document.getElementById('wallet-network-badge');
    const connectionTime = document.getElementById('connection-time');

    if (addressElement) {
      addressElement.textContent = formatWalletAddress(connectedWallet.address);
      addressElement.title = connectedWallet.address; // Show full address on hover
    }

    if (networkBadge) {
      networkBadge.textContent = connectedWallet.network || 'Ethereum';
    }

    if (connectionTime && connectedWallet.connectedAt) {
      const date = new Date(connectedWallet.connectedAt);
      connectionTime.textContent = `Connected ${date.toLocaleDateString()}`;
    }
  }

  // Show connected state
  function showConnectedState() {
    const notConnected = document.getElementById('wallet-not-connected');
    const connected = document.getElementById('wallet-connected');

    if (notConnected) notConnected.style.display = 'none';
    if (connected) connected.style.display = 'block';
  }

  // Show not connected state
  function showNotConnectedState() {
    const notConnected = document.getElementById('wallet-not-connected');
    const connected = document.getElementById('wallet-connected');

    if (notConnected) notConnected.style.display = 'block';
    if (connected) connected.style.display = 'none';
  }

  // Disconnect wallet
  function disconnectWallet() {
    connectedWallet = {
      address: null,
      provider: null,
      network: null,
      connectedAt: null
    };

    // Remove from localStorage
    localStorage.removeItem('connectedWallet');

    // Update UI
    showNotConnectedState();
    showToast('Wallet disconnected', 'info');
  }

  // Change wallet (disconnect and reconnect)
  async function changeWallet() {
    disconnectWallet();
    // Wait a moment then show connection options
    setTimeout(() => {
      showToast('Please connect a different wallet', 'info');
    }, 500);
  }

  // Save wallet address to backend
  async function saveWalletToBackend() {
    if (!connectedWallet.address) return;

    try {
      const response = await fetch(`${INVOICING_API_BASE}/wallet/update`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          wallet_address: connectedWallet.address,
          wallet_type: 'Web3',
          provider: connectedWallet.provider,
          network: connectedWallet.network
        })
      });

      if (!response.ok) {
        console.warn('Failed to save wallet to backend:', response.status);
        // Don't show error to user as this is not critical for the UI
      }
    } catch (error) {
      console.error('Error saving wallet to backend:', error);
      // Don't show error to user as this is not critical for the UI
    }
  }

  // Setup Web3 wallet event listeners
  function setupWalletEventListeners() {
    // MetaMask connection button
    const connectMetaMaskBtn = document.getElementById('connect-metamask');
    if (connectMetaMaskBtn) {
      connectMetaMaskBtn.onclick = connectMetaMask;
    }

    // Generic wallet connection button
    const connectGenericBtn = document.getElementById('connect-wallet-generic');
    if (connectGenericBtn) {
      connectGenericBtn.onclick = connectGenericWallet;
    }

    // Disconnect button
    const disconnectBtn = document.getElementById('disconnect-wallet-btn');
    if (disconnectBtn) {
      disconnectBtn.onclick = disconnectWallet;
    }

    // Change wallet button
    const changeWalletBtn = document.getElementById('change-wallet-btn');
    if (changeWalletBtn) {
      changeWalletBtn.onclick = changeWallet;
    }

    // Request verification button
    const requestVerificationBtn = document.getElementById('request-verification-btn');
    if (requestVerificationBtn) {
      requestVerificationBtn.onclick = requestWalletVerification;
    }

    // Listen for MetaMask account changes
    if (isMetaMaskAvailable()) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          // User disconnected
          disconnectWallet();
        } else if (connectedWallet.address && accounts[0] !== connectedWallet.address) {
          // User switched accounts
          connectedWallet.address = accounts[0];
          storeWalletInfo();
          updateWalletDisplay();
          saveWalletToBackend();
          showToast('Wallet account changed', 'info');
        }
      });

      window.ethereum.on('chainChanged', (chainId) => {
        if (connectedWallet.address) {
          connectedWallet.network = getNetworkName(chainId);
          storeWalletInfo();
          updateWalletDisplay();
          showToast(`Network changed to ${connectedWallet.network}`, 'info');
        }
      });
    }
  }

  // Load wallet info on page load
  async function loadWalletInfo() {
    loadStoredWalletInfo();
    
    // If no stored wallet, show not connected state
    if (!connectedWallet.address) {
      showNotConnectedState();
    }
    
    // Load backend wallet verification status
    await loadBackendWalletInfo();
  }

  // Load wallet verification status from backend
  async function loadBackendWalletInfo() {
    try {
      const response = await fetch(`${INVOICING_API_BASE}/wallet/info`, {
        headers: getAuthHeaders(token)
      });

      if (response.ok) {
        const walletInfo = await response.json();
        updateVerificationStatus(walletInfo);
      }
    } catch (error) {
      console.error('Error loading backend wallet info:', error);
    }
  }

  // Update verification status display
  function updateVerificationStatus(walletInfo) {
    if (!walletInfo || !connectedWallet.address) return;

    const statusElement = document.getElementById('wallet-verified-status');
    const connectionTime = document.getElementById('connection-time');
    const requestButton = document.getElementById('request-verification-btn');

    if (!statusElement) return;

    if (walletInfo.wallet_verified) {
      // Wallet is verified
      statusElement.textContent = '✅ Verified';
      statusElement.className = 'status-badge verified';
      if (requestButton) requestButton.style.display = 'none';
      
      if (connectionTime && walletInfo.verified_at) {
        const date = new Date(walletInfo.verified_at);
        connectionTime.textContent = `Verified ${date.toLocaleDateString()}`;
      }
    } else if (walletInfo.verification_requested) {
      // Verification requested but pending
      statusElement.textContent = '📋 Verification Requested';
      statusElement.className = 'status-badge verification-requested';
      if (requestButton) {
        requestButton.textContent = '⏳ Verification Pending';
        requestButton.disabled = true;
      }
      
      if (connectionTime && walletInfo.verification_requested_at) {
        const date = new Date(walletInfo.verification_requested_at);
        connectionTime.textContent = `Verification requested ${date.toLocaleDateString()}`;
      }
    } else {
      // Connected but not verified
      statusElement.textContent = '⏳ Unverified';
      statusElement.className = 'status-badge unverified';
      if (requestButton) {
        requestButton.style.display = 'inline-flex';
        requestButton.disabled = false;
        requestButton.textContent = '🔍 Request Verification';
      }
    }
  }

  // Request wallet verification from backend
  async function requestWalletVerification() {
    const requestButton = document.getElementById('request-verification-btn');
    const originalText = requestButton.textContent;
    
    requestButton.disabled = true;
    requestButton.textContent = 'Requesting...';
    
    try {
      const response = await fetch(`${INVOICING_API_BASE}/wallet/request-verification`, {
        method: 'POST',
        headers: getAuthHeaders(token)
      });

      if (response.ok) {
        const result = await response.json();
        showToast(result.message, 'success');
        
        // Reload wallet info to update status
        await loadBackendWalletInfo();
      } else {
        const error = await response.json();
        showToast(`Failed to request verification: ${error.detail}`, 'error');
      }
    } catch (error) {
      console.error('Error requesting wallet verification:', error);
      showToast('Failed to request verification. Please try again.', 'error');
    } finally {
      requestButton.disabled = false;
      requestButton.textContent = originalText;
    }
  }

  // Initialize the page
  initializePage();
});