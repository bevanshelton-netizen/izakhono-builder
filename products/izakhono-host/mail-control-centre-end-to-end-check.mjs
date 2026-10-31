import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'products/izakhono-host/mail-control-centre-state.json',
  'products/izakhono-host/mail-control-centre.ts',
  'products/izakhono-host/mail-control-centre.test.ts',
  'products/izakhono-host/mail-control-centre-api.ts',
  'products/izakhono-host/mail-control-centre-api.test.ts',
  'products/izakhono-host/mail-control-centre-ui.ts',
  'products/izakhono-host/mail-control-centre-ui.test.ts',
  'products/izakhono-host/MAIL-CONTROL-CENTRE-V1.md',
];

const failures = [];
for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) failures.push(relative);
}

if (failures.length) {
  console.error(JSON.stringify({ status: 'failed', reason: 'required-mail-control-centre-artifacts-missing', failures }, null, 2));
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(path.join(root, 'products/izakhono-host/mail-control-centre-state.json'), 'utf8'));
if (state.productionClaimsRequireEvidence !== true) failures.push('production-claims-evidence-gate');
if (state.contentAccess !== 'separately-permissioned-and-audited') failures.push('content-access-boundary');

const result = {
  status: failures.length ? 'failed' : 'passed',
  controlCentre: 'present',
  api: 'present',
  ui: 'present',
  evidenceGate: state.productionClaimsRequireEvidence === true ? 'enabled' : 'failed',
  contentBoundary: state.contentAccess === 'separately-permissioned-and-audited' ? 'enforced-by-contract' : 'failed',
  verifiedDomains: state.domains.filter((domain) => domain.status === 'verified').length,
  mailboxes: state.mailboxes.length,
  openIncidents: state.incidents.filter((incident) => incident.status !== 'resolved').length,
};

console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
