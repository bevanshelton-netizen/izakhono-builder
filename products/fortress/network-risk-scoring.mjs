import { buildDecision } from './core/risk-contract.js';

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));

const PATTERN_WEIGHTS = Object.freeze({
  COORDINATED_TRANSACTION_PATTERN: 20,
  SHARED_DEVICE: 15,
  SHARED_COUNTERPARTY: 15,
  VELOCITY_CLUSTER: 20,
  MERCHANT_COMPROMISE_PATTERN: 25,
  ACCOUNT_TAKEOVER_CLUSTER: 30,
  RAPID_FUNDS_MOVEMENT: 20,
});

function normalisePattern(pattern = {}) {
  const type = String(pattern.type ?? 'UNKNOWN');
  const score = clamp(Number(pattern.score));
  const confidence = clamp(Number(pattern.confidence));
  const evidenceCount = Math.max(0, Math.floor(Number(pattern.evidenceCount) || 0));
  return {
    type,
    score,
    confidence,
    evidenceCount,
    reasonCodes: Array.isArray(pattern.reasonCodes) ? [...new Set(pattern.reasonCodes.map(String))] : [],
    entityIds: Array.isArray(pattern.entityIds) ? [...new Set(pattern.entityIds.map(String))] : [],
  };
}

function scoreNetworkRisk(patterns = []) {
  const normalised = patterns.map(normalisePattern);
  if (!normalised.length) {
    return { score: 0, confidence: 0, band: 'LOW', reasons: [], contributors: [], networkDensity: 0 };
  }

  let weightedScore = 0;
  let weightTotal = 0;
  let evidence = 0;
  const reasons = new Set();
  const contributors = [];

  for (const pattern of normalised) {
    const base = PATTERN_WEIGHTS[pattern.type] ?? 10;
    const confidenceWeight = Math.max(0, pattern.confidence / 100);
    const evidenceBoost = Math.min(1.25, 1 + Math.max(0, pattern.evidenceCount - 1) * 0.05);
    const contribution = clamp((base + pattern.score * 0.35) * confidenceWeight * evidenceBoost);
    weightedScore += contribution;
    weightTotal += Math.max(1, base * confidenceWeight);
    evidence += pattern.evidenceCount;
    pattern.reasonCodes.forEach((code) => reasons.add(code));
    contributors.push({ type: pattern.type, contribution: Math.round(contribution * 100) / 100, confidence: pattern.confidence, evidenceCount: pattern.evidenceCount });
  }

  const score = clamp(Math.round((weightedScore / weightTotal) * 100) / 100);
  const confidence = clamp(Math.round(((normalised.reduce((sum, p) => sum + p.confidence, 0) / normalised.length) * Math.min(1, evidence / Math.max(1, normalised.length))) * 100) / 100);
  const band = score >= 90 ? 'CRITICAL' : score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';

  return {
    score,
    confidence,
    band,
    reasons: [...reasons],
    contributors,
    networkDensity: Math.round((evidence / Math.max(1, normalised.length)) * 100) / 100,
  };
}

function buildNetworkDecision({ eventId, subjectId, patterns = [], context = {}, policy = {} } = {}) {
  if (!eventId || !subjectId) throw new TypeError('eventId and subjectId are required');
  const aggregate = scoreNetworkRisk(patterns);
  const signals = {
    network: {
      score: aggregate.score,
      confidence: aggregate.confidence,
      reasonCodes: aggregate.reasons,
      source: 'fortress-network-intelligence',
    },
  };
  const decision = buildDecision({ eventId, subjectId, signals, context, policy });
  return Object.freeze({
    ...decision,
    network: aggregate,
    sandboxOnly: true,
    liveMoneyMovement: false,
  });
}

export { PATTERN_WEIGHTS, normalisePattern, scoreNetworkRisk, buildNetworkDecision };
