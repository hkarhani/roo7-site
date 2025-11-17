import { API_CONFIG, BRAND_CONFIG } from './frontend-config.js';

const PERIODS = [
  { value: '24h', label: '24h', days: 1 },
  { value: '7d', label: '7d', days: 7 },
  { value: '30d', label: '30d', days: 30 },
  { value: '90d', label: '90d', days: 90 },
  { value: '180d', label: '180d', days: 180 },
  { value: '1y', label: '1y', days: 365 },
];
const PERIOD_KEYS = PERIODS.map((period) => period.value);

const BENCHMARKS = [
  { value: 'composite', label: 'Composite Benchmark', detail: 'Composite weighted basket (BTC 60% · ETH 25% · SOL 5% · BNB 5% · XRP 5%)' },
  { value: 'BTCUSDT', label: 'BTC', detail: 'Bitcoin (BTCUSDT) hourly change' },
  { value: 'ETHUSDT', label: 'ETH', detail: 'Ethereum (ETHUSDT) hourly change' },
  { value: 'SOLUSDT', label: 'SOL', detail: 'Solana (SOLUSDT) hourly change' },
  { value: 'BNBUSDT', label: 'BNB', detail: 'BNB (BNBUSDT) hourly change' },
  { value: 'XRPUSDT', label: 'XRP', detail: 'XRP (XRPUSDT) hourly change' },
];
const BENCHMARK_VALUES = BENCHMARKS.map((benchmark) => benchmark.value);
const DEFAULT_PERIOD = '7d';

const AUTH_API_BASE = API_CONFIG.authUrl;
const MARKET_API_BASE = API_CONFIG.marketUrl;

const PERIOD_INFO = {
  '24h': 24,
  '7d': 7 * 24,
  '30d': 30 * 24,
  '90d': 90 * 24,
  '180d': 180 * 24,
  '1y': 365 * 24,
};
const LONG_PERIODS = new Set(['90d', '180d', '1y']);
const COVERAGE_RATIO = 0.75;

const state = {
  token: null,
  accounts: [],
  accountId: 'ALL',
  period: DEFAULT_PERIOD,
  lockedPeriod: DEFAULT_PERIOD,
  benchmark: 'composite',
  lockedBenchmark: 'composite',
  showPlatform: true,
  showBenchmark: true,
  rawData: null,
  summary: null,
  platformPeriods: {},
  platformCoverage: {},
  portfolioPeriods: {},
  portfolioCoverage: {},
  accountSummaries: new Map(),
  loading: false,
};

const selectors = {
  accountSelector: document.getElementById('account-selector'),
  benchmarkButtons: document.querySelectorAll('.benchmark-btn'),
  periodButtons: document.querySelectorAll('.period-btn'),
  togglePlatform: document.getElementById('toggle-platform'),
  toggleBenchmark: document.getElementById('toggle-benchmark'),
  status: document.getElementById('chart-status'),
  benchmarkDetail: document.getElementById('benchmark-detail'),
  benchmarkLegend: document.getElementById('benchmark-legend-label'),
  portfolioChange: document.getElementById('portfolio-change'),
  platformChange: document.getElementById('platform-change'),
  benchmarkChange: document.getElementById('benchmark-change'),
  portfolioUpdated: document.getElementById('portfolio-last-updated'),
  portfolioBenchmarkSpread: document.getElementById('portfolio-benchmark-spread'),
  portfolioBenchmarkHelper: document.getElementById('portfolio-benchmark-helper'),
  tableBody: document.getElementById('benchmark-table-body'),
  tableStatus: document.getElementById('benchmark-table-status'),
  logoutBtn: document.getElementById('logout-btn'),
  footerYear: document.getElementById('footer-year'),
};

let chart = null;
const seriesCache = new Map();
const accountSummaryCache = new Map();
const resizeHandler = () => resizeChart(state.rawData?.points?.length || 0);

function loadingMarkup(text) {
  return `
    <span class="loading-indicator">
      <span class="spinner" aria-hidden="true"></span>
      <span>${text}</span>
    </span>`;
}

function getChartContainer() {
  return document.getElementById('comparison-chart');
}

function computeChartDimensions(pointCount = 0) {
  const container = getChartContainer();
  const viewportWidth = window.innerWidth || 1024;
  const viewportHeight = window.innerHeight || 768;
  const containerWidth = container?.clientWidth || viewportWidth - 40;
  const width = Math.max(360, Math.min(containerWidth, viewportWidth - 32));

  const baseHeight = Math.max(300, viewportHeight * 0.35);
  let densityBonus = 0;
  if (pointCount > 240) densityBonus = 80;
  else if (pointCount > 120) densityBonus = 60;
  else if (pointCount > 60) densityBonus = 30;

  const height = Math.min(640, baseHeight + densityBonus);
  return { width, height };
}

function resizeChart(pointCount = 0) {
  if (!chart) return;
  const { width, height } = computeChartDimensions(pointCount);
  chart.resize(width, height);
}

function derivePlatformPeriods(summary) {
  const result = {};
  if (!summary?.benchmarks?.length) return result;
  const source = summary.benchmarks.find((entry) => entry.periods);
  if (!source) return result;
  PERIODS.forEach(({ value }) => {
    result[value] = source.periods?.[value]?.platform_change_percent ?? null;
  });
  return result;
}

function deriveCoverage(summary) {
  const result = {};
  if (!summary?.benchmarks?.length) return result;
  const source = summary.benchmarks.find((entry) => entry.periods);
  if (!source) return result;
  PERIODS.forEach(({ value }) => {
    result[value] = source.periods?.[value]?.shared_points ?? null;
  });
  return result;
}

function buildValueCell(value, coverage, periodKey) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '<td><div class="placeholder-copy">–</div></td>';
  }
  if (LONG_PERIODS.has(periodKey)) {
    const expected = PERIOD_INFO[periodKey] || 0;
    if (!coverage || (expected && coverage < expected * COVERAGE_RATIO)) {
      return '<td><div class="placeholder-copy">N/A</div></td>';
    }
  }
  const polarity = value > 0 ? 'positive' : value < 0 ? 'negative' : '';
  const classes = ['cell-pill'];
  if (polarity) classes.push(polarity);
  return `<td><span class="${classes.join(' ')}">${formatPercent(value)}</span></td>`;
}

function buildRow({ label, subtitle = '', periods = {}, coverage = {}, rowClass = '', dataset = null, accountId = null }) {
  const cells = PERIODS.map(({ value }) => buildValueCell(periods[value], coverage[value], value)).join('');
  const attributes = [];
  if (dataset) attributes.push(`data-benchmark="${dataset}"`);
  if (accountId) attributes.push(`data-account-id="${accountId}"`);
  const attrString = attributes.length ? ' ' + attributes.join(' ') : '';
  return `
    <tr class="${rowClass}"${attrString}>
      <td>
        <div class="benchmark-name">
          <span>${label}</span>
          ${subtitle ? `<span class="sub">${subtitle}</span>` : ''}
        </div>
      </td>
      ${cells}
    </tr>`;
}

function getBenchmarkOption(value) {
  return BENCHMARKS.find((option) => option.value === value) || BENCHMARKS[0];
}

function waitForLineChart() {
  return new Promise((resolve) => {
    if (window.LineChart) {
      resolve(window.LineChart);
      return;
    }
    const interval = setInterval(() => {
      if (window.LineChart) {
        clearInterval(interval);
        resolve(window.LineChart);
      }
    }, 30);
  });
}

function setLoading(isLoading, { silent = false } = {}) {
  state.loading = isLoading;
  if (!silent) {
    if (isLoading) {
      const benchmarkLabel = getBenchmarkOption(state.benchmark).label;
      selectors.status.innerHTML = loadingMarkup(`Fetching data vs ${benchmarkLabel}…`);
    } else {
      selectors.status.textContent = '';
    }
  }
  if (isLoading && chart) {
    chart.showLoadingState();
  }
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '– %';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function cumulativeSeries(points, key) {
  if (!points || points.length === 0) {
    return [];
  }
  const sorted = [...points].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const series = [];
  const firstTime = new Date(sorted[0].timestamp);
  let baselineDate = new Date(firstTime);
  if (sorted.length > 1) {
    const nextTime = new Date(sorted[1].timestamp);
    const delta = Math.max(1, nextTime.getTime() - firstTime.getTime());
    baselineDate = new Date(firstTime.getTime() - delta);
  } else {
    baselineDate = new Date(firstTime.getTime() - 3600000);
  }
  series.push({
    timestamp: baselineDate.toISOString(),
    date: baselineDate,
    value: 0,
  });

  let cumulative = 0;
  sorted.forEach((point) => {
    const change = parseFloat(point[key] || 0);
    cumulative += change;
    series.push({
      timestamp: point.timestamp,
      date: new Date(point.timestamp),
      value: cumulative / 100,
    });
  });

  return series;
}

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${state.token}`,
  };
}

function handleAuthError(status) {
  if (status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/auth.html';
    return true;
  }
  return false;
}

async function loadAccounts() {
  try {
    const res = await fetch(`${AUTH_API_BASE}/accounts`, {
      headers: getAuthHeaders(),
    });
    if (handleAuthError(res.status)) return;
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const normalized = Array.isArray(data) ? data : [];
    state.accounts = normalized.map((acc) => ({
      id: acc.id || acc._id,
      label: acc.account_name || acc.name || acc.id,
    }));
    accountSummaryCache.clear();
    renderAccountSelector();
  } catch (error) {
    console.error('Account fetch error:', error);
    state.accounts = [];
    renderAccountSelector();
    selectors.status.textContent = 'Unable to load accounts list.';
  }
}

function renderAccountSelector() {
  if (!selectors.accountSelector) return;
  selectors.accountSelector.innerHTML = '';
  const items = [{ id: 'ALL', label: 'All Accounts' }, ...state.accounts];
  items.forEach((item) => {
    const button = document.createElement('button');
    button.textContent = item.label || 'Unnamed';
    button.dataset.accountId = item.id;
    button.className = item.id === state.accountId ? 'active' : '';
    button.addEventListener('click', () => {
      if (state.accountId === item.id) return;
      state.accountId = item.id;
      renderAccountSelector();
      seriesCache.clear();
      fetchPerformance({ silent: false, useCache: false }).catch((error) =>
        console.error('Account change fetch error', error)
      );
      fetchSummary();
    });
    selectors.accountSelector.appendChild(button);
  });

  highlightAccountRow(state.accountId);
}

async function fetchSingleAccountSummary(accountId) {
  try {
    const params = new URLSearchParams({
      periods: PERIOD_KEYS.join(','),
      benchmarks: 'composite',
      account_id: accountId,
    });
    const endpoint = `${MARKET_API_BASE}/benchmark/portfolio/table?${params.toString()}`;
    const response = await fetch(endpoint, { headers: getAuthHeaders() });
    if (handleAuthError(response.status)) return null;
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.detail || 'Unexpected API response');
    }
    const periods = payload.data.portfolio?.periods || {};
    const coverage = deriveCoverage(payload.data);
    return { periods, coverage };
  } catch (error) {
    console.error(`Account summary fetch failed for ${accountId}:`, error);
    return { periods: {}, coverage: {} };
  }
}

async function fetchAccountSummaries(force = false) {
  if (!state.accounts.length) {
    state.accountSummaries = new Map();
    return;
  }

  const entries = [];
  for (const account of state.accounts) {
    if (!account.id) continue;
    if (!force && accountSummaryCache.has(account.id)) {
      entries.push([account.id, accountSummaryCache.get(account.id)]);
      continue;
    }
    const summary = await fetchSingleAccountSummary(account.id);
    accountSummaryCache.set(account.id, summary);
    entries.push([account.id, summary]);
  }
  state.accountSummaries = new Map(entries);
}

function setActivePeriodButton(activePeriod) {
  selectors.periodButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.period === activePeriod);
  });
  document.querySelectorAll('.period-header').forEach((header) => {
    header.classList.toggle('active', header.dataset.period === activePeriod);
  });
}

function updateBenchmarkButtons() {
  selectors.benchmarkButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.benchmark === state.benchmark);
  });
}

function highlightAccountRow(activeAccount) {
  if (!selectors.tableBody) return;
  selectors.tableBody.querySelectorAll('tr').forEach((row) => {
    row.classList.toggle('active-row', row.dataset.accountId === activeAccount);
  });
}

function updateStats(portfolioSeries, platformSeries, benchmarkSeries) {
  const lastPortfolio = portfolioSeries.at(-1)?.value ?? 0;
  const lastPlatform = platformSeries.at(-1)?.value ?? 0;
  const lastBenchmark = benchmarkSeries.at(-1)?.value ?? 0;
  const spread = (lastPortfolio - lastBenchmark) * 100;

  selectors.portfolioChange.textContent = formatPercent(lastPortfolio * 100);
  selectors.platformChange.textContent = formatPercent(lastPlatform * 100);
  selectors.benchmarkChange.textContent = formatPercent(lastBenchmark * 100);
  selectors.portfolioBenchmarkSpread.textContent = formatPercent(spread);
  selectors.portfolioBenchmarkHelper.textContent =
    spread >= 0 ? 'Portfolio outperforming benchmark' : 'Portfolio underperforming benchmark';

  const lastTimestamp =
    state.rawData?.points?.at(-1)?.timestamp || new Date().toISOString();
  selectors.portfolioUpdated.textContent = `Updated ${new Date(lastTimestamp).toUTCString()}`;

  const option = getBenchmarkOption(state.benchmark);
  selectors.benchmarkDetail.textContent = option.detail;
  selectors.benchmarkLegend.textContent = `${option.label} benchmark`;
}

function updateChart() {
  if (!state.rawData || !state.rawData.points?.length) {
    if (chart) {
      chart.showEmptyState();
    }
    selectors.status.textContent = 'No overlapping data available for this selection.';
    return;
  }

  const portfolioSeries = cumulativeSeries(state.rawData.points, 'portfolio_change_percent');
  const platformSeries = cumulativeSeries(state.rawData.points, 'platform_change_percent');
  const benchmarkSeries = cumulativeSeries(state.rawData.points, 'benchmark_change_percent');
  const portfolioValueMap = new Map(portfolioSeries.map((point) => [point.timestamp, point.value]));

  if (!portfolioSeries.length || !platformSeries.length || !benchmarkSeries.length) {
    chart.showEmptyState();
    selectors.status.textContent = 'Insufficient data to display chart.';
    return;
  }

  const periodConfig = PERIODS.find((p) => p.value === state.period);
  if (chart) {
    chart.options.periodDays = periodConfig?.days || 7;
    const benchmarkLabel = getBenchmarkOption(state.benchmark).label;
    const dataset = [
      {
        name: state.accountId === 'ALL' ? 'Portfolio cumulative %' : 'Account cumulative %',
        color: '#10b981',
        values: portfolioSeries.map((point) => ({ timestamp: point.timestamp, value: point.value })),
        area: true,
        fillToZero: true,
        areaColor: 'rgba(16, 185, 129, 0.18)'
      }
    ];
    if (state.showPlatform) {
      dataset.push({
        name: 'Platform cumulative %',
        color: '#1d4ed8',
        values: platformSeries.map((point) => ({ timestamp: point.timestamp, value: point.value })),
        area: false
      });
    }
    if (state.showBenchmark) {
      dataset.push({
        name: `Benchmark cumulative % (${benchmarkLabel})`,
        color: '#f97316',
        values: benchmarkSeries.map((point) => ({ timestamp: point.timestamp, value: point.value })),
        area: false
      });
    }

    chart.setData(dataset);
    const anomalies = Array.isArray(state.rawData.metadata?.anomalies)
      ? state.rawData.metadata.anomalies
      : [];
    const markers = anomalies
      .map((anomaly) => ({
        timestamp: anomaly.timestamp,
        value: portfolioValueMap.get(anomaly.timestamp) ?? null,
        color: anomaly.type === 'withdrawal' ? '#ef4444' : '#10b981',
      }))
      .filter((marker) => marker.value !== null);
    chart.setMarkers(markers);
    resizeChart(state.rawData?.points?.length || portfolioSeries.length);
  }

  updateStats(portfolioSeries, platformSeries, benchmarkSeries);
  selectors.status.textContent = `Shared data points: ${state.rawData.metadata?.timestamps_shared ?? '–'}`;
  highlightAccountRow(state.accountId);
}

async function fetchPerformance(options = {}) {
  const { silent = false, useCache = true } = options;
  const targetBenchmark = state.benchmark;
  const targetPeriod = state.period;
  const targetAccount = state.accountId === 'ALL' ? null : state.accountId;
  const cacheKey = `${targetBenchmark}|${targetPeriod}|${targetAccount || 'ALL'}`;
  if (useCache && seriesCache.has(cacheKey)) {
    state.rawData = seriesCache.get(cacheKey);
    updateChart();
    return;
  }

  setLoading(true, { silent });
  const params = new URLSearchParams({
    period: targetPeriod,
    benchmark: targetBenchmark,
  });
  if (targetAccount) {
    params.append('account_id', targetAccount);
  }

  const endpoint = `${MARKET_API_BASE}/benchmark/portfolio/performance?${params.toString()}`;

  try {
    const response = await fetch(endpoint, {
      headers: getAuthHeaders(),
    });
    if (handleAuthError(response.status)) return;
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.detail || 'Unexpected API response');
    }
    state.rawData = payload.data;
    seriesCache.set(cacheKey, payload.data);
    updateChart();
  } catch (error) {
    console.error('Portfolio fetch error:', error);
    seriesCache.delete(cacheKey);
    selectors.status.textContent = 'Unable to load portfolio analytics.';
    if (chart) {
      chart.showEmptyState();
    }
  } finally {
    state.loading = false;
  }
}


function extractBenchmarkPeriods(entry) {
  const periods = {};
  PERIODS.forEach(({ value }) => {
    periods[value] = entry.periods?.[value]?.benchmark_change_percent ?? null;
  });
  return periods;
}

function renderSummaryTable() {
  if (!selectors.tableBody) return;
  if (!state.summary) {
    selectors.tableBody.innerHTML = `
      <tr class="table-placeholder-row">
        <td colspan="7">
          <div class="placeholder-copy">Summary will appear once data loads.</div>
        </td>
      </tr>`;
    return;
  }

  const rows = [];

  rows.push(
    buildRow({
      label: 'Portfolio',
      subtitle: 'Aggregated across selected accounts',
      periods: state.portfolioPeriods,
      coverage: state.portfolioCoverage,
      rowClass: 'portfolio-row',
      accountId: 'ALL',
    })
  );

  state.accounts.forEach((account) => {
    const summary = state.accountSummaries.get(account.id);
    const periods = summary?.periods || {};
    rows.push(
      buildRow({
        label: account.label || 'Account',
        subtitle: 'Account performance',
        periods,
        coverage: summary?.coverage || {},
        rowClass: 'account-row',
        accountId: account.id,
      })
    );
  });

  if (Array.isArray(state.summary.benchmarks) && state.summary.benchmarks.length) {
    const composite =
      state.summary.benchmarks.find((entry) => entry.benchmark === 'composite') ||
      state.summary.benchmarks[0];
    rows.push(
      buildRow({
        label: 'Composite Benchmark',
        subtitle: 'Weighted basket reference',
        periods: extractBenchmarkPeriods(composite),
        coverage: deriveCoverage({ benchmarks: [composite] }),
        rowClass: 'benchmark-row',
        dataset: composite.benchmark,
      })
    );
  }

  rows.push(
    buildRow({
      label: 'Platform',
      subtitle: 'ROO7 aggregate strategies',
      periods: state.platformPeriods,
      coverage: state.platformCoverage,
      rowClass: 'platform-row',
    })
  );

  selectors.tableBody.innerHTML = rows.length
    ? rows.join('')
    : `<tr class="table-placeholder-row"><td colspan="7"><div class="placeholder-copy">No data available.</div></td></tr>`;

  selectors.tableBody.querySelectorAll('tr[data-account-id]').forEach((row) => {
    const accountId = row.dataset.accountId;
    row.addEventListener('click', () => {
      if (!accountId || accountId === state.accountId) return;
      state.accountId = accountId;
      renderAccountSelector();
      highlightAccountRow(state.accountId);
      seriesCache.clear();
      fetchPerformance({ silent: false, useCache: false }).catch((error) =>
        console.error('Account change error', error)
      );
    });
  });

  document.querySelectorAll('.period-header').forEach((header) => {
    header.removeEventListener('click', handlePeriodHeaderClick);
    header.addEventListener('click', handlePeriodHeaderClick);
  });
  setActivePeriodButton(state.period);

  if (selectors.tableStatus) {
    selectors.tableStatus.textContent = 'Click a portfolio or account row (or timeframe) to update the chart.';
  }

  highlightAccountRow(state.accountId);
}

function handlePeriodHeaderClick(event) {
  const period = event.currentTarget?.dataset?.period;
  if (!period || period === state.period) return;
  state.period = period;
  state.lockedPeriod = period;
  setActivePeriodButton(period);
  fetchPerformance({ silent: false, useCache: false }).catch((error) =>
    console.error('Period header change error', error)
  );
}

async function fetchSummary() {
  if (!selectors.tableStatus) return;
  try {
    selectors.tableStatus.innerHTML = loadingMarkup('Loading summary…');
    const params = new URLSearchParams({
      periods: PERIOD_KEYS.join(','),
      benchmarks: BENCHMARK_VALUES.join(','),
    });
    const endpoint = `${MARKET_API_BASE}/benchmark/portfolio/table?${params.toString()}`;
    const response = await fetch(endpoint, {
      headers: getAuthHeaders(),
    });
    if (handleAuthError(response.status)) return;
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.detail || 'Unexpected API response');
    }
    state.summary = payload.data;
    state.platformPeriods = derivePlatformPeriods(payload.data);
    state.platformCoverage = deriveCoverage(payload.data);
    state.portfolioPeriods = payload.data.portfolio?.periods || {};
    state.portfolioCoverage = deriveCoverage(payload.data);
    await fetchAccountSummaries(true);
    renderSummaryTable();
  } catch (error) {
    console.error('Summary fetch error:', error);
    selectors.tableStatus.textContent = 'Unable to load summary table.';
  }
}

function applyBenchmark(nextBenchmark) {
  if (!nextBenchmark || nextBenchmark === state.benchmark) {
    updateBenchmarkButtons();
    return;
  }
  state.benchmark = nextBenchmark;
  state.lockedBenchmark = nextBenchmark;
  updateBenchmarkButtons();
  fetchPerformance({ silent: false, useCache: false }).catch((error) =>
    console.error('Benchmark button error', error)
  );
}

function handleBenchmarkClick(event) {
  const button = event.target.closest('button[data-benchmark]');
  if (!button) return;
  applyBenchmark(button.dataset.benchmark);
}

function handlePeriodClick(event) {
  const button = event.target.closest('button[data-period]');
  if (!button || button.dataset.period === state.period) return;
  state.period = button.dataset.period;
  state.lockedPeriod = state.period;
  setActivePeriodButton(state.period);
  fetchPerformance({ silent: false, useCache: false }).catch((error) =>
    console.error('Period button error', error)
  );
}

function initLogout() {
  if (!selectors.logoutBtn) return;
  selectors.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = '/auth.html';
  });
}

function initVisibilityToggles() {
  if (selectors.togglePlatform) {
    selectors.togglePlatform.checked = state.showPlatform;
    selectors.togglePlatform.addEventListener('change', (event) => {
      state.showPlatform = event.target.checked;
      updateChart();
    });
  }
  if (selectors.toggleBenchmark) {
    selectors.toggleBenchmark.checked = state.showBenchmark;
    selectors.toggleBenchmark.addEventListener('change', (event) => {
      state.showBenchmark = event.target.checked;
      updateChart();
    });
  }
}

async function init() {
  state.token = localStorage.getItem('token');
  if (!state.token) {
    window.location.href = '/auth.html';
    return;
  }

  document.title = `${BRAND_CONFIG.name} | Portfolio vs Benchmark`;
  const brandLogo = document.querySelector('.brand-logo');
  if (brandLogo) brandLogo.textContent = BRAND_CONFIG.name;

  selectors.footerYear.textContent = new Date().getFullYear();
  initLogout();
  initVisibilityToggles();

  selectors.periodButtons.forEach((btn) => btn.addEventListener('click', handlePeriodClick));
  selectors.benchmarkButtons.forEach((btn) => btn.addEventListener('click', handleBenchmarkClick));

  await waitForLineChart();
  const initialDimensions = computeChartDimensions();
  chart = new window.LineChart('comparison-chart', {
    width: initialDimensions.width,
    height: initialDimensions.height,
    dateFormat: 'adaptive',
    valueFormat: 'percentage',
    periodDays: 7,
    colors: ['#10b981', '#1d4ed8', '#f97316'],
    centerZero: true,
    shadeBetween: false,
    fillArea: false,
  });

  window.addEventListener('resize', resizeHandler);

  await loadAccounts();
  await fetchAccountSummaries(true);
  setActivePeriodButton(state.period);
  await fetchPerformance({ silent: false, useCache: false });
  await fetchSummary();
}

window.addEventListener('DOMContentLoaded', init);
