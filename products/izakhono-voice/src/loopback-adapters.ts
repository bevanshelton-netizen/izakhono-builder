import type {
  CaseStore,
  CallerIdentity,
  KnowledgeAdapter,
  ModelAdapter,
  TelephonyAdapter,
  VoiceAdapter,
  CallCase,
} from "./types";

/** Deterministic adapters for local contract/integration testing. */
export class LoopbackTelephonyAdapter implements TelephonyAdapter {
  readonly calls: string[] = [];
  async answer(callId: string) { this.calls.push(`answer:${callId}`); }
  async dial(phone: string, callId: string) { this.calls.push(`dial:${phone}:${callId}`); }
  async transfer(callId: string, destination: string) { this.calls.push(`transfer:${callId}:${destination}`); }
  async sendSms(phone: string, body: string) { this.calls.push(`sms:${phone}:${body}`); }
  async hangup(callId: string) { this.calls.push(`hangup:${callId}`); }
}

export class LoopbackVoiceAdapter implements VoiceAdapter {
  async transcribe(_audio: Uint8Array): Promise<string> { return "loopback transcription"; }
  async synthesize(text: string): Promise<Uint8Array> { return new TextEncoder().encode(text); }
}

export class LoopbackKnowledgeAdapter implements KnowledgeAdapter {
  async retrieve(query: string, tenantId: string) {
    return [{ text: `Tenant ${tenantId} knowledge context for: ${query}`, source: "loopback" }];
  }
}

export class LoopbackModelAdapter implements ModelAdapter {
  async respond(input: Parameters<ModelAdapter["respond"]>[0]): Promise<string> {
    const last = input.messages[input.messages.length - 1];
    return `Loopback response: ${last?.content ?? "How can I help you?"}`;
  }
}

export class MemoryCaseStore implements CaseStore {
  private readonly cases = new Map<string, CallCase>();
  private readonly customers = new Map<string, CallerIdentity>();

  async getByPhone(phone: string) { return this.customers.get(phone); }

  async save(caseData: CallCase) {
    this.cases.set(caseData.callId, structuredClone(caseData));
    this.customers.set(caseData.customer.phone, structuredClone(caseData.customer));
  }

  getByCallId(callId: string) { return this.cases.get(callId); }
}
