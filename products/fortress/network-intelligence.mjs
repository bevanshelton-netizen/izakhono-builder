const DECISIONS = new Set(['ALLOW','ALLOW_WITH_MONITORING','CHALLENGE','HOLD_FOR_REVIEW','BLOCK','ESCALATE']);
const POLICY_VERSION = 'fortress-network-v1';

export const PATTERN_TYPES = Object.freeze({
  VELOCITY_CLUSTER: 'VELOCITY_CLUSTER',
  SHARED_DEVICE: 'SHARED_DEVICE',
  SHARED_COUNTERPARTY: 'SHARED_COUNTERPARTY',
  COORDINATED_TRANSACTION_PATTERN: 'COORDINATED_TRANSACTION_PATTERN',
  MERCHANT_COMPROMISE_PATTERN: 'MERCHANT_COMPROMISE_PATTERN',
  ACCOUNT_TAKEOVER_CLUSTER: 'ACCOUNT_TAKEOVER_CLUSTER',
  RAPID_RISK_SEQUENCE: 'RAPID_RISK_SEQUENCE'
});

function clamp(n, min = 0, max = 100) { return Math.max(min, Math.min(max, Number(n) || 0)); }

export function analyzeNetwork(input = {}) {
  const signals = input.signals || {};
  const reasons = [];
  const patterns = [];
  let score = 0;

  const add = (type, points, reason) => {
    patterns.push({ patternType: type, score: points, reasonCode: reason });
    reasons.push(reason);
    score += points;
  };

  if ((signals.velocityEvents || 0) >= 5) add(PATTERN_TYPES.VELOCITY_CLUSTER, 20, 'NETWORK_VELOCITY_CLUSTER');
  if ((signals.sharedDeviceSubjects || 0) >= 3) add(PATTERN_TYPES.SHARED_DEVICE, 20, 'NETWORK_SHARED_DEVICE');
  if ((signals.sharedCounterpartySubjects || 0) >= 3) add(PATTERN_TYPES.SHARED_COUNTERPARTY, 20, 'NETWORK_SHARED_COUNTERPARTY');
  if (signals.coordinatedActivity) add(PATTERN_TYPES.COORDINATED_TRANSACTION_PATTERN, 25, 'NETWORK_COORDINATED_ACTIVITY');
  if (signals.merchantCompromise) add(PATTERN_TYPES.MERCHANT_COMPROMISE_PATTERN, 25, 'NETWORK_MERCHANT_COMPROMISE');
  if (signals.accountTakeoverCluster) add(PATTERN_TYPES.ACCOUNT_TAKEOVER_CLUSTER, 30, 'NETWORK_ATO_CLUSTER');
  if (signals.rapidRiskSequence) add(PATTERN_TYPES.RAPID_RISK_SEQUENCE, 20, 'NETWORK_RAPID_RISK_SEQUENCE');

  score = clamp(score);
  const confidence = clamp(Math.min(100, patterns.length * 15 + (signals.evidenceCount || 0) * 5));
  const riskBand = score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';
  const decision = score >= 80 ? 'ESCALATE' : score >= 60 ? 'HOLD_FOR_REVIEW' : score >= 30 ? 'CHALLENGE' : 'ALLOW_WITH_MONITORING';

  return {
    policyVersion: POLICY_VERSION,
    score,
    confidence,
    riskBand,
    decision: DECISIONS.has(decision) ? decision : 'ALLOW_WITH_MONITORING',
    reasonCodes: [...new Set(reasons)],
    patterns,
    evidenceCount: Number(signals.evidenceCount) || 0,
    safety: { sandboxOnly: true, liveMoneyMovement: false }
  };
}

export function buildRiskEvent(input, analysis) {
  if (!analysis || analysis.safety.liveMoneyMovement !== false) throw new Error('Unsafe network analysis state');
  return {
    eventType: 'FORTRESS_NETWORK_RISK',
    subjectId: input.subjectId ?? null,
    merchantId: input.merchantId ?? null,
    transactionId: input.transactionId ?? null,
    riskScore: analysis.score,
    decision: analysis.decision,
    reasonCodes: analysis.reasonCodes,
    policyVersion: analysis.policyVersion,
    sandboxOnly: true,
    liveMoneyMovement: false
  };
}

export function runNetworkPipeline(input = {}) {
  const analysis = analyzeNetwork(input);
  return { analysis, riskEvent: buildRiskEvent(input, analysis) };
}
