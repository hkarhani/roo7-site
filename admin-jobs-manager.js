import CONFIG from './frontend-config.js';

const AUTH_API_BASE = CONFIG.API_CONFIG.authUrl;
const JOBS_API_BASE = (CONFIG.CONFIG_UTILS?.getJobsApiUrl?.('') || CONFIG.API_CONFIG.jobsUrl).replace(/\/$/, '');

const token = localStorage.getItem('token');

let currentExecutionId = null;
let currentJobDetails = null;
let currentLogLines = 400;
let currentPage = 1;
let currentPageSize = 10;
let currentJobsTotal = 0;

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

const dateTimeFormatterCache = new Map();

function formatDate(value) {
  if (!value) return '—';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const cacheKey = `date-${timeZone}`;
    let formatter = dateTimeFormatterCache.get(cacheKey);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone,
      });
      dateTimeFormatterCache.set(cacheKey, formatter);
    }

    return formatter.format(date);
  } catch (e) {
    return value;
  }
}

function formatDuration(seconds) {
  if (seconds == null) return '—';
  return `${seconds.toFixed(1)}s`;
}

function hasKeys(value) {
  return value && typeof value === 'object' && Object.keys(value).length > 0;
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
  params.append('limit', String(currentPageSize));
  params.append('offset', String(Math.max(0, (currentPage - 1) * currentPageSize)));

  try {
    const data = await fetchJson(`${JOBS_API_BASE}/admin/jobs?${params.toString()}`);
    currentJobsTotal = data.total || 0;
    const items = data.items || [];

    if (!items.length && currentJobsTotal > 0 && currentPage > 1) {
      const totalPages = Math.max(1, Math.ceil(currentJobsTotal / currentPageSize));
      if (currentPage > totalPages) {
        currentPage = totalPages;
        return loadJobs();
      }
    }

    renderJobsTable(items);
    attachJobRowHandlers();
    updatePaginationControls();
  } catch (error) {
    console.error('Failed to load job executions', error);
    renderJobsTable([]);
    currentJobsTotal = 0;
    updatePaginationControls();
  }
}

function renderActiveJobs(items) {
  const container = document.getElementById('active-jobs-list');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<div class="empty">No active jobs found.</div>';
    return;
  }
  const rows = items.map(item => {
    const status = (item.status || 'UNKNOWN').toString().toUpperCase();
    const statusClass = status === 'ACTIVE'
      ? 'active'
      : status === 'DISABLED'
        ? 'disabled'
        : status === 'PENDING'
          ? 'pending'
          : 'unknown';

    return `
      <tr>
        <td>
          <div class="status-dot">
            <span class="status-indicator ${statusClass}" title="${status}"></span>
            <span>${item.account_name || item.account_id || 'Unknown Account'}</span>
          </div>
        </td>
        <td>${item.job_type || '—'}</td>
        <td>${item.run_status || '—'}</td>
        <td>${formatDate(item.next_run_at)}</td>
        <td>${formatDate(item.last_run_at)}</td>
        <td>${item.consecutive_failures || 0}</td>
        <td><button class="btn-force-run" data-id="${item._id}">Run Now</button></td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="active-jobs-summary">
      <thead>
        <tr>
          <th>Account</th>
          <th>Type</th>
          <th>Run Status</th>
          <th>Next Run</th>
          <th>Last Run</th>
          <th>Fails</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;

  container.querySelectorAll('.btn-force-run').forEach(button => {
    button.addEventListener('click', async (event) => {
      const id = button.getAttribute('data-id');
      if (!id) return;
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = 'Scheduling...';
      try {
        await fetchJson(`${JOBS_API_BASE}/admin/active-jobs/${encodeURIComponent(id)}/run-now`, {
          method: 'POST',
        });
        loadActiveJobs();
        loadJobs();
      } catch (error) {
        console.error('Failed to force job execution', error);
        alert(`Failed to force execution: ${error.message}`);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });
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

function renderJobDetails(job) {
  const detailsContainer = document.getElementById('job-detail');
  if (!detailsContainer) {
    return;
  }

  const resultDetails = job.result_details || {};
  const hasResultDetails = hasKeys(resultDetails);
  const rawJson = hasResultDetails
    ? JSON.stringify(resultDetails, null, 2)
    : 'No result payload available for this execution.';

  detailsContainer.innerHTML = `
    <h3>Execution Details</h3>
    <div class="detail-grid">
      <div><strong>Account:</strong> ${job.account_name || job.account_id || '—'}</div>
      <div><strong>Status:</strong> ${job.status || '—'}</div>
      <div><strong>Job Type:</strong> ${job.job_type || '—'}</div>
      <div><strong>Strategy:</strong> ${job.strategy || '—'}</div>
      <div><strong>Started:</strong> ${formatDate(job.started_at)}</div>
      <div><strong>Completed:</strong> ${formatDate(job.completed_at)}</div>
      <div><strong>Duration:</strong> ${formatDuration(job.duration_seconds)}</div>
      <div><strong>Worker:</strong> ${job.worker_id || 'observer'}</div>
      <div><strong>Error Info:</strong> ${job.error_info?.message || job.error_info || '—'}</div>
      <div><strong>Active Job ID:</strong> ${job.active_job_id || '—'}</div>
    </div>
    <details class="raw-json" ${hasResultDetails ? '' : 'open'}>
      <summary>Raw result JSON</summary>
      <pre class="result-json"></pre>
    </details>
  `;

  const jsonPre = detailsContainer.querySelector('.result-json');
  if (jsonPre) {
    jsonPre.textContent = rawJson;
  }

  if (!hasResultDetails) {
    detailsContainer.querySelector('.raw-json')?.setAttribute('open', '');
  }

  detailsContainer.classList.remove('hidden');
}

async function loadJobLog(linesOverride) {
  const logContainer = document.getElementById('job-log');
  const logContent = document.getElementById('job-log-content');
  const logMeta = document.getElementById('job-log-meta');
  const linesSelect = document.getElementById('job-log-lines');
  const logCard = document.getElementById('job-log-card');

  if (!logContainer || !logContent) {
    return;
  }

  if (!currentExecutionId) {
    logContent.textContent = 'Select a job execution to view its log.';
    if (logMeta) logMeta.textContent = '';
    logContainer.classList.add('hidden');
    logCard?.classList.add('hidden');
    return;
  }

  const requestedLines = Number.isFinite(linesOverride) ? linesOverride : currentLogLines;
  if (linesSelect && linesSelect.value !== String(requestedLines)) {
    linesSelect.value = String(requestedLines);
  }

  logContent.textContent = 'Loading log...';
  if (logMeta) {
    logMeta.textContent = '';
  }

  try {
    const log = await fetchJson(`${JOBS_API_BASE}/admin/jobs/${currentExecutionId}/log?lines=${requestedLines}`);
    logContent.textContent = log.content || 'Log file empty';
    currentLogLines = log.lines || requestedLines;
    if (logMeta) {
      const jobName = currentJobDetails?.account_name || currentJobDetails?.account_id || currentExecutionId;
      logMeta.textContent = `Active Job: ${log.active_job_id || 'n/a'} · Showing last ${currentLogLines} lines for ${jobName}`;
    }
  } catch (error) {
    logContent.textContent = `Log unavailable: ${error.message}`;
    if (logMeta) {
      logMeta.textContent = '';
    }
  }

  logContainer.classList.remove('hidden');
  logCard?.classList.remove('hidden');
}

async function showJobDetails(executionId) {
  const detailsContainer = document.getElementById('job-detail');
  const logContainer = document.getElementById('job-log');
  const logContent = document.getElementById('job-log-content');
  const linesSelect = document.getElementById('job-log-lines');
  const detailCard = document.getElementById('job-detail-card');
  const logCard = document.getElementById('job-log-card');

  if (!detailsContainer || !logContainer || !logContent) {
    return;
  }

  currentExecutionId = executionId;
  if (linesSelect && linesSelect.value) {
    currentLogLines = parseInt(linesSelect.value, 10) || currentLogLines;
  }

  detailsContainer.classList.remove('hidden');
  detailsContainer.innerHTML = '<h3>Execution Details</h3><p>Loading details...</p>';
  logContainer.classList.remove('hidden');
  logContent.textContent = 'Loading log...';
  detailCard?.classList.remove('hidden');
  logCard?.classList.remove('hidden');

  try {
    const job = await fetchJson(`${JOBS_API_BASE}/admin/jobs/${executionId}`);
    currentJobDetails = job;
    renderJobDetails(job);
    await loadJobLog(currentLogLines);
  } catch (error) {
    detailsContainer.innerHTML = `<div class="error">Failed to load job details: ${error.message}</div>`;
    logContent.textContent = '';
    currentJobDetails = null;
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
    currentPage = 1;
    loadJobs();
  });

  document.getElementById('refresh-summary').addEventListener('click', () => {
    loadSummary();
    loadJobs();
    loadActiveJobs();
  });
}

function getPaginationElements() {
  return {
    pageSizeSelect: document.getElementById('jobs-page-size'),
    prevButton: document.getElementById('jobs-prev'),
    nextButton: document.getElementById('jobs-next'),
    pageInfo: document.getElementById('jobs-page-info'),
  };
}

function updatePaginationControls() {
  const { pageSizeSelect, prevButton, nextButton, pageInfo } = getPaginationElements();

  if (pageSizeSelect && pageSizeSelect.value !== String(currentPageSize)) {
    pageSizeSelect.value = String(currentPageSize);
  }

  const totalPages = Math.max(1, Math.ceil((currentJobsTotal || 0) / currentPageSize));
  if (currentPage > totalPages) {
    currentPage = totalPages;
  }
  if (currentPage < 1) {
    currentPage = 1;
  }
  if (pageInfo) {
    const start = currentJobsTotal === 0 ? 0 : ((currentPage - 1) * currentPageSize) + 1;
    const end = Math.min(currentJobsTotal, currentPage * currentPageSize);
    const rangeText = currentJobsTotal === 0 ? '0' : `${start}-${end}`;
    pageInfo.textContent = `Page ${Math.min(currentPage, totalPages)} of ${totalPages} • Showing ${rangeText} of ${currentJobsTotal}`;
  }

  if (prevButton) {
    prevButton.disabled = currentPage <= 1;
  }
  if (nextButton) {
    nextButton.disabled = currentPage >= totalPages;
  }
}

function setupPaginationControls() {
  const { pageSizeSelect, prevButton, nextButton } = getPaginationElements();

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', () => {
      const parsed = parseInt(pageSizeSelect.value, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        currentPageSize = parsed;
        currentPage = 1;
        loadJobs();
      }
    });
  }

  if (prevButton) {
    prevButton.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage -= 1;
        loadJobs();
      }
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil((currentJobsTotal || 0) / currentPageSize));
      if (currentPage < totalPages) {
        currentPage += 1;
        loadJobs();
      }
    });
  }

  updatePaginationControls();
}

function setupLogControls() {
  const linesSelect = document.getElementById('job-log-lines');
  const refreshButton = document.getElementById('job-log-refresh');
  const openButton = document.getElementById('job-log-open');

  if (linesSelect) {
    linesSelect.addEventListener('change', () => {
      const parsed = parseInt(linesSelect.value, 10);
      currentLogLines = Number.isFinite(parsed) ? parsed : currentLogLines;
      loadJobLog(currentLogLines);
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      loadJobLog(currentLogLines);
    });
  }

  if (openButton) {
    openButton.addEventListener('click', () => {
      if (!currentExecutionId) return;
      const url = `job-log-viewer.html?executionId=${encodeURIComponent(currentExecutionId)}&lines=${currentLogLines}`;
      window.open(url, '_blank', 'noopener');
    });
  }
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
  if (window.themeManager) {
    window.themeManager.applySavedTheme();
  }
  requireToken();
  initNavigation();
  setupFilters();
  setupPaginationControls();
  setupLogControls();
  loadSummary();
  loadJobs();
  loadActiveJobs();
});
