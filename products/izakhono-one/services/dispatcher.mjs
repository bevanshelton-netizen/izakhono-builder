import { supports } from './contracts.mjs';
import { prepareAction } from './action.mjs';
import { canServeRuntime } from './runtime.mjs';

export function prepareServiceDispatch({ service, action, runtime, authenticated=false, verified=false, destructive=false, payment=false, correlationId } = {}) {
  const slug = String(service || '').trim();
  const capability = String(action || '').trim();
  const runtimeValue = runtime || { service_slug: slug, state: 'foundation', health: 'unknown' };
  if (!supports(slug, capability)) return { ok:false, mode:'prepare_only', dispatchable:false, service:slug, action:capability, reason:'unsupported_capability', sideEffects:false };
  const policy = prepareAction({ service:slug, action:capability, authenticated, verified, destructive, payment, correlationId });
  const runtimeReady = canServeRuntime(runtimeValue.state, runtimeValue.health);
  return { ok:policy.ok && runtimeReady, mode:'prepare_only', dispatchable:policy.ok && runtimeReady, service:slug, action:capability, policy:policy.policy, audit:policy.audit, requiresHumanReview:policy.requiresHumanReview, runtime:{state:runtimeValue.state,health:runtimeValue.health,ready:runtimeReady}, reason:!policy.ok?'policy_gate':(!runtimeReady?'runtime_not_verified':'ready_for_service_adapter'), sideEffects:false };
}
