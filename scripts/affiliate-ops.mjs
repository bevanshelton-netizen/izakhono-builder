import fs from 'node:fs';

const enginePath = 'products/izakhono-affiliate/affiliate-engine.v1.json';
const autopilotPath = 'products/izakhono-affiliate/autopilot.v1.json';
const reportPath = 'affiliate-ops-report.json';

const engine = JSON.parse(fs.readFileSync(enginePath, 'utf8'));
const autopilot = JSON.parse(fs.readFileSync(autopilotPath, 'utf8'));

const issues = [];
const checks = [];

if (engine.schema !== 'izakhono.affiliate.engine.v1') issues.push('Affiliate Engine schema mismatch');
if (autopilot.schema !== 'izakhono.affiliate.autopilot.v1') issues.push('Affiliate Autopilot schema mismatch');
if (autopilot.scheduler?.policy !== 'owned-first-externally-reversible') issues.push('Autopilot lost owned-first policy');
if (autopilot.scheduler?.primary !== 'IZAKHONO TASKS') issues.push('IZAKHONO TASKS must remain primary scheduler');
if (engine.tracking?.behavioural_profiling !== false) issues.push('Behavioural profiling must remain disabled');
if (engine.tracking?.advertising_ids !== false) issues.push('Advertising IDs must remain disabled');

async function checkUrl(item) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const started = Date.now();
  try {
    const res = await fetch(item.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'IZAKHONO-AFFILIATE-AUTOPILOT/1.0 (+owned-first health monitor)',
        'accept': 'text/html,application/xhtml+xml'
      }
    });
    return {
      id: item.id,
      url: item.url,
      ok: res.ok,
      status: res.status,
      final_url: res.url,
      latency_ms: Date.now() - started
    };
  } catch (error) {
    return {
      id: item.id,
      url: item.url,
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
      latency_ms: Date.now() - started
    };
  } finally {
    clearTimeout(timer);
  }
}

for (const item of autopilot.network_watch || []) {
  checks.push(await checkUrl(item));
}
for (const c of checks) if (!c.ok) issues.push(`${c.id}: public network endpoint check failed`);

const report = {
  schema: 'izakhono.affiliate.ops-report.v1',
  generated_at: new Date().toISOString(),
  scheduler_policy: autopilot.scheduler?.policy,
  primary_scheduler: autopilot.scheduler?.primary,
  fallback_scheduler: autopilot.scheduler?.fallback,
  engine_version: engine.version,
  adapters_registered: (engine.external_adapters || []).length,
  checks,
  issues,
  issue_count: issues.length,
  status: issues.length ? 'ATTENTION' : 'HEALTHY',
  notes: [
    'Public reachability is not proof of affiliate-account approval or authenticated API health.',
    'Authenticated adapter sync remains conditional on server-side credentials.',
    'Legal terms, banking/tax identity, paid spend and material commission changes remain owner-gated.'
  ]
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

if (
  engine.infrastructure?.system_of_record !== 'IZAKHONO-owned infrastructure' ||
  engine.infrastructure?.external_networks !== 'replaceable adapters only'
) {
  process.exit(1);
}
