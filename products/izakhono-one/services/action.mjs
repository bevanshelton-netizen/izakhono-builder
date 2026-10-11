import { evaluatePolicy } from './policy.mjs';

export function prepareAction(input={}) {
  const policy = evaluatePolicy(input);
  return {ok:policy.decision === 'allow', service:input.service || null, action:input.action || null, policy, requiresHumanReview:policy.decision === 'review', audit:{required:true, correlationId:input.correlationId || crypto.randomUUID()}};
}
