export type CallerId = {
  raw: string;
  normalized: string;
};

export type VoiceCallStarted = {
  type: 'call.started';
  provider: string;
  providerCallId: string;
  caller: CallerId;
  calledNumber: string;
  receivedAt: string;
};

export type VoiceMediaReady = {
  type: 'call.media.ready';
  providerCallId: string;
  mediaSessionId: string;
  direction: 'inbound' | 'outbound';
  codec: string;
};

export type VoiceCallEnded = {
  type: 'call.ended';
  providerCallId: string;
  endedAt: string;
  reason?: string;
};

export type VoiceEvent = VoiceCallStarted | VoiceMediaReady | VoiceCallEnded;

export type VoiceCommand =
  | { type: 'answer'; providerCallId: string }
  | { type: 'hangup'; providerCallId: string }
  | { type: 'transfer'; providerCallId: string; destination: string }
  | { type: 'sendSms'; providerCallId: string; to: string; body: string }
  | { type: 'startMedia'; providerCallId: string }
  | { type: 'stopMedia'; providerCallId: string };

export interface TelephonyProvider {
  readonly name: string;
  normalizeCallerId(raw: string): CallerId;
  handleEvent(input: unknown): VoiceEvent;
  execute(command: VoiceCommand): Promise<void>;
}

export function assertProductionReady(gates: Record<string, boolean>): void {
  const required = [
    'numberConfigured',
    'signedWebhookReachable',
    'callerIdCaptured',
    'sessionCreated',
    'mediaEstablished',
    'aiResponseReturned',
    'hangupVerified',
    'transferVerified',
    'auditRecorded',
    'failurePathTested',
  ];

  const missing = required.filter((key) => gates[key] !== true);
  if (missing.length) {
    throw new Error(`VOICE_NOT_LIVE: missing activation gates: ${missing.join(', ')}`);
  }
}
