import { API_CONFIG, BRAND_CONFIG } from './frontend-config.js';

const PERIODS = [
  { value: '24h', label: '24h', days: 1 },
  { value: '7d', label: '7d', days: 7 },
  { value: '30d', label: '30d', days: 30 },
  { value: '90d', label: '90d', days: 90 },
  { value: '180d', label: '180d', days: 180 },
  { value: '1y', label: '1y', days: 365 },
];

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

const state = {
  period: '24h',
  benchmark: BENCHMARKS[0].value,
  rawData: null,
  loading: false,
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
  footerYear: document.getElementById('footer-year'),
};

let chart = null;

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

  const baseHeight = Math.max(360, viewportHeight * 0.45);
  let densityBonus = 0;
  if (pointCount > 240) densityBonus = 160;
  else if (pointCount > 180) densityBonus = 120;
  else if (pointCount > 120) densityBonus = 80;
  else if (pointCount > 60) densityBonus = 40;

  const height = Math.min(820, baseHeight + densityBonus);
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

function setLoading(isLoading) {
  state.loading = isLoading;
  if (isLoading) {
    const label = getBenchmarkOption(state.benchmark).label;
    selectors.status.textContent = `Fetching data vs ${label}…`;
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
  series.push({
    timestamp: firstTime.toISOString(),
    date: firstTime,
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
  if (value === null || value === undefined) return '– %';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
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
}

async function fetchPerformance() {
  setLoading(true);
  const params = new URLSearchParams({
    period: state.period,
    benchmark: state.benchmark,
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
    state.rawData = payload.data;
    updateChart();
  } catch (error) {
    console.error('Benchmark fetch error:', error);
    const option = getBenchmarkOption(state.benchmark);
    selectors.status.textContent = `Unable to load data for ${option.label}. Please try again later.`;
    if (chart) {
      chart.showEmptyState();
    }
  } finally {
    setLoading(false);
  }
}

function handlePeriodClick(event) {
  const button = event.target.closest('button[data-period]');
  if (!button || button.dataset.period === state.period) return;

  selectors.periodButtons.forEach((btn) => btn.classList.toggle('active', btn === button));
  state.period = button.dataset.period;
  fetchPerformance();
}

function handleBenchmarkClick(event) {
  const button = event.target.closest('button[data-benchmark]');
  if (!button || button.dataset.benchmark === state.benchmark) return;

  state.benchmark = button.dataset.benchmark;
  updateBenchmarkButtons();
  fetchPerformance();
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

  fetchPerformance();
}

window.addEventListener('DOMContentLoaded', init);
