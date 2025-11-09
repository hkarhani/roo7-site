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
  {
    value: 'composite',
    label: 'Composite Benchmark',
    shortLabel: 'Composite',
    detail: 'Composite weighted basket (BTC 60% · ETH 25% · SOL 5% · BNB 5% · XRP 5%)',
  },
  { value: 'BTCUSDT', label: 'BTC', shortLabel: 'BTC', detail: 'Bitcoin (BTCUSDT) hourly change' },
  { value: 'ETHUSDT', label: 'ETH', shortLabel: 'ETH', detail: 'Ethereum (ETHUSDT) hourly change' },
  { value: 'SOLUSDT', label: 'SOL', shortLabel: 'SOL', detail: 'Solana (SOLUSDT) hourly change' },
  { value: 'BNBUSDT', label: 'BNB', shortLabel: 'BNB', detail: 'BNB (BNBUSDT) hourly change' },
  { value: 'XRPUSDT', label: 'XRP', shortLabel: 'XRP', detail: 'XRP (XRPUSDT) hourly change' },
];
const BENCHMARK_VALUES = BENCHMARKS.map((benchmark) => benchmark.value);

const DEFAULT_PERIOD = '7d';
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
  period: DEFAULT_PERIOD,
  lockedPeriod: DEFAULT_PERIOD,
  benchmark: BENCHMARKS[0].value,
  lockedBenchmark: BENCHMARKS[0].value,
  rawData: null,
  loading: false,
  summary: null,
  coverage: {},
};

const selectors = {
  periodButtons: document.querySelectorAll('.period-btn'),
  benchmarkButtons: document.querySelectorAll('.benchmark-btn'),
  status: document.getElementById('chart-status'),
  platformChange: document.getElementById('platform-change'),
  platformUpdated: document.getElementById('platform-last-updated'),
  benchmarkChange: document.getElementById('benchmark-change'),
  spreadChange: document.getElementById('spread-change'),
  spreadHelper: document.getElementById('spread-helper'),
  benchmarkDetail: document.getElementById('benchmark-detail'),
  benchmarkLegend: document.getElementById('benchmark-legend-label'),
  tableBody: document.getElementById('benchmark-table-body'),
  tableStatus: document.getElementById('benchmark-table-status'),
  footerYear: document.getElementById('footer-year'),
};

let chart = null;
const seriesCache = new Map();

function getBenchmarkOption(value) {
  return BENCHMARKS.find((option) => option.value === value) || BENCHMARKS[0];
}

function resolveBenchmarkLabel() {
  const option = getBenchmarkOption(state.benchmark);
  const metadataKey = state.rawData?.metadata?.benchmark;
  if (metadataKey && metadataKey.toLowerCase() === state.benchmark.toLowerCase()) {
    return state.rawData?.metadata?.benchmark_label || option.label;
  }
  return option.label;
}

function resolveBenchmarkDetail() {
  const option = getBenchmarkOption(state.benchmark);
  if (option.value === 'composite') {
    return option.detail;
  }
  const metadataKey = state.rawData?.metadata?.benchmark;
  if (metadataKey && metadataKey.toLowerCase() === state.benchmark.toLowerCase()) {
    const label = state.rawData?.metadata?.benchmark_label || option.label;
    return `${label} hourly change (spot close)`;
  }
  return option.detail;
}

function updateBenchmarkButtons() {
  selectors.benchmarkButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.benchmark === state.benchmark);
  });
}

function setActivePeriodButton(activePeriod) {
  selectors.periodButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.period === activePeriod);
  });
  document.querySelectorAll('.period-header').forEach((header) => {
    header.classList.toggle('active', header.dataset.period === activePeriod);
  });
}

function debounce(fn, delay = 150) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
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
      const label = getBenchmarkOption(state.benchmark).label;
      selectors.status.textContent = `Fetching data vs ${label}…`;
    } else {
      selectors.status.textContent = '';
    }
  }
  if (isLoading && chart) {
    chart.showLoadingState();
  }
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
    baselineDate = new Date(firstTime.getTime() - 3600000); // default to 1 hour before
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
      value: cumulative / 100, // chart expects decimal for percentage
    });
  });

  return series;
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '– %';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function deriveCoverage(summary) {
  const coverage = {};
  const benchmark = summary?.benchmarks?.find((entry) => entry.periods);
  if (!benchmark) return coverage;
  PERIODS.forEach(({ value }) => {
    const metric = benchmark.periods?.[value];
    coverage[value] = metric?.timestamps_shared ?? metric?.shared_points ?? 0;
  });
  return coverage;
}

function updateStats(platformSeries, benchmarkSeries) {
  const lastPlatform = platformSeries.at(-1)?.value ?? 0;
  const lastBenchmark = benchmarkSeries.at(-1)?.value ?? 0;
  const spread = (lastPlatform - lastBenchmark) * 100;
  const benchmarkLabel = resolveBenchmarkLabel();

  selectors.platformChange.textContent = formatPercent(lastPlatform * 100);
  selectors.benchmarkChange.textContent = formatPercent(lastBenchmark * 100);
  selectors.spreadChange.textContent = formatPercent(spread);
  selectors.spreadChange.style.color = spread >= 0 ? '#10b981' : '#ef4444';
  selectors.spreadHelper.textContent =
    spread >= 0
      ? `Platform outperforming ${benchmarkLabel}`
      : `Platform underperforming ${benchmarkLabel}`;

  if (selectors.benchmarkLegend) {
    selectors.benchmarkLegend.textContent = `Benchmark cumulative % (${benchmarkLabel})`;
  }
  if (selectors.benchmarkDetail) {
    selectors.benchmarkDetail.textContent = resolveBenchmarkDetail();
  }

  const lastTimestamp =
    state.rawData?.points?.at(-1)?.timestamp || new Date().toISOString();
  selectors.platformUpdated.textContent = `Updated ${new Date(lastTimestamp).toUTCString()}`;
}

function updateChart() {
  if (!state.rawData || !state.rawData.points?.length) {
    if (chart) {
      chart.showEmptyState();
    }
    selectors.status.textContent = `No overlapping data available for ${resolveBenchmarkLabel()} this period.`;
    return;
  }

  const platformSeries = cumulativeSeries(state.rawData.points, 'platform_change_percent');
  const benchmarkSeries = cumulativeSeries(state.rawData.points, 'benchmark_change_percent');

  if (!platformSeries.length || !benchmarkSeries.length) {
    chart.showEmptyState();
    selectors.status.textContent = `Insufficient data to display chart for ${resolveBenchmarkLabel()}.`;
    return;
  }

  const periodConfig = PERIODS.find((p) => p.value === state.period);
  if (chart) {
    chart.options.periodDays = periodConfig?.days || 7;
    const benchmarkLabel = resolveBenchmarkLabel();
    chart.setData([
      {
        name: 'Platform cumulative %',
        color: '#1d4ed8',
        values: platformSeries.map((point) => ({
          timestamp: point.timestamp,
          value: point.value,
        })),
      },
      {
        name: `Benchmark cumulative % (${benchmarkLabel})`,
        color: '#f97316',
        values: benchmarkSeries.map((point) => ({
          timestamp: point.timestamp,
          value: point.value,
        })),
      },
    ]);
    resizeChart(state.rawData?.points?.length || platformSeries.length);
  }

  updateStats(platformSeries, benchmarkSeries);
  selectors.status.textContent = `Shared data points vs ${resolveBenchmarkLabel()}: ${state.rawData.metadata?.timestamps_shared ?? '–'}`;
  highlightTableRow(state.benchmark);
}

async function fetchPerformance(options = {}) {
  const { silent = false, useCache = true } = options;
  const targetBenchmark = state.benchmark;
  const targetPeriod = state.period;
  const cacheKey = `${targetBenchmark}|${targetPeriod}`;
  if (useCache && seriesCache.has(cacheKey)) {
    if (targetBenchmark === state.benchmark && targetPeriod === state.period) {
      state.rawData = seriesCache.get(cacheKey);
      updateChart();
    }
    return;
  }

  setLoading(true, { silent });
  const params = new URLSearchParams({
    period: targetPeriod,
    benchmark: targetBenchmark,
  });
  const endpoint = `${API_CONFIG.marketUrl}/public/benchmark/platform-vs-market?${params.toString()}`;

  try {
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.detail || 'Unexpected API response');
    }
    seriesCache.set(cacheKey, payload.data);
    if (targetBenchmark === state.benchmark && targetPeriod === state.period) {
      state.rawData = payload.data;
      updateChart();
    }
  } catch (error) {
    console.error('Benchmark fetch error:', error);
    seriesCache.delete(cacheKey);
    if (targetBenchmark === state.benchmark && targetPeriod === state.period) {
      const option = getBenchmarkOption(state.benchmark);
      selectors.status.textContent = `Unable to load data for ${option.label}. Please try again later.`;
      if (chart) {
        chart.showEmptyState();
      }
    }
  } finally {
    state.loading = false;
  }
}

function handlePeriodClick(event) {
  const button = event.target.closest('button[data-period]');
  if (!button) return;
  applyPeriod(button.dataset.period);
}

function handleBenchmarkClick(event) {
  const button = event.target.closest('button[data-benchmark]');
  if (!button) return;
  applyBenchmark(button.dataset.benchmark);
}

function applyPeriod(nextPeriod, options = {}) {
  const { temporary = false, silent = false } = options;
  if (!nextPeriod) return;
  const normalized = nextPeriod.toLowerCase();
  if (!temporary) {
    state.lockedPeriod = normalized;
  }
  if (normalized === state.period) {
    setActivePeriodButton(state.period);
    return;
  }
  state.period = normalized;
  setActivePeriodButton(state.period);
  fetchPerformance({ silent, useCache: true }).catch((error) =>
    console.error('applyPeriod fetch error', error)
  );
}

function highlightTableRow(activeBenchmark) {
  if (!selectors.tableBody) return;
  selectors.tableBody.querySelectorAll('tr').forEach((row) => {
    row.classList.toggle('active-row', row.dataset.benchmark === activeBenchmark);
  });
}

function applyBenchmark(nextBenchmark, options = {}) {
  const { temporary = false, silent = false } = options;
  if (!nextBenchmark) return;
  const isSameBenchmark = nextBenchmark === state.benchmark;
  if (!temporary) {
    state.lockedBenchmark = nextBenchmark;
  }
  if (isSameBenchmark) {
    highlightTableRow(nextBenchmark);
    updateBenchmarkButtons();
    return;
  }
  state.benchmark = nextBenchmark;
  updateBenchmarkButtons();
  highlightTableRow(nextBenchmark);
  fetchPerformance({ silent }).catch((error) => console.error('applyBenchmark fetch error', error));
}

function handleTableRowClick(event) {
  const benchmark = event.currentTarget?.dataset?.benchmark;
  if (!benchmark) return;
  applyBenchmark(benchmark);
}

function handlePeriodHeaderClick(event) {
  const period = event.currentTarget?.dataset?.period;
  if (!period) return;
  applyPeriod(period, { temporary: false, silent: false });
}

function hasSufficientCoverage(sharedPoints, periodKey) {
  const expected = PERIOD_INFO[periodKey] || 0;
  if (!LONG_PERIODS.has(periodKey) || expected === 0) return true;
  if (sharedPoints === null || sharedPoints === undefined) return false;
  return sharedPoints >= expected * COVERAGE_RATIO;
}

function buildBenchmarkCell(metric, periodKey) {
  const value = metric?.benchmark_change_percent;
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '<td><div class="placeholder-copy">–</div></td>';
  }
  const shared = metric.timestamps_shared ?? metric.shared_points ?? 0;
  if (!hasSufficientCoverage(shared, periodKey)) {
    return '<td><div class="placeholder-copy">N/A</div></td>';
  }
  const polarity = value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
  return `<td><span class="cell-pill ${polarity}">${formatPercent(value)}</span></td>`;
}

function buildPlatformCell(value, periodKey) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '<td><div class="placeholder-copy">–</div></td>';
  }
  const shared = state.coverage?.[periodKey] ?? 0;
  if (!hasSufficientCoverage(shared, periodKey)) {
    return '<td><div class="placeholder-copy">N/A</div></td>';
  }
  const polarity = value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
  return `<td><span class="cell-pill ${polarity} platform-pill">${formatPercent(value)}</span></td>`;
}

function computePlatformPeriodValues() {
  const values = {};
  if (!state.summary?.benchmarks) {
    PERIODS.forEach(({ value }) => {
      values[value] = null;
    });
    return values;
  }
  PERIODS.forEach(({ value }) => {
    values[value] = getPlatformValueForPeriod(value);
  });
  return values;
}

function getPlatformValueForPeriod(periodKey) {
  if (!state.summary?.benchmarks) return null;
  for (const entry of state.summary.benchmarks) {
    const metric = entry.periods?.[periodKey];
    if (
      metric &&
      metric.platform_change_percent !== null &&
      metric.platform_change_percent !== undefined &&
      !Number.isNaN(metric.platform_change_percent)
    ) {
      return metric.platform_change_percent;
    }
  }
  return null;
}

function buildPlatformRow(periodValues) {
  const cells = PERIODS.map((period) =>
    buildPlatformCell(periodValues[period.value], period.value)
  ).join('');
  return `
    <tr class="platform-row">
      <td>
        <div class="benchmark-name">
          <span>Platform</span>
          <span class="sub">Aggregated ROO7 performance</span>
        </div>
      </td>
      ${cells}
    </tr>`;
}

function renderSummaryTable() {
  if (!selectors.tableBody) return;
  if (!state.summary || !Array.isArray(state.summary.benchmarks) || state.summary.benchmarks.length === 0) {
    selectors.tableBody.innerHTML = `
      <tr class="table-placeholder-row">
        <td colspan="7">
          <div class="placeholder-copy">Summary will appear once data loads.</div>
        </td>
      </tr>`;
    return;
  }

  const orderMap = new Map(BENCHMARK_VALUES.map((value, index) => [value, index]));
  const sortedBenchmarks = [...state.summary.benchmarks].sort((a, b) => {
    const aScore = orderMap.get(a.benchmark) ?? Number.MAX_SAFE_INTEGER;
    const bScore = orderMap.get(b.benchmark) ?? Number.MAX_SAFE_INTEGER;
    return aScore - bScore;
  });

  const rows = sortedBenchmarks
    .map((entry) => {
      const shortLabel =
        entry.benchmark === 'composite' ? 'Composite' : (entry.benchmark || '').replace('USDT', '');
      const subtitle =
        entry.benchmark_type === 'composite'
          ? 'Composite weighted basket'
          : `${shortLabel} spot reference`;
      const cells = PERIODS.map((period) =>
        buildBenchmarkCell(entry.periods?.[period.value], period.value)
      ).join('');
      return `
        <tr data-benchmark="${entry.benchmark}">
          <td>
            <div class="benchmark-name">
              <span>${shortLabel}</span>
              <span class="sub">${subtitle}</span>
            </div>
          </td>
          ${cells}
        </tr>`;
    })
    .join('');

  const platformValues = computePlatformPeriodValues();
  const platformRow = buildPlatformRow(platformValues);
  selectors.tableBody.innerHTML = rows + platformRow;
  selectors.tableBody.querySelectorAll('tr').forEach((row) => {
    const benchmark = row.dataset.benchmark;
    if (!benchmark) return;
    row.addEventListener('click', handleTableRowClick);
  });
  highlightTableRow(state.benchmark);
  document.querySelectorAll('.period-header').forEach((header) => {
    header.removeEventListener('click', handlePeriodHeaderClick);
    header.addEventListener('click', handlePeriodHeaderClick);
  });
  setActivePeriodButton(state.period);
  if (selectors.tableStatus) {
    selectors.tableStatus.textContent = 'Click a benchmark row or timeframe to update the chart.';
  }
}

async function fetchSummary() {
  if (!selectors.tableStatus) return;
  try {
    selectors.tableStatus.textContent = 'Loading summary…';
    const params = new URLSearchParams({
      periods: PERIOD_KEYS.join(','),
      benchmarks: BENCHMARK_VALUES.join(','),
    });
    const endpoint = `${API_CONFIG.marketUrl}/public/benchmark/platform-vs-market/table?${params.toString()}`;
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.detail || 'Unexpected API response');
    }
    state.summary = payload.data;
    state.coverage = deriveCoverage(payload.data);
    renderSummaryTable();
  } catch (error) {
    console.error('Summary fetch error:', error);
    selectors.tableStatus.textContent = 'Unable to load summary table.';
  }
}

async function init() {
  await waitForLineChart();
  const initialDimensions = computeChartDimensions();
  chart = new window.LineChart('comparison-chart', {
    width: initialDimensions.width,
    height: initialDimensions.height,
    dateFormat: 'adaptive',
    valueFormat: 'percentage',
    periodDays: 1,
    colors: ['#1d4ed8', '#f97316'],
    centerZero: true,
    shadeBetween: true,
    fillArea: false
  });

  document.title = `${BRAND_CONFIG.name} | Platform vs Benchmark`;
  selectors.footerYear.textContent = new Date().getFullYear();
  selectors.periodButtons.forEach((btn) => {
    btn.addEventListener('click', handlePeriodClick);
  });
  selectors.benchmarkButtons.forEach((btn) => {
    btn.addEventListener('click', handleBenchmarkClick);
  });
  updateBenchmarkButtons();
  const handleResize = debounce(() => resizeChart(state.rawData?.points?.length || 0), 200);
  window.addEventListener('resize', handleResize);

  state.lockedBenchmark = state.benchmark;
  setActivePeriodButton(state.period);
  fetchPerformance().catch((error) => console.error('Initial fetch error', error));
  fetchSummary();
}

window.addEventListener('DOMContentLoaded', init);
