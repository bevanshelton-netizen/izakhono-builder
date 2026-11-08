export type ModuleId = 'privacy' | 'automate' | 'social-intelligence';

export type AccountContext = {
  userId: string;
  organisationId: string;
  role: 'owner' | 'admin' | 'member';
};

export type ConsentRecord = {
  id: string;
  userId: string;
  organisationId: string;
  purpose: 'device-permissions' | 'social-connection' | 'automation-action' | 'notifications';
  grantedAt: string;
  revokedAt?: string;
};

export type DeviceSummary = {
  id: string;
  platform: 'android' | 'ios' | 'web';
  displayName: string;
  registeredAt: string;
  lastSeenAt?: string;
  trustState: 'pending' | 'trusted' | 'revoked';
};

export type AutomationTrigger =
  | { type: 'schedule'; cron: string; timezone: string }
  | { type: 'webhook'; connectionId: string; eventType: string }
  | { type: 'manual' };

export type AutomationCondition =
  | { type: 'equals'; field: string; value: string | number | boolean }
  | { type: 'contains'; field: string; value: string };

export type AutomationAction =
  | { type: 'send_notification'; title: string; body: string }
  | { type: 'create_task'; title: string; dueAt?: string }
  | { type: 'call_webhook'; connectionId: string; eventType: string };

export type AutomationDefinition = {
  id: string;
  organisationId: string;
  createdBy: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  createdAt: string;
  updatedAt: string;
};

export type AutomationRunState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type AutomationRun = {
  id: string;
  automationId: string;
  organisationId: string;
  state: AutomationRunState;
  idempotencyKey: string;
  startedAt?: string;
  finishedAt?: string;
  errorCode?: string;
};

export type SocialConnection = {
  id: string;
  organisationId: string;
  provider: string;
  externalAccountLabel: string;
  scopes: string[];
  connectedAt: string;
  revokedAt?: string;
};

export type SocialAlert = {
  id: string;
  organisationId: string;
  connectionId: string;
  sourceUrl: string;
  headline: string;
  observedAt: string;
};

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'INVALID_INPUT'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';
