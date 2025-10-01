import CONFIG from './frontend-config.js';

const JOBS_API_BASE = (CONFIG.CONFIG_UTILS?.getJobsApiUrl?.('') || CONFIG.API_CONFIG.jobsUrl).replace(/\/$/, '');
const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'auth.html';
}

function authHeaders() {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {})
    }
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = 'auth.html';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  return response.json();
}

const params = new URLSearchParams(window.location.search);
const executionId = params.get('executionId');
let currentLines = parseInt(params.get('lines') || '400', 10);
if (!Number.isFinite(currentLines) || currentLines < 10) {
  currentLines = 400;
}

const logElement = document.getElementById('viewer-log');
const titleElement = document.getElementById('viewer-title');
const executionElement = document.getElementById('viewer-execution');
const activeElement = document.getElementById('viewer-active');
const pathElement = document.getElementById('viewer-path');
const statusElement = document.getElementById('viewer-status');
const linesSelect = document.getElementById('viewer-lines');
const refreshButton = document.getElementById('viewer-refresh');
const autoRefreshCheckbox = document.getElementById('viewer-autorefresh');
const updatedElement = document.getElementById('viewer-updated');
const downloadButton = document.getElementById('viewer-download');
const copyApiButton = document.getElementById('viewer-copy-api');

let currentLogPayload = null;
let autoRefreshTimer = null;
let cachedJobMeta = null;

function formatTimestamp(value) {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return value;
  }
}

function setStatus(message, variant = '') {
  if (!statusElement) return;
  statusElement.textContent = message || '';
  statusElement.classList.remove('error', 'success');
  if (variant) {
    statusElement.classList.add(variant);
  }
}

function scheduleAutoRefresh() {
  if (autoRefreshTimer) {
    clearTimeout(autoRefreshTimer);
    autoRefreshTimer = null;
  }
  if (autoRefreshCheckbox?.checked) {
    autoRefreshTimer = setTimeout(() => {
      loadLog();
    }, 30_000);
  }
}

async function loadJobMetadata() {
  if (!executionId) return;
  try {
    cachedJobMeta = await fetchJson(`${JOBS_API_BASE}/admin/jobs/${executionId}`);
    const label = cachedJobMeta.account_name || cachedJobMeta.account_id || executionId;
    titleElement.textContent = `Job Log • ${label}`;
    document.title = `Job Log • ${label}`;
  } catch (error) {
    setStatus(`Failed to load job metadata: ${error.message}`, 'error');
  }
}

async function loadLog() {
  if (!executionId) {
    logElement.textContent = 'Missing executionId query parameter.';
    setStatus('Cannot load log without an execution ID.', 'error');
    return;
  }

  if (linesSelect && linesSelect.value !== String(currentLines)) {
    linesSelect.value = String(currentLines);
  }

  setStatus('Loading log...');
  logElement.textContent = 'Loading log...';

  try {
    const payload = await fetchJson(`${JOBS_API_BASE}/admin/jobs/${executionId}/log?lines=${currentLines}`);
    currentLogPayload = payload;

    logElement.textContent = payload.content || 'Log file empty';
    executionElement.textContent = executionId;
    activeElement.textContent = payload.active_job_id || '—';
    pathElement.textContent = payload.log_path || '—';

    const updatedText = `Last updated ${formatTimestamp(new Date().toISOString())}`;
    if (updatedElement) {
      updatedElement.textContent = updatedText;
    }

    setStatus(`Showing last ${payload.lines || currentLines} lines.`, 'success');
    scheduleAutoRefresh();
  } catch (error) {
    logElement.textContent = `Log unavailable: ${error.message}`;
    setStatus(error.message, 'error');
    scheduleAutoRefresh();
  }
}

function downloadLog() {
  if (!currentLogPayload) {
    return;
  }
  const content = currentLogPayload.content || '';
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${executionId || 'job-log'}.log`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function copyApiUrl() {
  if (!navigator.clipboard || !executionId) {
    return;
  }
  const apiUrl = `${JOBS_API_BASE}/admin/jobs/${executionId}/log?lines=${currentLines}`;
  const curl = `curl -H "Authorization: Bearer <TOKEN>" "${apiUrl}"`;
  try {
    await navigator.clipboard.writeText(curl);
    setStatus('Copied API command to clipboard.', 'success');
  } catch (error) {
    setStatus('Failed to copy API command.', 'error');
  }
}

if (linesSelect) {
  linesSelect.addEventListener('change', () => {
    const parsed = parseInt(linesSelect.value, 10);
    if (Number.isFinite(parsed) && parsed >= 10) {
      currentLines = parsed;
      loadLog();
    }
  });
  linesSelect.value = String(currentLines);
}

refreshButton?.addEventListener('click', () => {
  loadLog();
});

autoRefreshCheckbox?.addEventListener('change', () => {
  scheduleAutoRefresh();
});

downloadButton?.addEventListener('click', () => {
  downloadLog();
});

copyApiButton?.addEventListener('click', () => {
  copyApiUrl();
});

if (!executionId) {
  setStatus('Missing executionId parameter.', 'error');
  logElement.textContent = 'Provide an executionId query parameter to view a log.';
} else {
  loadJobMetadata().finally(() => {
    loadLog();
  });
}
