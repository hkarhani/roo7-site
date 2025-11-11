import { API_CONFIG } from './frontend-config.js';

const AUTH_API_BASE = API_CONFIG.authUrl;
const MARKET_API_BASE = API_CONFIG.marketUrl;

const PERIODS = [
  { value: '24h', label: '24h', hours: 24 },
  { value: '7d', label: '7d', hours: 7 * 24 },
  { value: '30d', label: '30d', hours: 30 * 24 },
  { value: '90d', label: '90d', hours: 90 * 24 },
  { value: '180d', label: '180d', hours: 180 * 24 },
  { value: '1y', label: '1Y', hours: 365 * 24 }
];
const PERIOD_KEYS = PERIODS.map(({ value }) => value);
const PERIOD_INFO = Object.fromEntries(PERIODS.map(({ value, hours }) => [value, hours]));
const LONG_PERIODS = new Set(['90d', '180d', '1y']);
const COVERAGE_RATIO = 0.75;

const BENCHMARKS = [
  { value: 'composite', label: 'Composite' },
  { value: 'BTCUSDT', label: 'BTC' },
  { value: 'ETHUSDT', label: 'ETH' },
  { value: 'SOLUSDT', label: 'SOL' },
  { value: 'BNBUSDT', label: 'BNB' },
  { value: 'XRPUSDT', label: 'XRP' }
];
const SOURCE_COLORS = ['#ef4444', '#0ea5e9', '#14b8a6', '#a855f7'];

function getBenchmarkOption(value) {
  return BENCHMARKS.find((item) => item.value === value) || BENCHMARKS[0];
}

const state = {
  token: null,
  users: [],
  selectedUserId: 'ALL',
  accounts: [],
  selectedAccountIds: [],
  benchmark: 'composite',
  period: '7d',
  showPlatform: true,
  showBenchmark: true,
  showSourceBenchmark: true,
  chart: null,
  rawSeries: null,
  accountSummaries: new Map(),
  tableData: null,
  loadingChart: false,
  sourceAccounts: [],
  selectedSourceIds: [],
  sourcePerformance: null,
  sourceChart: null,
  sourceLoading: false,
  sourcePeriod: '7d',
  sourceTableData: null,
  selectedMetricsTarget: null,
  portfolioMetrics: null,
  sourceMetrics: null,
  metricsLoading: false,
  sourceColorMap: {}
};

const selectors = {
  totalValue: document.getElementById('total-portfolio-value'),
  totalUsers: document.getElementById('total-users'),
  totalAccounts: document.getElementById('total-accounts'),
  lastUpdated: document.getElementById('total-last-updated'),
  topUsersList: document.getElementById('top-users-list'),
  topUsersChart: document.getElementById('top-users-chart'),
  strategyContainer: document.getElementById('strategy-distribution'),
  strategyTotal: document.getElementById('strategy-total'),
  sourceContainer: document.getElementById('source-distribution'),
  sourceTotal: document.getElementById('source-total'),
  userFilter: document.getElementById('user-filter'),
  accountsList: document.getElementById('accounts-list'),
  toggleAllAccountsBtn: document.getElementById('toggle-all-accounts'),
  periodButtons: document.getElementById('period-buttons'),
  benchmarkButtons: document.getElementById('benchmark-buttons'),
  togglePlatform: document.getElementById('toggle-platform'),
  toggleBenchmark: document.getElementById('toggle-benchmark'),
  chartStatus: document.getElementById('chart-status'),
  chartContainer: document.getElementById('comparison-chart'),
  legend: document.getElementById('chart-legend'),
  tableBody: document.getElementById('snapshot-table-body'),
  logoutBtn: document.getElementById('logout-btn'),
  themeToggle: document.getElementById('theme-toggle'),
  footerYear: document.getElementById('footer-year'),
  sourceFilters: document.getElementById('source-account-filters'),
  sourceChartContainer: document.getElementById('source-comparison-chart'),
  sourceChartStatus: document.getElementById('source-chart-status'),
  sourcePeriodButtons: document.getElementById('source-period-buttons'),
  sourceBenchmarkToggle: document.getElementById('toggle-source-benchmark'),
  sourceTableBody: document.getElementById('source-table-body'),
  sourceLegendList: document.getElementById('source-strategy-legend')
};

function requireAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/auth.html';
    return null;
  }
  state.token = token;
  return token;
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${state.token}`
  };
}

async function authorizedFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...authHeaders()
    }
  });
  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/auth.html';
    return null;
  }
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }
  return response.json();
}

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2
  }).format(value);
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '0.00%';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function setChartStatus(text) {
  if (selectors.chartStatus) {
    selectors.chartStatus.textContent = text;
  }
}

async function loadOverview() {
  try {
    const data = await authorizedFetch(`${AUTH_API_BASE}/admin/portfolio-analytics/overview`);
    if (!data || !data.success) return;
    const totals = data.totals || {};
    selectors.totalValue.textContent = formatCurrency(totals.total_value || 0);
    selectors.totalUsers.textContent = totals.user_count || 0;
    selectors.totalAccounts.textContent = totals.account_count || 0;
    selectors.lastUpdated.textContent = totals.last_updated
      ? new Date(totals.last_updated).toLocaleString()
      : '--';
    renderTopUsers(data.top_users || [], data.remainder || null);
  } catch (error) {
    console.error('Overview load failed', error);
  }
}

function renderTopUsers(topUsers, remainder) {
  if (!topUsers.length) {
    selectors.topUsersList.innerHTML = '<li class="placeholder-copy">Waiting for data…</li>';
    selectors.topUsersChart.innerHTML = '<div class="empty-state small">No contributions yet</div>';
    return;
  }
  selectors.topUsersList.innerHTML = topUsers
    .map((user, idx) => `
      <li>
        <div class="info">
          <strong>${idx + 1}. ${user.name || 'User'}</strong>
          <span>${user.email || user.username || ''}</span>
        </div>
        <div class="value">
          ${formatCurrency(user.total_value)}
          <br/>
          <small>${user.percentage?.toFixed(1) || 0}%</small>
        </div>
      </li>
    `)
    .join('');
  const chartSegments = [...topUsers];
  if (remainder && remainder.value > 0.01) {
    chartSegments.push({
      name: 'Other',
      total_value: remainder.value,
      percentage: remainder.percentage
    });
  }
  const total = chartSegments.reduce((sum, item) => sum + (item.total_value || 0), 0) || 1;
  selectors.topUsersChart.innerHTML = `
    <div class="stacked-bar">
      ${chartSegments.map((segment, index) => {
        const pct = (segment.total_value / total) * 100;
        const hue = (index * 55) % 360;
        return `<span style="width:${pct}%;background:hsl(${hue} 75% 60% / 0.8)" title="${segment.name || 'User'}"></span>`;
      }).join('')}
    </div>
  `;
}

async function loadStrategyDistribution() {
  try {
    const data = await authorizedFetch(`${AUTH_API_BASE}/admin/portfolio-analytics/strategy-distribution`);
    if (!data || !data.success) return;
    const { strategies = [], total_value = 0 } = data;
    selectors.strategyTotal.textContent = `Total: ${formatCurrency(total_value)}`;
    if (!strategies.length) {
      selectors.strategyContainer.innerHTML = '<div class="empty-state small">No active strategies yet.</div>';
      return;
    }
    selectors.strategyContainer.innerHTML = strategies.map((entry, index) => {
      const hue = (index * 70) % 360;
      return `
        <div class="distribution-bar">
          <div class="label-line">
            <span>${entry.strategy}</span>
            <span>${formatCurrency(entry.total_value)} · ${entry.percentage.toFixed(1)}%</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${entry.percentage}%;background:hsl(${hue} 70% 55% / 0.85)"></div>
          </div>
        </div>`;
    }).join('');
  } catch (error) {
    console.error('Strategy distribution failed', error);
  }
}

async function loadSourceDistribution() {
  try {
    const data = await authorizedFetch(`${AUTH_API_BASE}/admin/portfolio-analytics/source-distribution`);
    if (!data || !data.success) return;
    const sources = data.sources || [];
    selectors.sourceTotal.textContent = `Total: ${formatCurrency(data.total_value || 0)}`;
    if (!sources.length) {
      selectors.sourceContainer.innerHTML = '<div class="empty-state small">No source accounts detected.</div>';
      return;
    }
    selectors.sourceContainer.innerHTML = sources.map((entry, index) => {
      const hue = (index * 80) % 360;
      return `
        <div class="distribution-bar">
          <div class="label-line">
            <span>${entry.name} · <small>${entry.strategy}</small></span>
            <span>${formatCurrency(entry.total_value)} · ${entry.percentage.toFixed(1)}%</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${entry.percentage}%;background:hsl(${hue} 65% 50% / 0.8)"></div>
          </div>
        </div>`;
    }).join('');
  } catch (error) {
    console.error('Source distribution failed', error);
  }
}

async function loadUsersList() {
  try {
    const query = new URLSearchParams({
      page: '1',
      page_size: '200',
      sort: 'value_desc'
    });
    const data = await authorizedFetch(`${AUTH_API_BASE}/admin/portfolio-analytics/users?${query.toString()}`);
    if (!data || !data.success) return;
    state.users = data.items || [];
    renderUserOptions();
  } catch (error) {
    console.error('Users list failed', error);
    state.users = [];
    renderUserOptions();
  }
}

function renderUserOptions() {
  if (!selectors.userFilter) return;
  selectors.userFilter.innerHTML = '<option value="ALL">All Users</option>';
  state.users.forEach((user) => {
    const option = document.createElement('option');
    option.value = user.user_id;
    option.textContent = `${user.name || user.email || 'User'} · ${formatCurrency(user.total_value || 0)}`;
    selectors.userFilter.appendChild(option);
  });
  selectors.userFilter.value = state.selectedUserId;
}

async function handleUserChange(event) {
  state.selectedUserId = event.target.value;
  state.accountSummaries.clear();
  if (state.selectedUserId === 'ALL') {
    state.accounts = [];
    state.selectedAccountIds = [];
    renderAccountsList();
    await Promise.all([
      fetchPerformance(),
      fetchSnapshotTable()
    ]);
    return;
  }
  await loadAccountsForUser(state.selectedUserId);
  await Promise.all([
    fetchPerformance(),
    fetchSnapshotTable()
  ]);
}

async function loadAccountsForUser(userId) {
  if (!userId || userId === 'ALL') return;
  try {
    selectors.accountsList.innerHTML = loadingMarkup('Loading accounts…');
    const data = await authorizedFetch(`${AUTH_API_BASE}/admin/portfolio-analytics/user-accounts/${userId}`);
    if (!data || !data.success) {
      selectors.accountsList.innerHTML = '<div class="placeholder-copy">Failed to load accounts.</div>';
      state.accounts = [];
      state.selectedAccountIds = [];
      return;
    }
    state.accounts = data.accounts || [];
    state.selectedAccountIds = state.accounts.map((acc) => acc.account_id);
    renderAccountsList();
    await fetchAccountSummaries();
  } catch (error) {
    console.error('User accounts failed', error);
    selectors.accountsList.innerHTML = '<div class="placeholder-copy">Unable to load accounts.</div>';
  }
}

function renderAccountsList() {
  if (state.selectedUserId === 'ALL') {
    selectors.accountsList.innerHTML = '<div class="placeholder-copy">Aggregated across every account.</div>';
    selectors.toggleAllAccountsBtn.disabled = true;
    selectors.toggleAllAccountsBtn.textContent = 'Select all';
    return;
  }
  selectors.toggleAllAccountsBtn.disabled = !state.accounts.length;
  if (!state.accounts.length) {
    selectors.accountsList.innerHTML = '<div class="placeholder-copy">No funded accounts for this user.</div>';
    return;
  }
  selectors.accountsList.innerHTML = state.accounts.map((account) => {
    const checked = state.selectedAccountIds.includes(account.account_id);
    return `
      <label class="account-checkbox">
        <span>
          <input type="checkbox" data-account-id="${account.account_id}" ${checked ? 'checked' : ''}/>
          ${account.name} · <small>${account.strategy}</small>
        </span>
        <strong>${formatCurrency(account.current_value || 0)}</strong>
      </label>
    `;
  }).join('');

  selectors.accountsList.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const accountId = event.target.dataset.accountId;
      if (!accountId) return;
      if (event.target.checked) {
        if (!state.selectedAccountIds.includes(accountId)) {
          state.selectedAccountIds.push(accountId);
        }
      } else {
        state.selectedAccountIds = state.selectedAccountIds.filter((id) => id !== accountId);
      }
      fetchPerformance();
      fetchSnapshotTable();
    });
  });

  selectors.toggleAllAccountsBtn.textContent =
    state.selectedAccountIds.length === state.accounts.length ? 'Clear all' : 'Select all';
}

function toggleAllAccounts() {
  if (!state.accounts.length) return;
  const allSelected = state.selectedAccountIds.length === state.accounts.length;
  state.selectedAccountIds = allSelected ? [] : state.accounts.map((acc) => acc.account_id);
  renderAccountsList();
  fetchPerformance();
  fetchSnapshotTable();
}

function buildButtonGroup(container, items, activeValue, callback) {
  container.innerHTML = '';
  items.forEach((item) => {
    const button = document.createElement('button');
    button.textContent = item.label;
    button.dataset.value = item.value;
    if (item.value === activeValue) button.classList.add('active');
    button.addEventListener('click', () => {
      if (item.value === activeValue) return;
      callback(item.value);
    });
    container.appendChild(button);
  });
}

function setupPeriodButtons() {
  if (!selectors.periodButtons) return;
  const handlePeriodChange = async (value) => {
    if (value === state.period) return;
    state.period = value;
    buildButtonGroup(selectors.periodButtons, PERIODS, state.period, handlePeriodChange);
    await Promise.all([fetchPerformance(), fetchSnapshotTable(), fetchSourcePerformance(), fetchSourceTable()]);
  };
  buildButtonGroup(selectors.periodButtons, PERIODS, state.period, handlePeriodChange);
}

function setupSourcePeriodButtons() {
  if (!selectors.sourcePeriodButtons) return;
  const handleSourcePeriodChange = async (value) => {
    if (value === state.sourcePeriod) return;
    state.sourcePeriod = value;
    buildButtonGroup(selectors.sourcePeriodButtons, PERIODS, state.sourcePeriod, handleSourcePeriodChange);
    await Promise.all([fetchSourcePerformance(), fetchSourceTable()]);
  };
  buildButtonGroup(selectors.sourcePeriodButtons, PERIODS, state.sourcePeriod, handleSourcePeriodChange);
}

function setupBenchmarkButtons() {
  if (!selectors.benchmarkButtons) return;
  const handleBenchmarkChange = async (value) => {
    if (value === state.benchmark) return;
    state.benchmark = value;
    buildButtonGroup(selectors.benchmarkButtons, BENCHMARKS, state.benchmark, handleBenchmarkChange);
    state.accountSummaries.clear();
    await Promise.all([fetchPerformance(), fetchSnapshotTable(), fetchSourcePerformance(), fetchSourceTable()]);
    if (state.selectedUserId !== 'ALL') {
      await fetchAccountSummaries();
    }
  };
  buildButtonGroup(selectors.benchmarkButtons, BENCHMARKS, state.benchmark, handleBenchmarkChange);
}

function handleTogglePlatform(event) {
  state.showPlatform = event.target.checked;
  renderChart();
  renderSourceComparisonChart();
}

function handleToggleBenchmark(event) {
  state.showBenchmark = event.target.checked;
  renderChart();
  renderSourceComparisonChart();
}

async function waitForLineChart() {
  if (window.LineChart) return window.LineChart;
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (window.LineChart) {
        clearInterval(interval);
        resolve(window.LineChart);
      }
    }, 50);
  });
}

function buildCumulativeSeries(points, key) {
  if (!Array.isArray(points) || points.length === 0) return [];
  let cumulativeFactor = 1;
  const series = [];
  const firstTimestamp = points[0].timestamp;
  series.push({
    timestamp: firstTimestamp,
    date: new Date(firstTimestamp),
    value: 0,
    label: formatPercent(0)
  });
  points.forEach((point, index) => {
    if (index === 0) {
      return;
    }
    const delta = Number(point?.[key] ?? 0);
    const stepMultiplier = 1 + (delta / 100);
    const safeMultiplier = Number.isFinite(stepMultiplier) && stepMultiplier > 0 ? stepMultiplier : 0.0001;
    cumulativeFactor *= safeMultiplier;
    const cumulativeDecimal = cumulativeFactor - 1;
    const date = new Date(point.timestamp);
    series.push({
      timestamp: point.timestamp,
      date,
      value: cumulativeDecimal,
      label: formatPercent(cumulativeDecimal * 100)
    });
  });
  return series;
}

function renderSourceAccountFilters() {
  if (!selectors.sourceFilters) return;
  if (!state.sourceAccounts.length) {
    selectors.sourceFilters.innerHTML = '<div class="placeholder-copy">No source accounts available.</div>';
    return;
  }
  selectors.sourceFilters.innerHTML = state.sourceAccounts
    .map((account) => {
      const checked = state.selectedSourceIds.includes(account.id);
      const color = state.sourceColorMap[account.id] || '#9ca3af';
      return `
        <label class="source-toggle">
          <span class="source-color" style="background:${color}"></span>
          <input type="checkbox" data-source-id="${account.id}" ${checked ? 'checked' : ''} />
          <span>${account.name || 'Source'}<small> ${account.strategy || ''}</small></span>
        </label>
      `;
    })
    .join('');

  selectors.sourceFilters.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const sourceId = event.target.dataset.sourceId;
      if (!sourceId) return;
      if (event.target.checked) {
        if (!state.selectedSourceIds.includes(sourceId)) {
          state.selectedSourceIds.push(sourceId);
        }
      } else {
        state.selectedSourceIds = state.selectedSourceIds.filter((id) => id !== sourceId);
      }
      renderSourceComparisonChart();
    });
  });
}

async function loadSourceAccountsForComparison() {
  if (!selectors.sourceFilters) return;
  selectors.sourceFilters.innerHTML = '<div class="placeholder-copy">Loading source accounts…</div>';
  try {
    const response = await authorizedFetch(`${AUTH_API_BASE}/admin/analytics/source-accounts-list`);
    if (!response?.success) throw new Error('Invalid response');
    state.sourceAccounts = (response.accounts || []).slice(0, 4);
    state.selectedSourceIds = state.sourceAccounts.map((account) => account.id);
    state.sourceColorMap = {};
    state.sourceAccounts.forEach((account, index) => {
      state.sourceColorMap[account.id] = SOURCE_COLORS[index % SOURCE_COLORS.length];
    });
    renderSourceAccountFilters();
    if (!state.sourceAccounts.length) {
      if (selectors.sourceChartContainer) {
        selectors.sourceChartContainer.innerHTML = '<div class="empty-state">No source accounts configured.</div>';
      }
      selectors.sourceTableBody && (selectors.sourceTableBody.innerHTML = '<tr><td colspan="7"><div class="placeholder-copy">No source accounts configured.</div></td></tr>');
    } else {
      await Promise.all([fetchSourcePerformance(), fetchSourceTable()]);
    }
  } catch (error) {
    console.error('Source accounts load failed', error);
    selectors.sourceFilters.innerHTML = '<div class="placeholder-copy">Failed to load source accounts.</div>';
  }
}

async function fetchSourcePerformance(options = {}) {
  if (!state.sourceAccounts.length) return;
  const ids = state.sourceAccounts.map((account) => account.id).filter(Boolean);
  if (!ids.length) return;
  const params = new URLSearchParams({
    period: options.period || state.sourcePeriod,
    benchmark: state.benchmark,
    source_ids: ids.join(',')
  });
  try {
    state.sourceLoading = true;
    if (selectors.sourceChartStatus) {
      selectors.sourceChartStatus.textContent = 'Fetching source account performance…';
    }
    const payload = await authorizedFetch(`${MARKET_API_BASE}/admin/benchmark/source/performance?${params.toString()}`);
    state.sourcePerformance = payload?.data || payload;
    if (state.sourcePerformance?.benchmark?.points && state.sourcePerformance.benchmark.points.length) {
      const earliest = state.sourcePerformance.benchmark.points[0].timestamp;
      state.sourcePerformance.sources.forEach((source) => {
        source.points = (source.points || []).filter((point) => !earliest || point.timestamp >= earliest);
      });
    }
    await renderSourceComparisonChart();
    if (selectors.sourceChartStatus) {
      selectors.sourceChartStatus.textContent = 'Updated.';
    }
  } catch (error) {
    console.error('Source performance fetch failed', error);
    if (selectors.sourceChartStatus) {
      selectors.sourceChartStatus.textContent = 'Unable to load source performance.';
    }
    if (state.sourceChart) {
      state.sourceChart.showEmptyState();
    }
  } finally {
    state.sourceLoading = false;
  }
}

async function renderSourceComparisonChart() {
  if (!selectors.sourceChartContainer) return;
  if (!state.sourcePerformance || !Array.isArray(state.sourcePerformance.sources)) {
    selectors.sourceChartContainer.innerHTML = '<div class="empty-state">Source performance unavailable.</div>';
    return;
  }
  const LineChartClass = await waitForLineChart();
  if (!state.sourceChart) {
    state.sourceChart = new LineChartClass('source-comparison-chart', {
      width: selectors.sourceChartContainer.clientWidth || 900,
      height: 360,
      animate: false,
      showGrid: true,
      showTooltip: true,
      centerZero: true,
      valueFormat: 'percentage',
      colors: SOURCE_COLORS,
      fillArea: false
    });
  }

  const series = [];
  state.sourcePerformance.sources.forEach((source, index) => {
    if (!state.selectedSourceIds.includes(source.source_id)) {
      return;
    }
    const values = buildCumulativeSeries(source.points || [], 'change_percent');
    if (!values.length) return;
    const labelParts = [source.name || 'Source'];
    if (source.strategy) {
      labelParts.push(`(${source.strategy})`);
    }
    const color = state.sourceColorMap[source.source_id] || SOURCE_COLORS[index % SOURCE_COLORS.length];
    series.push({
      name: labelParts.join(' '),
      color,
      values,
      area: false
    });
  });

  if (state.showSourceBenchmark && state.sourcePerformance.benchmark?.points) {
    const benchmarkValues = buildCumulativeSeries(state.sourcePerformance.benchmark.points, 'change_percent');
    if (benchmarkValues.length) {
      series.push({
        name: `Benchmark (${getBenchmarkOption(state.benchmark).label})`,
        color: '#f97316',
        values: benchmarkValues,
        area: true,
        fillToZero: true,
        areaColor: 'rgba(249, 115, 22, 0.15)'
      });
    }
  }

  if (!series.length) {
    state.sourceChart.showEmptyState();
    if (selectors.sourceChartStatus) {
      selectors.sourceChartStatus.textContent = 'Select at least one source account to display the chart.';
    }
    return;
  }

  state.sourceChart.setData(series);
  updateSourceLegend(series);
}

function updateSourceLegend(series = []) {
  if (selectors.sourceBenchmarkToggle) {
    const legendEl = document.querySelector('#source-chart-legend .legend-item.benchmark');
    if (legendEl) {
      legendEl.style.opacity = state.showSourceBenchmark ? '1' : '0.35';
    }
    selectors.sourceBenchmarkToggle.checked = state.showSourceBenchmark;
  }
  if (!selectors.sourceLegendList) return;
  const items = series
    .filter((item) => !item.name.toLowerCase().includes('benchmark'))
    .map((item) => `
      <span class="legend-item swatch">
        <span class="legend-swatch" style="background:${item.color}"></span>
        ${item.name}
      </span>
    `).join('');
  selectors.sourceLegendList.innerHTML = items || '<span class="placeholder-copy">Select a source account</span>';
}

async function fetchSourceTable() {
  if (!selectors.sourceTableBody) return;
  if (!state.sourceAccounts.length) {
    selectors.sourceTableBody.innerHTML = '<tr><td colspan="7"><div class="placeholder-copy">No source accounts available.</div></td></tr>';
    return;
  }
  const ids = state.sourceAccounts.map((account) => account.id).filter(Boolean);
  if (!ids.length) {
    selectors.sourceTableBody.innerHTML = '<tr><td colspan="7"><div class="placeholder-copy">No source accounts available.</div></td></tr>';
    return;
  }
  const params = new URLSearchParams({
    periods: PERIOD_KEYS.join(','),
    source_ids: ids.join(',')
  });
  try {
    const payload = await authorizedFetch(`${MARKET_API_BASE}/admin/benchmark/source/table?${params.toString()}`);
    state.sourceTableData = payload?.data || payload;
    renderSourceTable();
  } catch (error) {
    console.error('Source table fetch failed', error);
    selectors.sourceTableBody.innerHTML = '<tr><td colspan="7"><div class="placeholder-copy">Unable to load source snapshot.</div></td></tr>';
  }
}

function renderSourceTable() {
  if (!selectors.sourceTableBody) return;
  const data = state.sourceTableData;
  if (!data || !Array.isArray(data.sources) || !data.sources.length) {
    selectors.sourceTableBody.innerHTML = '<tr><td colspan="7"><div class="placeholder-copy">Source performance unavailable.</div></td></tr>';
    return;
  }
  const rows = data.sources.map((source) => {
    const cells = PERIODS.map(({ value }) => {
      const pct = source.periods ? source.periods[value] : null;
      const weightPct = source.weights ? source.weights[value] : null;
      if (pct === null || pct === undefined) {
        return '<td><div class="placeholder-copy">N/A</div></td>';
      }
      const polarity = pct > 0 ? 'positive' : pct < 0 ? 'negative' : '';
      const weightText = weightPct === null || weightPct === undefined
        ? 'N/A'
        : `${weightPct.toFixed(1)}%`;
      return `<td><span class="cell-pill ${polarity}">${formatPercent(pct)}</span><div class="source-weight">(${weightText})</div></td>`;
    }).join('');
    return `
      <tr class="source-row" data-target='${JSON.stringify({ type: 'source', id: source.source_id })}'>
        <td>
          <div class="benchmark-name">
            <span>${source.name || 'Source Account'}</span>
            ${source.strategy ? `<span class="sub">${source.strategy}</span>` : ''}
          </div>
        </td>
        ${cells}
      </tr>`;
  });
  selectors.sourceTableBody.innerHTML = rows.join('');
  selectors.sourceTableBody.insertAdjacentHTML('beforeend', buildSourcePlatformRow(data));
  selectors.sourceTableBody.querySelectorAll('tr.source-row').forEach((row) => {
    const dataset = row.dataset.target;
    if (!dataset) return;
    row.addEventListener('click', () => {
      const target = JSON.parse(dataset);
      fetchPortfolioMetrics(target);
    });
  });
}

function buildSourcePlatformRow(data) {
  const periods = data.platform?.periods || {};
  const cells = PERIODS.map(({ value }) => {
    const pct = periods[value];
    if (pct === null || pct === undefined) {
      return '<td><div class="placeholder-copy">N/A</div></td>';
    }
    const polarity = pct > 0 ? 'positive' : pct < 0 ? 'negative' : '';
    return `<td><span class="cell-pill ${polarity}">${formatPercent(pct)}</span><div class="source-weight">(Platform)</div></td>`;
  }).join('');
  return `
    <tr class="source-row" data-target='${JSON.stringify({ type: 'source-platform' })}'>
      <td>
        <div class="benchmark-name">
          <span>Total Platform</span>
          <span class="sub">Source aggregate</span>
        </div>
      </td>
      ${cells}
    </tr>
  `;
}

function computeChartSeries(points) {
  if (!Array.isArray(points) || points.length === 0) return [];
  const series = [];
  const portfolioValues = buildCumulativeSeries(points, 'portfolio_change_percent');
  const platformValues = buildCumulativeSeries(points, 'platform_change_percent');
  const benchmarkValues = buildCumulativeSeries(points, 'benchmark_change_percent');

  series.push({
    name: state.selectedUserId === 'ALL' ? 'Total Portfolio' : 'Selection Portfolio',
    color: '#2563eb',
    area: true,
    fillToZero: true,
    values: portfolioValues
  });

  if (state.showPlatform) {
    series.push({
      name: 'Platform',
      color: '#16a34a',
      values: platformValues
    });
  }

  if (state.showBenchmark) {
    series.push({
      name: `Benchmark (${getBenchmarkLabel(state.benchmark)})`,
      color: '#f97316',
      values: benchmarkValues
    });
  }

  return series;
}

async function fetchPerformance() {
  const params = new URLSearchParams({
    period: state.period,
    benchmark: state.benchmark
  });
  if (state.selectedUserId !== 'ALL') {
    params.append('user_ids', state.selectedUserId);
  }
  if (state.selectedAccountIds.length > 0) {
    params.append('account_ids', state.selectedAccountIds.join(','));
  }

  try {
    state.loadingChart = true;
    setChartStatus('Fetching performance…');
    const data = await authorizedFetch(`${MARKET_API_BASE}/admin/benchmark/portfolio/performance?${params.toString()}`);
    state.rawSeries = data?.data || data;
    renderChart();
  } catch (error) {
    console.error('Performance fetch failed', error);
    setChartStatus('Unable to load performance.');
    if (state.chart) state.chart.showEmptyState();
  } finally {
    state.loadingChart = false;
  }
}

async function renderChart() {
  if (!state.rawSeries || !Array.isArray(state.rawSeries.points)) return;
  const series = computeChartSeries(state.rawSeries.points || []);
  if (!series.length) {
    if (state.chart) {
      state.chart.showEmptyState();
    } else if (selectors.chartContainer) {
      selectors.chartContainer.innerHTML = '<div class="empty-state">No datapoints available yet.</div>';
    }
    setChartStatus('No datapoints for this selection.');
    return;
  }
  const LineChartClass = await waitForLineChart();
  if (!state.chart) {
    state.chart = new LineChartClass('comparison-chart', {
      width: selectors.chartContainer.clientWidth || 900,
      height: 420,
      animate: true,
      showGrid: true,
      showTooltip: true,
      centerZero: true,
      valueFormat: 'percentage',
      colors: ['#2563eb', '#16a34a', '#f97316']
    });
  }
  state.chart.setData(series);
  setChartStatus('Updated.');
  updateLegend();
}

function updateLegend() {
  if (!selectors.legend) return;
  selectors.legend.querySelector('.legend-item.platform').style.opacity = state.showPlatform ? '1' : '0.35';
  selectors.legend.querySelector('.legend-item.benchmark').style.opacity = state.showBenchmark ? '1' : '0.35';
}

async function fetchSnapshotTable() {
  const params = new URLSearchParams({
    periods: PERIOD_KEYS.join(','),
    benchmarks: state.benchmark === 'composite' ? 'composite' : `composite,${state.benchmark}`
  });
  if (state.selectedUserId !== 'ALL') {
    params.append('user_ids', state.selectedUserId);
  }
  if (state.selectedAccountIds.length) {
    params.append('account_ids', state.selectedAccountIds.join(','));
  }

  try {
    const payload = await authorizedFetch(`${MARKET_API_BASE}/admin/benchmark/portfolio/table?${params.toString()}`);
    state.tableData = payload?.data || payload;
    renderSnapshotTable();
  } catch (error) {
    console.error('Snapshot table fetch failed', error);
    selectors.tableBody.innerHTML = `
      <tr><td colspan="7"><div class="placeholder-copy">Unable to load snapshot.</div></td></tr>
    `;
  }
}

async function fetchPortfolioMetrics(target) {
  try {
    state.metricsLoading = true;
    state.selectedMetricsTarget = target;
    let endpoint;
    let params = new URLSearchParams({ period: state.period, benchmark: state.benchmark });
    if (target.type === 'portfolio') {
      if (state.selectedUserId !== 'ALL') {
        params.append('user_ids', state.selectedUserId);
      }
      if (state.selectedAccountIds.length) {
        params.append('account_ids', state.selectedAccountIds.join(','));
      }
      endpoint = `${MARKET_API_BASE}/admin/analytics/portfolio/metrics?${params.toString()}`;
    } else if (target.type === 'account') {
      params = new URLSearchParams({
        period: state.period,
        benchmark: state.benchmark,
        user_ids: state.selectedUserId,
        account_ids: target.id
      });
      endpoint = `${MARKET_API_BASE}/admin/analytics/portfolio/metrics?${params.toString()}`;
    } else if (target.type === 'source') {
      params = new URLSearchParams({
        period: state.sourcePeriod,
        benchmark: state.benchmark,
        source_ids: target.id
      });
      endpoint = `${MARKET_API_BASE}/admin/analytics/source/metrics?${params.toString()}`;
    } else if (target.type === 'source-platform') {
      params = new URLSearchParams({
        period: state.sourcePeriod,
        benchmark: state.benchmark,
        source_ids: state.sourceAccounts.map((account) => account.id).join(',')
      });
      endpoint = `${MARKET_API_BASE}/admin/analytics/source/metrics?${params.toString()}`;
    }
    if (!endpoint) return;
    const response = await authorizedFetch(endpoint);
    const payload = response?.data || response;
    if (target.type === 'source') {
      state.sourceMetrics = payload;
      if (state.sourceMetrics && state.sourceMetrics.metrics) {
        delete state.sourceMetrics.metrics;
      }
    } else if (target.type === 'source-platform') {
      state.sourceMetrics = {
        period: payload?.period,
        metrics: payload?.metrics || null,
        sources: []
      };
      if (!state.sourceMetrics.metrics && payload?.sources?.length) {
        state.sourceMetrics.metrics = payload.sources[0]?.metrics || null;
      }
    } else {
      state.portfolioMetrics = payload;
    }
    renderMetricsDetail();
  } catch (error) {
    console.error('Metrics fetch failed', error);
    renderMetricsDetail(true);
  } finally {
    state.metricsLoading = false;
  }
}

function renderMetricsDetail(isError = false) {
  const portfolioContainer = document.getElementById('portfolio-metrics-detail');
  const sourceContainer = document.getElementById('source-metrics-detail');
  if (isError) {
    if (portfolioContainer) {
      portfolioContainer.classList.remove('hidden');
      portfolioContainer.innerHTML = '<p class="error">Unable to load metrics. Please try again.</p>';
    }
    if (sourceContainer) {
      sourceContainer.classList.remove('hidden');
      sourceContainer.innerHTML = '<p class="error">Unable to load metrics. Please try again.</p>';
    }
    return;
  }
  if (portfolioContainer && state.portfolioMetrics) {
    portfolioContainer.classList.remove('hidden');
    portfolioContainer.innerHTML = buildMetricsMarkup(state.portfolioMetrics);
  }
  if (sourceContainer && state.sourceMetrics) {
    sourceContainer.classList.remove('hidden');
    sourceContainer.innerHTML = buildSourceMetricsMarkup(state.sourceMetrics);
  }
}

function buildMetricsMarkup(payload) {
  const metrics = payload?.metrics || {};
  const dateRange = metrics.date_range || {};
  const sections = [];
  const addSection = (title, data) => {
    const entries = Object.entries(data || {}).filter(([, value]) => value !== null && value !== undefined);
    if (!entries.length) return;
    sections.push(`
      <div class="metrics-card">
        <h4>${title}</h4>
        <ul>
          ${entries.map(([label, value]) => `<li><strong>${formatLabel(label)}:</strong> ${formatMetric(value)}</li>`).join('')}
        </ul>
      </div>
    `);
  };
  addSection('Performance', metrics.performance);
  addSection('Risk & Drawdowns', metrics.risk);
  addSection('Distribution', metrics.distribution);
  addSection('Relative', metrics.relative);
  const dateLabel = dateRange.start && dateRange.end
    ? `<p class="hint">Data coverage: ${new Date(dateRange.start).toLocaleString()} – ${new Date(dateRange.end).toLocaleString()} (${dateRange.points || 0} points)</p>`
    : '';
  return `
    <h3>Detailed Metrics</h3>
    ${dateLabel}
    <div class="metrics-grid">
      ${sections.join('')}
    </div>
  `;
}

function buildSourceMetricsMarkup(payload) {
  const dateLabel = payload?.period ? `<p class="hint">Period: ${payload.period}</p>` : '';
  const cards = [];
  if (payload.metrics) {
    cards.push(`
      <div class="metrics-card">
        <h4>Total Platform</h4>
        ${buildMetricsMarkup({ metrics: payload.metrics })}
      </div>
    `);
  }
  (payload.sources || []).forEach((source) => {
    cards.push(`
      <div class="metrics-card">
        <h4>${source.name || 'Source Account'} ${source.strategy ? `<span class="sub">${source.strategy}</span>` : ''}</h4>
        ${buildMetricsMarkup({ metrics: source.metrics })}
      </div>
    `);
  });
  return `
    <h3>Source Metrics</h3>
    ${dateLabel}
    <div class="metrics-grid">
      ${cards.join('')}
    </div>
  `;
}

function formatLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace('pct', '(%)')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMetric(value) {
  if (typeof value === 'number') {
    return Math.abs(value) >= 1 ? value.toFixed(2) : value.toFixed(4);
  }
  return value;
}

async function fetchAccountSummaries() {
  if (!state.accounts.length || state.selectedUserId === 'ALL') return;
  const promises = state.accounts.slice(0, 12).map(async (account) => {
    if (state.accountSummaries.has(account.account_id)) return;
    try {
      const params = new URLSearchParams({
        periods: PERIOD_KEYS.join(','),
        benchmarks: state.benchmark,
        user_ids: state.selectedUserId,
        account_ids: account.account_id
      });
      const payload = await authorizedFetch(`${MARKET_API_BASE}/admin/benchmark/portfolio/table?${params.toString()}`);
      const response = payload?.data || payload;
      const portfolioPeriods = response?.portfolio?.periods || {};
      const firstBenchmark = (response?.benchmarks || [])[0];
      const coverage = {};
      if (firstBenchmark?.periods) {
        Object.entries(firstBenchmark.periods).forEach(([period, details]) => {
          coverage[period] = details?.shared_points || 0;
        });
      }
      state.accountSummaries.set(account.account_id, {
        periods: portfolioPeriods,
        coverage
      });
    } catch (error) {
      console.warn(`Account summary failed for ${account.account_id}`, error);
    }
  });
  await Promise.all(promises);
  renderSnapshotTable();
}

function buildValueCell(value, coverage, periodKey) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '<td><div class="placeholder-copy">–</div></td>';
  }
  if (LONG_PERIODS.has(periodKey)) {
    const required = PERIOD_INFO[periodKey] || 0;
    if (!coverage || coverage < required * COVERAGE_RATIO) {
      return '<td><div class="placeholder-copy">N/A</div></td>';
    }
  }
  const polarity = value > 0 ? 'positive' : value < 0 ? 'negative' : '';
  return `<td><span class="cell-pill ${polarity}">${formatPercent(value)}</span></td>`;
}

function getBenchmarkLabel(value) {
  return BENCHMARKS.find((item) => item.value === value)?.label || value;
}

function renderSnapshotTable() {
  if (!state.tableData) return;
  const rows = [];
  const benchmarkEntries = state.tableData.benchmarks || [];
  const referenceBenchmark = benchmarkEntries.find((entry) => entry.benchmark === 'composite') || benchmarkEntries[0];

  const coverage = {};
  if (referenceBenchmark?.periods) {
    Object.entries(referenceBenchmark.periods).forEach(([period, details]) => {
      coverage[period] = details?.shared_points || 0;
    });
  }

  // Portfolio row
  rows.push(buildSnapshotRow({
    label: state.selectedUserId === 'ALL' ? 'Total Portfolio' : 'Selected Portfolio',
    periods: state.tableData.portfolio?.periods || {},
    coverage,
    target: { type: 'portfolio' }
  }));

  // Account rows (selected user only)
  if (state.selectedUserId !== 'ALL') {
    state.accounts.forEach((account) => {
      const summary = state.accountSummaries.get(account.account_id);
      rows.push(buildSnapshotRow({
        label: account.name,
        subtitle: account.strategy,
        periods: summary?.periods || {},
        coverage: summary?.coverage || {},
        target: { type: 'account', id: account.account_id }
      }));
    });
  }

  // Benchmark rows
  benchmarkEntries.forEach((entry) => {
    rows.push(buildSnapshotRow({
      label: `${entry.label || entry.benchmark} Benchmark`,
      periods: mapBenchmarkPeriods(entry, 'benchmark_change_percent'),
      coverage: mapBenchmarkCoverage(entry)
    }));
    rows.push(buildSnapshotRow({
      label: `${entry.label || entry.benchmark} Platform`,
      subtitle: 'Platform performance',
      periods: mapBenchmarkPeriods(entry, 'platform_change_percent'),
      coverage: mapBenchmarkCoverage(entry),
      rowClass: 'platform-row',
      target: { type: 'platform' }
    }));
  });

  selectors.tableBody.innerHTML = rows.join('');
  selectors.tableBody.querySelectorAll('tr.snapshot-row').forEach((row) => {
    const dataset = row.dataset.target;
    if (!dataset) return;
    row.addEventListener('click', () => {
      const target = JSON.parse(dataset);
      fetchPortfolioMetrics(target);
    });
  });
}

function mapBenchmarkPeriods(entry, field) {
  const result = {};
  if (!entry?.periods) return result;
  Object.entries(entry.periods).forEach(([period, payload]) => {
    result[period] = payload?.[field] ?? null;
  });
  return result;
}

function mapBenchmarkCoverage(entry) {
  const result = {};
  if (!entry?.periods) return result;
  Object.entries(entry.periods).forEach(([period, payload]) => {
    result[period] = payload?.shared_points || 0;
  });
  return result;
}

function buildSnapshotRow({ label, subtitle = '', periods = {}, coverage = {}, rowClass = '', target }) {
  const cells = PERIOD_KEYS.map((periodKey) => buildValueCell(periods[periodKey], coverage[periodKey], periodKey)).join('');
  return `
    <tr class="snapshot-row ${rowClass}" data-target='${target ? JSON.stringify(target) : ''}'>
      <td>
        <div class="benchmark-name">
          <span>${label}</span>
          ${subtitle ? `<span class="sub">${subtitle}</span>` : ''}
        </div>
      </td>
      ${cells}
    </tr>
  `;
}

function loadingMarkup(text) {
  return `
    <span class="loading-indicator">
      <span class="spinner" aria-hidden="true"></span>
      <span>${text}</span>
    </span>
  `;
}

function setupEventListeners() {
  if (selectors.userFilter) {
    selectors.userFilter.addEventListener('change', handleUserChange);
  }
  if (selectors.toggleAllAccountsBtn) {
    selectors.toggleAllAccountsBtn.addEventListener('click', toggleAllAccounts);
  }
  if (selectors.togglePlatform) {
    selectors.togglePlatform.addEventListener('change', handleTogglePlatform);
  }
  if (selectors.toggleBenchmark) {
    selectors.toggleBenchmark.addEventListener('change', handleToggleBenchmark);
  }
  if (selectors.sourceBenchmarkToggle) {
    selectors.sourceBenchmarkToggle.addEventListener('change', (event) => {
      state.showSourceBenchmark = event.target.checked;
      renderSourceComparisonChart();
    });
  }
  if (selectors.logoutBtn) {
    selectors.logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      window.location.href = '/auth.html';
    });
  }
  if (selectors.themeToggle) {
    selectors.themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
    });
  }
  window.addEventListener('resize', () => {
    if (!state.chart) return;
    const width = selectors.chartContainer.clientWidth || 900;
    state.chart.resize(width, 420);
  });
}

function setFooterYear() {
  if (selectors.footerYear) {
    selectors.footerYear.textContent = new Date().getFullYear();
  }
}

async function init() {
  if (!requireAuth()) return;
  setupEventListeners();
  setFooterYear();
  setupPeriodButtons();
  setupBenchmarkButtons();
  setupSourcePeriodButtons();
  await Promise.all([
    loadOverview(),
    loadStrategyDistribution(),
    loadSourceDistribution(),
    loadUsersList(),
    loadSourceAccountsForComparison()
  ]);
  await Promise.all([fetchPerformance(), fetchSnapshotTable(), fetchSourcePerformance(), fetchSourceTable()]);
}

init().catch((error) => {
  console.error('Initialization error', error);
  setChartStatus('Failed to initialize page.');
});
    if (target.type === 'source-platform') {
      if (state.sourceMetrics && state.sourceMetrics.metrics) {
        state.sourceMetrics.metrics = response?.data?.metrics || response?.metrics || response;
      } else {
        state.sourceMetrics = {
          period: state.sourcePeriod,
          sources: [],
          metrics: response?.data?.metrics || response?.metrics || response
        };
      }
    }
