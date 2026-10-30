/**
 * FORTRESS Core Risk Contract
 * Pure, deterministic, side-effect free decision primitives.
 * No payment movement, custody, freezing, or external calls.
 */

export const DECISIONS = Object.freeze([
  'ALLOW',
  'ALLOW_WITH_MONITORING',
  'CHALLENGE',
  'HOLD_FOR_REVIEW',
  'BLOCK',
  'ESCALATE',
]);

export const RISK_BANDS = Object.freeze([
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);

const clamp = (value, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));

export function normaliseSignal(signal = {}) {
  return {
    score: clamp(Number(signal.score)),
    confidence: clamp(Number(signal.confidence)),
    reasonCodes: Array.isArray(signal.reasonCodes)
      ? [...new Set(signal.reasonCodes.filter(Boolean).map(String))]
      : [],
    source: signal.source ? String(signal.source) : 'unknown',
  };
}

export function calculateRiskScore(signals = {}) {
  const entries = Object.entries(signals).map(([name, value]) => [name, normaliseSignal(value)]);
  if (!entries.length) return { score: 0, confidence: 0, reasons: [], contributors: [] };

  let weighted = 0;
  let weightTotal = 0;
  const reasons = new Set();
  const contributors = [];

  for (const [name, signal] of entries) {
    const weight = Math.max(1, signal.confidence);
    weighted += signal.score * weight;
    weightTotal += weight;
    signal.reasonCodes.forEach((code) => reasons.add(code));
    contributors.push({ name, score: signal.score, confidence: signal.confidence });
  }

  return {
    score: Math.round(clamp(weighted / weightTotal) * 100) / 100,
    confidence: Math.round((weightTotal / (entries.length * 100)) * 100) / 100,
    reasons: [...reasons],
    contributors,
  };
}

export function riskBand(score) {
  if (score >= 90) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

export function decide({ score = 0, confidence = 0, highConfidenceBlock = false, mandatoryChallenge = false } = {}) {
  const risk = clamp(score);
  if (highConfidenceBlock && confidence >= 0.8) return 'BLOCK';
  if (risk >= 90 && confidence >= 0.8) return 'BLOCK';
  if (risk >= 75) return 'HOLD_FOR_REVIEW';
  if (mandatoryChallenge || risk >= 55) return 'CHALLENGE';
  if (risk >= 30) return 'ALLOW_WITH_MONITORING';
  return 'ALLOW';
}

export function buildDecision({ eventId, subjectId, signals = {}, context = {}, policy = {} } = {}) {
  if (!eventId || !subjectId) throw new TypeError('eventId and subjectId are required');

  const aggregate = calculateRiskScore(signals);
  const decision = decide({
    score: aggregate.score,
    confidence: aggregate.confidence,
    highConfidenceBlock: policy.highConfidenceBlock === true,
    mandatoryChallenge: policy.mandatoryChallenge === true,
  });

  return Object.freeze({
    contractVersion: '1.0.0',
    eventId: String(eventId),
    subjectId: String(subjectId),
    score: aggregate.score,
    confidence: aggregate.confidence,
    band: riskBand(aggregate.score),
    decision,
    reasonCodes: aggregate.reasons,
    contributors: aggregate.contributors,
    context: { ...context },
    moneyMovement: false,
    requiresAuthorisedAction: decision !== 'ALLOW',
    createdAt: new Date().toISOString(),
  });
}
