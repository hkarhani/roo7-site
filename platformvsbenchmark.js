import { API_CONFIG, BRAND_CONFIG } from './frontend-config.js';

const PERIODS = [
  { value: '24h', label: '24h', days: 1 },
  { value: '7d', label: '7d', days: 7 },
  { value: '30d', label: '30d', days: 30 },
  { value: '90d', label: '90d', days: 90 },
  { value: '180d', label: '180d', days: 180 },
  { value: '1y', label: '1y', days: 365 },
];

const state = {
  period: '24h',
  rawData: null,
  loading: false,
};

const selectors = {
  periodButtons: document.querySelectorAll('.period-btn'),
  status: document.getElementById('chart-status'),
  platformChange: document.getElementById('platform-change'),
  platformUpdated: document.getElementById('platform-last-updated'),
  benchmarkChange: document.getElementById('benchmark-change'),
  spreadChange: document.getElementById('spread-change'),
  spreadHelper: document.getElementById('spread-helper'),
  footerYear: document.getElementById('footer-year'),
};

let chart = null;

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
  selectors.status.textContent = isLoading ? 'Fetching data…' : '';
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

  selectors.platformChange.textContent = formatPercent(lastPlatform * 100);
  selectors.benchmarkChange.textContent = formatPercent(lastBenchmark * 100);
  selectors.spreadChange.textContent = formatPercent(spread);
  selectors.spreadChange.style.color = spread >= 0 ? '#10b981' : '#ef4444';
  selectors.spreadHelper.textContent =
    spread >= 0 ? 'Platform outperforming benchmark' : 'Platform underperforming benchmark';

  const lastTimestamp =
    state.rawData?.points?.at(-1)?.timestamp || new Date().toISOString();
  selectors.platformUpdated.textContent = `Updated ${new Date(lastTimestamp).toUTCString()}`;
}

function updateChart() {
  if (!state.rawData || !state.rawData.points?.length) {
    if (chart) {
      chart.showEmptyState();
    }
    selectors.status.textContent = 'No overlapping data available for this period.';
    return;
  }

  const platformSeries = cumulativeSeries(state.rawData.points, 'platform_change_percent');
  const benchmarkSeries = cumulativeSeries(state.rawData.points, 'benchmark_change_percent');

  if (!platformSeries.length || !benchmarkSeries.length) {
    chart.showEmptyState();
    selectors.status.textContent = 'Insufficient data to display chart.';
    return;
  }

  const periodConfig = PERIODS.find((p) => p.value === state.period);
  if (chart) {
    chart.options.periodDays = periodConfig?.days || 7;
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
        name: 'Benchmark cumulative %',
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
  selectors.status.textContent = `Shared data points: ${state.rawData.metadata?.timestamps_shared ?? '–'}`;
}

async function fetchPerformance() {
  setLoading(true);
  const endpoint = `${API_CONFIG.marketUrl}/public/benchmark/platform-vs-market?period=${state.period}`;

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
    selectors.status.textContent = 'Unable to load data. Please try again later.';
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
  const handleResize = debounce(() => resizeChart(state.rawData?.points?.length || 0), 200);
  window.addEventListener('resize', handleResize);

  fetchPerformance();
}

window.addEventListener('DOMContentLoaded', init);
