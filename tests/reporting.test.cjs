// Offline tests: node --test tests/reporting.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const R = require('../reporting-values.js');
const LineChart = require('../line-chart.js');
const root = path.resolve(__dirname, '..');

test('account value is signed equity, not highest candidate or equity plus PnL', () => {
  assert.equal(R.accountValue({equity_usdt: 1181.48, current_value: 2786.87, unrealized_pnl: -2.1}), 1181.48);
  assert.equal(R.accountValue({current_value: 100, summary: {unrealized_pnl_usdt: 20}}), 100);
  assert.equal(R.accountValue({equity_usdt: 0, current_value: 100}), 0);
  assert.equal(R.accountValue({equity_usdt: -50}), -50);
  assert.equal(R.accountValue({}), null);
  for (const value of [null, undefined, '', true, Infinity, NaN]) assert.equal(R.finite(value), null);
});

test('current equity never falls back to stale chart history', () => {
  assert.equal(R.currentValue({current_value: 50625}), null);
  assert.equal(R.currentValue({current_value: 50625, current: {equity_usdt: 52425}}), 52425);
  assert.equal(R.currentValue({current: {equity_usdt: 0}}), 0);
});
test('separate observation boundaries do not restart an intact benchmark', () => {
  const payload = {points: [{timestamp:'2026-01-01T01:30:00Z', benchmark_change_percent:null}],
    series: {benchmark: points.map(p => ({...p, change_percent:p.change})), portfolio:[]}};
  const series = R.comparisonSeries(payload, 'benchmark');
  assert.ok(Math.abs(series.at(-1).value + .01) < 1e-10);
  assert.equal(R.comparisonSeries(payload, 'portfolio').length, 0);
});
test('request cache coalesces concurrent loads, scopes keys, and retries errors', async () => {
  const cache = R.requestCache();
  let calls = 0;
  const loader = async () => {calls++; return 42;};
  assert.deepEqual(await Promise.all([cache('owner1:url',loader),cache('owner1:url',loader)]),[42,42]);
  assert.equal(calls,1);
  await cache('owner2:url',loader); assert.equal(calls,2);
  await assert.rejects(cache('error',async()=>{throw Error('offline');}));
  assert.equal(await cache('error',loader),42);
});
test('valid observed segments carry explicit date bounds and no invented full-period return', () => {
  const series = R.cumulativeSeries([...points,{timestamp:'2026-01-01T03:00:00Z',change:null},
    {timestamp:'2026-01-01T04:00:00Z',change:2}], 'change');
  const last = R.segmentSummary(series);
  assert.ok(Math.abs(last.value - .02) < 1e-10);
  assert.equal(last.start,'2026-01-01T03:00:00.000Z');
  assert.match(R.observedCell({change_percent:2,start:last.start,end:last.end},v=>v+'%'),/not the full selected period/);
});
test('analytics starts chart before waiting for account summaries', () => {
  const js = fs.readFileSync(path.join(root,'portfoliovsbenchmark.js'),'utf8');
  const init = js.slice(js.indexOf('async function init()'));
  assert.ok(init.indexOf('void fetchPerformance') < init.indexOf('void loadAccounts'));
  assert.ok(!js.includes('await fetchAccountSummaries()'));
});

const points = [
  {timestamp: '2026-01-01T01:00:00Z', interval_start: '2026-01-01T00:00:00Z', change: 10},
  {timestamp: '2026-01-01T02:00:00Z', change: -10},
];
test('compounds every interval including the first, with a starting baseline', () => {
  const series = R.cumulativeSeries(points, 'change');
  assert.equal(series.length, 3);
  assert.equal(series[0].value, 0);
  assert.ok(Math.abs(series[1].value - .1) < 1e-10);
  assert.ok(Math.abs(series[2].value + .01) < 1e-10);
});
test('missing return splits separately rebased observed segments', () => {
  const series = R.cumulativeSeries([...points, {timestamp: '2026-01-01T03:00:00Z', change: null}, {timestamp: '2026-01-01T04:00:00Z', change: 10}], 'change');
  assert.ok(Math.abs(series.at(-1).value - .1) < 1e-10);
  assert.ok(series.some(p => p.value === null));
  assert.equal(series.at(-1).segment_start, '2026-01-01T03:00:00.000Z');
  assert.equal(R.cumulativeSeries([{timestamp: 'invalid', change: 10}], 'change').length, 0);
});
test('coverage notice discloses partial history, stale gaps and cash flow limitations', () => {
  const text = R.coverageText({as_of: '2026-01-01T03:00:00Z', observed_hours: 3, partial_period: true, gaps: 2, cohort_changed: true});
  for (const expected of ['3.0h', 'partial period', '2 missing', 'coverage changed', 'deposits/withdrawals']) assert.ok(text.includes(expected));
});

function chart(values) {
  const c = Object.create(LineChart.prototype);
  c.options = {width: 800, height: 400, margin: {top: 20, bottom: 20, left: 80, right: 60}, valueFormat: 'currency'};
  c.data = [{values}];
  c.scales = {x: null, y: null};
  c.processData(); c.createScales(600, 360);
  return c;
}
test('chart preserves zero and missing data separately, and scales negative equity', () => {
  const c = chart([{timestamp: points[0].timestamp, value_usdt: 0, total_value: 99}, {timestamp: points[1].timestamp, value_usdt: null, total_value: 99}, {timestamp: '2026-01-01T03:00:00Z', value: -10}]);
  assert.deepEqual(c.data[0].values.map(p => p.value), [0, null, -10]);
  assert.ok(c.scales.y.domain[0] < -10);
  assert.ok(c.scales.y.domain[1] > 0);
  const line = c.createLinePath(c.data[0].values);
  assert.equal((line.match(/M/g) || []).length, 2);
  assert.equal(c.createAreaPath(c.data[0].values), '');
});
test('a chart cannot connect or shade over a long observation gap', () => {
  const c = chart([{timestamp: '2026-01-01T01:00:00Z', value: 100}, {timestamp: '2026-01-01T02:00:00Z', value: 110}, {timestamp: '2026-01-01T06:00:00Z', value: 120}, {timestamp: '2026-01-01T07:00:00Z', value: 130}]);
  assert.equal((c.createLinePath(c.data[0].values).match(/M/g) || []).length, 2);
  assert.equal((c.createAreaPath(c.data[0].values).match(/Z/g) || []).length, 2);
});
test('constant negative balances have a valid noninverted axis', () => {
  const c = chart([{timestamp: points[0].timestamp, value: -50}, {timestamp: points[1].timestamp, value: -50}]);
  assert.ok(c.scales.y.domain[0] < -50 && c.scales.y.domain[1] > -50);
  c.options.width = 280;
  assert.equal(c.generateXTicks().length, 2); // Narrow charts do not overlap six labels.
});

// Extract actual pure UI functions for summary tests, without running login or APIs.
function uiFunction(file, name, nextName, globals) {
  const s = fs.readFileSync(path.join(root, file), 'utf8');
  const begin = s.indexOf('function ' + name + '(');
  const end = s.indexOf('function ' + nextName + '(', begin);
  const source = s.slice(begin, end).replace(/(?:async\s+)?\s*$/, '');
  const context = {...globals, window: {ReportingValues: R}};
  vm.createContext(context);
  vm.runInContext(source, context);
  return context[name];
}
test('comparison summary shows unavailable, not zero or outperformance, after a gap', () => {
  const selectors = Object.fromEntries(['portfolioChange','platformChange','benchmarkChange','portfolioBenchmarkSpread','portfolioBenchmarkHelper','portfolioUpdated','benchmarkDetail','benchmarkLegend'].map(k => [k, {}]));
  const fn = uiFunction('portfoliovsbenchmark.js', 'updateStats', 'updateChart', {selectors, state: {rawData: {points: []}}, formatPercent: v => v === null ? 'N/A' : v.toFixed(2), getBenchmarkOption: () => ({label: 'BTC', detail: ''})});
  fn([{value: null}], [{value: 0}], [{value: .1}]);
  assert.equal(selectors.portfolioChange.textContent, 'N/A');
  assert.equal(selectors.portfolioBenchmarkSpread.textContent, 'N/A');
  assert.match(selectors.portfolioBenchmarkHelper.textContent, /unavailable/);
});
test('shared reporting helper loads before page scripts on every modified page', () => {
  for (const file of ['dashboard','admin-dashboard','admin-portfolioanalytics','portfoliovsbenchmark','platformvsbenchmark','troubleshoot']) {
    const html = fs.readFileSync(path.join(root, file+'.html'), 'utf8');
    assert.ok(html.indexOf('src="reporting-values.js') >= 0, file);
    assert.ok(html.indexOf('src="reporting-values.js') < html.indexOf('src="'+file+'.js'), file);
  }
});
test('admin chart functions are not duplicated by an edit', () => {
  const js = fs.readFileSync(path.join(root, 'admin-dashboard.js'), 'utf8');
  for (const name of ['loadPlatformAnalytics', 'updatePlatformSummaryStats', 'displaySourceAccountsAnalyticsData']) assert.equal(js.split('function '+name+'(').length - 1, 1, name);
});
