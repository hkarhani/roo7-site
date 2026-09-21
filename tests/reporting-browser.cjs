// Offline rendering test. Requires Playwright; never visits the deployed app.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function extract(file, name, next) {
  const code = read(file), a = code.indexOf('function '+name+'('), b = code.indexOf('function '+next+'(', a);
  assert.ok(a >= 0 && b > a, name);
  return code.slice(a, b);
}
(async () => {
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => route.abort()); // No network, even from imported CSS.
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'roo7-reporting-ui-'));
  async function setup(file, selector) {
    await page.goto('about:blank');
    const html = read(file).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
    await page.setContent(html);
    const section = await page.locator(selector).evaluate(el => el.outerHTML);
    await page.setContent('<html><head></head><body>'+section+'</body></html>');
    await page.addStyleTag({content: read('dashboard.css') + (file === 'admin-dashboard.html' ? read('admin-dashboard.css') : '') + read('reporting-values.css')});
    await page.addStyleTag({content: 'body {margin:24px} .dashboard-card {width:auto;max-width:none}'});
    await page.addScriptTag({content: read('reporting-values.js')});
    await page.addScriptTag({content: read('line-chart.js')});
  }
  await setup('dashboard.html', '#section-analytics');
  await page.addScriptTag({content: `
    const formatCurrency = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
    const formatPercentage = value => value.toFixed(2)+'%';
    const updateLiveAccountsSummary = () => {};
    let latestAggregatedCurrentTotal = null, latestAggregatedTimestamp = null;
    ${extract('dashboard.js','updateAnalyticsSummary','showAnalyticsError')}
    updateAnalyticsSummary({summary:{current:{equity_usdt:32732.51,complete:true,as_of:"2026-09-21T13:40:00Z"},current_value:32732.51, period_change:null, percentage_change:null,
      as_of:'2026-09-21T13:40:00Z',observed_hours:3.7,partial_period:true,legacy_observations:4}},'ALL');
    document.getElementById('analytics-account-select').innerHTML='<option>All Accounts</option>';
    document.getElementById('analytics-period-select').value='1';
    const chart = new LineChart('analytics-chart',{width:1250,height:330,animate:false});
    chart.setPeriod(1);
    chart.setData([{name:'Recorded equity',values:[{timestamp:'2026-09-21T10:00:00Z',value:36000},
      {timestamp:'2026-09-21T11:00:00Z',value:null},{timestamp:'2026-09-21T12:00:00Z',value:32680},
      {timestamp:'2026-09-21T13:00:00Z',value:32732.51}]}]);
  `});
  assert.equal(await page.locator('#period-change-badge').textContent(), '—');
  assert.match(await page.locator('#analytics-coverage').textContent(), /unverified/);
  assert.equal((await page.locator('.line-series-0').getAttribute('d')).match(/M/g).length, 2);
  await page.screenshot({path:path.join(artifacts,'customer-summary-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:1000});
  await page.waitForFunction(() => document.querySelectorAll('.x-axis text').length <= 3);
  const overflow = await page.evaluate(() => [...document.querySelectorAll('.analytics-status-badges .status-item')].some(el => el.getBoundingClientRect().right > 390));
  assert.equal(overflow, false, 'Summary cards overflow mobile viewport');
  await page.screenshot({path:path.join(artifacts,'customer-summary-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await setup('admin-dashboard.html', '#section-platform-analytics');
  await page.addScriptTag({content: `
    const formatCurrency = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
    ${extract('admin-dashboard.js','updatePlatformSummaryStats','resetPlatformKpis')}
    updatePlatformSummaryStats({current:{equity_usdt:52425.66,complete:true,as_of:"2026-09-21T13:40:00Z",users_count:4},current_value:52399.91,period_change:null,users_count:4,
      as_of:'2026-09-21T13:40:00Z',observed_hours:23.7,legacy_observations:24,cohort_changed:true});
  `});
  assert.equal(await page.locator('#platform-24h-change-badge').textContent(), '—');
  assert.equal(await page.locator('#platform-users-count-badge').textContent(), '4');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('platform-users-count-badge')).color === 'rgb(71, 85, 105)');
  assert.notEqual(await page.locator('#platform-users-count-badge').evaluate(el => getComputedStyle(el).color), 'rgb(255, 255, 255)');
  assert.notEqual(await page.locator('#platform-24h-change-badge').evaluate(el => getComputedStyle(el).color), 'rgb(255, 255, 255)');
  await page.screenshot({path:path.join(artifacts,'admin-summary.png'),fullPage:true});
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('Offline browser summary/chart checks passed. Screenshots: '+artifacts);
})().catch(e => { console.error(e); process.exit(1); });
