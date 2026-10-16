import assert from 'node:assert/strict';
import { dueSources, normalizeSourceRegistration, refreshPlan, registerSources, scheduleNextRefresh } from './services/search-source-registry.mjs';

const base={source_id:'owned-za',kind:'owned',status:'approved',approved:true,enabled:true,uri:'https://owned.example',schedule_seconds:3600,priority:90};
const normalized=normalizeSourceRegistration(base);
assert.equal(normalized.schedule_seconds,3600);
assert.equal(normalized.priority,90);

const registered=registerSources([base,{source_id:'blocked',kind:'untrusted',status:'pending',approved:false,enabled:true}]);
assert.equal(registered.records.length,1);
assert.equal(registered.rejected,1);

const now=new Date('2026-10-16T20:00:00.000Z');
const due=dueSources([normalized,{...normalized,source_id:'future',next_refresh_at:'2026-10-16T21:00:00.000Z',priority:100}],now);
assert.equal(due.length,1);
assert.equal(due[0].source_id,'owned-za');

const scheduled=scheduleNextRefresh(normalized,now);
assert.equal(scheduled.refresh_state,'idle');
assert.equal(scheduled.next_refresh_at,'2026-10-16T21:00:00.000Z');

const plan=refreshPlan([normalized,{...normalized,source_id:'future',next_refresh_at:'2026-10-16T21:00:00.000Z',priority:100}],now);
assert.equal(plan.due_count,1);
assert.equal(plan.sources[0].source_id,'owned-za');

console.log('SEARCH_SOURCE_REGISTRY_TESTS=PASS');
