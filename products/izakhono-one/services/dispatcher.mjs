import { supports } from './contracts.mjs';
import { prepareAction } from './action.mjs';
import { canServeRuntime } from './runtime.mjs';
import { authorizeRequest } from './fortress.mjs';

export function prepareServiceDispatch({ service, action, runtime, principal, resource, authenticated=false, verified=false, destructive=false, payment=false, correlationId } = {}) {
  const slug = String(service || '').trim();
  const capability = String(action || '').trim();
  const runtimeValue = runtime || { service_slug: slug, state: 'foundation', health: 'unknown' };
  if (!supports(slug, capability)) return { ok:false, mode:'prepare_only', dispatchable:false, service:slug, action:capability, reason:'unsupported_capability', sideEffects:false };

  const subject = principal || { authenticated, verified };
  const fortress = authorizeRequest({ principal:subject, service:slug, action:capability, resource, destructive, payment, correlationId });
  if (fortress.decision === 'deny') return { ok:false, mode:'prepare_only', dispatchable:false, service:slug, action:capability, reason:'fortress_authorization_denied', fortress, requiresHumanReview:false, sideEffects:false };
  if (fortress.decision === 'review') return { ok:false, mode:'prepare_only', dispatchable:false, service:slug, action:capability, reason:'fortress_review_required', fortress, requiresHumanReview:true, sideEffects:false };

  const policy = prepareAction({ service:slug, action:capability, authenticated:subject.authenticated, verified:subject.verified, destructive, payment, correlationId });
  const runtimeReady = canServeRuntime(runtimeValue.state, runtimeValue.health);
  return { ok:policy.ok && runtimeReady, mode:'prepare_only', dispatchable:policy.ok && runtimeReady, service:slug, action:capability, fortress, policy:policy.policy, audit:policy.audit, requiresHumanReview:policy.requiresHumanReview, runtime:{state:runtimeValue.state,health:runtimeValue.health,ready:runtimeReady}, reason:!policy.ok?'policy_gate':(!runtimeReady?'runtime_not_verified':'ready_for_service_adapter'), sideEffects:false };
}
