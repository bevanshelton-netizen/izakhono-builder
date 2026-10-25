import { createProvisionerJob, recordEvidence, validateBlueprint, validateJob, verifyLive } from './provisioner-runtime';

const blueprint = {
  schemaVersion: '1.0' as const,
  business: { name: 'MicroBiz LaunchPad', description: 'Business launch platform.' },
  score: 98,
  workflow: ['BRAND','WEBSITE','DOMAIN','DNS','SSL','MAIL','PAYMENTS','CRM','MARKETING','PROVISIONING'] as const,
  outputs: ['Brand direction'],
  status: 'BLUEPRINT_GENERATED' as const,
};

validateBlueprint(blueprint);
const job = createProvisionerJob(blueprint, ['BRAND','WEBSITE','DOMAIN'], 'bs-test-001', '2026-10-25T20:00:00.000Z');
if (job.status !== 'QUEUED' || job.evidence.length !== 3) throw new Error('job creation failed');
validateJob(job);

let running = recordEvidence(job, 'BRAND', 'PASSED', 'brand-accepted', '2026-10-25T20:01:00.000Z');
if (running.status !== 'RUNNING') throw new Error('partial evidence must keep job running');
running = recordEvidence(running, 'WEBSITE', 'PASSED', 'site-build-accepted', '2026-10-25T20:02:00.000Z');
running = recordEvidence(running, 'DOMAIN', 'PASSED', 'domain-accepted', '2026-10-25T20:03:00.000Z');
if (running.status !== 'PROVISIONED') throw new Error('all passed evidence must provision job');

const live = verifyLive(running, 'https-200-and-intended-content-verified', '2026-10-25T20:04:00.000Z');
if (live.status !== 'LIVE_VERIFIED') throw new Error('live verification failed');

let rejected = false;
try { createProvisionerJob(blueprint, ['PAYMENTS','DNS','DOMAIN','DOMAIN'], 'bs-bad-001'); } catch { rejected = true; }
if (!rejected) throw new Error('duplicate capability should be rejected');

rejected = false;
try { createProvisionerJob(blueprint, ['CRM','PROVISIONING','IDEA'], 'bs-bad-002'); } catch { rejected = true; }
if (!rejected) throw new Error('capability outside workflow should be rejected');

console.log('IZAKHONO Business Studio Provisioner runtime contract: PASS');
