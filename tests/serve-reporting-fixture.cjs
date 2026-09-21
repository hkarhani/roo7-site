// Manual browser fixture: node tests/serve-reporting-fixture.cjs
// Loopback only. Synthetic API responses; no production calls or real credentials.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const requests = new Map();
const benchmark = [1,2,3,4].map((h,i)=>({
  timestamp: `2026-09-21T${String(h+10).padStart(2,'0')}:00:00Z`,
  interval_start: `2026-09-21T${String(h+9).padStart(2,'0')}:00:00Z`,
  change_percent: i%2 ? -.3 : .8
}));
const portfolio = benchmark.map((p,i)=>({...p,change_percent:i===1?null:[1,null,-.2,.4][i]}));
const observed = {start:portfolio[2].interval_start,end:portfolio[3].timestamp,change_percent:.1992,points:2,partial:true};
const periodRows = Object.fromEntries(['24h','7d','30d','90d','180d','1y'].map(p=>[p,{
  portfolio_change_percent:null,platform_change_percent:null,benchmark_change_percent:null,shared_points:2,
  observed:{portfolio:observed,platform:observed},benchmark_observed:observed
}]));
const summary = {portfolio:{periods:{},observed:Object.fromEntries(Object.keys(periodRows).map(p=>[p,observed]))},
  benchmarks:[{benchmark:'composite',label:'Composite',periods:periodRows}]};
const history = (multiplier = 1, onlyLegacy = false) => ({points: benchmark.map((p,i)=>({
  timestamp:p.timestamp, value:[2800,2780,1180,1190][i]*multiplier,
  complete:true, valuation_verified:!onlyLegacy && i>=2,
})), summary:{as_of:benchmark[3].timestamp, observed_hours:3, legacy_observations:onlyLegacy?4:2, partial_period:true}});
const current = value => ({equity_usdt:value,as_of:benchmark[3].timestamp,complete:true,stale_accounts:0,accounts_count:1});
const server = http.createServer((req,res)=>{
  const url = new URL(req.url,'http://127.0.0.1');
  const file = path.basename(url.pathname);
  const send = (body,type='application/json')=>{res.writeHead(200,{'Content-Type':type,
    'Content-Security-Policy':"default-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:"});res.end(typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body));};
  if(url.pathname.startsWith('/mock/')){
    requests.set(req.url,(requests.get(req.url)||0)+1);
    console.log('fixture API',req.url,'count',requests.get(req.url));
    if(url.pathname.endsWith('/accounts')) return send([{id:'fixture-a',account_name:'Fixture A'},{id:'fixture-b',account_name:'Fixture B'}]);
    if(url.pathname.endsWith('/performance')) {
      const individual = url.searchParams.has('account_id');
      const legacyOnly = url.searchParams.get('account_id') === 'fixture-b';
      const changes = legacyOnly ? portfolio.map(p=>({...p,change_percent:null})) : portfolio;
      return send({success:true,data:{points:changes,series:{portfolio:changes,platform:portfolio,benchmark},
        equity_history:{portfolio:history(individual?1:3,legacyOnly),platform:history(5)},
        current_equity:{portfolio:current(individual?1190:3570),platform:current(5950)},metadata:{}}});
    }
    if(url.pathname.endsWith('/table')) return setTimeout(()=>send({success:true,data:summary}),8000);
    return send({success:true,data:{}});
  }
  if(file==='frontend-config.js') return send("export const API_CONFIG={authUrl:'/mock/auth',marketUrl:'/mock/market'};export const BRAND_CONFIG={name:'ROO7 Offline Test'};",'text/javascript');
  const target = path.join(root,file || 'portfoliovsbenchmark.html');
  if(!['.html','.css','.js','.png','.ico'].includes(path.extname(target)) || !fs.existsSync(target)){res.writeHead(404);return res.end();}
  let body = fs.readFileSync(target);
  if(file.endsWith('.html') || !file) body=body.toString().replace('<head>',"<head><script>localStorage.setItem('token','synthetic-fixture-only');</script>");
  send(body,({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.ico':'image/x-icon'})[path.extname(target)]);
});
server.listen(0,'127.0.0.1',()=>console.log('Fixture URL: http://127.0.0.1:'+server.address().port+'/portfoliovsbenchmark.html'));
