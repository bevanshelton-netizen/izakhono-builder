export type VoiceProvider = "tkos" | string;

export interface CallRequest {
  tenantId: string;
  from: string;
  to: string;
  callerId?: string;
  displayName?: string;
  metadata?: Record<string, string>;
}

export interface CallResult {
  provider: VoiceProvider;
  providerCallId: string;
  status: string;
  raw?: unknown;
}

export interface VoiceNumber {
  id: string;
  number: string;
  status?: string;
  capabilities?: string[];
  raw?: unknown;
}

export interface CallRecord {
  id: string;
  tenantId?: string;
  from?: string;
  to?: string;
  status?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  raw?: unknown;
}

export interface CarrierAdapter {
  readonly provider: VoiceProvider;
  createCall(request: CallRequest, idempotencyKey: string): Promise<CallResult>;
  listNumbers(): Promise<VoiceNumber[]>;
  listCallRecords(options?: { from?: string; to?: string }): Promise<CallRecord[]>;
}

export interface VoiceRuntimeConfig {
  provider: VoiceProvider;
  apiBaseUrl: string;
  apiKey: string;
}

export function requireServerVoiceConfig(config: VoiceRuntimeConfig): VoiceRuntimeConfig {
  if (!config.apiKey) throw new Error("Voice carrier API key is required on the server");
  if (typeof window !== "undefined") {
    throw new Error("Voice carrier credentials must never be used in browser code");
  }
  return config;
}
