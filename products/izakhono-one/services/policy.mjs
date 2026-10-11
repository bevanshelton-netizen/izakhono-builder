import { resolveService, supports } from './contracts.mjs';

const decisions = new Set(['allow','deny','review']);

export function evaluatePolicy({service, action, authenticated=false, verified=false, destructive=false, payment=false}={}) {
  const contract = resolveService(service);
  if (!contract) return {decision:'deny', reason:'unknown_service'};
  if (!action) return {decision:'deny', reason:'missing_action'};
  if (destructive && !authenticated) return {decision:'deny', reason:'authentication_required'};
  if (payment && !verified) return {decision:'review', reason:'payment_verification_required'};
  if (action !== 'read' && !supports(service, action)) return {decision:'deny', reason:'unsupported_capability'};
  return {decision:'allow', reason:'foundation_policy_pass'};
}

export function isDecision(value){ return decisions.has(value); }
