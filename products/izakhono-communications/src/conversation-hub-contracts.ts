/**
 * IZAKHONO Conversation Hub — pure domain contracts.
 *
 * No database, network, provider, model, payment, identity or runtime side effects.
 * FORTRESS and canonical portfolio services remain external authorities.
 */

export type TenantScope = Readonly<{
  entity_id: string;
  platform_id: string;
  organisation_id?: string;
  branch_id?: string;
}>;

export type Channel =
  | "whatsapp"
  | "instagram"
  | "messenger"
  | "tiktok"
  | "email"
  | "sms"
  | "webchat"
  | "izakhono_connect"
  | "voice"
  | "api";

export type ConversationState = "open" | "pending" | "resolved" | "archived";
export type AgentMode = "disabled" | "suggest_only" | "draft_only" | "guarded_auto_reply";

export interface Conversation {
  conversation_id: string;
  scope: TenantScope;
  channel: Channel;
  external_thread_ref?: string;
  state: ConversationState;
  assigned_queue_id?: string;
  assigned_agent_id?: string;
  customer_crm_ref?: string;
  organisation_crm_ref?: string;
  deal_crm_ref?: string;
  agent_mode: AgentMode;
  created_at: string;
  updated_at: string;
}

export type MessageState =
  | "received"
  | "queued"
  | "attempting"
  | "accepted_by_channel"
  | "delivered"
  | "read"
  | "failed"
  | "unknown";

export interface MessageEnvelope {
  message_id: string;
  conversation_id: string;
  scope: TenantScope;
  channel: Channel;
  direction: "inbound" | "outbound";
  state: MessageState;
  body_ref?: string;
  provider_message_ref?: string;
  idempotency_key?: string;
  created_at: string;
  updated_at: string;
}

export interface TransitionEvidence {
  source: "channel_webhook" | "provider_response" | "reconciliation" | "owned_gateway";
  provider_event_id: string;
  observed_at: string;
}

const MESSAGE_TRANSITIONS: Record<MessageState, readonly MessageState[]> = {
  received: [],
  queued: ["attempting"],
  attempting: ["accepted_by_channel", "failed", "unknown"],
  accepted_by_channel: ["delivered", "failed"],
  delivered: ["read"],
  read: [],
  failed: [],
  unknown: ["accepted_by_channel", "failed"],
};

export function sameTenantScope(a: TenantScope, b: TenantScope): boolean {
  return a.entity_id === b.entity_id
    && a.platform_id === b.platform_id
    && (a.organisation_id ?? null) === (b.organisation_id ?? null)
    && (a.branch_id ?? null) === (b.branch_id ?? null);
}

/** Scope comparison is an additional guard, never a substitute for FORTRESS authorisation. */
export function canReadConversation(
  conversation: Conversation,
  principalScope: TenantScope,
  fortressAuthorised: boolean,
): boolean {
  return fortressAuthorised && sameTenantScope(conversation.scope, principalScope);
}

export function validateMessageTransition(
  message: MessageEnvelope,
  next: MessageState,
  evidence?: TransitionEvidence,
): string[] {
  const errors: string[] = [];
  if (message.direction === "inbound" && message.state !== "received") {
    errors.push("INBOUND_MESSAGE_STATE_INVALID");
  }
  if (!MESSAGE_TRANSITIONS[message.state].includes(next)) {
    errors.push("MESSAGE_TRANSITION_NOT_ALLOWED");
  }
  if (["accepted_by_channel", "delivered", "read", "failed"].includes(next)) {
    if (!evidence) errors.push("MESSAGE_TRANSITION_EVIDENCE_REQUIRED");
    else {
      if (!evidence.provider_event_id.trim()) errors.push("PROVIDER_EVENT_ID_REQUIRED");
      if (!Number.isFinite(Date.parse(evidence.observed_at))) errors.push("INVALID_EVIDENCE_TIMESTAMP");
    }
  }
  if (next === "delivered" || next === "read") {
    if (evidence?.source !== "channel_webhook" && evidence?.source !== "reconciliation") {
      errors.push("DELIVERY_RECEIPT_SOURCE_NOT_TRUSTED");
    }
  }
  return errors;
}

export interface ChannelCapabilities {
  inbound_text: boolean;
  outbound_text: boolean;
  media: boolean;
  templates: boolean;
  delivery_receipts: boolean;
  read_receipts: boolean;
  group_messaging: boolean;
  voice: boolean;
}

export interface ChannelAdapterDescriptor {
  adapter_id: string;
  channel: Channel;
  state: "not_connected" | "configured" | "sandbox" | "production_approved" | "suspended";
  capabilities: ChannelCapabilities;
  credential_ref?: string;
  last_verified_event_at?: string;
}

export function adapterCanSendText(adapter: ChannelAdapterDescriptor): boolean {
  return adapter.state === "production_approved"
    && adapter.capabilities.outbound_text
    && Boolean(adapter.credential_ref?.trim());
}

export interface ConsentEvidence {
  state: "granted" | "revoked" | "unknown";
  channel: Channel;
  purpose: "service" | "marketing";
  source_ref: string;
  observed_at: string;
  expires_at?: string;
}

export interface OutboundPolicyInput {
  channel: Channel;
  purpose: "service" | "marketing";
  message_kind: "freeform" | "approved_template";
  consent?: ConsentEvidence;
  lawful_basis_confirmed: boolean;
  within_service_window: boolean;
  approved_template: boolean;
  sender_verified: boolean;
  recipient_not_suppressed: boolean;
  adapter_production_ready: boolean;
  now: string;
}

export function evaluateOutboundPolicy(input: OutboundPolicyInput): string[] {
  const errors: string[] = [];
  const now = Date.parse(input.now);
  if (!Number.isFinite(now)) errors.push("INVALID_POLICY_TIME");
  if (!input.sender_verified) errors.push("SENDER_NOT_VERIFIED");
  if (!input.recipient_not_suppressed) errors.push("RECIPIENT_SUPPRESSED");
  if (!input.adapter_production_ready) errors.push("CHANNEL_NOT_PRODUCTION_READY");
  if (!input.lawful_basis_confirmed) errors.push("LAWFUL_BASIS_NOT_CONFIRMED");

  const consent = input.consent;
  const consentValid = Boolean(
    consent
    && consent.state === "granted"
    && consent.channel === input.channel
    && consent.purpose === input.purpose
    && consent.source_ref.trim()
    && Number.isFinite(Date.parse(consent.observed_at))
    && (!consent.expires_at || Date.parse(consent.expires_at) > now),
  );

  if (input.purpose === "marketing" && !consentValid) {
    errors.push("MARKETING_CONSENT_NOT_VALID");
  }
  if (consent?.state === "revoked") errors.push("CONSENT_REVOKED");
  if (consent && (consent.channel !== input.channel || consent.purpose !== input.purpose)) {
    errors.push("CONSENT_SCOPE_MISMATCH");
  }

  if (input.channel === "whatsapp") {
    if (input.message_kind === "freeform" && !input.within_service_window) {
      errors.push("WHATSAPP_SERVICE_WINDOW_CLOSED");
    }
    if (input.message_kind === "approved_template" && !input.approved_template) {
      errors.push("WHATSAPP_TEMPLATE_NOT_APPROVED");
    }
    if (input.purpose === "marketing" && input.message_kind !== "approved_template") {
      errors.push("WHATSAPP_MARKETING_REQUIRES_APPROVED_TEMPLATE");
    }
  }
  return [...new Set(errors)];
}

export type AgentAction =
  | "classify_intent"
  | "qualify_lead"
  | "summarise_conversation"
  | "draft_reply"
  | "send_reply"
  | "create_crm_activity"
  | "create_booking"
  | "issue_refund"
  | "change_payment"
  | "change_access"
  | "make_regulated_decision";

export interface AgentActionContext {
  action: AgentAction;
  mode: AgentMode;
  confidence: number;
  approved_knowledge_refs: string[];
  consent_allows_message: boolean;
  no_sensitive_intent: boolean;
  customer_explicitly_confirmed: boolean;
  authorised_action_adapter: boolean;
  idempotency_key?: string;
}

export interface AgentActionDecision {
  outcome: "allow" | "requires_human" | "deny";
  reason: string;
}

export function evaluateAgentAction(context: AgentActionContext): AgentActionDecision {
  const prohibited: AgentAction[] = [
    "issue_refund", "change_payment", "change_access", "make_regulated_decision",
  ];
  if (prohibited.includes(context.action)) {
    return { outcome: "deny", reason: "ACTION_REQUIRES_CANONICAL_AUTHORITY_AND_HUMAN_CONTROL" };
  }
  if (context.action === "classify_intent" || context.action === "qualify_lead" || context.action === "summarise_conversation") {
    return { outcome: "allow", reason: "ADVISORY_CONVERSATION_ACTION" };
  }
  if (context.action === "draft_reply" || context.mode === "suggest_only" || context.mode === "draft_only" || context.mode === "disabled") {
    return { outcome: "requires_human", reason: "HUMAN_REVIEW_REQUIRED_BY_AGENT_MODE" };
  }
  if (context.action === "create_booking") {
    const ready = context.customer_explicitly_confirmed
      && context.authorised_action_adapter
      && Boolean(context.idempotency_key && context.idempotency_key.length >= 16);
    return ready
      ? { outcome: "allow", reason: "CUSTOMER_CONFIRMED_AND_ADAPTER_AUTHORISED" }
      : { outcome: "requires_human", reason: "BOOKING_CONFIRMATION_OR_AUTHORISED_ADAPTER_MISSING" };
  }
  if (context.action === "create_crm_activity") {
    return context.authorised_action_adapter
      ? { outcome: "allow", reason: "CRM_ADAPTER_AUTHORISED" }
      : { outcome: "requires_human", reason: "CRM_ADAPTER_NOT_AUTHORISED" };
  }
  if (context.action === "send_reply") {
    const ready = context.mode === "guarded_auto_reply"
      && context.confidence >= 0.85
      && context.approved_knowledge_refs.length > 0
      && context.consent_allows_message
      && context.no_sensitive_intent;
    return ready
      ? { outcome: "allow", reason: "GUARDED_AUTO_REPLY_POLICY_SATISFIED" }
      : { outcome: "requires_human", reason: "AUTO_REPLY_GUARDS_NOT_SATISFIED" };
  }
  return { outcome: "deny", reason: "UNRECOGNISED_AGENT_ACTION" };
}

export type HandoverReason =
  | "customer_requested_human"
  | "low_confidence"
  | "repeated_failure"
  | "complaint_or_dispute"
  | "sensitive_topic"
  | "safety_concern"
  | "policy_boundary"
  | "tool_failure";

export interface HandoverRequest {
  conversation_id: string;
  scope: TenantScope;
  queue_id: string;
  reason: HandoverReason;
  summary_ref: string;
  requested_at: string;
}

export function validateHandover(request: HandoverRequest): string[] {
  const errors: string[] = [];
  if (!request.conversation_id.trim()) errors.push("CONVERSATION_ID_REQUIRED");
  if (!request.queue_id.trim()) errors.push("HANDOVER_QUEUE_REQUIRED");
  if (!request.summary_ref.trim()) errors.push("HANDOVER_CONTEXT_REQUIRED");
  if (!Number.isFinite(Date.parse(request.requested_at))) errors.push("INVALID_HANDOVER_TIMESTAMP");
  return errors;
}

export interface RoutingAgent {
  agent_id: string;
  available: boolean;
  skills: string[];
  languages: string[];
  active_conversations: number;
  max_concurrent_conversations: number;
}

export function selectAgent(
  agents: readonly RoutingAgent[],
  requiredSkills: readonly string[],
  language: string,
): RoutingAgent | null {
  const eligible = agents.filter(agent =>
    agent.available
    && agent.max_concurrent_conversations > 0
    && agent.active_conversations < agent.max_concurrent_conversations
    && requiredSkills.every(skill => agent.skills.includes(skill))
    && agent.languages.includes(language),
  );
  eligible.sort((a, b) => {
    const loadA = a.active_conversations / a.max_concurrent_conversations;
    const loadB = b.active_conversations / b.max_concurrent_conversations;
    return loadA - loadB || a.agent_id.localeCompare(b.agent_id);
  });
  return eligible[0] ?? null;
}

export interface IdempotencyRecord {
  key: string;
  request_fingerprint: string;
  result_ref: string;
}

export function evaluateIdempotency(
  existing: IdempotencyRecord | undefined,
  key: string,
  fingerprint: string,
): "new" | "replay" | "conflict" | "invalid" {
  if (key.trim().length < 16 || key.length > 128 || !fingerprint.trim()) return "invalid";
  if (!existing) return "new";
  if (existing.key !== key) return "conflict";
  return existing.request_fingerprint === fingerprint ? "replay" : "conflict";
}

/** A CRM event is a reference/outbox hand-off; the Hub never owns CRM contact/deal state. */
export interface CrmConversationEvent {
  event_id: string;
  event_type: "conversation.lead_qualified" | "conversation.activity_proposed";
  scope: TenantScope;
  conversation_id: string;
  crm_contact_ref?: string;
  crm_deal_ref?: string;
  occurred_at: string;
  idempotency_key: string;
}
