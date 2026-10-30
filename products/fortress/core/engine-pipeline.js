import { buildDecision } from './risk-contract.js';

const safe = (value) => (value && typeof value === 'object' ? value : {});

export function runFortressPipeline(input = {}) {
  const event = safe(input.event);
  const signals = safe(input.signals);

  return buildDecision({
    eventId: event.id,
    subjectId: event.subjectId,
    signals,
    context: {
      channel: event.channel ?? 'unknown',
      country: event.country ?? null,
      currency: event.currency ?? null,
      merchantId: event.merchantId ?? null,
      provider: event.provider ?? null,
    },
    policy: safe(input.policy),
  });
}

export function engineOutput(name, signal = {}) {
  return Object.freeze({
    engine: String(name),
    score: Number.isFinite(signal.score) ? Math.max(0, Math.min(100, signal.score)) : 0,
    confidence: Number.isFinite(signal.confidence)
      ? Math.max(0, Math.min(100, signal.confidence))
      : 0,
    reasonCodes: Array.isArray(signal.reasonCodes) ? [...new Set(signal.reasonCodes.map(String))] : [],
    evaluatedAt: new Date().toISOString(),
  });
}
