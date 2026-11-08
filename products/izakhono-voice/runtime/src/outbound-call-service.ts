import { randomUUID } from "node:crypto";
import type { TelephonyAdapter } from "../../src/types.js";
import type { VoiceCallRegistry } from "./runtime-contract.js";

export interface OutboundCallRequest {
  tenantId: string;
  destination: string;
}

export interface OutboundCallResult {
  callId: string;
  status: "submitted";
}

/**
 * Trusted application boundary for outbound calls.
 *
 * The internal call is durably tenant-bound before the carrier is contacted.
 * A carrier submission failure closes the still-unbound record, preventing
 * abandoned pending calls from being mistaken for active calls.
 */
export class OutboundCallService {
  constructor(
    private readonly registry: Pick<VoiceCallRegistry, "createOutboundCall" | "failUnboundOutboundCall">,
    private readonly telephony: Pick<TelephonyAdapter, "dial">,
    private readonly newCallId: () => string = randomUUID,
  ) {}

  async placeCall(request: OutboundCallRequest): Promise<OutboundCallResult> {
    const tenantId = request.tenantId.trim();
    const destination = request.destination.trim();
    if (!tenantId) throw new Error("tenantId is required");
    if (!/^\\+[1-9][0-9]{7,14}$/.test(destination)) {
      throw new Error("destination must be a valid E.164 phone number");
    }

    const callId = this.newCallId();
    if (!/^[0-9a-f-]{36}$/i.test(callId)) throw new Error("call ID generator must return a UUID");

    await this.registry.createOutboundCall({ callId, tenantId });
    try {
      await this.telephony.dial(destination, callId);
    } catch (error) {
      try {
        await this.registry.failUnboundOutboundCall({ callId, tenantId });
      } catch {
        // Preserve the carrier submission error; reconciliation can inspect
        // the durable pending record if the cleanup write also fails.
      }
      throw error;
    }
    return { callId, status: "submitted" };
  }
}
