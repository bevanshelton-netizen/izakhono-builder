import { runtimeStates, runtimeHealth, normalizeRuntimeState, publicRuntimeView, canServeRuntime } from './services/runtime.mjs';

if (runtimeStates.join(',') !== 'foundation,staging,verified,degraded,disabled') throw new Error('runtime state set changed');
if (runtimeHealth.join(',') !== 'unknown,healthy,degraded,unhealthy') throw new Error('runtime health set changed');

const foundation = normalizeRuntimeState({service_slug:'nav'});
if (canServeRuntime(foundation.state, foundation.health)) throw new Error('unverified runtime became executable');

const verified = normalizeRuntimeState({service_slug:'nav',state:'verified',health:'healthy',version:'v2'});
if (canServeRuntime(verified.state, verified.health)) throw new Error('verified runtime bypassed database security gate');

const securePosture = { ready_for_verified_runtime: true };
if (!canServeRuntime(verified.state, verified.health, securePosture)) throw new Error('verified healthy runtime blocked despite secure database posture');

const insecurePosture = { ready_for_verified_runtime: false };
if (canServeRuntime(verified.state, verified.health, insecurePosture)) throw new Error('insecure database posture allowed execution');

if (publicRuntimeView(verified).version !== 'v2') throw new Error('runtime public view failed');

for (const state of ['foundation','staging','degraded','disabled']) {
  if (canServeRuntime(state,'healthy',securePosture)) throw new Error(`${state} runtime incorrectly executable`);
}
for (const health of ['unknown','degraded','unhealthy']) {
  if (canServeRuntime('verified',health,securePosture)) throw new Error(`${health} runtime incorrectly executable`);
}

console.log('IZAKHONO ONE runtime test: PASS');
