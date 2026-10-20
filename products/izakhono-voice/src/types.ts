export type CallDirection = "inbound" | "outbound";
export type CallStatus = "ringing" | "active" | "handoff" | "completed" | "failed";

export interface CallerIdentity {
  phone: string;
  customerId?: string;
  name?: string;
  callerIdName?: string;
  preferredLanguage?: string;
}

export interface VoiceEvent {
  timestamp: string;
  type:
    | "call_started"
    | "caller_identified"
    | "message"
    | "tool_call"
    | "sms"
    | "handoff"
    | "reminder"
    | "call_ended";
  speaker?: "customer" | "assistant" | "agent" | "system";
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface CallCase {
  callId: string;
  direction: CallDirection;
  status: CallStatus;
  customer: CallerIdentity;
  businessContext: Record<string, unknown>;
  claim: Record<string, unknown>;
  events: VoiceEvent[];
  nextAction?: string;
}

export interface TelephonyAdapter {
  answer(callId: string): Promise<void>;
  dial(phone: string, callId: string): Promise<void>;
  transfer(callId: string, destination: string): Promise<void>;
  sendSms(phone: string, body: string): Promise<void>;
  hangup(callId: string): Promise<void>;
}

export interface VoiceAdapter {
  transcribe(audio: Uint8Array, language?: string): Promise<string>;
  synthesize(text: string, voice: string, language?: string): Promise<Uint8Array>;
}

export interface KnowledgeAdapter {
  retrieve(query: string, tenantId: string): Promise<Array<{ text: string; source: string }>>;
}

export interface ModelAdapter {
  respond(input: {
    system: string;
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
    context: Array<{ text: string; source: string }>;
  }): Promise<string>;
}

export interface CaseStore {
  getByPhone(phone: string): Promise<CallerIdentity | undefined>;
  save(caseData: CallCase): Promise<void>;
}
