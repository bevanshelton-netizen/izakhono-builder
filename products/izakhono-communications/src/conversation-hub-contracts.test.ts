import {
  adapterCanSendText,
  canReadConversation,
  evaluateAgentAction,
  evaluateIdempotency,
  evaluateOutboundPolicy,
  selectAgent,
  validateHandover,
  validateMessageTransition,
  type AgentActionContext,
  type Conversation,
  type MessageEnvelope,
  type OutboundPolicyInput,
  type RoutingAgent,
  type TenantScope,
} from "./conversation-hub-contracts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const scope: TenantScope = { entity_id: "entity-a", platform_id: "platform-a", organisation_id: "org-a" };
const otherScope: TenantScope = { entity_id: "entity-b", platform_id: "platform-a", organisation_id: "org-a" };
const conversation: Conversation = {
  conversation_id: "conv-1",
  scope,
  channel: "whatsapp",
  state: "open",
  agent_mode: "guarded_auto_reply",
  created_at: "2026-11-26T10:00:00Z",
  updated_at: "2026-11-26T10:00:00Z",
};

assert(canReadConversation(conversation, scope, true), "same tenant and FORTRESS approval should permit access");
assert(!canReadConversation(conversation, otherScope, true), "cross-tenant access must be denied");
assert(!canReadConversation(conversation, scope, false), "scope match must not bypass FORTRESS");

const outbound: MessageEnvelope = {
  message_id: "msg-1", conversation_id: "conv-1", scope, channel: "whatsapp",
  direction: "outbound", state: "queued",
  created_at: "2026-11-26T10:00:00Z", updated_at: "2026-11-26T10:00:00Z",
};
assert(validateMessageTransition(outbound, "attempting").length === 0, "queued to attempting should be valid");
assert(validateMessageTransition(outbound, "delivered", {
  source: "channel_webhook", provider_event_id: "evt-1", observed_at: "2026-11-26T10:01:00Z",
}).includes("MESSAGE_TRANSITION_NOT_ALLOWED"), "queued must not jump directly to delivered");
assert(validateMessageTransition({ ...outbound, state: "attempting" }, "accepted_by_channel").includes("MESSAGE_TRANSITION_EVIDENCE_REQUIRED"), "provider acceptance requires evidence");
assert(validateMessageTransition({ ...outbound, state: "accepted_by_channel" }, "delivered", {
  source: "provider_response", provider_event_id: "evt-2", observed_at: "2026-11-26T10:01:00Z",
}).includes("DELIVERY_RECEIPT_SOURCE_NOT_TRUSTED"), "delivery requires a trusted receipt/reconciliation source");

const adapter = {
  adapter_id: "wa-1", channel: "whatsapp" as const, state: "production_approved" as const,
  credential_ref: "secret://whatsapp/business-a",
  capabilities: { inbound_text: true, outbound_text: true, media: true, templates: true, delivery_receipts: true, read_receipts: true, group_messaging: false, voice: false },
};
assert(adapterCanSendText(adapter), "approved adapter with server-side secret reference should be send-capable");
assert(!adapterCanSendText({ ...adapter, state: "sandbox" }), "sandbox adapter must not send production traffic");

const validConsent = {
  state: "granted" as const, channel: "whatsapp" as const, purpose: "marketing" as const,
  source_ref: "consent-record-1", observed_at: "2026-11-20T10:00:00Z",
};
const validOutbound: OutboundPolicyInput = {
  channel: "whatsapp", purpose: "marketing", message_kind: "approved_template",
  consent: validConsent, lawful_basis_confirmed: true, within_service_window: false,
  approved_template: true, sender_verified: true, recipient_not_suppressed: true,
  adapter_production_ready: true, now: "2026-11-26T10:00:00Z",
};
assert(evaluateOutboundPolicy(validOutbound).length === 0, "valid marketing template and consent should pass");
assert(evaluateOutboundPolicy({ ...validOutbound, consent: { ...validConsent, state: "revoked" } }).includes("MARKETING_CONSENT_NOT_VALID"), "revoked consent must block marketing");
assert(evaluateOutboundPolicy({ ...validOutbound, message_kind: "freeform" }).includes("WHATSAPP_MARKETING_REQUIRES_APPROVED_TEMPLATE"), "WhatsApp marketing requires approved template");
assert(evaluateOutboundPolicy({ ...validOutbound, recipient_not_suppressed: false }).includes("RECIPIENT_SUPPRESSED"), "suppression must block all outbound");
assert(evaluateOutboundPolicy({ ...validOutbound, channel: "whatsapp", purpose: "service", message_kind: "freeform", consent: undefined, within_service_window: false }).includes("WHATSAPP_SERVICE_WINDOW_CLOSED"), "WhatsApp freeform outside service window must be blocked");

const agentBase: AgentActionContext = {
  action: "send_reply", mode: "guarded_auto_reply", confidence: 0.93,
  approved_knowledge_refs: ["kb:refund-policy:v3"], consent_allows_message: true,
  no_sensitive_intent: true, customer_explicitly_confirmed: false,
  authorised_action_adapter: false,
};
assert(evaluateAgentAction(agentBase).outcome === "allow", "guarded, sourced and permitted reply should be allowed");
assert(evaluateAgentAction({ ...agentBase, confidence: 0.62 }).outcome === "requires_human", "low confidence requires human");
assert(evaluateAgentAction({ ...agentBase, approved_knowledge_refs: [] }).outcome === "requires_human", "unsourced answer requires human");
assert(evaluateAgentAction({ ...agentBase, consent_allows_message: false }).outcome === "requires_human", "AI cannot bypass outbound consent");
assert(evaluateAgentAction({ ...agentBase, action: "issue_refund" }).outcome === "deny", "AI must not issue refunds");
assert(evaluateAgentAction({ ...agentBase, action: "change_payment" }).outcome === "deny", "AI must not change payments");
assert(evaluateAgentAction({ ...agentBase, action: "create_booking", customer_explicitly_confirmed: true, authorised_action_adapter: true, idempotency_key: "booking-idempotency-0001" }).outcome === "allow", "confirmed booking through authorised adapter may proceed");

assert(validateHandover({
  conversation_id: "conv-1", scope, queue_id: "support", reason: "customer_requested_human",
  summary_ref: "summary://conv-1", requested_at: "2026-11-26T10:00:00Z",
}).length === 0, "complete human handover should validate");
assert(validateHandover({
  conversation_id: "conv-1", scope, queue_id: "", reason: "low_confidence",
  summary_ref: "", requested_at: "not-a-date",
}).length === 3, "handover without queue/context/timestamp must fail");

const agents: RoutingAgent[] = [
  { agent_id: "agent-b", available: true, skills: ["sales"], languages: ["en"], active_conversations: 3, max_concurrent_conversations: 5 },
  { agent_id: "agent-a", available: true, skills: ["sales", "support"], languages: ["en"], active_conversations: 1, max_concurrent_conversations: 5 },
  { agent_id: "agent-c", available: false, skills: ["sales"], languages: ["en"], active_conversations: 0, max_concurrent_conversations: 5 },
];
assert(selectAgent(agents, ["sales"], "en")?.agent_id === "agent-a", "routing should choose the least-loaded eligible agent");
assert(selectAgent(agents, ["billing"], "en") === null, "routing must not assign an agent without required skills");

assert(evaluateIdempotency(undefined, "request-idempotency-001", "hash-a") === "new", "first request should be new");
assert(evaluateIdempotency({ key: "request-idempotency-001", request_fingerprint: "hash-a", result_ref: "result-1" }, "request-idempotency-001", "hash-a") === "replay", "same key and fingerprint should replay");
assert(evaluateIdempotency({ key: "request-idempotency-001", request_fingerprint: "hash-a", result_ref: "result-1" }, "request-idempotency-001", "hash-b") === "conflict", "same key with different payload must conflict");
assert(evaluateIdempotency(undefined, "short", "hash-a") === "invalid", "short idempotency key must fail");

console.log("IZAKHONO CONVERSATION HUB CONTRACTS: PASS");
