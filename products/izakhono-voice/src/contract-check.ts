import { IzakhonoVoiceOrchestrator } from "./orchestrator";
import { ProviderRegistry } from "./provider-registry";
import {
  LoopbackKnowledgeAdapter,
  LoopbackModelAdapter,
  LoopbackTelephonyAdapter,
  LoopbackVoiceAdapter,
  MemoryCaseStore,
} from "./loopback-adapters";

/**
 * Minimal end-to-end contract check. It proves the orchestration layer can
 * operate without a specific telephony, speech, model or database vendor.
 */
export async function runIzakhonoVoiceContractCheck() {
  const telephony = new LoopbackTelephonyAdapter();
  const cases = new MemoryCaseStore();
  const registry = new ProviderRegistry();

  registry.register({
    telephony,
    voice: new LoopbackVoiceAdapter(),
    knowledge: new LoopbackKnowledgeAdapter(),
    model: new LoopbackModelAdapter(),
    cases,
  });

  const providers = registry.get();
  const orchestrator = new IzakhonoVoiceOrchestrator(
    providers.telephony,
    providers.voice,
    providers.knowledge,
    providers.model,
    providers.cases,
  );

  const call = await orchestrator.startInbound("loopback-call-001", "+27000000000");
  const reply = await orchestrator.generateReply(
    call,
    "I need help with my account.",
    "demo-tenant",
  );
  await orchestrator.handoff(call, "agent-001");

  const saved = cases.getByCallId(call.callId);
  if (!saved) throw new Error("Call case was not persisted");
  if (saved.customer.phone !== "+27000000000") throw new Error("Caller ID context was lost");
  if (!saved.events.some((event) => event.type === "caller_identified")) {
    throw new Error("Caller identification event was not recorded");
  }
  if (!reply.startsWith("Loopback response:")) throw new Error("Model adapter contract failed");
  if (!telephony.calls.includes("answer:loopback-call-001")) {
    throw new Error("Telephony answer contract failed");
  }
  if (!telephony.calls.includes("transfer:loopback-call-001:agent-001")) {
    throw new Error("Human handoff contract failed");
  }

  return {
    ok: true,
    callId: call.callId,
    caller: saved.customer.phone,
    status: saved.status,
    events: saved.events.length,
    reply,
    telephonyEvents: telephony.calls,
  };
}
