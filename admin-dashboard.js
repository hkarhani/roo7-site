// admin-dashboard.js - Admin Dashboard Logic v3.6

console.log('🔧 Admin Dashboard Debug: Script loading started...');

import CONFIG from './frontend-config.js';

console.log('🔧 Admin Dashboard Debug: Config loaded:', CONFIG);

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch (e) {
    return value;
  }
}

function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined) return '0.00';
  const parsed = parseFloat(num);
  if (Number.isNaN(parsed)) return '0.00';
  return parsed.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

async function fetchJson(url, token) {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/auth.html';
    throw new Error('Unauthorized');
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }
  return response.json();
}

document.addEventListener('DOMContentLoaded', async () => {
  const INVOICING_API_BASE = CONFIG.API_CONFIG.invoicingUrl;
  const AUTH_API_BASE = CONFIG.API_CONFIG.authUrl;
  const JOBS_API_BASE = CONFIG.API_CONFIG.jobsUrl;

  const token = localStorage.getItem('token');
  if (!token) {
    console.log('❌ No token found, redirecting to auth...');
    setTimeout(() => window.location.href = '/auth.html', 2000);
    return;
  }

  try {
    const me = await fetchJson(`${AUTH_API_BASE}/me`, token);
    if (!me.is_admin) {
      document.body.innerHTML = '<p>Admin access required</p>';
      return;
    }
  } catch (error) {
    console.error('Admin verification failed:', error);
    window.location.href = '/auth.html';
    return;
  }

  await loadSystemOverview();
  await loadActiveAccounts();
  await loadUsersAccounts();
  await loadJobsPanel();
  attachEventListeners();

  async function loadSystemOverview() {
    try {
      const summary = await fetchJson(`${INVOICING_API_BASE}/admin/dashboard/summary`, token);
      try {
        const jobsSummary = await fetchJson(`${JOBS_API_BASE}/admin/jobs/summary`, token);
        summary.jobs_summary = jobsSummary;
      } catch (jobsError) {
        console.warn('Jobs summary fetch failed:', jobsError);
      }
      displaySystemOverview(summary.summary || summary || {});
    } catch (error) {
      console.error('Failed to load system overview:', error);
    }
  }

  function displaySystemOverview(summary) {
    const container = document.getElementById('overview-stats');
    const users = summary.users || {};
    const subscriptions = summary.subscriptions || {};
    const invoices = summary.invoices || {};
    const jobs = summary.jobs_summary || {};

    container.innerHTML = `
      <div class="overview-summary">
        <div class="stat-card admin clickable" onclick="window.location.href='/admin-users.html'">
          <div class="stat-icon">👥</div>
          <div class="stat-label">Total Users</div>
          <div class="stat-value">${users.total || 0}</div>
          <div class="stat-action">Click to manage →</div>
        </div>
        <div class="stat-card admin clickable" onclick="window.location.href='/admin-accounts.html'">
          <div class="stat-icon">💰</div>
          <div class="stat-label">Total Accounts</div>
          <div class="stat-value">${users.total_accounts || 0}</div>
          <div class="stat-action">Click to manage →</div>
        </div>
        <div class="stat-card admin clickable" onclick="window.location.href='/admin-users.html'">
          <div class="stat-icon">🔄</div>
          <div class="stat-label">Active Subs</div>
          <div class="stat-value">${subscriptions.active || 0}</div>
          <div class="stat-action">Click to manage →</div>
        </div>
        <div class="stat-card admin clickable" onclick="window.location.href='/admin-users.html'">
          <div class="stat-icon">📄</div>
          <div class="stat-label">Pending Invoices</div>
          <div class="stat-value">${invoices.pending || 0}</div>
          <div class="stat-action">Click to manage →</div>
        </div>
        <div class="stat-card admin clickable" onclick="window.location.href='/admin-users.html'">
          <div class="stat-icon">💰</div>
          <div class="stat-label">Total Revenue</div>
          <div class="stat-value">$${formatNumber(invoices.total_revenue || 0, 0)}</div>
          <div class="stat-action">Click to manage →</div>
        </div>
        <div class="stat-card admin clickable" onclick="window.location.href='/admin-jobs-manager.html'">
          <div class="stat-icon">🧮</div>
          <div class="stat-label">Jobs Executed</div>
          <div class="stat-value">${jobs.total_jobs || 0}</div>
          <div class="stat-action">View execution history →</div>
        </div>
        <div class="stat-card admin clickable" onclick="window.location.href='/admin-jobs-manager.html'">
          <div class="stat-icon">🚨</div>
          <div class="stat-label">Job Failures</div>
          <div class="stat-value">${jobs.total_failed || 0}</div>
          <div class="stat-action">Investigate recent failures →</div>
        </div>
      </div>
    `;
  }

  async function loadActiveAccounts() {
    try {
      const response = await fetchJson(`${AUTH_API_BASE}/admin/accounts/active-trading`, token);
      const accounts = response.accounts || [];
      const container = document.getElementById('active-accounts-container');
      if (!accounts.length) {
        container.innerHTML = '<div class="empty-state">No active trading accounts found.</div>';
        return;
      }
      container.innerHTML = accounts.map(account => `
        <div class="account-card">
          <h4>${account.account_name || 'Unnamed Account'}</h4>
          <p>User: ${account.username || account._user_id || 'Unknown'}</p>
          <p>Strategy: ${account.strategy || 'None'}</p>
          <p>Total Value: $${formatNumber(account.total_value || account.current_value || 0)}</p>
        </div>
      `).join('');
    } catch (error) {
      document.getElementById('active-accounts-container').innerHTML = `<div class="error-state"><p>${error.message}</p></div>`;
    }
  }

  async function loadUsersAccounts() {
    try {
      const response = await fetchJson(`${AUTH_API_BASE}/admin/accounts/users-accounts`, token);
      const accounts = response.accounts || [];
      const container = document.getElementById('users-accounts-container');
      if (!accounts.length) {
        container.innerHTML = '<div class="empty-state">No accounts without strategies found.</div>';
        return;
      }
      container.innerHTML = accounts.map(account => `
        <div class="account-card">
          <h4>${account.account_name || 'Unnamed Account'}</h4>
          <p>User: ${account.username || account._user_id || 'Unknown'}</p>
          <p>Exchange: ${account.exchange || 'Unknown'}</p>
        </div>
      `).join('');
    } catch (error) {
      document.getElementById('users-accounts-container').innerHTML = `<div class="error-state"><p>${error.message}</p></div>`;
    }
  }

  async function loadJobsPanel() {
    const overview = document.getElementById('jobs-overview');
    overview.innerHTML = '<div class="loading-state"><p>Loading jobs summary...</p></div>';
    try {
      const [summary, activeJobs] = await Promise.all([
        fetchJson(`${JOBS_API_BASE}/admin/jobs/summary`, token),
        fetchJson(`${JOBS_API_BASE}/admin/active-jobs?limit=5`, token)
      ]);

      renderJobsSummary(summary, activeJobs.items || []);
    } catch (error) {
      console.error('Jobs panel failed:', error);
      overview.innerHTML = `<div class="error-state"><p>Failed to load jobs summary: ${error.message}</p></div>`;
    }
  }

  function renderJobsSummary(summary, activeJobs) {
    const container = document.getElementById('jobs-overview');
    if (!container) {
      return;
    }

    const total = summary?.total_jobs ?? 0;
    const failures = summary?.total_failed ?? 0;
    const success = summary?.total_success ?? 0;
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
    const lastExecution = summary?.last_execution ? formatDate(summary.last_execution) : '—';
    const lastFailure = summary?.last_failure ? formatDate(summary.last_failure) : '—';

    const overviewCard = `
      <div class="status-card">
        <div class="status-header">
          <span class="status-icon">${total > 0 ? '🟢' : '🟡'}</span>
          <div>
            <h3>Observer Jobs Manager</h3>
            <p>${total} total executions</p>
          </div>
          <button class="secondary-button" onclick="window.open('/admin-jobs-manager.html', '_blank')">📊 Open Jobs Dashboard</button>
        </div>
        <div class="status-details">
          <div class="status-grid">
            <div>
              <strong>${success}</strong>
              <span>Successful</span>
            </div>
            <div>
              <strong>${failures}</strong>
              <span>Failures</span>
            </div>
            <div>
              <strong>${successRate}%</strong>
              <span>Success Rate</span>
            </div>
            <div>
              <strong>${lastExecution}</strong>
              <span>Last Execution</span>
            </div>
            <div>
              <strong>${lastFailure}</strong>
              <span>Last Failure</span>
            </div>
          </div>
        </div>
      </div>
    `;

    if (!activeJobs.length) {
      container.innerHTML = `
        ${overviewCard}
        <div class="empty-state">No active jobs currently scheduled.</div>
      `;
      return;
    }

    const activeJobsMarkup = activeJobs.map(job => `
      <div class="active-job-card">
        <div class="active-job-header">
          <h4>${job.account_name || job.account_id || 'Unknown Account'}</h4>
          <span class="badge badge-${(job.status || 'UNKNOWN').toLowerCase()}">${job.status || 'UNKNOWN'}</span>
        </div>
        <div class="active-job-body">
          <div><strong>Run Status:</strong> ${job.run_status || '—'}</div>
          <div><strong>Job Type:</strong> ${job.job_type || '—'}</div>
          <div><strong>Strategy:</strong> ${job.strategy || '—'}</div>
          <div><strong>Next Run:</strong> ${formatDate(job.next_run_at)}</div>
          <div><strong>Last Run:</strong> ${formatDate(job.last_run_at)}</div>
          <div><strong>Consecutive Failures:</strong> ${job.consecutive_failures || 0}</div>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      ${overviewCard}
      <div class="jobs-active-list">${activeJobsMarkup}</div>
    `;
  }

  function attachEventListeners() {
    document.getElementById('refresh-overview').addEventListener('click', async () => {
      await loadSystemOverview();
      await loadJobsPanel();
    });

    document.getElementById('refresh-active-accounts').addEventListener('click', loadActiveAccounts);
    document.getElementById('refresh-users-accounts').addEventListener('click', loadUsersAccounts);
    document.getElementById('refresh-jobs').addEventListener('click', loadJobsPanel);
    document.getElementById('open-jobs-dashboard').addEventListener('click', () => {
      window.open('/admin-jobs-manager.html', '_blank');
    });
  }
});
