export type ProvisioningState =
  | "REQUESTED"
  | "PAYMENT_CONFIRMED"
  | "TENANT_CREATED"
  | "NUMBER_ASSIGNED"
  | "EXTENSIONS_CREATED"
  | "ROUTING_CONFIGURED"
  | "DEVICES_ISSUED"
  | "SERVICE_VALIDATED"
  | "ACTIVE"
  | "REQUIRES_ATTENTION";

export type Tenant = {
  id: string;
  name: string;
  status: "active" | "suspended";
  createdAt: string;
};

export type Extension = {
  id: string;
  tenantId: string;
  number: string;
  displayName: string;
  enabled: boolean;
};

export type PhoneNumber = {
  id: string;
  tenantId: string | null;
  e164: string;
  status: "available" | "reserved" | "assigned" | "released";
  carrierConnectionId: string;
};

export type RoutingRule = {
  id: string;
  tenantId: string;
  priority: number;
  match: string;
  destination: string;
  enabled: boolean;
};

export type CallRecord = {
  id: string;
  tenantId: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  startedAt: string;
  endedAt?: string;
  status: "ringing" | "answered" | "completed" | "failed";
};

export type ProvisioningJob = {
  id: string;
  tenantId: string;
  state: ProvisioningState;
  attempts: number;
  lastError?: string;
  updatedAt: string;
};
