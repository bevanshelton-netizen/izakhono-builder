import type { VoiceStreamAuthorization } from "../../src/twilio-media-stream-bridge.js";

export interface VoiceCallRegistry {
  /**
   * Resolve CallSid to a persisted IZAKHONO call and tenant. The implementation
   * MUST validate call state, stream token/association, tenant, expiry, replay,
   * and one-active-stream policy atomically in durable shared storage.
   * customParameters are untrusted lookup hints, never tenant authority.
   */
  authorizeStart(input: {
    callSid: string;
    streamSid: string;
    customParameters: Record<string, string>;
  }): Promise<VoiceStreamAuthorization | null>;

  /** Persist final provider usage against the already-authorized tenant/call. */
  recordUsage?(input: {
    tenantId: string;
    callId: string;
    usage: unknown;
  }): Promise<void>;
}

export interface VoiceRuntimeDependencies {
  callRegistry: VoiceCallRegistry;
  /** Tenant-scoped policy instructions resolved from trusted call/tenant state. */
  instructionsForCall(input: VoiceStreamAuthorization): Promise<string>;
  audit?(event: {
    tenantId: string;
    callId: string;
    event: string;
    details?: unknown;
  }): Promise<void>;
}

export interface VoiceRuntimeAdapterModule {
  createVoiceRuntimeDependencies(env: NodeJS.ProcessEnv): Promise<VoiceRuntimeDependencies>;
}
