/**
 * IZAKHONO PAY Self-Improvement Engine.
 *
 * Turns operational observations into ranked, testable improvement proposals.
 * This module is deliberately advisory: it never authorises live money movement,
 * regulatory changes, provider activation, or production deployment by itself.
 */

export const IMPROVEMENT_STAGES = Object.freeze([
  'observed','proposed','sandbox','tested','security_review','approved','released','verified','rolled_back'
]);

export const IMPROVEMENT_RULES = Object.freeze({
  minimumSampleSize: 30,
  maxAutoRiskScore: 2,
  protectedDomains: Object.freeze([
    'regulated_money_movement','custody','settlement','acquiring','issuing','e_money','live_provider_activation','credential_security'
  ])
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function normaliseMetrics(input = {}) {
  const transactions = Number(input.transactions || 0);
  const succeeded = Number(input.succeeded || 0);
  const failed = Number(input.failed || 0);
  const pending = Number(input.pending || 0);
  const fraud = Number(input.fraud || 0);
  const incidents = Number(input.incidents || 0);
  return {
    transactions,
    succeeded,
    failed,
    pending,
    fraud,
    incidents,
    success_rate: transactions ? succeeded / transactions : 0,
    failure_rate: transactions ? failed / transactions : 0,
    pending_rate: transactions ? pending / transactions : 0,
    fraud_rate: transactions ? fraud / transactions : 0,
    incident_rate: transactions ? incidents / transactions : 0
  };
}

export function detectSignals(metrics = {}) {
  const m = normaliseMetrics(metrics);
  const signals = [];
  if (m.transactions >= IMPROVEMENT_RULES.minimumSampleSize && m.success_rate < 0.95) signals.push({ code:'LOW_SUCCESS_RATE', severity:'high', value:m.success_rate });
  if (m.transactions >= IMPROVEMENT_RULES.minimumSampleSize && m.pending_rate > 0.05) signals.push({ code:'HIGH_PENDING_RATE', severity:'medium', value:m.pending_rate });
  if (m.transactions >= IMPROVEMENT_RULES.minimumSampleSize && m.fraud_rate > 0.01) signals.push({ code:'FRAUD_RATE_ELEVATED', severity:'high', value:m.fraud_rate });
  if (m.incidents > 0) signals.push({ code:'OPERATIONAL_INCIDENTS', severity:'high', value:m.incidents });
  return { metrics:m, signals };
}

export function rankImprovement(signal, context = {}) {
  const severityWeight = { low:1, medium:3, high:5, critical:8 }[signal.severity] || 1;
  const volume = clamp(Number(context.transactions || 0) / 1000, 0, 5);
  const customerImpact = clamp(Number(context.customerImpact || 1), 0, 5);
  const risk = clamp(Number(context.riskScore || 1), 0, 5);
  return Number((severityWeight + volume + customerImpact - risk).toFixed(2));
}

export function proposeImprovement(signal, context = {}) {
  const protectedDomain = IMPROVEMENT_RULES.protectedDomains.includes(context.domain);
  const riskScore = Number(context.riskScore || (protectedDomain ? 5 : 1));
  const requiresHumanApproval = protectedDomain || riskScore > IMPROVEMENT_RULES.maxAutoRiskScore;
  return Object.freeze({
    id: `imp_${Date.now()}_${signal.code.toLowerCase()}`,
    signal: signal.code,
    domain: context.domain || 'payment_operations',
    objective: context.objective || `Improve ${signal.code.toLowerCase()}`,
    priority: rankImprovement(signal, context),
    risk_score: riskScore,
    requires_human_approval: requiresHumanApproval,
    allowed_next_stage: requiresHumanApproval ? 'proposed' : 'sandbox',
    fail_closed: true,
    status: 'proposed'
  });
}

export function evaluateExperiment({ baseline, candidate, minimumLift = 0.01, sampleSize = 0 } = {}) {
  const base = Number(baseline || 0);
  const next = Number(candidate || 0);
  const lift = next - base;
  const sufficientSample = Number(sampleSize) >= IMPROVEMENT_RULES.minimumSampleSize;
  return {
    baseline: base,
    candidate: next,
    lift,
    sufficient_sample: sufficientSample,
    pass: sufficientSample && lift >= minimumLift
  };
}

export function releaseDecision(proposal, experiment, security = {}) {
  if (!proposal || proposal.fail_closed !== true) return { decision:'BLOCK', reason:'invalid_proposal' };
  if (proposal.requires_human_approval) return { decision:'HUMAN_REVIEW', reason:'protected_or_high_risk_change' };
  if (security.passed !== true) return { decision:'BLOCK', reason:'security_review_required' };
  if (experiment?.pass !== true) return { decision:'BLOCK', reason:'experiment_failed' };
  return { decision:'RELEASE_CANDIDATE', reason:'sandbox_experiment_and_security_passed' };
}

export function canSelfDeploy(change = {}) {
  if (change.regulated === true) return false;
  if (change.liveMoneyMovement === true) return false;
  if (change.credentialSecurity === true) return false;
  if (change.productionDeployment === true) return false;
  return change.securityPassed === true && change.testsPassed === true;
}
