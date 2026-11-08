import assert from 'node:assert/strict';
import { planAutomationRun, validateAutomation } from './automation';
import type { AutomationDefinition } from './contracts';

const base: AutomationDefinition = {
  id: 'auto_001',
  organisationId: 'org_001',
  createdBy: 'user_001',
  name: 'Morning reminder',
  enabled: true,
  trigger: { type: 'schedule', cron: '0 8 * * 1', timezone: 'Africa/Johannesburg' },
  conditions: [],
  actions: [{ type: 'send_notification', title: 'Good morning', body: 'Remember your daily checklist.' }],
  createdAt: '2026-11-08T08:00:00.000Z',
  updatedAt: '2026-11-08T08:00:00.000Z',
};

function run() {
  assert.equal(validateAutomation(base).length, 0);
  assert.equal(planAutomationRun(base, { userId: 'user_001', organisationId: 'org_001' }).executionMode, 'queued');
  assert.throws(() => planAutomationRun(base, { userId: 'user_002', organisationId: 'org_001' }), /outside the caller context/);
  assert.throws(() => planAutomationRun({ ...base, enabled: false }, { userId: 'user_001', organisationId: 'org_001' }), /disabled/);
  assert.ok(validateAutomation({ ...base, name: 'x'.repeat(81) }).some(issue => issue.code === 'invalid_name'));
  assert.ok(validateAutomation({ ...base, actions: [{ type: 'call_webhook', connectionId: 'bad id', eventType: 'test' }] }).length > 0);
  assert.ok(validateAutomation({ ...base, trigger: { type: 'schedule', cron: 'not a cron', timezone: 'Mars/Olympus' } }).length > 0);
  console.log('IZAKHONO Mobile Intelligence automation contract tests passed');
}

run();
