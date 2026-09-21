/* Shared reporting contract. No exchange credentials or strategy-source data. */
(function (root) {
  const finite = value => value === null || value === undefined || value === '' || typeof value === 'boolean'
    ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
  function accountValue(account) {
    for (const value of [account?.equity_usdt, account?.valuation?.equity_usdt,
      account?.current_value, account?.portfolio_total_value, account?.summary?.total_equity_usdt,
      account?.total_usdt_value]) {
      if (finite(value) !== null) return finite(value);
    }
    return null; // Missing data is not a zero balance.
  }
  function cumulativeSeries(points, key) {
    const sorted = [...(points || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const series = [];
    let factor = 1, previous = null, active = false, segmentStart = null;
    for (const point of sorted) {
      const delta = finite(point[key]), date = new Date(point.timestamp);
      const start = new Date(point.interval_start || (previous === null ? date.getTime() - 3600000 : previous));
      const hours = (date - start) / 3600000;
      if (delta === null || !Number.isFinite(date.getTime()) || !(hours > 0 && hours <= 2)) {
        if (Number.isFinite(date.getTime())) series.push({timestamp: point.timestamp, date, value: null});
        active = false; previous = date.getTime(); continue;
      }
      if (!active || start.getTime() !== previous) {
        if (series.length && series.at(-1).value !== null) {
          series.push({timestamp: start.toISOString(), date: start, value: null});
        }
        factor = 1; segmentStart = start.toISOString();
        series.push({timestamp: segmentStart, date: start, value: 0, baseline: true, segment_start: segmentStart});
      }
      factor *= 1 + delta / 100;
      series.push({timestamp: point.timestamp, date, value: factor - 1, segment_start: segmentStart});
      active = true; previous = date.getTime();
    }
    return series;
  }
  function comparisonSeries(payload, name) {
    // Each stream retains its own interval boundaries, including partial hours.
    const direct = payload?.series?.[name];
    return cumulativeSeries(direct || payload?.points || [], direct ? 'change_percent' : name + '_change_percent');
  }
  function observedCell(observed, format) {
    if (finite(observed?.change_percent) === null) return null;
    const label = 'Observed segment only: ' + new Date(observed.start).toUTCString() +
      ' to ' + new Date(observed.end).toUTCString() + '; not the full selected period';
    return '<td><span class="cell-pill" title="' + label + '">' + format(observed.change_percent) + '*</span></td>';
  }
  function segmentSummary(series) {
    const valid = (series || []).filter(p => !p.baseline && finite(p.value) !== null);
    const last = valid.at(-1);
    return {value: last?.value ?? null, start: last?.segment_start, end: last?.timestamp,
      label: last?.segment_start ? 'Observed segment: ' + new Date(last.segment_start).toLocaleString() +
        ' – ' + new Date(last.timestamp).toLocaleString() : 'No verified change interval available'};
  }
  function currentValue(summary) {
    return finite(summary?.current?.equity_usdt);
  }
  function currentText(summary) {
    const current = summary?.current;
    if (!current) return 'Current equity unavailable; historical coverage is separate.';
    return (current.complete ? 'Current enabled-account equity as of ' + new Date(current.as_of).toLocaleString() :
      'Current equity unavailable: ' + current.stale_accounts + ' stale/missing accounts') +
      '. History uses the current enabled-account cohort, not historical membership.';
  }
  function requestCache(ttl = 60000) {
    const completed = new Map(), pending = new Map();
    return async (key, loader) => {
      const hit = completed.get(key);
      if (hit && Date.now() - hit.time < ttl) return hit.value;
      if (pending.has(key)) return pending.get(key);
      const work = Promise.resolve().then(loader).then(value => {
        completed.set(key, {time: Date.now(), value});
        while (completed.size > 64) completed.delete(completed.keys().next().value);
        return value;
      }).finally(() => pending.delete(key));
      pending.set(key, work); return work;
    };
  }
  function coverageText(summary) {
    if (!summary?.as_of) return 'No verified observations in the selected period.';
    const hours = finite(summary.observed_hours);
    const coverage = hours === null ? '' : ` · ${hours.toFixed(1)}h recorded span${summary.partial_period ? ' (partial period)' : ''}`;
    const gaps = summary.gaps ? ` · ${summary.gaps} missing/stale intervals` : '';
    const legacy = summary.legacy_observations ? ' Historical valuations are unverified and may include reporting corrections; change summaries are unavailable.' : '';
    const cohort = summary.cohort_changed ? ' · Account coverage changed; period comparison unavailable' : '';
    return `As of ${new Date(summary.as_of).toLocaleString()}${coverage}${gaps}${cohort}.${legacy} Balance changes include deposits/withdrawals; investment return is not verified.`;
  }
  const api = { finite, accountValue, cumulativeSeries, comparisonSeries, observedCell, segmentSummary, currentValue, currentText, requestCache, coverageText };
  root.ReportingValues = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
