// invoices.js - Invoice Management Page Logic
import CONFIG, { FEATURE_FLAGS } from './frontend-config.js';

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
  let allInvoices = [];
  let filteredInvoices = [];
  let userSubscription = null;
  let currentAUMData = null;

  // Load initial data
  async function initializePage() {
    try {
      const results = await Promise.all([
        loadUserSubscription(),
        loadInvoices(),
        loadCurrentAUM()
      ]);
      
      // Store AUM data from the third promise result
      currentAUMData = results[2];
      
      updateSummaryStats();
      updateAUMDisplay();
      updatePricingCalculator();
      checkSubscriptionStatus();
    } catch (error) {
      console.error('Failed to initialize page:', error);
      showToast('Failed to load invoice data', 'error');
    }
  }

  // Check subscription status and show invoice request section if needed
  function checkSubscriptionStatus() {
    const invoiceRequestSection = document.getElementById('section-subscription-management');
    
    if (!userSubscription || userSubscription.status !== 'active') {
      // Show invoice request section for users without active subscription
      invoiceRequestSection.style.display = 'block';
    } else {
      // User has active subscription - hide invoice request section
      invoiceRequestSection.style.display = 'none';
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
      } else if (response.status === 404) {
        userSubscription = null;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      // Don't show error for subscription - it's optional
    }
  }

  // Load current 7-day average AUM
  async function loadCurrentAUM() {
    try {
      const response = await fetch(`${INVOICING_API_BASE}/subscriptions/aum`, {
        headers: getAuthHeaders(token)
      });
      
      if (response.ok) {
        const aumData = await response.json();
        console.log('7-day AUM data:', aumData);
        return aumData;
      } else {
        console.warn('Failed to load AUM data:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Error loading AUM data:', error);
      return null;
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

    // Update stats with null checks to prevent DOM errors
    const totalPaidElement = document.getElementById('total-paid');
    const totalOutstandingElement = document.getElementById('total-outstanding');
    const totalCountElement = document.getElementById('total-count');
    
    if (totalPaidElement) {
      totalPaidElement.textContent = `$${totalPaid.toFixed(2)}`;
    }
    if (totalOutstandingElement) {
      totalOutstandingElement.textContent = `$${totalOutstanding.toFixed(2)}`;
    }
    if (totalCountElement) {
      totalCountElement.textContent = totalCount;
    }
    
  }

  // Update AUM displays with real 7-day average data
  function updateAUMDisplay() {
    const currentAumElement = document.getElementById('current-aum');
    const userAumDisplayElement = document.getElementById('user-aum-display');
    
    if (currentAUMData && currentAUMData.aum_7day_avg !== undefined) {
      const aumValue = `$${currentAUMData.aum_7day_avg.toFixed(2)}`;
      
      // Update top stats display
      if (currentAumElement) {
        currentAumElement.textContent = aumValue;
      }
      
      // Update pricing calculator display
      if (userAumDisplayElement) {
        userAumDisplayElement.textContent = aumValue;
      }
      
      console.log('Updated AUM displays with 7-day average:', aumValue);
    } else {
      // Fallback to $0.00 if no AUM data
      if (currentAumElement) {
        currentAumElement.textContent = '$0.00';
      }
      if (userAumDisplayElement) {
        userAumDisplayElement.textContent = '$0.00';
      }
    }
  }

  // Update pricing calculator based on real AUM
  function updatePricingCalculator() {
    const baseFeeElement = document.getElementById('base-fee-display');
    const referralFeeElement = document.getElementById('referral-fee-display');
    
    if (currentAUMData && currentAUMData.aum_7day_avg !== undefined) {
      const aum = currentAUMData.aum_7day_avg;
      
      // Calculate pricing based on 2025 model
      let baseFee, referralFee, savings;
      
      if (aum < 10000) {
        baseFee = 600;
        referralFee = 500;
        savings = 100;
      } else {
        baseFee = Math.round(aum * 0.072);  // 7.2% of AUM
        referralFee = Math.round(aum * 0.06);  // 6% of AUM with referral
        savings = baseFee - referralFee;
      }
      
      // Update displays
      if (baseFeeElement) {
        baseFeeElement.textContent = `$${baseFee.toLocaleString()}`;
      }
      if (referralFeeElement) {
        referralFeeElement.innerHTML = `$${referralFee.toLocaleString()} <span style="color: #059669;">(Save $${savings.toLocaleString()})</span>`;
      }
      
      console.log('Updated pricing calculator:', { aum, baseFee, referralFee, savings });
    } else {
      // Reset to $0 if no AUM data
      if (baseFeeElement) {
        baseFeeElement.textContent = '$0.00';
      }
      if (referralFeeElement) {
        referralFeeElement.textContent = '$0.00';
      }
    }
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
              `<button class="invoice-action-btn delete-btn" onclick="deleteInvoice('${invoice._id}')">
                🗑️ Delete
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

  // Filter invoices with null checks
  function applyFilters() {
    const statusFilterEl = document.getElementById('status-filter');
    const typeFilterEl = document.getElementById('type-filter');
    const dateFromEl = document.getElementById('date-from');
    const dateToEl = document.getElementById('date-to');
    
    const statusFilter = statusFilterEl ? statusFilterEl.value : '';
    const typeFilter = typeFilterEl ? typeFilterEl.value : '';
    const dateFrom = dateFromEl ? dateFromEl.value : '';
    const dateTo = dateToEl ? dateToEl.value : '';

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

  // Clear filters with null checks
  function clearFilters() {
    const statusFilterEl = document.getElementById('status-filter');
    const typeFilterEl = document.getElementById('type-filter');
    const dateFromEl = document.getElementById('date-from');
    const dateToEl = document.getElementById('date-to');
    
    if (statusFilterEl) statusFilterEl.value = '';
    if (typeFilterEl) typeFilterEl.value = '';
    if (dateFromEl) dateFromEl.value = '';
    if (dateToEl) dateToEl.value = '';
    
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

  window.deleteInvoice = async function(invoiceId) {
    if (!confirm('⚠️ Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return;
    }
    
    try {
      console.log('Deleting invoice with ID:', invoiceId);
      
      const response = await fetch(`${INVOICING_API_BASE}/invoices/${invoiceId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token)
      });

      if (response.ok) {
        const result = await response.json();
        showToast('✅ Invoice deleted successfully! You can now request a new one.', 'success');
        loadInvoices(); // Reload the invoice list
      } else {
        const error = await response.json();
        showToast(`❌ Failed to delete invoice: ${error.detail}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      showToast('❌ Error deleting invoice. Please try again.', 'error');
    }
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

  // === SUBSCRIPTION ACTIVATION FUNCTIONS (Cleaned up) ===

  // Activate subscription (updated for new flow)
  async function activateSubscription() {
    try {
      // Check for new flow button first, fallback to old (for backward compatibility during transition)
      const activateBtn = document.getElementById('activate-with-pricing-btn') || document.getElementById('activate-subscription-btn');
      if (!activateBtn) {
        throw new Error('Activation button not found');
      }
      
      activateBtn.disabled = true;
      activateBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Activating...</span>';

      // Get referral code from new flow input, fallback to old
      const newReferralInput = document.getElementById('new-referral-code');
      const oldReferralInput = document.getElementById('activation-referral-code');
      const referralCode = (newReferralInput?.value || oldReferralInput?.value || '').trim();
      
      const activationData = {
        referral_code: referralCode || null,
        notes: 'Subscription activated via new invoice flow'
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
      // Reset button state
      const activateBtn = document.getElementById('activate-with-pricing-btn') || document.getElementById('activate-subscription-btn');
      if (activateBtn) {
        activateBtn.disabled = false;
        activateBtn.innerHTML = '<span class="btn-icon">🚀</span><span class="btn-text">Activate Subscription</span>';
      }
    }
  }


  // === NEW INVOICE REQUEST FUNCTIONS ===

  // Request invoice with auto-troubleshooting
  async function requestInvoiceWithAutoTroubleshoot() {
    try {
      const requestBtn = document.getElementById('request-invoice-btn');
      requestBtn.disabled = true;
      requestBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Processing...</span>';

      const response = await fetch(`${INVOICING_API_BASE}${CONFIG.API_CONFIG.endpoints.requestInvoice}`, {
        method: 'POST',
        headers: getAuthHeaders(token)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        displayAutoTroubleshootResults(result.auto_troubleshoot_result);
        displayInvoicePreview(result.preliminary_invoice);
        showReferralSection();
        showToast('✅ Invoice request processed successfully!', 'success');
      } else {
        throw new Error(result.error || 'Invoice request failed');
      }

    } catch (error) {
      console.error('Error requesting invoice:', error);
      showToast(`Invoice request failed: ${error.message}`, 'error');
    } finally {
      const requestBtn = document.getElementById('request-invoice-btn');
      requestBtn.disabled = false;
      requestBtn.innerHTML = '<span class="btn-icon">📄</span><span class="btn-text">Request Invoice</span>';
    }
  }

  // Display auto-troubleshoot results
  function displayAutoTroubleshootResults(troubleshootResult) {
    const autoTroubleshootSection = document.getElementById('auto-troubleshoot-info');
    const autoTroubleshootDetails = document.getElementById('auto-troubleshoot-details');
    
    if (!troubleshootResult) return;
    
    const { successful_troubleshoots, total_accounts_processed, troubleshoot_results, total_value_discovered } = troubleshootResult;
    
    autoTroubleshootDetails.innerHTML = `
      <div class="validation-summary">
        <div class="validation-item">
          <span class="validation-label">Accounts Analyzed:</span>
          <span class="validation-value">${total_accounts_processed}</span>
        </div>
        <div class="validation-item">
          <span class="validation-label">Successfully Updated:</span>
          <span class="validation-value">${successful_troubleshoots}</span>
        </div>
        <div class="validation-item">
          <span class="validation-label">Total Value Discovered:</span>
          <span class="validation-value"><strong>$${total_value_discovered.toFixed(2)}</strong></span>
        </div>
      </div>
      ${troubleshoot_results.length > 0 ? `
        <div class="accounts-list">
          <h5>📊 Account Analysis Details</h5>
          ${troubleshoot_results.map(result => `
            <div class="account-item ${result.success ? 'success' : 'failed'}">
              <span class="account-name">${result.account_name}</span>
              <span class="account-value">${result.success ? `$${result.current_value?.toFixed(2) || '0.00'}` : 'Failed'}</span>
              <span class="account-strategy">${result.message}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
    
    autoTroubleshootSection.style.display = 'block';
  }

  // Display invoice preview
  function displayInvoicePreview(preliminaryInvoice) {
    const invoiceSection = document.getElementById('preliminary-invoice');
    const invoiceDetails = document.getElementById('invoice-preview-details');
    
    if (!preliminaryInvoice) return;
    
    const { portfolio_value, tier, base_price, current_price, is_first_time_user } = preliminaryInvoice;
    
    invoiceDetails.innerHTML = `
      <div class="pricing-breakdown">
        <div class="pricing-item">
          <span class="pricing-label">Portfolio Value:</span>
          <span class="pricing-value">$${portfolio_value.toFixed(2)}</span>
        </div>
        <div class="pricing-item">
          <span class="pricing-label">Subscription Tier:</span>
          <span class="pricing-value">${getTierDisplayName(tier)}</span>
        </div>
        <div class="pricing-item">
          <span class="pricing-label">Base Price:</span>
          <span class="pricing-value">$${base_price.toFixed(2)} USDT</span>
        </div>
        <div class="pricing-item final">
          <span class="pricing-label">Current Price:</span>
          <span class="pricing-value"><strong>$${current_price.toFixed(2)} USDT</strong></span>
        </div>
        ${is_first_time_user ? `
          <div class="pricing-notice">
            <span class="referral-success">🎉 First-time user - eligible for referral discounts!</span>
          </div>
        ` : ''}
      </div>
    `;
    
    // Store preliminary invoice data for later use
    window.preliminaryInvoiceData = preliminaryInvoice;
    
    // Show activation button when invoice preview is ready
    const activateBtn = document.getElementById('activate-with-pricing-btn');
    if (activateBtn) {
      activateBtn.style.display = 'inline-block';
    }
    
    invoiceSection.style.display = 'block';
  }

  // Show referral section after invoice preview
  function showReferralSection() {
    const referralSection = document.getElementById('new-referral-section');
    referralSection.style.display = 'block';
  }

  // Validate new referral code and update pricing
  async function validateNewReferralCode() {
    const referralCode = document.getElementById('new-referral-code').value.trim();
    const referralMessage = document.getElementById('new-referral-message');
    
    if (!referralCode) {
      referralMessage.innerHTML = '';
      // Reset to original pricing
      if (window.preliminaryInvoiceData) {
        displayUpdatedPricing(null, window.preliminaryInvoiceData);
      }
      // Ensure activation button is still visible for non-referral activation
      const activateBtn = document.getElementById('activate-with-pricing-btn');
      if (activateBtn) {
        activateBtn.style.display = 'inline-block';
      }
      return;
    }

    if (!window.preliminaryInvoiceData) {
      referralMessage.innerHTML = '<span class="referral-error">❌ Please request invoice first</span>';
      return;
    }

    try {
      const validateBtn = document.getElementById('validate-new-referral-btn');
      validateBtn.disabled = true;
      validateBtn.textContent = 'Validating...';

      const response = await fetch(`${INVOICING_API_BASE}${CONFIG.API_CONFIG.endpoints.calculatePricing}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          portfolio_value: window.preliminaryInvoiceData.portfolio_value,
          referral_code: referralCode
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        referralMessage.innerHTML = `<span class="referral-info">✅ Valid referral code from ${result.referrer_info?.username || 'verified user'}</span>`;
        displayUpdatedPricing(result.pricing, window.preliminaryInvoiceData);
        showToast('🎉 Referral discount applied!', 'success');
        
        // Show activate button
        document.getElementById('activate-with-pricing-btn').style.display = 'inline-block';
      } else {
        throw new Error(result.error || 'Referral validation failed');
      }

    } catch (error) {
      console.error('Error validating referral:', error);
      referralMessage.innerHTML = `<span class="referral-error">❌ ${error.message}</span>`;
    } finally {
      const validateBtn = document.getElementById('validate-new-referral-btn');
      validateBtn.disabled = false;
      validateBtn.textContent = 'Validate & Apply Discount';
    }
  }

  // Display updated pricing with referral discount
  function displayUpdatedPricing(newPricing, originalInvoice) {
    const updatedPricingSection = document.getElementById('updated-pricing');
    const updatedPricingDetails = document.getElementById('updated-pricing-details');
    
    if (!newPricing) {
      // Show original pricing
      updatedPricingDetails.innerHTML = `
        <div class="pricing-breakdown">
          <div class="pricing-item final">
            <span class="pricing-label">Price:</span>
            <span class="pricing-value"><strong>$${originalInvoice.current_price.toFixed(2)} USDT</strong></span>
          </div>
        </div>
      `;
    } else {
      // Show pricing with discount
      const hasDiscount = newPricing.discount > 0;
      
      updatedPricingDetails.innerHTML = `
        <div class="pricing-breakdown">
          ${hasDiscount ? `
            <div class="pricing-item">
              <span class="pricing-label">Original Price:</span>
              <span class="pricing-value strikethrough">$${newPricing.base_price.toFixed(2)}</span>
            </div>
            <div class="pricing-item discount">
              <span class="pricing-label">Referral Discount (${(newPricing.discount * 100).toFixed(0)}%):</span>
              <span class="pricing-value">-$${newPricing.discount_amount.toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="pricing-item final">
            <span class="pricing-label">Final Price:</span>
            <span class="pricing-value"><strong>$${newPricing.final_price.toFixed(2)} USDT</strong></span>
          </div>
          ${hasDiscount ? `
            <div class="pricing-notice">
              <span class="referral-success">🎉 You save $${newPricing.discount_amount.toFixed(2)} with this referral!</span>
            </div>
          ` : ''}
        </div>
      `;
      
      // Store updated pricing
      window.updatedPricingData = newPricing;
    }
    
    updatedPricingSection.style.display = 'block';
  }

  // Event Listeners (with null checks)
  const backToDashboardBtn = document.getElementById('back-to-dashboard');
  const applyFiltersBtn = document.getElementById('apply-filters');
  const clearFiltersBtn = document.getElementById('clear-filters');
  const exportInvoicesBtn = document.getElementById('export-invoices-btn');
  const viewSubscriptionBtn = document.getElementById('view-subscription-btn');
  const paymentHelpBtn = document.getElementById('payment-help-btn');

  if (backToDashboardBtn) {
    backToDashboardBtn.onclick = () => {
      window.location.href = '/dashboard.html';
    };
  }

  if (applyFiltersBtn) {
    applyFiltersBtn.onclick = applyFilters;
  }

  if (clearFiltersBtn) {
    clearFiltersBtn.onclick = clearFilters;
  }

  if (exportInvoicesBtn) {
    exportInvoicesBtn.onclick = exportInvoices;
  }

  if (viewSubscriptionBtn) {
    viewSubscriptionBtn.onclick = showSubscriptionDetails;
  }

  if (paymentHelpBtn) {
    paymentHelpBtn.onclick = () => {
      const paymentHelpModal = document.getElementById('payment-help-modal');
      if (paymentHelpModal) {
        paymentHelpModal.style.display = 'block';
      }
    };
  }

  // Invoice request flow event listeners (with null checks)
  const requestInvoiceBtn = document.getElementById('request-invoice-btn');
  const validateNewReferralBtn = document.getElementById('validate-new-referral-btn');
  const activateWithPricingBtn = document.getElementById('activate-with-pricing-btn');
  const newReferralCodeInput = document.getElementById('new-referral-code');

  if (requestInvoiceBtn) {
    requestInvoiceBtn.onclick = requestInvoiceWithAutoTroubleshoot;
  } else {
    console.warn('⚠️ request-invoice-btn element not found - check if HTML is updated');
  }

  if (validateNewReferralBtn) {
    validateNewReferralBtn.onclick = validateNewReferralCode;
  } else {
    console.warn('⚠️ validate-new-referral-btn element not found - check if HTML is updated');
  }

  if (activateWithPricingBtn) {
    activateWithPricingBtn.onclick = activateSubscription;
  } else {
    console.warn('⚠️ activate-with-pricing-btn element not found - check if HTML is updated');
  }
  
  // Real-time referral code validation
  if (newReferralCodeInput) {
    newReferralCodeInput.addEventListener('input', validateNewReferralCode);
  } else {
    console.warn('⚠️ new-referral-code input element not found - check if HTML is updated');
  }

  // Modal event listeners (with null checks)
  const closeInvoiceModalBtn = document.getElementById('close-invoice-modal');
  const closeHelpModalBtn = document.getElementById('close-help-modal');
  const downloadInvoiceBtn = document.getElementById('download-invoice');
  const printInvoiceBtn = document.getElementById('print-invoice');

  if (closeInvoiceModalBtn) {
    closeInvoiceModalBtn.onclick = () => {
      const invoiceModal = document.getElementById('invoice-modal');
      if (invoiceModal) {
        invoiceModal.style.display = 'none';
      }
    };
  }

  if (closeHelpModalBtn) {
    closeHelpModalBtn.onclick = () => {
      const paymentHelpModal = document.getElementById('payment-help-modal');
      if (paymentHelpModal) {
        paymentHelpModal.style.display = 'none';
      }
    };
  }

  if (downloadInvoiceBtn) {
    downloadInvoiceBtn.onclick = () => {
      showToast('Download functionality will be implemented soon', 'info');
    };
  }

  if (printInvoiceBtn) {
    printInvoiceBtn.onclick = () => {
      window.print();
    };
  }

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
  initializePage();
});