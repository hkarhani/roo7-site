import CONFIG from './frontend-config.js';

const AUTH_API_BASE = CONFIG.API_CONFIG.authUrl;
const JOBS_API_BASE = (CONFIG.CONFIG_UTILS?.getJobsApiUrl?.('') || CONFIG.API_CONFIG.jobsUrl).replace(/\/$/, '');

const token = localStorage.getItem('token');

function requireToken() {
  if (!token) {
    window.location.href = 'auth.html';
    throw new Error('Authentication required');
  }
}

function getAuthHeaders() {
  requireToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {})
    }
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = 'auth.html';
    return Promise.reject(new Error('Unauthorized'));
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  return response.json();
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch (e) {
    return value;
  }
}

function formatDuration(seconds) {
  if (seconds == null) return '—';
  return `${seconds.toFixed(1)}s`;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

async function loadSummary() {
  try {
    const summary = await fetchJson(`${JOBS_API_BASE}/admin/jobs/summary`);
    setText('jobs-total', summary.total_jobs);
    setText('jobs-success', summary.total_success);
    setText('jobs-failed', summary.total_failed);
    setText('jobs-last-execution', formatDate(summary.last_execution));
    setText('jobs-last-failure', summary.last_failure ? formatDate(summary.last_failure) : '—');
  } catch (error) {
    console.error('Failed to load jobs summary', error);
    setText('jobs-total', '—');
    setText('jobs-success', '—');
    setText('jobs-failed', '—');
  }
}

function renderJobsTable(items) {
  const tbody = document.getElementById('jobs-table-body');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">No job executions found</td></tr>';
    return;
  }
  tbody.innerHTML = items.map(item => {
    const statusClass = item.status === 'FAILED' ? 'status-failed' : 'status-success';
    return `
      <tr data-id="${item._id}" class="job-row">
        <td>${item.job_type || '—'}</td>
        <td>${item.account_name || item.account_id || '—'}</td>
        <td>${item.strategy || '—'}</td>
        <td><span class="status-badge ${statusClass}">${item.status || '—'}</span></td>
        <td>${formatDate(item.completed_at)}</td>
        <td>${formatDuration(item.duration_seconds)}</td>
      </tr>
    `;
  }).join('');
}

async function loadJobs() {
  const status = document.getElementById('filter-status').value;
  const jobType = document.getElementById('filter-job-type').value;
  const accountSearch = document.getElementById('filter-account').value.trim();

  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (jobType) params.append('job_type', jobType);
  if (accountSearch) params.append('account_id', accountSearch);
  params.append('limit', '100');

  try {
    const data = await fetchJson(`${JOBS_API_BASE}/admin/jobs?${params.toString()}`);
    renderJobsTable(data.items || []);
    attachJobRowHandlers();
  } catch (error) {
    console.error('Failed to load job executions', error);
    renderJobsTable([]);
  }
}

function renderActiveJobs(items) {
  const container = document.getElementById('active-jobs-list');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<div class="empty">No active jobs found.</div>';
    return;
  }
  container.innerHTML = items.map(item => `
      <div class="active-job-card">
        <div class="active-job-header">
          <h4>${item.account_name || item.account_id || 'Unknown Account'}</h4>
          <span class="badge badge-${item.status?.toLowerCase() || 'unknown'}">${item.status || '—'}</span>
        </div>
        <div class="active-job-body">
          <div><strong>Run Status:</strong> ${item.run_status || '—'}</div>
          <div><strong>Job Type:</strong> ${item.job_type || '—'}</div>
          <div><strong>Strategy:</strong> ${item.strategy || '—'}</div>
          <div><strong>Next Run:</strong> ${formatDate(item.next_run_at)}</div>
          <div><strong>Last Run:</strong> ${formatDate(item.last_run_at)}</div>
          <div><strong>Failures:</strong> ${item.consecutive_failures || 0}</div>
        </div>
      </div>
    `).join('');
}

async function loadActiveJobs() {
  try {
    const data = await fetchJson(`${JOBS_API_BASE}/admin/active-jobs?limit=100`);
    renderActiveJobs(data.items || []);
  } catch (error) {
    console.error('Failed to load active jobs', error);
    renderActiveJobs([]);
  }
}

async function showJobDetails(executionId) {
  const detailsContainer = document.getElementById('job-detail');
  const logContainer = document.getElementById('job-log');
  const logContent = document.getElementById('job-log-content');
  if (!detailsContainer || !logContainer || !logContent) return;

  try {
    const job = await fetchJson(`${JOBS_API_BASE}/admin/jobs/${executionId}`);
    detailsContainer.innerHTML = `
      <h3>Execution Details</h3>
      <div class="detail-grid">
        <div><strong>Account:</strong> ${job.account_name || job.account_id || '—'}</div>
        <div><strong>Status:</strong> ${job.status || '—'}</div>
        <div><strong>Job Type:</strong> ${job.job_type || '—'}</div>
        <div><strong>Started:</strong> ${formatDate(job.started_at)}</div>
        <div><strong>Completed:</strong> ${formatDate(job.completed_at)}</div>
        <div><strong>Duration:</strong> ${formatDuration(job.duration_seconds)}</div>
        <div><strong>Worker:</strong> ${job.worker_id || 'observer'}</div>
        <div><strong>Failures:</strong> ${job.error_info?.message || '—'}</div>
      </div>
      <pre class="result-json">${JSON.stringify(job.result_details || {}, null, 2)}</pre>
    `;

    try {
      const log = await fetchJson(`${JOBS_API_BASE}/admin/jobs/${executionId}/log?lines=400`);
      logContent.textContent = log.content || 'Log file empty';
    } catch (logError) {
      logContent.textContent = `Log unavailable: ${logError.message}`;
    }

    detailsContainer.classList.remove('hidden');
    logContainer.classList.remove('hidden');
  } catch (error) {
    detailsContainer.innerHTML = `<div class="error">Failed to load job details: ${error.message}</div>`;
    logContent.textContent = '';
  }
}

function attachJobRowHandlers() {
  document.querySelectorAll('.job-row').forEach(row => {
    row.addEventListener('click', () => {
      const executionId = row.getAttribute('data-id');
      if (executionId) {
        showJobDetails(executionId);
      }
    });
  });
}

function setupFilters() {
  document.getElementById('apply-filters').addEventListener('click', () => {
    loadJobs();
  });

  document.getElementById('refresh-summary').addEventListener('click', () => {
    loadSummary();
    loadJobs();
    loadActiveJobs();
  });
}

function initNavigation() {
  document.getElementById('back-to-dashboard').addEventListener('click', () => {
    window.location.href = 'admin-dashboard.html';
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = 'auth.html';
  });
}

window.addEventListener('DOMContentLoaded', () => {
  requireToken();
  initNavigation();
  setupFilters();
  loadSummary();
  loadJobs();
  loadActiveJobs();
});
