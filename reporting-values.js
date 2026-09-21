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
    if (!sorted.length) return [];
    const first = sorted[0];
    if (!Number.isFinite(new Date(first.timestamp).getTime())) return [];
    const baseline = first.interval_start || new Date(new Date(first.timestamp).getTime() - 3600000).toISOString();
    const series = [{ timestamp: baseline, date: new Date(baseline), value: 0 }];
    let factor = 1;
    let complete = true;
    let previous = new Date(baseline).getTime();
    for (const point of sorted) {
      const delta = finite(point[key]);
      const date = new Date(point.timestamp);
      if (delta === null || !Number.isFinite(date.getTime()) || date - previous > 7200000 || date - previous <= 0) complete = false;
      if (complete) factor *= 1 + delta / 100;
      series.push({timestamp: point.timestamp, date, value: complete ? factor - 1 : null});
      previous = date.getTime();
    }
    return series;
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
  const api = { finite, accountValue, cumulativeSeries, coverageText };
  root.ReportingValues = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
