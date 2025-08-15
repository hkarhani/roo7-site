// referrals.js - Referral Program Page Logic

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api.roo7.site";
  const INVOICING_API_BASE = "https://api.roo7.site:8003";

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

  // Load initial data
  async function initializePage() {
    try {
      await loadReferralData();
      updateUI();
      setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize page:', error);
      showToast('Failed to load referral data', 'error');
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
          console.log('ℹ️ No referral data found - user hasn\'t generated code yet');
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      referralData = await response.json();
      allReferrals = referralData.referred_users || [];
      filteredReferrals = [...allReferrals];
      
      console.log('✅ Referral data loaded:', referralData);
      
    } catch (error) {
      console.error('Error loading referral data:', error);
      showToast(`Failed to load referral data: ${error.message}`, 'error');
      
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
    const linkInput = document.getElementById('referral-link-input');
    
    if (referralData.referral_code) {
      codeInput.value = referralData.referral_code;
      linkInput.value = referralData.referral_link;
      codeInput.placeholder = referralData.referral_code;
      linkInput.placeholder = referralData.referral_link;
    } else {
      codeInput.placeholder = 'No code generated yet';
      linkInput.placeholder = 'Generate a code to get your link';
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
      console.log('🔄 Generating referral code...');
      console.log('📡 API URL:', `${INVOICING_API_BASE}/referrals/generate-code`);
      console.log('🔑 Token exists:', !!token);
      
      const response = await fetch(`${INVOICING_API_BASE}/referrals/generate-code`, {
        method: 'POST',
        headers: getAuthHeaders(token)
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

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
      console.log('✅ Response data:', data);
      
      if (data.referral_code) {
        // Update local data
        referralData.referral_code = data.referral_code;
        referralData.referral_link = `https://www.roo7.site/signup?ref=${data.referral_code}`;
        
        console.log('✅ Updated referral data:', {
          code: referralData.referral_code,
          link: referralData.referral_link
        });
        
        // Update UI
        updateUI();
        
        showToast('Referral code generated successfully!', 'success');
      } else {
        console.error('❌ Invalid response - no referral_code field:', data);
        throw new Error('Invalid response from server - missing referral_code');
      }
      
    } catch (error) {
      console.error('❌ Error generating referral code:', error);
      showToast(`Failed to generate code: ${error.message}`, 'error');
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
    if (!referralData?.referral_link) {
      showToast('Please generate a referral code first', 'warning');
      return;
    }

    const subject = encodeURIComponent('Join me on ROO7 - Automated Trading Platform');
    const body = encodeURIComponent(`Hi there!

I've been using ROO7's automated trading platform and thought you might be interested. It's been great for managing my crypto portfolio with minimal effort.

Use my referral link to sign up: ${referralData.referral_link}

Let me know if you have any questions!

Best regards`);
    
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  }

  function shareViaTwitter() {
    if (!referralData?.referral_link) {
      showToast('Please generate a referral code first', 'warning');
      return;
    }

    const text = encodeURIComponent(`Just discovered ROO7's automated trading platform! 🚀 Perfect for hands-off crypto portfolio management. Check it out: ${referralData.referral_link} #CryptoTrading #AutomatedInvesting #ROO7`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  }

  function shareViaLinkedIn() {
    if (!referralData?.referral_link) {
      showToast('Please generate a referral code first', 'warning');
      return;
    }

    const url = encodeURIComponent(referralData.referral_link);
    const title = encodeURIComponent('ROO7 - Automated Trading Platform');
    const summary = encodeURIComponent('Professional automated trading platform for crypto portfolio management');
    
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}&summary=${summary}`, '_blank');
  }

  function shareViaWhatsApp() {
    if (!referralData?.referral_link) {
      showToast('Please generate a referral code first', 'warning');
      return;
    }

    const text = encodeURIComponent(`Hey! I've been using ROO7 for automated crypto trading and it's been amazing. You should check it out: ${referralData.referral_link}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
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

    document.getElementById('copy-link-btn').onclick = () => {
      if (referralData?.referral_link) {
        copyToClipboard(referralData.referral_link, 'Referral link copied!');
      } else {
        showToast('No referral link to copy', 'warning');
      }
    };

    // Share buttons
    document.getElementById('share-email').onclick = shareViaEmail;
    document.getElementById('share-twitter').onclick = shareViaTwitter;
    document.getElementById('share-linkedin').onclick = shareViaLinkedIn;
    document.getElementById('share-whatsapp').onclick = shareViaWhatsApp;

    // Filter
    document.getElementById('filter-btn').onclick = filterReferrals;

    // FAQ toggles
    setupFAQToggles();
  }

  // Setup FAQ toggles
  function setupFAQToggles() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
      const question = item.querySelector('.faq-question');
      
      question.onclick = () => {
        const isActive = item.classList.contains('active');
        
        // Close all other FAQ items
        faqItems.forEach(otherItem => {
          otherItem.classList.remove('active');
        });
        
        // Toggle current item
        if (!isActive) {
          item.classList.add('active');
        }
      };
    });
  }

  // Initialize the page
  console.log('🚀 Initializing referrals page...');
  initializePage();
});