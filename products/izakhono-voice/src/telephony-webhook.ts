import type { CallerIdentity } from "./types";

export interface InboundCallWebhook {
  event: "call.inbound";
  callId: string;
  from: string;
  callerIdName?: string;
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedInboundCall {
  callId: string;
  caller: CallerIdentity;
  metadata: Record<string, unknown>;
}

/**
 * Normalizes an inbound event from the external telephony gateway into the
 * IZAKHONO VOICE domain model. No provider-specific fields leak inward.
 */
export function normalizeInboundCall(event: InboundCallWebhook): NormalizedInboundCall {
  if (event.event !== "call.inbound") throw new Error("Unsupported telephony event");
  if (!event.callId.trim()) throw new Error("Inbound callId is required");
  if (!event.from.trim()) throw new Error("Inbound caller number is required");

  return {
    callId: event.callId,
    caller: {
      phone: event.from,
      callerIdName: event.callerIdName,
      preferredLanguage: event.language,
    },
    metadata: event.metadata ?? {},
  };
}
