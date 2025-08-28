// Audit Management Dashboard JavaScript

import CONFIG from './frontend-config.js';

// Get API URL from config
const getApiUrl = () => {
    return CONFIG?.API_CONFIG?.authUrl || CONFIG?.API_URL || 'https://api.roo7.site:443';
};

class AuditManagement {
    constructor() {
        this.currentPage = 1;
        this.totalPages = 1;
        this.totalResults = 0;
        this.selectedAudits = new Set();
        this.currentFilters = {};
        this.audits = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInitialData();
        this.setupTheme();
        this.setDefaultDates();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('back-to-jobs')?.addEventListener('click', () => {
            window.location.href = 'admin-jobs-manager.html';
        });
        
        document.getElementById('back-to-admin')?.addEventListener('click', () => {
            window.location.href = 'admin-dashboard.html';
        });
        
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userRole');
            window.location.href = 'auth.html';
        });

        // Theme toggle
        document.getElementById('toggle-theme')?.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            localStorage.setItem('darkMode', document.body.classList.contains('dark-theme'));
        });

        // Filter actions
        document.getElementById('apply-filters')?.addEventListener('click', () => {
            this.applyFilters();
        });
        
        document.getElementById('clear-filters')?.addEventListener('click', () => {
            this.clearFilters();
        });

        // Refresh buttons
        document.getElementById('refresh-stats')?.addEventListener('click', () => {
            this.loadAuditStats();
        });
        
        document.getElementById('refresh-audits')?.addEventListener('click', () => {
            this.loadAudits();
        });

        // Bulk actions
        document.getElementById('select-all-audits')?.addEventListener('click', () => {
            this.selectAllVisible();
        });
        
        document.getElementById('deselect-all-audits')?.addEventListener('click', () => {
            this.deselectAll();
        });
        
        document.getElementById('bulk-delete-selected')?.addEventListener('click', () => {
            this.showBulkDeleteConfirmation();
        });
        
        document.getElementById('export-selected')?.addEventListener('click', () => {
            this.exportSelected();
        });

        // Results per page
        document.getElementById('results-per-page')?.addEventListener('change', (e) => {
            this.currentPage = 1;
            this.loadAudits();
        });

        // Modal events
        document.getElementById('close-delete-modal')?.addEventListener('click', () => {
            this.hideDeleteConfirmation();
        });
        
        document.getElementById('cancel-delete')?.addEventListener('click', () => {
            this.hideDeleteConfirmation();
        });
        
        document.getElementById('confirm-delete')?.addEventListener('click', () => {
            this.executeDelete();
        });

        document.getElementById('close-detail-modal')?.addEventListener('click', () => {
            this.hideAuditDetail();
        });
        
        document.getElementById('close-detail-modal-btn')?.addEventListener('click', () => {
            this.hideAuditDetail();
        });
        
        document.getElementById('delete-single-audit')?.addEventListener('click', () => {
            this.deleteSingleAudit();
        });
    }

    setupTheme() {
        const darkMode = localStorage.getItem('darkMode') === 'true';
        if (darkMode) {
            document.body.classList.add('dark-theme');
        }
    }

    setDefaultDates() {
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        document.getElementById('date-from').value = weekAgo.toISOString().split('T')[0];
        document.getElementById('date-to').value = today.toISOString().split('T')[0];
    }

    formatDateTime(dateString) {
        if (!dateString) return 'N/A';
        if (typeof dateString !== 'string') return 'Invalid date';
        
        try {
            // Handle both ISO strings with and without timezone indicators
            let dateToFormat = dateString;
            
            // If the string doesn't end with 'Z' and doesn't contain timezone info,
            // and it looks like an ISO string, treat it as UTC
            if (dateString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) && 
                !dateString.endsWith('Z') && 
                !dateString.includes('+') && 
                !dateString.includes('-', 10)) {
                dateToFormat = dateString + 'Z';
            }
            
            const date = new Date(dateToFormat);
            
            // Check if date is valid
            if (isNaN(date.getTime())) {
                console.warn('Invalid date string:', dateString);
                return 'Invalid date';
            }
            
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZoneName: 'short'
            });
        } catch (error) {
            console.error('Error formatting date:', dateString, error);
            return 'Invalid date';
        }
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadAccountOptions(),
                this.loadUserOptions(),
                this.loadAuditStats(),
                this.loadAudits()
            ]);
        } catch (error) {
            logger.error('Failed to load initial data:', error);
            this.showError('Failed to load initial data');
        }
    }

    async loadAccountOptions() {
        try {
            const response = await fetch(`${getApiUrl()}/admin/accounts`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (response.ok) {
                const accounts = await response.json();
                const select = document.getElementById('account-filter');
                
                accounts.forEach(account => {
                    const option = document.createElement('option');
                    option.value = account._id;
                    option.textContent = `${account.account_name} (${account._id})`;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            logger.error('Failed to load account options:', error);
        }
    }

    async loadUserOptions() {
        try {
            const response = await fetch(`${getApiUrl()}/admin/users`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (response.ok) {
                const users = await response.json();
                const select = document.getElementById('user-filter');
                
                users.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user._id;
                    option.textContent = `${user.username} (${user._id})`;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            logger.error('Failed to load user options:', error);
        }
    }

    async loadAuditStats() {
        try {
            const container = document.getElementById('audit-stats-container');
            container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div>Loading statistics...</div>';

            const response = await fetch(`${getApiUrl()}/admin/jobs-manager/audit-stats`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (response.ok) {
                const stats = await response.json();
                this.renderAuditStats(stats);
            } else {
                throw new Error('Failed to load stats');
            }
        } catch (error) {
            logger.error('Failed to load audit stats:', error);
            document.getElementById('audit-stats-container').innerHTML = 
                '<div class="error-state">Failed to load statistics</div>';
        }
    }

    renderAuditStats(stats) {
        const container = document.getElementById('audit-stats-container');
        
        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${stats.total || 0}</div>
                <div class="stat-label">Total Audits</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.today || 0}</div>
                <div class="stat-label">Today</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.significant_changes || 0}</div>
                <div class="stat-label">Significant</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.rebalance_needed || 0}</div>
                <div class="stat-label">Rebalance Needed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.unique_accounts || 0}</div>
                <div class="stat-label">Accounts</div>
            </div>
        `;
    }

    buildFilters() {
        const filters = {};
        
        const accountId = document.getElementById('account-filter').value;
        if (accountId) filters.account_id = accountId;
        
        const changeType = document.getElementById('change-type-filter').value;
        if (changeType) filters.change_type = changeType;
        
        const userId = document.getElementById('user-filter').value;
        if (userId) filters.user_id = userId;
        
        const dateFrom = document.getElementById('date-from').value;
        if (dateFrom) filters.date_from = dateFrom;
        
        const dateTo = document.getElementById('date-to').value;
        if (dateTo) filters.date_to = dateTo;
        
        const searchText = document.getElementById('search-text').value.trim();
        if (searchText) filters.search = searchText;
        
        const rebalanceNeeded = document.getElementById('rebalance-needed-filter').value;
        if (rebalanceNeeded) filters.rebalance_needed = rebalanceNeeded;
        
        const significantChanges = document.getElementById('significant-changes-filter').value;
        if (significantChanges) filters.is_significant = significantChanges;
        
        return filters;
    }

    async loadAudits() {
        try {
            const container = document.getElementById('audit-results-container');
            container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div>Loading audit results...</div>';

            const filters = this.buildFilters();
            const resultsPerPage = document.getElementById('results-per-page').value;
            
            const queryParams = new URLSearchParams({
                page: this.currentPage,
                limit: resultsPerPage,
                ...filters
            });

            const response = await fetch(`${getApiUrl()}/admin/jobs-manager/audit-logs?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.audits = data.audits || [];
                this.totalPages = data.total_pages || 1;
                this.totalResults = data.total || 0;
                
                this.renderAuditResults();
                this.renderPagination();
                this.updateResultsCount();
            } else {
                throw new Error('Failed to load audits');
            }
        } catch (error) {
            logger.error('Failed to load audits:', error);
            document.getElementById('audit-results-container').innerHTML = 
                '<div class="error-state">Failed to load audit results</div>';
        }
    }

    renderAuditResults() {
        const container = document.getElementById('audit-results-container');
        
        if (this.audits.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <div class="empty-state-text">No audit records found</div>
                    <div class="empty-state-subtext">Try adjusting your filters or date range</div>
                </div>
            `;
            return;
        }

        const table = document.createElement('table');
        table.className = 'audit-table';
        
        table.innerHTML = `
            <thead>
                <tr>
                    <th><input type="checkbox" id="select-all-checkbox" class="audit-row-checkbox"></th>
                    <th>Timestamp</th>
                    <th>Change Type</th>
                    <th>Account</th>
                    <th>User</th>
                    <th>Rebalance Needed</th>
                    <th>Significant</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${this.audits.map(audit => this.renderAuditRow(audit)).join('')}
            </tbody>
        `;
        
        container.innerHTML = '';
        container.appendChild(table);
        
        // Setup select all checkbox
        const selectAllCheckbox = document.getElementById('select-all-checkbox');
        selectAllCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.selectAllVisible();
            } else {
                this.deselectAll();
            }
        });
    }

    renderAuditRow(audit) {
        const isSelected = this.selectedAudits.has(audit._id);
        const timestamp = this.formatDateTime(audit.timestamp);
        const changeTypeBadge = this.getChangeTypeBadge(audit.change_type);
        
        // Extract rebalance needed status
        const rebalanceNeeded = audit.details?.portfolio_drift_result?.rebalance_needed;
        const isSignificant = audit.details?.is_significant;
        
        return `
            <tr class="audit-row ${isSelected ? 'selected' : ''}" data-audit-id="${audit._id}">
                <td>
                    <input type="checkbox" class="audit-row-checkbox" 
                           ${isSelected ? 'checked' : ''} 
                           onchange="auditManager.toggleAuditSelection('${audit._id}')">
                </td>
                <td class="timestamp-cell">${timestamp}</td>
                <td>${changeTypeBadge}</td>
                <td>${audit.details?.account_name || 'Unknown'}</td>
                <td>${audit.user_id}</td>
                <td>
                    ${rebalanceNeeded !== undefined ? 
                        `<span class="rebalance-needed-${rebalanceNeeded}">${rebalanceNeeded ? 'Yes' : 'No'}</span>` : 
                        'N/A'
                    }
                </td>
                <td>
                    ${isSignificant !== undefined ? 
                        `<span class="significant-changes-${isSignificant}">${isSignificant ? 'Yes' : 'No'}</span>` : 
                        'N/A'
                    }
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn view-btn" onclick="auditManager.viewAuditDetail('${audit._id}')">
                            👁️ View
                        </button>
                        <button class="action-btn delete-btn" onclick="auditManager.deleteAudit('${audit._id}')">
                            🗑️ Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    getChangeTypeBadge(changeType) {
        const badges = {
            'configuration_change_analysis': 'change-type-config',
            'configuration_change_analysis_legacy': 'change-type-config',
            'job_created': 'change-type-job',
            'job_restored': 'change-type-job',
            'status_change': 'change-type-status',
            'cadence_consistency_fix': 'change-type-fix',
            'account_migration': 'change-type-fix'
        };
        
        const badgeClass = badges[changeType] || 'change-type-config';
        const displayName = changeType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        return `<span class="change-type-badge ${badgeClass}">${displayName}</span>`;
    }

    renderPagination() {
        const container = document.getElementById('pagination-container');
        
        if (this.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let paginationHTML = '<div class="pagination-controls">';
        
        // Previous button
        paginationHTML += `
            <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} 
                    onclick="auditManager.goToPage(${this.currentPage - 1})">
                ← Previous
            </button>
        `;
        
        // Page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        if (startPage > 1) {
            paginationHTML += `<button class="pagination-btn" onclick="auditManager.goToPage(1)">1</button>`;
            if (startPage > 2) {
                paginationHTML += '<span class="pagination-ellipsis">...</span>';
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" 
                        onclick="auditManager.goToPage(${i})">
                    ${i}
                </button>
            `;
        }
        
        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                paginationHTML += '<span class="pagination-ellipsis">...</span>';
            }
            paginationHTML += `<button class="pagination-btn" onclick="auditManager.goToPage(${this.totalPages})">${this.totalPages}</button>`;
        }
        
        // Next button
        paginationHTML += `
            <button class="pagination-btn" ${this.currentPage === this.totalPages ? 'disabled' : ''} 
                    onclick="auditManager.goToPage(${this.currentPage + 1})">
                Next →
            </button>
        `;
        
        paginationHTML += '</div>';
        
        // Add pagination info
        const startItem = (this.currentPage - 1) * parseInt(document.getElementById('results-per-page').value) + 1;
        const endItem = Math.min(this.currentPage * parseInt(document.getElementById('results-per-page').value), this.totalResults);
        
        paginationHTML += `
            <div class="pagination-info">
                Showing ${startItem}-${endItem} of ${this.totalResults} results
            </div>
        `;
        
        container.innerHTML = paginationHTML;
    }

    updateResultsCount() {
        document.getElementById('results-count').textContent = 
            `${this.totalResults} audit records found`;
    }

    goToPage(page) {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        this.loadAudits();
    }

    applyFilters() {
        this.currentPage = 1;
        this.selectedAudits.clear();
        this.updateBulkActionButtons();
        this.loadAudits();
    }

    clearFilters() {
        document.getElementById('account-filter').value = '';
        document.getElementById('change-type-filter').value = '';
        document.getElementById('user-filter').value = '';
        document.getElementById('search-text').value = '';
        document.getElementById('rebalance-needed-filter').value = '';
        document.getElementById('significant-changes-filter').value = '';
        
        this.setDefaultDates();
        this.applyFilters();
    }

    toggleAuditSelection(auditId) {
        if (this.selectedAudits.has(auditId)) {
            this.selectedAudits.delete(auditId);
        } else {
            this.selectedAudits.add(auditId);
        }
        
        this.updateRowSelection(auditId);
        this.updateBulkActionButtons();
        this.updateSelectAllCheckbox();
    }

    updateRowSelection(auditId) {
        const row = document.querySelector(`[data-audit-id="${auditId}"]`);
        const checkbox = row?.querySelector('.audit-row-checkbox');
        
        if (this.selectedAudits.has(auditId)) {
            row?.classList.add('selected');
            if (checkbox) checkbox.checked = true;
        } else {
            row?.classList.remove('selected');
            if (checkbox) checkbox.checked = false;
        }
    }

    selectAllVisible() {
        this.audits.forEach(audit => {
            this.selectedAudits.add(audit._id);
            this.updateRowSelection(audit._id);
        });
        this.updateBulkActionButtons();
        this.updateSelectAllCheckbox();
    }

    deselectAll() {
        this.selectedAudits.clear();
        document.querySelectorAll('.audit-row').forEach(row => {
            row.classList.remove('selected');
            const checkbox = row.querySelector('.audit-row-checkbox');
            if (checkbox) checkbox.checked = false;
        });
        this.updateBulkActionButtons();
        this.updateSelectAllCheckbox();
    }

    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('select-all-checkbox');
        if (!selectAllCheckbox) return;
        
        const visibleAudits = this.audits.map(a => a._id);
        const allVisibleSelected = visibleAudits.length > 0 && 
                                  visibleAudits.every(id => this.selectedAudits.has(id));
        
        selectAllCheckbox.checked = allVisibleSelected;
        selectAllCheckbox.indeterminate = !allVisibleSelected && 
                                         visibleAudits.some(id => this.selectedAudits.has(id));
    }

    updateBulkActionButtons() {
        const count = this.selectedAudits.size;
        const bulkDeleteBtn = document.getElementById('bulk-delete-selected');
        const exportBtn = document.getElementById('export-selected');
        const countSpan = document.getElementById('selected-count');
        
        if (bulkDeleteBtn) {
            bulkDeleteBtn.disabled = count === 0;
        }
        if (exportBtn) {
            exportBtn.disabled = count === 0;
        }
        if (countSpan) {
            countSpan.textContent = count;
        }
    }

    async viewAuditDetail(auditId) {
        try {
            const response = await fetch(`${getApiUrl()}/admin/jobs-manager/audit-logs/${auditId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (response.ok) {
                const audit = await response.json();
                this.showAuditDetail(audit);
            } else {
                throw new Error('Failed to load audit detail');
            }
        } catch (error) {
            logger.error('Failed to load audit detail:', error);
            this.showError('Failed to load audit detail');
        }
    }

    showAuditDetail(audit) {
        const modal = document.getElementById('audit-detail-modal');
        const body = document.getElementById('audit-detail-body');
        
        body.innerHTML = `
            <div class="audit-detail-section">
                <h4>Basic Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Timestamp</div>
                        <div class="detail-value">${this.formatDateTime(audit.timestamp)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Change Type</div>
                        <div class="detail-value">${audit.change_type}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Account ID</div>
                        <div class="detail-value">${audit.account_id}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">User ID</div>
                        <div class="detail-value">${audit.user_id}</div>
                    </div>
                </div>
            </div>
            
            <div class="audit-detail-section">
                <h4>Details</h4>
                <div class="json-display">${JSON.stringify(audit.details, null, 2)}</div>
            </div>
        `;
        
        // Store current audit ID for delete function
        modal.dataset.currentAuditId = audit._id;
        modal.style.display = 'block';
    }

    hideAuditDetail() {
        document.getElementById('audit-detail-modal').style.display = 'none';
    }

    deleteAudit(auditId) {
        this.selectedAudits.clear();
        this.selectedAudits.add(auditId);
        this.showBulkDeleteConfirmation();
    }

    deleteSingleAudit() {
        const modal = document.getElementById('audit-detail-modal');
        const auditId = modal.dataset.currentAuditId;
        if (auditId) {
            this.deleteAudit(auditId);
        }
    }

    showBulkDeleteConfirmation() {
        const count = this.selectedAudits.size;
        if (count === 0) return;
        
        const modal = document.getElementById('delete-confirmation-modal');
        const text = document.getElementById('delete-confirmation-text');
        
        text.textContent = count === 1 ? 
            'Are you sure you want to delete this audit record?' :
            `Are you sure you want to delete ${count} audit records?`;
        
        modal.style.display = 'block';
    }

    hideDeleteConfirmation() {
        document.getElementById('delete-confirmation-modal').style.display = 'none';
    }

    async executeDelete() {
        try {
            const auditIds = Array.from(this.selectedAudits);
            
            const response = await fetch(`${getApiUrl()}/admin/jobs-manager/audit-logs/bulk-delete`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ audit_ids: auditIds })
            });

            if (response.ok) {
                const result = await response.json();
                this.showSuccess(`Successfully deleted ${result.deleted_count} audit records`);
                
                this.selectedAudits.clear();
                this.updateBulkActionButtons();
                this.hideDeleteConfirmation();
                this.hideAuditDetail();
                
                // Reload data
                await Promise.all([
                    this.loadAuditStats(),
                    this.loadAudits()
                ]);
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to delete audit records');
            }
        } catch (error) {
            logger.error('Failed to delete audit records:', error);
            this.showError('Failed to delete audit records: ' + error.message);
        }
    }

    async exportSelected() {
        try {
            const auditIds = Array.from(this.selectedAudits);
            
            const response = await fetch(`${getApiUrl()}/admin/jobs-manager/audit-logs/export`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ audit_ids: auditIds })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `audit_export_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                window.URL.revokeObjectURL(url);
                
                this.showSuccess('Export completed successfully');
            } else {
                throw new Error('Failed to export audit records');
            }
        } catch (error) {
            logger.error('Failed to export audit records:', error);
            this.showError('Failed to export audit records: ' + error.message);
        }
    }

    showError(message) {
        // Simple error notification - you can enhance this with a proper toast system
        alert('Error: ' + message);
    }

    showSuccess(message) {
        // Simple success notification - you can enhance this with a proper toast system
        alert('Success: ' + message);
    }
}

// Initialize the audit management system
const auditManager = new AuditManagement();

// Make it globally available for onclick handlers
window.auditManager = auditManager;