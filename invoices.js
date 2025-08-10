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
    } catch (error) {
      console.error('Failed to initialize page:', error);
      showToast('Failed to load invoice data', 'error');
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
            <span class="detail-label">Referral Code:</span>
            <span class="detail-value">${invoice.referral_code}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Referral Commission:</span>
            <span class="detail-value">$${invoice.referral_commission.toFixed(2)}</span>
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
  async function createUpgradeInvoice() {
    if (!userSubscription) {
      showToast('You need an active subscription to request upgrades', 'warning');
      return;
    }

    try {
      const response = await fetch(`${INVOICING_API_BASE}/invoices/create-upgrade`, {
        method: 'POST',
        headers: getAuthHeaders(token)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      showToast('Upgrade invoice created successfully!', 'success');
      
      // Reload invoices to show the new one
      await loadInvoices();
      updateSummaryStats();
      
    } catch (error) {
      console.error('Error creating upgrade invoice:', error);
      showToast(`Failed to create upgrade invoice: ${error.message}`, 'error');
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

  // Event Listeners
  document.getElementById('back-to-dashboard').onclick = () => {
    window.location.href = '/dashboard.html';
  };

  document.getElementById('apply-filters').onclick = applyFilters;
  document.getElementById('clear-filters').onclick = clearFilters;
  document.getElementById('create-upgrade-btn').onclick = createUpgradeInvoice;
  document.getElementById('export-invoices-btn').onclick = exportInvoices;

  document.getElementById('view-subscription-btn').onclick = () => {
    if (userSubscription) {
      showToast(`Subscription: ${getTierDisplayName(userSubscription.current_tier)} (${userSubscription.status})`, 'info', 5000);
    } else {
      showToast('No active subscription found', 'warning');
    }
  };

  document.getElementById('payment-help-btn').onclick = () => {
    document.getElementById('payment-help-modal').style.display = 'block';
  };

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