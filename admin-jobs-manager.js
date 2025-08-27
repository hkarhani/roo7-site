// Jobs Manager Dashboard JavaScript
console.log('🔧 Jobs Manager Debug: Script loading started...');

// Import centralized configuration (same pattern as admin-dashboard.js)
import CONFIG from './frontend-config.js';

console.log('🔧 Jobs Manager Debug: Config loaded:', CONFIG);

// Get API URL from config
const getApiUrl = () => {
    return CONFIG?.API_CONFIG?.authUrl || CONFIG?.API_URL || 'https://api.roo7.site:443';
};

class JobsManagerDashboard {
    constructor() {
        this.currentActiveJobs = [];
        this.currentFilters = {
            jobStatus: '',
            runStatus: '',
            historyAccount: '',
            historyStatus: '',
            historyLimit: 50
        };
        
        this.refreshIntervals = {
            status: null,
            activeJobs: null,
            summary: null
        };

        this.init();
    }

    async init() {
        console.log('🔧 Jobs Manager Dashboard: Initializing...');
        
        this.setupEventListeners();
        await this.loadInitialData();
        this.setupAutoRefresh();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('back-to-admin')?.addEventListener('click', () => {
            window.location.href = 'admin-dashboard.html';
        });

        document.getElementById('logout-btn')?.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            window.location.href = 'auth.html';
        });

        // Refresh buttons
        document.getElementById('refresh-jobs-status')?.addEventListener('click', () => {
            this.loadJobsManagerStatus();
        });

        document.getElementById('refresh-active-jobs-summary')?.addEventListener('click', () => {
            this.loadActiveJobsSummary();
        });

        document.getElementById('refresh-active-jobs')?.addEventListener('click', () => {
            this.loadActiveJobs();
        });

        // Filters
        document.getElementById('apply-filters')?.addEventListener('click', () => {
            this.applyJobFilters();
        });

        document.getElementById('load-job-history')?.addEventListener('click', () => {
            this.loadJobHistory();
        });

        document.getElementById('download-history-csv')?.addEventListener('click', () => {
            this.downloadJobHistoryCSV();
        });

        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        // Click outside modal to close
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Job action confirmations
        document.getElementById('confirm-job-action')?.addEventListener('click', () => {
            this.executeJobAction();
        });

        document.getElementById('cancel-job-action')?.addEventListener('click', () => {
            document.getElementById('job-action-modal').style.display = 'none';
        });
    }

    setupAutoRefresh() {
        // Refresh status every 30 seconds
        this.refreshIntervals.status = setInterval(() => {
            this.loadJobsManagerStatus();
        }, 30000);

        // Refresh active jobs summary every 60 seconds
        this.refreshIntervals.summary = setInterval(() => {
            this.loadActiveJobsSummary();
        }, 60000);

        // Refresh active jobs list every 2 minutes
        this.refreshIntervals.activeJobs = setInterval(() => {
            this.loadActiveJobs();
        }, 120000);
    }

    async loadInitialData() {
        await Promise.all([
            this.loadJobsManagerStatus(),
            this.loadActiveJobsSummary(),
            this.loadActiveJobs(),
            this.populateHistoryAccountFilter()
        ]);
    }

    async makeAuthenticatedRequest(url, options = {}) {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = 'auth.html';
            return;
        }

        return response;
    }

    async loadJobsManagerStatus() {
        try {
            console.log('🔧 Jobs Manager: Loading Jobs Manager status');
            
            const response = await this.makeAuthenticatedRequest(`${getApiUrl()}/admin/jobs-manager/status`);
            const data = await response.json();
            
            this.renderJobsManagerStatus(data);
        } catch (error) {
            console.error('❌ Jobs Manager: Failed to load Jobs Manager status', error);
            this.renderJobsManagerError('jobs-status-container', 'Failed to load Jobs Manager status');
        }
    }

    async loadActiveJobsSummary() {
        try {
            console.log('🔧 Jobs Manager: Loading active jobs summary');
            
            const response = await this.makeAuthenticatedRequest(`${getApiUrl()}/admin/jobs-manager/active-jobs`);
            const data = await response.json();
            
            this.renderActiveJobsSummary(data);
        } catch (error) {
            console.error('❌ Jobs Manager: Failed to load active jobs summary', error);
            this.renderJobsManagerError('active-jobs-stats', 'Failed to load active jobs summary');
        }
    }

    async loadActiveJobs() {
        try {
            console.log('🔧 Jobs Manager: Loading active jobs list');
            
            const response = await this.makeAuthenticatedRequest(`${getApiUrl()}/admin/jobs-manager/active-jobs-list`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API Response Error:', response.status, errorText);
                throw new Error(`API Error: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            console.log('📊 Active jobs response data:', data);
            
            // Store the jobs data for use in showJobDetails  
            this.currentActiveJobs = data.active_jobs || [];
            
            console.log(`📋 Found ${this.currentActiveJobs.length} active jobs`, this.currentActiveJobs);
            
            this.renderActiveJobsList(this.currentActiveJobs);
        } catch (error) {
            console.error('❌ Jobs Manager: Failed to load active jobs', error);
            this.renderActiveJobsError();
        }
    }

    async loadJobHistory() {
        try {
            console.log('🔧 Jobs Manager: Loading job execution history');
            
            const limit = document.getElementById('history-limit').value || 50;
            const accountFilter = document.getElementById('history-account-filter').value;
            const statusFilter = document.getElementById('history-status-filter').value;
            
            // Show loading state
            this.renderJobHistoryLoading();
            
            let apiUrl;
            if (accountFilter) {
                // Get executions for specific account
                apiUrl = `${getApiUrl()}/admin/jobs-manager/job-executions/${accountFilter}?limit=${limit}`;
            } else {
                // Get recent executions across all accounts
                apiUrl = `${getApiUrl()}/admin/jobs-manager/job-executions?limit=${limit}`;
            }
            
            console.log('📡 Fetching job history from:', apiUrl);
            
            const response = await this.makeAuthenticatedRequest(apiUrl);
            const data = await response.json();
            
            if (response.ok && data.success !== false) {
                let executions = data.executions || [];
                
                // Apply status filter if specified
                if (statusFilter) {
                    executions = executions.filter(exec => 
                        exec.status && exec.status.toUpperCase() === statusFilter.toUpperCase()
                    );
                }
                
                console.log(`📊 Loaded ${executions.length} job executions`);
                this.renderJobHistory(executions);
            } else {
                throw new Error(data.message || 'Failed to load job history');
            }
            
        } catch (error) {
            console.error('❌ Jobs Manager: Failed to load job history', error);
            this.renderJobHistoryError();
        }
    }

    renderJobsManagerStatus(data) {
        const container = document.getElementById('jobs-status-container');
        
        if (!data.available) {
            container.innerHTML = `
                <div class="jobs-error">
                    <h4>❌ Jobs Manager Not Available</h4>
                    <p>Jobs Manager is not available: ${data.error || 'Unknown error'}</p>
                </div>
            `;
            return;
        }

        const isRunning = data.running;
        const statusClass = isRunning ? 'running' : 'stopped';
        
        container.innerHTML = `
            <div class="status-card">
                <h4>Service Status</h4>
                <div class="status-value ${statusClass}">
                    ${isRunning ? '🟢 Running' : '🔴 Stopped'}
                </div>
                <div class="status-meta">
                    Worker ID: ${data.worker_id || 'N/A'}
                </div>
            </div>
            
            ${isRunning ? `
                <div class="status-card">
                    <h4>Uptime</h4>
                    <div class="status-value">
                        ${this.formatDuration(data.uptime_seconds || 0)}
                    </div>
                    <div class="status-meta">
                        Started: ${data.started_at ? new Date(data.started_at).toLocaleString() : 'N/A'}
                    </div>
                </div>
                
                <div class="status-card">
                    <h4>Cycle Statistics</h4>
                    <div class="status-value">
                        ${data.cycles_completed || 0} cycles
                    </div>
                    <div class="status-meta">
                        Last cycle: ${data.last_cycle_at ? new Date(data.last_cycle_at).toLocaleString() : 'N/A'}
                    </div>
                </div>
                
                <div class="status-card">
                    <h4>Job Statistics</h4>
                    <div class="status-value">
                        ${data.jobs_processed || 0} processed
                    </div>
                    <div class="status-meta">
                        Success: ${data.successful_executions || 0} | Failed: ${data.failed_executions || 0}
                    </div>
                </div>
            ` : ''}
        `;
    }

    renderActiveJobsSummary(data) {
        const container = document.getElementById('active-jobs-stats');
        
        // Debug: Log the actual data structure received
        console.log('📊 Active Jobs Summary Data:', JSON.stringify(data, null, 2));
        
        if (data.error) {
            container.innerHTML = `
                <div class="jobs-error">
                    Failed to load summary: ${data.error}
                </div>
            `;
            return;
        }

        const jobsByStatus = data.active_jobs_by_status || {};
        const jobsByRunStatus = data.active_jobs_by_run_status || {};
        
        // Debug: Log the parsed data
        console.log('📊 Jobs by Status:', jobsByStatus);
        console.log('📊 Jobs by Run Status:', jobsByRunStatus);
        
        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-number active">${jobsByStatus.ACTIVE || 0}</div>
                <div class="stat-label">Active Jobs</div>
            </div>
            <div class="stat-card">
                <div class="stat-number paused">${jobsByStatus.PAUSED || 0}</div>
                <div class="stat-label">Paused Jobs</div>
            </div>
            <div class="stat-card">
                <div class="stat-number disabled">${jobsByStatus.DISABLED || 0}</div>
                <div class="stat-label">Disabled Jobs</div>
            </div>
            <div class="stat-card">
                <div class="stat-number running">${jobsByRunStatus.RUNNING || 0}</div>
                <div class="stat-label">Currently Running</div>
            </div>
            <div class="stat-card">
                <div class="stat-number failed">${jobsByRunStatus.FAILED || 0}</div>
                <div class="stat-label">Failed Jobs</div>
            </div>
        `;
    }

    renderActiveJobsList(accounts) {
        const tbody = document.querySelector('#active-jobs-table tbody');
        
        if (!accounts || accounts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="jobs-empty">
                        <div class="jobs-empty-icon">📭</div>
                        <p>No active jobs found</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = accounts.map(account => {
            const nextRun = account.next_run_at ? this.formatDateTime(account.next_run_at) : 'Not scheduled';
            const lastRun = account.last_run_at ? this.formatDateTime(account.last_run_at) : 'Never';
            
            // Use actual failed jobs count from backend instead of consecutive_failures
            const successfulJobs = account.successful_jobs_count || 0;
            const failedJobs = account.failed_jobs_count || 0;
            
            const statusClass = account.status ? account.status.toLowerCase() : 'active';
            const runStatusClass = account.run_status ? account.run_status.toLowerCase() : 'idle';
            
            // Format account value - try multiple possible fields
            const currentValue = account.current_total_value || account.last_value || account.account_value;
            const formattedValue = currentValue ? `$${parseFloat(currentValue).toFixed(2)}` : 'N/A';
            
            // Style the success and failure counts
            const successfulStyle = successfulJobs > 0 ? 'color: #10b981; font-weight: 600;' : '';
            const failedStyle = failedJobs > 0 ? 'color: #ef4444; font-weight: 600;' : '';
            
            return `
            <tr>
                <td>${this.truncateId(account.account_id)}</td>
                <td>${account.username || 'N/A'}</td>
                <td>${account.account_name || 'Unnamed'}</td>
                <td>${account.strategy || 'N/A'}</td>
                <td><span class="status-badge ${statusClass}">${account.status || 'ACTIVE'}</span></td>
                <td><span class="status-badge ${runStatusClass}">${account.run_status || 'IDLE'}</span></td>
                <td class="account-value">${formattedValue}</td>
                <td class="time-display">${nextRun}</td>
                <td class="time-display">${lastRun}</td>
                <td><span style="${successfulStyle}">${successfulJobs}</span></td>
                <td><span style="${failedStyle}">${failedJobs}</span></td>
                <td>
                    <div class="job-actions">
                        <button class="job-action-btn force" onclick="jobsManager.showJobAction('${account.account_id}', 'force', '${account.account_name}')">
                            ⚡ Force
                        </button>
                        <button class="job-action-btn pause" onclick="jobsManager.showJobAction('${account.account_id}', 'pause', '${account.account_name}')">
                            ⏸️ Pause
                        </button>
                        <button class="job-action-btn details" onclick="jobsManager.showJobDetails('${account.account_id}')">
                            📋 Details
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }

    renderJobHistoryPlaceholder() {
        const tbody = document.querySelector('#job-history-table tbody');
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="jobs-empty">
                    <div class="jobs-empty-icon">📊</div>
                    <p>Job execution history will appear here once jobs start running</p>
                </td>
            </tr>
        `;
    }

    renderJobHistoryLoading() {
        const tbody = document.querySelector('#job-history-table tbody');
        const csvButton = document.getElementById('download-history-csv');
        
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="jobs-loading">
                    <p>Loading job execution history...</p>
                </td>
            </tr>
        `;
        
        // Hide CSV button during loading
        if (csvButton) csvButton.style.display = 'none';
    }

    renderJobHistory(executions) {
        const tbody = document.querySelector('#job-history-table tbody');
        const csvButton = document.getElementById('download-history-csv');
        
        if (!executions || executions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="jobs-empty">
                        <div class="jobs-empty-icon">📊</div>
                        <p>No job executions found with current filters</p>
                    </td>
                </tr>
            `;
            // Hide CSV button when no data
            if (csvButton) csvButton.style.display = 'none';
            return;
        }

        // Store executions data for CSV export
        this.currentJobHistoryData = executions;
        
        // Show CSV button when data is loaded
        if (csvButton) csvButton.style.display = 'inline-block';
        
        tbody.innerHTML = executions.map(execution => `
            <tr>
                <td title="${execution.id}">${this.truncateId(execution.id)}</td>
                <td title="${execution.account_id}">${this.truncateId(execution.account_id)}</td>
                <td>
                    <span class="status-badge ${execution.status ? execution.status.toLowerCase() : 'unknown'}">
                        ${execution.status || 'N/A'}
                    </span>
                </td>
                <td class="time-display">
                    ${execution.started_at ? this.formatDateTime(execution.started_at) : 'N/A'}
                </td>
                <td>
                    ${execution.duration_seconds ? `${execution.duration_seconds.toFixed(2)}s` : 'N/A'}
                </td>
                <td>${execution.worker_id || 'N/A'}</td>
                <td>
                    ${execution.spot_manager_result?.user_message 
                        ? `<span title="${execution.spot_manager_result.user_message}">${execution.spot_manager_result.user_message.substring(0, 30)}${execution.spot_manager_result.user_message.length > 30 ? '...' : ''}</span>`
                        : (execution.error_info ? '<span class="text-danger">Error</span>' : 'N/A')
                    }
                    ${execution.spot_manager_result?.current_total_value 
                        ? `<br><small class="text-success">$${execution.spot_manager_result.current_total_value.toFixed(2)}</small>`
                        : ''
                    }
                </td>
                <td>
                    <button class="job-action-btn details" onclick="jobsManager.showExecutionDetails('${execution.id}')">
                        📋 Details
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async showExecutionDetails(executionId) {
        const modal = document.getElementById('execution-details-modal');
        const content = document.getElementById('execution-details-content');
        
        // Show loading state
        content.innerHTML = `<div class="loading-state"><p>Loading execution details...</p></div>`;
        modal.style.display = 'block';
        
        try {
            console.log('📊 Fetching execution details for:', executionId);
            
            const response = await this.makeAuthenticatedRequest(
                `${getApiUrl()}/admin/jobs-manager/job-execution/${executionId}`
            );
            const data = await response.json();
            
            if (response.ok && data.success && data.execution) {
                const execution = data.execution;
                
                content.innerHTML = `
                    <div class="execution-details">
                        <div class="execution-section">
                            <h4>Execution Information</h4>
                            <div class="execution-field">
                                <strong>Execution ID:</strong>
                                <span>${execution.id}</span>
                            </div>
                            <div class="execution-field">
                                <strong>Account ID:</strong>
                                <span>${execution.account_id}</span>
                            </div>
                            <div class="execution-field">
                                <strong>Status:</strong>
                                <span class="status-badge ${execution.status ? execution.status.toLowerCase() : 'unknown'}">${execution.status || 'N/A'}</span>
                            </div>
                            <div class="execution-field">
                                <strong>Started:</strong>
                                <span>${execution.started_at ? this.formatDateTime(execution.started_at) : 'N/A'}</span>
                            </div>
                            <div class="execution-field">
                                <strong>Completed:</strong>
                                <span>${execution.completed_at ? this.formatDateTime(execution.completed_at) : 'Still running'}</span>
                            </div>
                            <div class="execution-field">
                                <strong>Duration:</strong>
                                <span>${execution.duration_seconds ? `${execution.duration_seconds.toFixed(2)}s` : 'N/A'}</span>
                            </div>
                            <div class="execution-field">
                                <strong>Worker:</strong>
                                <span>${execution.worker_id || 'N/A'}</span>
                            </div>
                            <div class="execution-field">
                                <strong>Attempt Number:</strong>
                                <span>${execution.attempt_number || 1}</span>
                            </div>
                        </div>
                        
                        ${execution.input_snapshot ? `
                            <div class="execution-section">
                                <h4>Input Parameters</h4>
                                <div class="json-display">
                                    ${JSON.stringify(execution.input_snapshot, null, 2)}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${execution.spot_manager_result ? `
                            <div class="execution-section">
                                <h4>Execution Results</h4>
                                <div class="execution-field">
                                    <strong>Result Message:</strong>
                                    <span>${execution.spot_manager_result.user_message || 'N/A'}</span>
                                </div>
                                ${execution.spot_manager_result.current_total_value ? `
                                    <div class="execution-field">
                                        <strong>Portfolio Value:</strong>
                                        <span class="text-success">$${execution.spot_manager_result.current_total_value.toFixed(2)}</span>
                                    </div>
                                ` : ''}
                                ${execution.spot_manager_result.admin_message ? `
                                    <div class="execution-field">
                                        <strong>Admin Details:</strong>
                                        <div class="json-display">
                                            ${JSON.stringify(execution.spot_manager_result.admin_message, null, 2)}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                        
                        ${execution.error_info ? `
                            <div class="execution-section">
                                <h4>Error Information</h4>
                                <div class="execution-field">
                                    <strong>Error Stage:</strong>
                                    <span class="text-danger">${execution.error_info.stage || 'N/A'}</span>
                                </div>
                                <div class="execution-field">
                                    <strong>Error Type:</strong>
                                    <span class="text-danger">${execution.error_info.type || 'N/A'}</span>
                                </div>
                                <div class="execution-field">
                                    <strong>Error Message:</strong>
                                    <span class="text-danger">${execution.error_info.message || 'N/A'}</span>
                                </div>
                                ${execution.error_info.traceback ? `
                                    <div class="execution-field">
                                        <strong>Stack Trace:</strong>
                                        <div class="json-display">
                                            ${execution.error_info.traceback}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
            } else {
                throw new Error(data.message || 'Failed to load execution details');
            }
            
        } catch (error) {
            console.error('❌ Jobs Manager: Failed to load execution details', error);
            content.innerHTML = `
                <div class="jobs-error">
                    <p>Failed to load execution details: ${error.message}</p>
                </div>
            `;
        }
    }

    async populateHistoryAccountFilter() {
        try {
            const response = await this.makeAuthenticatedRequest(`${getApiUrl()}/admin/active-users-accounts`);
            const data = await response.json();
            
            const select = document.getElementById('history-account-filter');
            select.innerHTML = '<option value="">All Accounts</option>';
            
            if (data.accounts) {
                data.accounts.forEach(account => {
                    const option = document.createElement('option');
                    option.value = account.account_id;
                    option.textContent = `${account.account_name || account.account_id} (${account.username})`;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('❌ Jobs Manager: Failed to populate account filter', error);
        }
    }

    applyJobFilters() {
        this.currentFilters.jobStatus = document.getElementById('job-status-filter').value;
        this.currentFilters.runStatus = document.getElementById('run-status-filter').value;
        this.loadActiveJobs();
    }

    showJobAction(accountId, action, accountName) {
        const modal = document.getElementById('job-action-modal');
        const title = document.getElementById('job-action-title');
        const message = document.getElementById('job-action-message');
        const confirmBtn = document.getElementById('confirm-job-action');
        
        document.getElementById('action-account-id').textContent = this.truncateId(accountId);
        document.getElementById('action-account-name').textContent = accountName;
        document.getElementById('action-current-status').textContent = 'ACTIVE';
        
        let actionText, actionClass, messageText;
        switch (action) {
            case 'force':
                actionText = 'Force Execution';
                actionClass = 'primary-button';
                messageText = 'This will immediately schedule the job for execution.';
                break;
            case 'pause':
                actionText = 'Pause Job';
                actionClass = 'secondary-button';
                messageText = 'This will pause the job until manually resumed.';
                break;
            case 'resume':
                actionText = 'Resume Job';
                actionClass = 'primary-button';
                messageText = 'This will resume the paused job.';
                break;
            default:
                return;
        }
        
        title.textContent = actionText;
        message.textContent = messageText;
        confirmBtn.textContent = actionText;
        confirmBtn.className = actionClass;
        confirmBtn.dataset.accountId = accountId;
        confirmBtn.dataset.action = action;
        
        modal.style.display = 'block';
    }

    async executeJobAction() {
        const confirmBtn = document.getElementById('confirm-job-action');
        const accountId = confirmBtn.dataset.accountId;
        const action = confirmBtn.dataset.action;
        
        try {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Processing...';
            
            let endpoint;
            switch (action) {
                case 'force':
                    endpoint = `/admin/jobs-manager/force-execution/${accountId}`;
                    break;
                case 'pause':
                    endpoint = `/admin/jobs-manager/pause/${accountId}`;
                    break;
                case 'resume':
                    endpoint = `/admin/jobs-manager/resume/${accountId}`;
                    break;
                default:
                    throw new Error('Unknown action');
            }
            
            const response = await this.makeAuthenticatedRequest(`${getApiUrl()}${endpoint}`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('JobsManagerDashboard', `Job action ${action} successful for ${accountId}`);
                this.showNotification(result.message, 'success');
                this.loadActiveJobs(); // Refresh the list
            } else {
                this.showNotification(result.message, 'warning');
            }
            
        } catch (error) {
            console.error('JobsManagerDashboard', `Failed to execute job action ${action}`, error);
            this.showNotification('Failed to execute action', 'error');
        } finally {
            document.getElementById('job-action-modal').style.display = 'none';
        }
    }

    async showJobDetails(accountId) {
        const modal = document.getElementById('job-details-modal');
        const content = document.getElementById('job-details-content');
        const title = document.getElementById('job-details-title');
        
        // Show loading state
        content.innerHTML = `
            <div class="loading-state">
                <p>Loading job details...</p>
            </div>
        `;
        modal.style.display = 'block';
        
        try {
            // Find the job data from our cached active jobs
            const job = this.currentActiveJobs.find(job => job.account_id === accountId);
            
            if (!job) {
                content.innerHTML = `
                    <div class="jobs-error">
                        <p>Job details not found for account ID: ${this.truncateId(accountId)}</p>
                    </div>
                `;
                return;
            }
            
            // Get job configuration from jobs manager active jobs endpoint
            const jobConfigResponse = await this.makeAuthenticatedRequest(
                `${getApiUrl()}/admin/jobs-manager/active-jobs`
            );
            const jobConfigData = await jobConfigResponse.json();
            
            // Find the specific job from the jobs manager data
            const jobConfig = jobConfigData.active_jobs?.find(j => j.account_id === accountId) || null;
            
            title.textContent = `Job Details - ${job.account_name || 'Account'}`;
            
            // Fetch last execution: prioritize last_job_id from active job, fallback to latest execution
            let lastExecution = null;
            
            if (jobConfig?.last_job_id) {
                // Fetch the specific last execution using last_job_id
                try {
                    const lastExecutionResponse = await this.makeAuthenticatedRequest(
                        `${getApiUrl()}/admin/jobs-manager/job-execution/${jobConfig.last_job_id}`
                    );
                    const lastExecutionData = await lastExecutionResponse.json();
                    
                    if (lastExecutionData.success) {
                        lastExecution = lastExecutionData.execution;
                        console.log('📊 Fetched specific last execution using last_job_id:', jobConfig.last_job_id);
                    }
                } catch (error) {
                    console.warn('⚠️ Failed to fetch specific last execution, falling back to latest:', error);
                }
            }
            
            // Fallback: get recent executions if specific fetch failed
            if (!lastExecution) {
                const executionsResponse = await this.makeAuthenticatedRequest(
                    `${getApiUrl()}/admin/jobs-manager/job-executions/${accountId}?limit=5`
                );
                const executionsData = await executionsResponse.json();
                
                lastExecution = executionsData.executions && executionsData.executions.length > 0 
                    ? executionsData.executions[0] 
                    : null;
                    
                console.log('📊 Using latest execution as fallback');
            }
            
            content.innerHTML = `
                <div class="execution-details">
                    <div class="execution-section">
                        <h4>Job Configuration</h4>
                        <div class="execution-field">
                            <strong>Account ID:</strong>
                            <span>${this.truncateId(job.account_id)}</span>
                        </div>
                        <div class="execution-field">
                            <strong>Account Name:</strong>
                            <span>${job.account_name || 'N/A'}</span>
                        </div>
                        <div class="execution-field">
                            <strong>Status:</strong>
                            <span class="status-badge ${jobConfig?.status ? jobConfig.status.toLowerCase() : 'unknown'}">${jobConfig?.status || job.status || 'N/A'}</span>
                        </div>
                        <div class="execution-field">
                            <strong>Run Status:</strong>
                            <span class="status-badge ${jobConfig?.run_status ? jobConfig.run_status.toLowerCase() : 'unknown'}">${jobConfig?.run_status || job.run_status || 'N/A'}</span>
                        </div>
                        <div class="execution-field">
                            <strong>Strategy:</strong>
                            <span>${jobConfig?.strategy || job.strategy || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div class="execution-section">
                        <h4>Execution Schedule</h4>
                        <div class="execution-field">
                            <strong>Cadence:</strong>
                            <span>${jobConfig?.cadence_minutes || job.cadence_minutes || 'N/A'} minutes</span>
                        </div>
                        <div class="execution-field">
                            <strong>Next Run:</strong>
                            <span>${jobConfig?.next_run_at ? this.formatDateTime(jobConfig.next_run_at) : (job.next_run_at ? this.formatDateTime(job.next_run_at) : 'Not scheduled')}</span>
                        </div>
                        <div class="execution-field">
                            <strong>Last Run:</strong>
                            <span>${jobConfig?.last_run_at ? this.formatDateTime(jobConfig.last_run_at) : (job.last_run_at ? this.formatDateTime(job.last_run_at) : 'Never')}</span>
                        </div>
                        <div class="execution-field">
                            <strong>Consecutive Failures:</strong>
                            <span class="${(jobConfig?.consecutive_failures || job.consecutive_failures || 0) > 0 ? 'text-danger' : 'text-success'}">${jobConfig?.consecutive_failures || job.consecutive_failures || 0}</span>
                        </div>
                        <div class="execution-field">
                            <strong>Immediate:</strong>
                            <span class="${jobConfig?.immediate || job.immediate ? 'text-warning' : 'text-secondary'}">${jobConfig?.immediate || job.immediate ? 'Yes (Due for immediate execution)' : 'No'}</span>
                        </div>
                        ${jobConfig?.current_job_id ? `
                            <div class="execution-field">
                                <strong>Current Job:</strong>
                                <span class="text-info">Running (ID: ${jobConfig.current_job_id.slice(-8)})</span>
                            </div>
                        ` : ''}
                        ${jobConfig?.last_job_id ? `
                            <div class="execution-field">
                                <strong>Last Job ID:</strong>
                                <span class="text-secondary">${jobConfig.last_job_id.slice(-8)}...</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="execution-section">
                        <h4>Target Portfolio</h4>
                        <div class="json-display">
                            ${JSON.stringify(jobConfig?.target_portfolio || lastExecution?.input_snapshot?.target_portfolio || job.target_portfolio || {}, null, 2)}
                        </div>
                    </div>
                    
                    ${lastExecution ? `
                        <div class="execution-section">
                            <h4>Last Execution Result ${jobConfig?.last_job_id ? '(Job ID: ' + jobConfig.last_job_id.slice(-8) + '...)' : '(Latest)'}</h4>
                            <div class="execution-field">
                                <strong>Status:</strong>
                                <span class="status-badge ${lastExecution.status ? lastExecution.status.toLowerCase() : 'unknown'}">${lastExecution.status || 'N/A'}</span>
                            </div>
                            <div class="execution-field">
                                <strong>Started:</strong>
                                <span>${lastExecution.started_at ? this.formatDateTime(lastExecution.started_at) : 'N/A'}</span>
                            </div>
                            <div class="execution-field">
                                <strong>Completed:</strong>
                                <span>${lastExecution.completed_at ? this.formatDateTime(lastExecution.completed_at) : 'Still running'}</span>
                            </div>
                            <div class="execution-field">
                                <strong>Duration:</strong>
                                <span>${lastExecution.duration_seconds ? `${lastExecution.duration_seconds.toFixed(2)}s` : 'N/A'}</span>
                            </div>
                            <div class="execution-field">
                                <strong>Worker:</strong>
                                <span>${lastExecution.worker_id || 'N/A'}</span>
                            </div>
                            ${lastExecution.spot_manager_result ? `
                                <div class="execution-field">
                                    <strong>Result Message:</strong>
                                    <span>${lastExecution.spot_manager_result.user_message || 'N/A'}</span>
                                </div>
                                ${lastExecution.spot_manager_result.current_total_value ? `
                                    <div class="execution-field">
                                        <strong>Portfolio Value:</strong>
                                        <span class="text-success">$${lastExecution.spot_manager_result.current_total_value.toFixed(2)}</span>
                                    </div>
                                ` : ''}
                            ` : ''}
                            ${lastExecution.error_info ? `
                                <div class="execution-field">
                                    <strong>Error:</strong>
                                    <span class="text-danger">${lastExecution.error_info.message || 'Unknown error'}</span>
                                </div>
                            ` : ''}
                        </div>
                    ` : `
                        <div class="execution-section">
                            <h4>Execution History</h4>
                            <p class="text-secondary">No execution history available for this job.</p>
                        </div>
                    `}
                </div>
            `;
            
        } catch (error) {
            console.error('❌ Jobs Manager: Failed to load job details', error);
            content.innerHTML = `
                <div class="jobs-error">
                    <p>Failed to load job details: ${error.message}</p>
                </div>
            `;
        }
    }

    showNotification(message, type = 'info') {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '4px',
            color: 'white',
            fontSize: '14px',
            zIndex: '10000',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            backgroundColor: type === 'success' ? '#10b981' : 
                           type === 'error' ? '#ef4444' : 
                           type === 'warning' ? '#f59e0b' : '#3b82f6'
        });
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    renderJobsManagerError(containerId, message) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="jobs-error">
                <h4>❌ Error</h4>
                <p>${message}</p>
                <button onclick="location.reload()" class="secondary-button">Retry</button>
            </div>
        `;
    }

    renderActiveJobsError() {
        const tbody = document.querySelector('#active-jobs-table tbody');
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="jobs-error">
                    Failed to load active jobs. <button onclick="jobsManager.loadActiveJobs()" class="secondary-button">Retry</button>
                </td>
            </tr>
        `;
    }

    renderJobHistoryError() {
        const tbody = document.querySelector('#job-history-table tbody');
        const csvButton = document.getElementById('download-history-csv');
        
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="jobs-error">
                    Failed to load job history. <button onclick="jobsManager.loadJobHistory()" class="secondary-button">Retry</button>
                </td>
            </tr>
        `;
        
        // Hide CSV button on error
        if (csvButton) csvButton.style.display = 'none';
    }

    truncateId(id) {
        return id ? id.substring(0, 8) + '...' : 'N/A';
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    formatDateTime(dateString) {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (error) {
            return 'Invalid date';
        }
    }

    downloadJobHistoryCSV() {
        if (!this.currentJobHistoryData || this.currentJobHistoryData.length === 0) {
            alert('No job history data available to export');
            return;
        }

        try {
            // Define CSV headers
            const headers = [
                'Execution ID',
                'Account ID', 
                'Account Name',
                'Status',
                'Started At',
                'Completed At',
                'Duration (seconds)',
                'Worker ID',
                'Result Summary',
                'Error Message'
            ];

            // Convert data to CSV format
            const csvData = this.currentJobHistoryData.map(execution => [
                execution.id || '',
                execution.account_id || '',
                execution.account_name || '',
                execution.status || '',
                execution.started_at || '',
                execution.completed_at || '',
                execution.duration_seconds || '',
                execution.worker_id || '',
                execution.result_summary || '',
                execution.error || ''
            ]);

            // Combine headers and data
            const csvContent = [headers, ...csvData]
                .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
                .join('\n');

            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                
                // Generate filename with current timestamp
                const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
                link.setAttribute('download', `job-history-${timestamp}.csv`);
                
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                console.log('📥 Job history CSV downloaded successfully');
            }
        } catch (error) {
            console.error('❌ Error generating CSV:', error);
            alert('Error generating CSV file. Please try again.');
        }
    }

    destroy() {
        // Clean up intervals
        Object.values(this.refreshIntervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.jobsManager = new JobsManagerDashboard();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (window.jobsManager) {
        window.jobsManager.destroy();
    }
});