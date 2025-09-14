// Jobs Manager Dashboard JavaScript
console.log('🔧 Jobs Manager Debug: Script loading started...');

// Import centralized configuration (same pattern as admin-dashboard.js)
import CONFIG from './frontend-config.js';

console.log('🔧 Jobs Manager Debug: Config loaded:', CONFIG);

// Get API URL from config with proper routing for jobs endpoints
const getApiUrl = (endpoint = '') => {
    // Use the routing function from CONFIG that handles jobs-manager endpoints
    if (CONFIG?.CONFIG_UTILS?.getApiUrl) {
        return CONFIG.CONFIG_UTILS.getApiUrl(endpoint);
    }
    // Fallback: manual routing if CONFIG_UTILS not available
    if (endpoint.includes('/admin/jobs-manager/')) {
        return `https://api.roo7.site:8004${endpoint}`;
    }
    return `https://api.roo7.site:443${endpoint}`;
};

class JobsManagerDashboard {
    constructor() {
        this.currentActiveJobs = [];
        this.currentFilters = {
            jobStatus: '',
            runStatus: '',
            userName: '',
            accountName: '',
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

        // Audit Changes functionality - redirect to dedicated audit management page
        document.getElementById('audit-changes-btn')?.addEventListener('click', () => {
            window.location.href = 'admin-audit-management.html';
        });

        document.getElementById('audit-changes-close')?.addEventListener('click', () => {
            document.getElementById('audit-changes-modal').style.display = 'none';
        });

        document.getElementById('load-audit-changes')?.addEventListener('click', () => {
            this.loadAuditChanges();
        });

        document.getElementById('download-audit-csv')?.addEventListener('click', () => {
            this.downloadAuditChangesCSV();
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
            
            const response = await this.makeAuthenticatedRequest(getApiUrl('/admin/jobs-manager/status'));
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
            
            const response = await this.makeAuthenticatedRequest(getApiUrl('/admin/jobs-manager/active-jobs'));
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
            
            const response = await this.makeAuthenticatedRequest(getApiUrl('/admin/jobs-manager/active-jobs-list'));
            
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
            
            // Apply filters before rendering
            const filteredJobs = this.filterActiveJobs(this.currentActiveJobs);
            console.log(`📋 After filtering: ${filteredJobs.length} jobs displayed`);
            
            this.renderActiveJobsList(filteredJobs);
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
                apiUrl = getApiUrl(`/admin/jobs-manager/job-executions/${accountFilter}?limit=${limit}`);
            } else {
                // Get recent executions across all accounts
                apiUrl = getApiUrl(`/admin/jobs-manager/job-executions?limit=${limit}`);
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
                
                // Debug: Log first execution to see available fields
                if (executions.length > 0) {
                    console.log('🔍 Sample execution data:', executions[0]);
                    console.log('🔍 Available fields:', Object.keys(executions[0]));
                }
                
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
        // Update individual stat elements instead of a container that doesn't exist
        if (!data.available) {
            console.error('Jobs Manager not available:', data.error || 'Unknown error');
            return;
        }

        const isRunning = data.running;
        console.log(`Jobs Manager Status: ${isRunning ? '🟢 Running' : '🔴 Stopped'}`);
        // Status display removed since HTML doesn't have jobs-status-container
    }

    renderActiveJobsSummary(data) {
        // Debug: Log the actual data structure received
        console.log('📊 Active Jobs Summary Data:', JSON.stringify(data, null, 2));

        if (data.error) {
            console.error('Failed to load summary:', data.error);
            return;
        }

        const jobsByStatus = data.active_jobs_by_status || {};
        const jobsByRunStatus = data.active_jobs_by_run_status || {};

        // Debug: Log the parsed data
        console.log('📊 Jobs by Status:', jobsByStatus);
        console.log('📊 Jobs by Run Status:', jobsByRunStatus);

        // Update the stat elements that actually exist in the HTML
        document.getElementById('total-jobs').textContent = (jobsByStatus.ACTIVE || 0) + (jobsByStatus.PAUSED || 0);
        document.getElementById('healthy-jobs').textContent = jobsByRunStatus.IDLE || 0;
        document.getElementById('attention-jobs').textContent = data.overdue_jobs || 0;
        document.getElementById('running-jobs').textContent = jobsByRunStatus.RUNNING || 0;
    }

    renderActiveJobsList(accounts) {
        const container = document.getElementById('jobs-grid');
        const emptyState = document.getElementById('jobs-empty');
        
        if (!accounts || accounts.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        container.style.display = 'grid';
        emptyState.style.display = 'none';

        // Use the existing createJobCard function from HTML
        container.innerHTML = accounts.map(account => {
            // Convert account data to format expected by createJobCard
            const job = {
                account_id: account.account_id,
                account_name: account.account_name,
                strategy: account.strategy,
                hedge_percent: account.hedge_percent,
                cadence_minutes: account.cadence_minutes,
                job_type: account.job_type,
                success_rate_percent: account.success_rate_percent || 0,
                consecutive_failures: account.consecutive_failures || 0,
                recent_executions_count: account.recent_executions_count || 0,
                next_run_at: account.next_run_at,
                last_run_at: account.last_run_at,
                is_running: account.run_status === 'RUNNING',
                last_execution_status: account.last_execution_result || 'UNKNOWN',
                needs_attention: account.consecutive_failures > 0
            };

            return this.createJobCard(job);
        }).join('');

        // Add event listeners
        accounts.forEach(account => {
            const card = document.getElementById(`job-${account.account_id}`);
            if (card) {
                this.setupJobCardListeners(card, account);
            }
        });
    }

    // Add createJobCard and setupJobCardListeners functions to match HTML structure
    createJobCard(job) {
        // This function should match the one in the HTML - copying the implementation
        const cardClass = job.is_running ? 'running' :
                         job.last_execution_status === 'SUCCEEDED' ? 'healthy' :
                         job.last_execution_status === 'FAILED' ? 'failed' :
                         job.needs_attention ? 'needs-attention' : 'healthy';

        const statusBadge = job.is_running ? 'status-running' :
                           job.last_execution_status === 'SUCCEEDED' ? 'status-healthy' :
                           job.last_execution_status === 'FAILED' ? 'status-failed' :
                           job.needs_attention ? 'status-attention' : 'status-healthy';

        const statusText = job.is_running ? '🔄 Running' :
                          job.last_execution_status === 'SUCCEEDED' ? '✅ Success' :
                          job.last_execution_status === 'FAILED' ? '❌ Failed' :
                          job.needs_attention ? '⚠️ Attention' : '✅ Ready';

        const nextRun = job.next_run_at ? new Date(job.next_run_at) : null;
        const lastRun = job.last_run_at ? new Date(job.last_run_at) : null;

        return `
          <div class="job-card ${cardClass}" id="job-${job.account_id}">
            <div class="job-header">
              <h3 class="job-title">${job.account_name}</h3>
              <div class="job-status">
                <span class="status-badge ${statusBadge}">${statusText}</span>
              </div>
            </div>

            <div class="job-details">
              <div class="detail-item">
                <span class="detail-label">Strategy</span>
                <span class="detail-value">${job.strategy}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Hedge %</span>
                <span class="detail-value">${job.hedge_percent}%</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Cadence</span>
                <span class="detail-value">${job.cadence_minutes} min</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Job Type</span>
                <span class="detail-value">${job.job_type}</span>
              </div>
            </div>

            <div class="job-metrics">
              <div class="metric">
                <div class="metric-value">${job.success_rate_percent || 0}%</div>
                <div class="metric-label">Success Rate</div>
              </div>
              <div class="metric">
                <div class="metric-value">${job.consecutive_failures || 0}</div>
                <div class="metric-label">Failures</div>
              </div>
              <div class="metric">
                <div class="metric-value">${job.recent_executions_count || 0}</div>
                <div class="metric-label">Recent Runs</div>
              </div>
            </div>

            <div class="job-details">
              <div class="detail-item">
                <span class="detail-label">Next Run</span>
                <span class="detail-value">${nextRun ? this.formatRelativeTime(nextRun) : 'Not scheduled'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Last Run</span>
                <span class="detail-value">${lastRun ? this.formatRelativeTime(lastRun) : 'Never'}</span>
              </div>
            </div>

            <div class="job-actions">
              <button class="btn-primary view-details-btn" data-account-id="${job.account_id}">
                📊 View Details
              </button>
              <button class="btn-success force-run-btn" data-account-id="${job.account_id}"
                      ${job.is_running ? 'disabled' : ''}>
                ▶️ ${job.is_running ? 'Running...' : 'Force Run'}
              </button>
            </div>
          </div>
        `;
    }

    setupJobCardListeners(card, job) {
        // View details button
        const viewDetailsBtn = card.querySelector('.view-details-btn');
        if (viewDetailsBtn) {
            viewDetailsBtn.addEventListener('click', () => {
                window.location.href = `active_job_details.html?account_id=${encodeURIComponent(job.account_id)}`;
            });
        }

        // Force run button
        const forceRunBtn = card.querySelector('.force-run-btn');
        if (forceRunBtn && !job.is_running) {
            forceRunBtn.addEventListener('click', () => this.forceJobExecution(job.account_id));
        }
    }

    // Utility functions for job cards
    formatRelativeTime(date) {
        if (typeof date === 'string') {
            if (date.includes('T') && !date.includes('Z') && !date.includes('+') && !date.includes('-', date.indexOf('T'))) {
                date = date + 'Z';
            }
            date = new Date(date);
        }

        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const absDiff = Math.abs(diff);

        if (absDiff < 60000) return diff < 0 ? 'Soon' : 'Just now';
        if (absDiff < 3600000) {
            const mins = Math.floor(absDiff / 60000);
            return diff < 0 ? `In ${mins}m` : `${mins}m ago`;
        }
        if (absDiff < 86400000) {
            const hours = Math.floor(absDiff / 3600000);
            return diff < 0 ? `In ${hours}h` : `${hours}h ago`;
        }
        if (absDiff < 604800000) {
            const days = Math.floor(absDiff / 86400000);
            return diff < 0 ? `In ${days}d` : `${days}d ago`;
        }

        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    renderJobHistoryPlaceholder() {
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
                <td class="schedule-display">
                    <div class="schedule-item next-run">
                        <span class="schedule-label">Next:</span>
                        <span class="schedule-time">${nextRun}</span>
                    </div>
                    <div class="schedule-item last-run">
                        <span class="schedule-label">Last:</span>
                        <span class="schedule-time">${lastRun}</span>
                    </div>
                </td>
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
        
        tbody.innerHTML = executions.map(execution => {
            // Handle potential field name variations
            const accountId = execution.account_id || execution.accountId || execution.account || 'N/A';
            const accountName = execution.account_name || 'Unknown';
            return `
            <tr>
                <td title="${execution.id}">${this.truncateId(execution.id)}</td>
                <td title="${accountName} (${accountId})">${accountName}</td>
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
                    ${execution.status === 'RUNNING' ? '<span class="text-info">⏳ Running...</span>' :
                      execution.status === 'SUCCEEDED' && execution.spot_manager_result?.user_message 
                        ? `<span title="${execution.spot_manager_result.user_message}">${execution.spot_manager_result.user_message.substring(0, 30)}${execution.spot_manager_result.user_message.length > 30 ? '...' : ''}</span>`
                        : execution.status === 'SUCCEEDED' && execution.spot_manager_result?.admin_message?.status === 'success'
                        ? '<span class="text-success">✅ Replication Successful</span>'
                        : execution.status === 'SUCCEEDED' 
                        ? '<span class="text-success">✅ Completed</span>'
                        : execution.error_info ? '<span class="text-danger">❌ Error</span>' : 'N/A'
                    }
                    ${execution.spot_manager_result?.current_total_value 
                        ? `<br><small class="text-success">$${execution.spot_manager_result.current_total_value.toFixed(2)}</small>`
                        : ''
                    }
                </td>
                <td>
                    <div class="job-actions">
                        <button class="job-action-btn details" onclick="jobsManager.showExecutionDetails('${execution.id}')">
                            📋 Details
                        </button>
                        ${execution.status === 'RUNNING' ? `
                            <button class="job-action-btn kill" onclick="jobsManager.killJobExecution('${execution.id}', '${accountName}')">
                                🛑 Kill
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }

    async showExecutionDetails(executionId) {
        const modal = document.getElementById('execution-details-modal');
        const content = document.getElementById('execution-details-content');

        // Show loading state
        content.innerHTML = `<div class="loading-state"><p>Loading execution details and logs...</p></div>`;
        modal.style.display = 'block';

        try {
            console.log('📊 Fetching execution details for:', executionId);

            // Fetch both execution details and logs in parallel
            const [executionResponse, logsResponse] = await Promise.all([
                this.makeAuthenticatedRequest(
                    getApiUrl(`/admin/jobs-manager/job-execution/${executionId}`)
                ),
                this.makeAuthenticatedRequest(
                    getApiUrl(`/admin/jobs/execution/${executionId}/logs`)
                )
            ]);

            const executionData = await executionResponse.json();
            const logsData = await logsResponse.json();

            if (executionResponse.ok && executionData.success && executionData.execution) {
                const execution = executionData.execution;
                
                content.innerHTML = `
                    <div class="execution-details">
                        ${logsData.success && logsData.log_content ? `
                            <div class="execution-section">
                                <h4>📋 Detailed Execution Logs</h4>
                                <div class="log-info">
                                    <p><strong>Log File:</strong> ${logsData.log_file_path || 'N/A'}</p>
                                    <p><strong>File Size:</strong> ${logsData.file_size_bytes ? `${(logsData.file_size_bytes / 1024).toFixed(1)} KB` : 'N/A'}</p>
                                </div>
                                <div class="log-content" style="max-height: 400px; overflow-y: auto; background: #1e1e1e; color: #f8f8f2; padding: 15px; border-radius: 6px; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; line-height: 1.4; white-space: pre-wrap;">${logsData.log_content}</div>
                            </div>
                        ` : `
                            <div class="execution-section">
                                <h4>📋 Execution Logs</h4>
                                <div class="execution-field">
                                    <span class="text-warning">⚠️ ${logsData.message || 'No detailed execution logs available for this job.'}</span>
                                </div>
                            </div>
                        `}

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
                        
                        ${execution.status === 'RUNNING' ? `
                            <div class="execution-section">
                                <h4>Job Status</h4>
                                <div class="execution-field">
                                    <strong>Current Status:</strong>
                                    <span class="text-info">⏳ Job is currently executing...</span>
                                </div>
                            </div>
                        ` : execution.spot_manager_result ? `
                            <div class="execution-section">
                                <h4>Execution Results</h4>
                                <div class="execution-field">
                                    <strong>Result Message:</strong>
                                    <span>${execution.spot_manager_result.user_message || 
                                        (execution.spot_manager_result.admin_message?.status === 'success' ? '✅ Futures Replication Successful' : 
                                         execution.status === 'SUCCEEDED' ? '✅ Job Completed Successfully' : 'N/A')}</span>
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

    async killJobExecution(executionId, accountName) {
        try {
            const confirmed = confirm(`Are you sure you want to kill the running job execution for account "${accountName}"?\n\nExecution ID: ${executionId}\n\nThis action cannot be undone.`);
            
            if (!confirmed) {
                return;
            }
            
            console.log('🛑 Killing job execution:', executionId);
            
            const response = await this.makeAuthenticatedRequest(
                getApiUrl(`/admin/jobs-manager/kill-execution/${executionId}`),
                {
                    method: 'POST'
                }
            );
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                console.log('✅ Job execution killed successfully');
                
                // Show success message
                this.showMessage('success', `Job execution for ${accountName} has been terminated`);
                
                // Refresh the job history to show updated status
                await this.loadJobHistory();
                
            } else {
                console.error('❌ Failed to kill job execution:', data.message);
                this.showMessage('error', `Failed to kill job execution: ${data.message || 'Unknown error'}`);
            }
            
        } catch (error) {
            console.error('❌ Error killing job execution:', error);
            this.showMessage('error', `Error killing job execution: ${error.message}`);
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
        this.currentFilters.userName = document.getElementById('user-name-filter').value.toLowerCase();
        this.currentFilters.accountName = document.getElementById('account-name-filter').value.toLowerCase();
        this.loadActiveJobs();
    }

    filterActiveJobs(jobs) {
        if (!jobs) return [];
        
        return jobs.filter(job => {
            // Filter by job status
            if (this.currentFilters.jobStatus && job.status !== this.currentFilters.jobStatus) {
                return false;
            }
            
            // Filter by run status
            if (this.currentFilters.runStatus && job.run_status !== this.currentFilters.runStatus) {
                return false;
            }
            
            // Filter by user name
            if (this.currentFilters.userName) {
                const userName = (job.username || '').toLowerCase();
                if (!userName.includes(this.currentFilters.userName)) {
                    return false;
                }
            }
            
            // Filter by account name
            if (this.currentFilters.accountName) {
                const accountName = (job.account_name || '').toLowerCase();
                if (!accountName.includes(this.currentFilters.accountName)) {
                    return false;
                }
            }
            
            return true;
        });
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
            
            const response = await this.makeAuthenticatedRequest(getApiUrl(endpoint), {
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
            // Reset button state before closing modal
            confirmBtn.disabled = false;
            confirmBtn.textContent = confirmBtn.dataset.action === 'force' ? 'Force Execution' : 
                                   confirmBtn.dataset.action === 'pause' ? 'Pause Job' : 'Resume Job';
            
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
                getApiUrl('/admin/jobs-manager/active-jobs')
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
                        getApiUrl(`/admin/jobs-manager/job-execution/${jobConfig.last_job_id}`)
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
                    getApiUrl(`/admin/jobs-manager/job-executions/${accountId}?limit=5`)
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
                            ${lastExecution.status === 'RUNNING' ? `
                                <div class="execution-field">
                                    <strong>Current Status:</strong>
                                    <span class="text-info">⏳ Currently executing...</span>
                                </div>
                            ` : lastExecution.spot_manager_result ? `
                                <div class="execution-field">
                                    <strong>Result Message:</strong>
                                    <span>${lastExecution.spot_manager_result.user_message || 
                                        (lastExecution.spot_manager_result.admin_message?.status === 'success' ? '✅ Futures Replication Successful' : 
                                         lastExecution.status === 'SUCCEEDED' ? '✅ Job Completed Successfully' : 'N/A')}</span>
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
            const csvData = this.currentJobHistoryData.map(execution => {
                // Handle potential field name variations
                const accountId = execution.account_id || execution.accountId || execution.account || '';
                return [
                    execution.id || '',
                    accountId,
                    execution.account_name || '',
                    execution.status || '',
                    execution.started_at || '',
                    execution.completed_at || '',
                    execution.duration_seconds || '',
                    execution.worker_id || '',
                    execution.result_summary || '',
                    execution.error || ''
                ];
            });

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

    showAuditChanges() {
        // Populate account filter from current active jobs
        const accountFilter = document.getElementById('audit-account-filter');
        accountFilter.innerHTML = '<option value="">All Accounts</option>';
        
        this.currentActiveJobs.forEach(account => {
            const option = document.createElement('option');
            option.value = account.account_id;
            option.textContent = `${account.account_name || account.account_id}`;
            accountFilter.appendChild(option);
        });
        
        document.getElementById('audit-changes-modal').style.display = 'block';
    }

    async loadAuditChanges() {
        const tbody = document.querySelector('#audit-changes-table tbody');
        const csvButton = document.getElementById('download-audit-csv');
        
        // Show loading state
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-message">Loading audit changes...</td>
            </tr>
        `;
        
        // Hide CSV button during loading
        if (csvButton) csvButton.style.display = 'none';
        
        try {
            // Get filter values
            const changeType = document.getElementById('audit-change-type-filter').value;
            const accountId = document.getElementById('audit-account-filter').value;
            const limit = parseInt(document.getElementById('audit-limit').value) || 100;
            
            // Build query parameters
            const params = new URLSearchParams();
            if (changeType) params.append('change_type', changeType);
            if (accountId) params.append('account_id', accountId);
            params.append('limit', limit.toString());
            
            const response = await this.makeAuthenticatedRequest(
                getApiUrl(`/admin/jobs-manager/audit-changes?${params.toString()}`)
            );
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.currentAuditChanges = data.changes || [];
                this.renderAuditChanges(this.currentAuditChanges);
            } else {
                throw new Error(data.message || 'Failed to load audit changes');
            }
            
        } catch (error) {
            console.error('❌ Failed to load audit changes:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="loading-message">Failed to load audit changes: ${error.message}</td>
                </tr>
            `;
        }
    }

    renderAuditChanges(changes) {
        const tbody = document.querySelector('#audit-changes-table tbody');
        const csvButton = document.getElementById('download-audit-csv');
        
        if (!changes || changes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="loading-message">No audit changes found</td>
                </tr>
            `;
            // Hide CSV button when no data
            if (csvButton) csvButton.style.display = 'none';
            return;
        }
        
        // Show CSV button when data is loaded
        if (csvButton) csvButton.style.display = 'inline-block';
        
        tbody.innerHTML = changes.map(change => {
            const changeTypeClass = this.getChangeTypeClass(change.change_type);
            const detailsText = this.formatChangeDetails(change.details, change.change_type);
            
            return `
            <tr>
                <td class="time-display">${this.formatDateTime(change.timestamp)}</td>
                <td>
                    <span class="status-badge ${changeTypeClass}">${this.formatChangeType(change.change_type)}</span>
                </td>
                <td>${change.details.account_name || 'Unknown'}</td>
                <td title="${change.account_id}">${this.truncateId(change.account_id)}</td>
                <td title="${change.user_id}">${this.truncateId(change.user_id)}</td>
                <td>
                    <div class="change-details" title="${detailsText}">
                        ${detailsText.length > 50 ? detailsText.substring(0, 50) + '...' : detailsText}
                    </div>
                </td>
                <td>
                    <button class="job-action-btn details" onclick="jobsManager.showChangeDetails('${change.id}')">
                        📋 Details
                    </button>
                </td>
            </tr>
            `;
        }).join('');
    }

    getChangeTypeClass(changeType) {
        const classMap = {
            'job_created': 'success',
            'configuration_change': 'warning',
            'status_change': 'info',
            'job_restored': 'success',
            'cadence_consistency_fix': 'warning',
            'account_migration': 'info'
        };
        return classMap[changeType] || 'unknown';
    }

    formatChangeType(changeType) {
        const typeMap = {
            'job_created': 'Job Created',
            'configuration_change': 'Config Change',
            'configuration_change_analysis': 'Config Analysis',
            'configuration_change_analysis_legacy': 'Config Analysis (Legacy)',
            'status_change': 'Status Change',
            'job_restored': 'Job Restored',
            'cadence_consistency_fix': 'Cadence Fix',
            'account_migration': 'Account Migration'
        };
        return typeMap[changeType] || changeType.replace('_', ' ');
    }

    formatChangeDetails(details, changeType) {
        switch (changeType) {
            case 'configuration_change_analysis':
            case 'configuration_change_analysis_legacy':
                return this.formatConfigurationChangeAnalysis(details);
                
            case 'configuration_change':
                const changes = details.changes || {};
                const changeList = Object.keys(changes).map(key => 
                    `${key}: ${JSON.stringify(changes[key].old)} → ${JSON.stringify(changes[key].new)}`
                ).join(', ');
                return changeList || 'Configuration updated';
                
            case 'status_change':
                return `${details.old_status} → ${details.new_status}${details.liquidation_queued ? ' (Liquidation queued)' : ''}`;
                
            case 'job_created':
                return `Strategy: ${details.strategy}, Type: ${details.job_type}, Cadence: ${details.cadence_minutes}min`;
                
            case 'job_restored':
                return `Restored from ${details.restored_from} to ${details.restored_to}`;
                
            case 'cadence_consistency_fix':
                return `Cadence: ${details.old_cadence_minutes}min → ${details.new_cadence_minutes}min`;
                
            case 'account_migration':
                return `Migration: ${details.migration_reason} - Set to ${details.default_value_set}`;
                
            default:
                return JSON.stringify(details).substring(0, 100);
        }
    }

    formatConfigurationChangeAnalysis(details) {
        try {
            const changes = details.changes || {};
            const driftResult = details.portfolio_drift_result;
            const isSignificant = details.is_significant;
            const actionTaken = details.action_taken;
            
            // Start building summary
            let summary = [];
            
            // Handle portfolio changes with drift analysis
            if (changes.target_portfolio && driftResult) {
                const driftSummary = driftResult.summary;
                if (driftSummary) {
                    const decision = driftSummary.rebalance_decision === 'needed' ? 'REBALANCE NEEDED' : 'No rebalance needed';
                    const maxDrift = driftSummary.max_drift_percentage;
                    const assetsNeedingAdjustment = driftSummary.assets_needing_adjustment;
                    
                    if (driftSummary.rebalance_decision === 'needed') {
                        summary.push(`🔴 ${decision} - ${assetsNeedingAdjustment}/${driftSummary.total_assets} assets drift >${driftSummary.threshold_percentage}% (max: ${maxDrift}%)`);
                    } else {
                        summary.push(`🟢 ${decision} - Max drift: ${maxDrift}% (threshold: ${driftSummary.threshold_percentage}%)`);
                    }
                } else {
                    summary.push('Portfolio updated - drift analysis included');
                }
            }
            
            // Handle other configuration changes
            const otherChanges = Object.keys(changes).filter(key => key !== 'target_portfolio');
            if (otherChanges.length > 0) {
                const changeList = otherChanges.map(key => {
                    const change = changes[key];
                    if (key === 'rebalance_frequency') {
                        return `${key}: ${change.old} → ${change.new}`;
                    }
                    return `${key}: ${JSON.stringify(change.old)} → ${JSON.stringify(change.new)}`;
                });
                summary.push(...changeList);
            }
            
            // Add action taken
            if (actionTaken) {
                const actionText = actionTaken === 'job_updated' ? '✅ Job updated' : '⏸️ No action (within threshold)';
                summary.push(actionText);
            }
            
            return summary.length > 0 ? summary.join(' | ') : 'Configuration analyzed';
            
        } catch (error) {
            console.error('Error formatting configuration change analysis:', error);
            return 'Configuration change with analysis';
        }
    }

    showChangeDetails(changeId) {
        const change = this.currentAuditChanges?.find(c => c.id === changeId);
        if (!change) return;
        
        const modal = document.getElementById('execution-details-modal');
        const content = document.getElementById('execution-details-content');
        
        content.innerHTML = `
            <div class="execution-details">
                <div class="execution-section">
                    <h4>Change Information</h4>
                    <div class="execution-field">
                        <strong>Change Type:</strong>
                        <span class="status-badge ${this.getChangeTypeClass(change.change_type)}">${this.formatChangeType(change.change_type)}</span>
                    </div>
                    <div class="execution-field">
                        <strong>Timestamp:</strong>
                        <span>${this.formatDateTime(change.timestamp)}</span>
                    </div>
                    <div class="execution-field">
                        <strong>Account:</strong>
                        <span>${change.details.account_name || 'Unknown'} (${change.account_id})</span>
                    </div>
                    <div class="execution-field">
                        <strong>User ID:</strong>
                        <span>${change.user_id}</span>
                    </div>
                </div>
                
                <div class="execution-section">
                    <h4>Change Details</h4>
                    <div class="json-display">
                        ${JSON.stringify(change.details, null, 2)}
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
    }

    downloadAuditChangesCSV() {
        if (!this.currentAuditChanges || this.currentAuditChanges.length === 0) {
            alert('No audit changes data to export');
            return;
        }
        
        try {
            const headers = ['Timestamp', 'Change Type', 'Account ID', 'Account Name', 'User ID', 'Details Summary', 'Full Details'];
            
            const csvData = this.currentAuditChanges.map(change => {
                const detailsText = this.formatChangeDetails(change.details, change.change_type);
                const fullDetails = JSON.stringify(change.details);
                
                return [
                    change.timestamp,
                    this.formatChangeType(change.change_type),
                    change.account_id || '',
                    change.details.account_name || '',
                    change.user_id || '',
                    `"${detailsText.replace(/"/g, '""')}"`,
                    `"${fullDetails.replace(/"/g, '""')}"`
                ];
            });
            
            // Create CSV content
            const csvContent = [headers, ...csvData]
                .map(row => row.join(','))
                .join('\n');
                
            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `audit_changes_${new Date().toISOString().split('T')[0]}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                console.log('📥 Audit changes CSV downloaded successfully');
            }
        } catch (error) {
            console.error('❌ Error generating audit CSV:', error);
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