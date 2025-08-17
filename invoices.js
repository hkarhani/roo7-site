// invoices.js - Invoice Management Page Logic

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
  let allInvoices = [];
  let filteredInvoices = [];
  let userSubscription = null;

  // Load initial data
  async function initializePage() {
    try {
      await Promise.all([
        loadUserSubscription(),
        loadInvoices()
      ]);
      updateSummaryStats();
      checkSubscriptionStatus();
    } catch (error) {
      console.error('Failed to initialize page:', error);
      showToast('Failed to load invoice data', 'error');
    }
  }

  // Check subscription status and show activation section if needed
  function checkSubscriptionStatus() {
    const activationSection = document.getElementById('section-activation');
    
    if (!userSubscription || userSubscription.status !== 'active') {
      activationSection.style.display = 'block';
      console.log('ℹ️ No active subscription - showing activation section');
    } else {
      activationSection.style.display = 'none';
      console.log('✅ Active subscription found - hiding activation section');
    }
  }

  // Load user subscription data
  async function loadUserSubscription() {
    try {
      const response = await fetch(`${INVOICING_API_BASE}/subscriptions/me`, {
        headers: getAuthHeaders(token)
      });

      if (response.ok) {
        userSubscription = await response.json();
        console.log('✅ Subscription loaded:', userSubscription);
      } else if (response.status === 404) {
        console.log('ℹ️ No subscription found');
        userSubscription = null;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      // Don't show error for subscription - it's optional
    }
  }

  // Load invoices
  async function loadInvoices() {
    try {
      const response = await fetch(`${INVOICING_API_BASE}/invoices/me`, {
        headers: getAuthHeaders(token)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      allInvoices = data.invoices || [];
      filteredInvoices = [...allInvoices];
      
      console.log(`✅ Loaded ${allInvoices.length} invoices`);
      updateInvoicesTable();
      
    } catch (error) {
      console.error('Error loading invoices:', error);
      showToast(`Failed to load invoices: ${error.message}`, 'error');
      
      // Show empty state
      const tbody = document.querySelector('#invoices-table tbody');
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <h3>Unable to Load Invoices</h3>
            <p>Please try refreshing the page or contact support if the problem persists.</p>
          </td>
        </tr>
      `;
    }
  }

  // Update summary statistics
  function updateSummaryStats() {
    const totalPaid = allInvoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.amount, 0);
    
    const totalOutstanding = allInvoices
      .filter(inv => ['pending', 'overdue'].includes(inv.status))
      .reduce((sum, inv) => sum + inv.amount, 0);
    
    const totalCount = allInvoices.length;
    
    const currentTier = userSubscription ? 
      getTierDisplayName(userSubscription.current_tier) : 'No Subscription';

    document.getElementById('total-paid').textContent = `$${totalPaid.toFixed(2)}`;
    document.getElementById('total-outstanding').textContent = `$${totalOutstanding.toFixed(2)}`;
    document.getElementById('total-count').textContent = totalCount;
    document.getElementById('current-tier').textContent = currentTier;
  }

  // Update invoices table
  function updateInvoicesTable() {
    const tbody = document.querySelector('#invoices-table tbody');
    
    if (filteredInvoices.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <h3>📄 No Invoices Found</h3>
            <p>No invoices match your current filters. Try adjusting your search criteria.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredInvoices.map(invoice => {
      const statusClass = `status-${invoice.status}`;
      const typeClass = `type-${invoice.invoice_type}`;
      
      return `
        <tr>
          <td><strong>${invoice.invoice_id}</strong></td>
          <td>${formatDate(invoice.invoice_date)}</td>
          <td><strong>$${invoice.amount.toFixed(2)}</strong></td>
          <td><span class="status-badge ${statusClass}">${invoice.status}</span></td>
          <td><span class="type-badge ${typeClass}">${invoice.invoice_type}</span></td>
          <td>${formatDate(invoice.due_date)}</td>
          <td class="invoice-actions">
            <button class="invoice-action-btn" onclick="viewInvoiceDetails('${invoice.invoice_id}')">
              👁️ View
            </button>
            ${invoice.status === 'paid' ? 
              `<button class="invoice-action-btn" onclick="downloadInvoice('${invoice.invoice_id}')">
                📥 Download
              </button>` : 
              `<button class="invoice-action-btn" onclick="payInvoice('${invoice.invoice_id}')">
                💳 Pay
              </button>`
            }
          </td>
        </tr>
      `;
    }).join('');
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

  // Get tier display name
  function getTierDisplayName(tier) {
    const tierMap = {
      'tier1': 'Tier 1',
      'tier2': 'Tier 2', 
      'tier3': 'Tier 3'
    };
    return tierMap[tier] || tier;
  }

  // Filter invoices
  function applyFilters() {
    const statusFilter = document.getElementById('status-filter').value;
    const typeFilter = document.getElementById('type-filter').value;
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;

    filteredInvoices = allInvoices.filter(invoice => {
      if (statusFilter && invoice.status !== statusFilter) return false;
      if (typeFilter && invoice.invoice_type !== typeFilter) return false;
      
      if (dateFrom) {
        const invoiceDate = new Date(invoice.invoice_date);
        const fromDate = new Date(dateFrom);
        if (invoiceDate < fromDate) return false;
      }
      
      if (dateTo) {
        const invoiceDate = new Date(invoice.invoice_date);
        const toDate = new Date(dateTo);
        if (invoiceDate > toDate) return false;
      }
      
      return true;
    });

    updateInvoicesTable();
    showToast(`Found ${filteredInvoices.length} matching invoices`, 'info', 2000);
  }

  // Clear filters
  function clearFilters() {
    document.getElementById('status-filter').value = '';
    document.getElementById('type-filter').value = '';
    document.getElementById('date-from').value = '';
    document.getElementById('date-to').value = '';
    
    filteredInvoices = [...allInvoices];
    updateInvoicesTable();
    showToast('Filters cleared', 'info', 2000);
  }

  // Global functions for onclick handlers
  window.viewInvoiceDetails = function(invoiceId) {
    const invoice = allInvoices.find(inv => inv.invoice_id === invoiceId);
    if (!invoice) {
      showToast('Invoice not found', 'error');
      return;
    }

    showInvoiceModal(invoice);
  };

  window.downloadInvoice = function(invoiceId) {
    showToast('Download functionality will be implemented soon', 'info');
  };

  window.payInvoice = function(invoiceId) {
    showToast('Payment functionality will be implemented soon', 'info');
  };

  // Show invoice details modal
  function showInvoiceModal(invoice) {
    const modal = document.getElementById('invoice-modal');
    const title = document.getElementById('modal-title');
    const details = document.getElementById('invoice-details');
    
    title.textContent = `Invoice ${invoice.invoice_id}`;
    
    details.innerHTML = `
      <div class="detail-group">
        <div class="detail-item">
          <span class="detail-label">Invoice ID:</span>
          <span class="detail-value">${invoice.invoice_id}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Issue Date:</span>
          <span class="detail-value">${formatDate(invoice.invoice_date)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Due Date:</span>
          <span class="detail-value">${formatDate(invoice.due_date)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Status:</span>
          <span class="detail-value">
            <span class="status-badge status-${invoice.status}">${invoice.status}</span>
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Type:</span>
          <span class="detail-value">
            <span class="type-badge type-${invoice.invoice_type}">${invoice.invoice_type}</span>
          </span>
        </div>
      </div>
      <div class="detail-group">
        <div class="detail-item">
          <span class="detail-label">Amount:</span>
          <span class="detail-value"><strong>$${invoice.amount.toFixed(2)}</strong></span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tier:</span>
          <span class="detail-value">${getTierDisplayName(invoice.tier)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Portfolio Value:</span>
          <span class="detail-value">$${invoice.portfolio_value ? invoice.portfolio_value.toFixed(2) : 'N/A'}</span>
        </div>
        ${invoice.referral_code ? `
          <div class="detail-item">
            <span class="detail-label">Referral Code Used:</span>
            <span class="detail-value">${invoice.referral_code}</span>
          </div>
        ` : ''}
        ${invoice.payment_date ? `
          <div class="detail-item">
            <span class="detail-label">Payment Date:</span>
            <span class="detail-value">${formatDate(invoice.payment_date)}</span>
          </div>
        ` : ''}
        ${invoice.notes ? `
          <div class="detail-item">
            <span class="detail-label">Notes:</span>
            <span class="detail-value">${invoice.notes}</span>
          </div>
        ` : ''}
      </div>
    `;
    
    modal.style.display = 'block';
  }

  // Create upgrade invoice
  function showSubscriptionDetails() {
    if (!userSubscription) {
      showToast('No active subscription found', 'warning');
      return;
    }

    const subscriptionStart = new Date(userSubscription.subscription_start);
    const subscriptionEnd = new Date(userSubscription.subscription_end);
    const now = new Date();
    const daysRemaining = Math.ceil((subscriptionEnd - now) / (1000 * 60 * 60 * 24));
    
    // Calculate term duration
    const termDays = Math.ceil((subscriptionEnd - subscriptionStart) / (1000 * 60 * 60 * 24));
    const termLabel = termDays <= 32 ? "Monthly" : termDays <= 366 ? "Annual" : "Custom";
    
    // Get tier information
    const tierInfo = getTierInfo(userSubscription.current_tier, userSubscription.portfolio_value);
    
    let detailsHTML = `
      <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; font-family: Arial, sans-serif;">
        <h3 style="margin: 0 0 15px 0; color: #495057;">📋 Subscription Details</h3>
        
        <div style="display: grid; gap: 12px;">
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dee2e6;">
            <strong>Current Tier:</strong>
            <span style="color: ${tierInfo.color};">${tierInfo.name}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dee2e6;">
            <strong>Status:</strong>
            <span style="color: ${userSubscription.status === 'active' ? '#28a745' : '#6c757d'}; text-transform: capitalize;">${userSubscription.status}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dee2e6;">
            <strong>Term:</strong>
            <span>${termLabel} (${termDays} days)</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dee2e6;">
            <strong>Portfolio Value:</strong>
            <span>$${userSubscription.portfolio_value.toLocaleString()}</span>
          </div>
          
          ${tierInfo.limits ? `
          <div style="background: #e7f3ff; border: 1px solid #b8daff; border-radius: 4px; padding: 10px; margin: 10px 0;">
            <strong style="color: #0c5460;">💡 ${tierInfo.name} Limits:</strong>
            <ul style="margin: 5px 0 0 20px; color: #0c5460;">
              ${tierInfo.limits.map(limit => `<li>${limit}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dee2e6;">
            <strong>Started:</strong>
            <span>${subscriptionStart.toLocaleDateString()}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dee2e6;">
            <strong>Expires:</strong>
            <span>${subscriptionEnd.toLocaleDateString()}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; padding: 8px 0;">
            <strong>Days Remaining:</strong>
            <span style="color: ${daysRemaining > 30 ? '#28a745' : daysRemaining > 7 ? '#ffc107' : '#dc3545'};">${daysRemaining} days</span>
          </div>
        </div>
      </div>
    `;
    
    showToast(detailsHTML, 'info', 10000);
  }

  function getTierInfo(tier, portfolioValue) {
    switch(tier) {
      case 'tier1':
        return {
          name: 'Tier 1 - Starter',
          color: '#007bff',
          limits: [
            'Maximum portfolio value: $10,000',
            'Monthly fee: $99 (or discounted rates)',
            'Basic trading strategies included'
          ]
        };
      case 'tier2':
        return {
          name: 'Tier 2 - Professional',
          color: '#28a745',
          limits: [
            'Portfolio value: $10,001 - $100,000',
            'Monthly fee: Based on portfolio value',
            'Advanced trading strategies included'
          ]
        };
      case 'tier3':
        return {
          name: 'Tier 3 - Enterprise',
          color: '#ffc107',
          limits: [
            'Portfolio value: $100,001+',
            'Custom pricing required',
            'Premium trading strategies included'
          ]
        };
      default:
        return {
          name: 'Unknown Tier',
          color: '#6c757d',
          limits: null
        };
    }
  }

  // Export invoices
  function exportInvoices() {
    if (filteredInvoices.length === 0) {
      showToast('No invoices to export', 'warning');
      return;
    }

    const csvContent = generateCSV(filteredInvoices);
    downloadCSV(csvContent, 'invoices_export.csv');
    showToast(`Exported ${filteredInvoices.length} invoices`, 'success');
  }

  // Generate CSV content
  function generateCSV(invoices) {
    const headers = [
      'Invoice ID', 'Date', 'Amount', 'Status', 'Type', 'Due Date', 
      'Tier', 'Portfolio Value', 'Referral Code', 'Payment Date'
    ];
    
    const rows = invoices.map(invoice => [
      invoice.invoice_id,
      invoice.invoice_date,
      invoice.amount,
      invoice.status,
      invoice.invoice_type,
      invoice.due_date,
      invoice.tier,
      invoice.portfolio_value || '',
      invoice.referral_code || '',
      invoice.payment_date || ''
    ]);

    return [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
  }

  // Download CSV file
  function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // === SUBSCRIPTION ACTIVATION FUNCTIONS ===

  // Validate portfolio for activation
  async function validatePortfolio() {
    try {
      const validateBtn = document.getElementById('validate-portfolio-btn');
      validateBtn.disabled = true;
      validateBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Validating...</span>';

      const response = await fetch(`${INVOICING_API_BASE}/subscriptions/validate-portfolio`, {
        headers: getAuthHeaders(token)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const validation = await response.json();
      displayPortfolioValidation(validation);
      
      if (validation.is_valid) {
        showToast('Portfolio validated successfully!', 'success');
        document.getElementById('activate-subscription-btn').style.display = 'inline-block';
      } else {
        showToast('No active accounts found for activation', 'warning');
      }

    } catch (error) {
      console.error('Error validating portfolio:', error);
      showToast(`Portfolio validation failed: ${error.message}`, 'error');
    } finally {
      const validateBtn = document.getElementById('validate-portfolio-btn');
      validateBtn.disabled = false;
      validateBtn.innerHTML = '<span class="btn-icon">🔍</span><span class="btn-text">Validate Portfolio</span>';
    }
  }

  // Display portfolio validation results
  function displayPortfolioValidation(validation) {
    const portfolioSection = document.getElementById('portfolio-validation');
    const portfolioDetails = document.getElementById('portfolio-details');
    
    portfolioDetails.innerHTML = `
      <div class="validation-summary">
        <div class="validation-item">
          <span class="validation-label">Total Portfolio Value:</span>
          <span class="validation-value"><strong>$${validation.total_value.toFixed(2)}</strong></span>
        </div>
        <div class="validation-item">
          <span class="validation-label">Active Accounts:</span>
          <span class="validation-value">${validation.active_accounts_count}</span>
        </div>
      </div>
      <div class="accounts-list">
        <h5>📊 Account Details</h5>
        ${validation.accounts.map(account => `
          <div class="account-item">
            <span class="account-name">${account.account_name}</span>
            <span class="account-value">$${account.current_value.toFixed(2)}</span>
            <span class="account-strategy">${account.strategy}</span>
          </div>
        `).join('')}
      </div>
    `;
    
    portfolioSection.style.display = 'block';
    
    // Calculate and display pricing
    calculateAndDisplayPricing(validation.total_value);
  }

  // Calculate and display pricing information
  function calculateAndDisplayPricing(portfolioValue) {
    const referralCode = document.getElementById('activation-referral-code').value.trim();
    const hasReferral = referralCode.length > 0;
    
    let pricing = {
      tier: '',
      base_price: 0,
      final_price: 0,
      discount: 0,
      referral_applied: false
    };

    if (portfolioValue < 10000) {
      pricing.tier = 'Tier 1';
      pricing.base_price = 1000;
      pricing.final_price = hasReferral ? 500 : 1000;
      pricing.discount = hasReferral ? 0.5 : 0;
      pricing.referral_applied = hasReferral;
    } else if (portfolioValue < 100000) {
      pricing.tier = 'Tier 2';
      pricing.base_price = hasReferral ? Math.round(portfolioValue * 0.10) : Math.round(portfolioValue * 0.08);
      pricing.final_price = hasReferral ? Math.round(portfolioValue * 0.08) : Math.round(portfolioValue * 0.10);
      pricing.discount = hasReferral ? 0.2 : 0;
      pricing.referral_applied = hasReferral;
    } else {
      pricing.tier = 'Tier 3';
      pricing.base_price = 0;
      pricing.final_price = 0;
      pricing.discount = 0;
      pricing.referral_applied = false;
    }

    displayPricingInfo(pricing);
  }

  // Display pricing information
  function displayPricingInfo(pricing) {
    const pricingSection = document.getElementById('pricing-info');
    const pricingDetails = document.getElementById('pricing-details');
    
    if (pricing.tier === 'Tier 3') {
      pricingDetails.innerHTML = `
        <div class="pricing-notice custom-pricing">
          <h5>🎯 Custom Pricing Required</h5>
          <p>Your portfolio value requires custom pricing. Please contact our support team for a personalized quote.</p>
          <div class="contact-info">
            <p>📧 Email: billing@roo7.site</p>
            <p>💬 Live Chat: Available 24/7</p>
          </div>
        </div>
      `;
      document.getElementById('activate-subscription-btn').style.display = 'none';
    } else {
      pricingDetails.innerHTML = `
        <div class="pricing-breakdown">
          <div class="pricing-item">
            <span class="pricing-label">Subscription Tier:</span>
            <span class="pricing-value">${pricing.tier}</span>
          </div>
          ${pricing.discount > 0 ? `
            <div class="pricing-item">
              <span class="pricing-label">Base Price:</span>
              <span class="pricing-value strikethrough">$${pricing.base_price.toFixed(2)}</span>
            </div>
            <div class="pricing-item discount">
              <span class="pricing-label">Discount (${(pricing.discount * 100).toFixed(0)}%):</span>
              <span class="pricing-value">-$${(pricing.base_price - pricing.final_price).toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="pricing-item final">
            <span class="pricing-label">Final Price:</span>
            <span class="pricing-value"><strong>$${pricing.final_price.toFixed(2)} USDT</strong></span>
          </div>
          ${pricing.referral_applied ? `
            <div class="pricing-notice">
              <span class="referral-success">🎉 Referral discount applied!</span>
            </div>
          ` : ''}
        </div>
      `;
    }
    
    pricingSection.style.display = 'block';
  }

  // Activate subscription
  async function activateSubscription() {
    try {
      const activateBtn = document.getElementById('activate-subscription-btn');
      activateBtn.disabled = true;
      activateBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Activating...</span>';

      const referralCode = document.getElementById('activation-referral-code').value.trim();
      
      const activationData = {
        referral_code: referralCode || null,
        notes: 'Subscription activated via invoices page'
      };

      const response = await fetch(`${INVOICING_API_BASE}/subscriptions/activate`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(activationData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      showToast('🎉 Subscription activated successfully!', 'success', 6000);
      
      // Reload page data
      await initializePage();
      
      // Show invoice details
      if (result.invoice) {
        setTimeout(() => {
          showToast(`Invoice ${result.invoice.invoice_id} created for $${result.invoice.amount.toFixed(2)}`, 'info', 5000);
        }, 1000);
      }

    } catch (error) {
      console.error('Error activating subscription:', error);
      showToast(`Activation failed: ${error.message}`, 'error');
    } finally {
      const activateBtn = document.getElementById('activate-subscription-btn');
      activateBtn.disabled = false;
      activateBtn.innerHTML = '<span class="btn-icon">🚀</span><span class="btn-text">Activate Subscription</span>';
    }
  }

  // Validate referral code
  async function validateReferralCode() {
    const referralCode = document.getElementById('activation-referral-code').value.trim();
    const referralMessage = document.getElementById('referral-message');
    
    if (!referralCode) {
      referralMessage.innerHTML = '';
      return;
    }

    // Simple client-side validation
    if (referralCode.length < 6 || referralCode.length > 12) {
      referralMessage.innerHTML = '<span class="referral-error">❌ Invalid referral code format</span>';
      return;
    }

    referralMessage.innerHTML = '<span class="referral-info">✅ Referral code format valid</span>';
    
    // Recalculate pricing if portfolio is already validated
    const portfolioSection = document.getElementById('portfolio-validation');
    if (portfolioSection.style.display === 'block') {
      const totalValueElement = document.querySelector('.validation-value strong');
      if (totalValueElement) {
        const portfolioValue = parseFloat(totalValueElement.textContent.replace('$', '').replace(',', ''));
        calculateAndDisplayPricing(portfolioValue);
      }
    }
  }

  // Event Listeners
  document.getElementById('back-to-dashboard').onclick = () => {
    window.location.href = '/dashboard.html';
  };

  document.getElementById('apply-filters').onclick = applyFilters;
  document.getElementById('clear-filters').onclick = clearFilters;
  document.getElementById('export-invoices-btn').onclick = exportInvoices;

  document.getElementById('view-subscription-btn').onclick = showSubscriptionDetails;

  document.getElementById('payment-help-btn').onclick = () => {
    document.getElementById('payment-help-modal').style.display = 'block';
  };

  // Subscription activation event listeners
  document.getElementById('validate-portfolio-btn').onclick = validatePortfolio;
  document.getElementById('activate-subscription-btn').onclick = activateSubscription;
  document.getElementById('validate-referral-btn').onclick = validateReferralCode;
  
  // Real-time referral code validation
  document.getElementById('activation-referral-code').addEventListener('input', validateReferralCode);

  // Modal event listeners
  document.getElementById('close-invoice-modal').onclick = () => {
    document.getElementById('invoice-modal').style.display = 'none';
  };

  document.getElementById('close-help-modal').onclick = () => {
    document.getElementById('payment-help-modal').style.display = 'none';
  };

  document.getElementById('download-invoice').onclick = () => {
    showToast('Download functionality will be implemented soon', 'info');
  };

  document.getElementById('print-invoice').onclick = () => {
    window.print();
  };

  // Close modals when clicking outside
  window.onclick = (event) => {
    const invoiceModal = document.getElementById('invoice-modal');
    const helpModal = document.getElementById('payment-help-modal');
    
    if (event.target === invoiceModal) {
      invoiceModal.style.display = 'none';
    }
    if (event.target === helpModal) {
      helpModal.style.display = 'none';
    }
  };

  // Initialize the page
  console.log('🚀 Initializing invoices page...');
  initializePage();
});