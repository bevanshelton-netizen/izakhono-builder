import type {
  CallCase,
  CaseStore,
  KnowledgeAdapter,
  ModelAdapter,
  TelephonyAdapter,
  VoiceAdapter,
} from "./types";

export class IzakhonoVoiceOrchestrator {
  constructor(
    private readonly telephony: TelephonyAdapter,
    private readonly voice: VoiceAdapter,
    private readonly knowledge: KnowledgeAdapter,
    private readonly model: ModelAdapter,
    private readonly cases: CaseStore,
  ) {}

  async startInbound(callId: string, phone: string): Promise<CallCase> {
    const knownCustomer = await this.cases.getByPhone(phone);
    const call: CallCase = {
      callId,
      direction: "inbound",
      status: "ringing",
      customer: knownCustomer ?? { phone },
      businessContext: {},
      claim: {},
      events: [],
    };

    await this.telephony.answer(callId);
    call.status = "active";
    call.events.push({
      timestamp: new Date().toISOString(),
      type: "call_started",
      speaker: "system",
    });
    call.events.push({
      timestamp: new Date().toISOString(),
      type: "caller_identified",
      speaker: "system",
      metadata: { phone, knownCustomer: Boolean(knownCustomer) },
    });

    await this.cases.save(call);
    return call;
  }

  async generateReply(
    call: CallCase,
    customerText: string,
    tenantId: string,
  ): Promise<string> {
    call.events.push({
      timestamp: new Date().toISOString(),
      type: "message",
      speaker: "customer",
      content: customerText,
    });

    const context = await this.knowledge.retrieve(customerText, tenantId);
    const reply = await this.model.respond({
      system:
        "You are IZAKHONO VOICE. Be concise, accurate and helpful. " +
        "Never invent customer records, prices, policies or case outcomes. " +
        "Use retrieved business context when available. Escalate when a human is required.",
      messages: call.events
        .filter((event) => event.type === "message" && event.content)
        .map((event) => ({
          role: event.speaker === "assistant" ? ("assistant" as const) : ("user" as const),
          content: event.content!,
        })),
      context,
    });

    call.events.push({
      timestamp: new Date().toISOString(),
      type: "message",
      speaker: "assistant",
      content: reply,
    });
    await this.cases.save(call);
    return reply;
  }

  async handoff(call: CallCase, agentDestination: string): Promise<void> {
    call.status = "handoff";
    call.events.push({
      timestamp: new Date().toISOString(),
      type: "handoff",
      speaker: "system",
      metadata: { destination: agentDestination },
    });
    await this.cases.save(call);
    await this.telephony.transfer(call.callId, agentDestination);
  }

  async finish(call: CallCase, summary: string): Promise<void> {
    call.status = "completed";
    call.nextAction = summary;
    call.events.push({
      timestamp: new Date().toISOString(),
      type: "call_ended",
      speaker: "system",
      content: summary,
    });
    await this.cases.save(call);
    await this.telephony.hangup(call.callId);
  }
}
