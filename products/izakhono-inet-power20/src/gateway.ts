import type { AccessDecision, ConsentGrant, DataDomain, Permission, ServiceManifest } from './types.js';
import { decideAccess } from './privacy.js';
import { getService } from './catalog.js';

export interface GatewayRequest {
  subjectId: string;
  serviceId: string;
  permission: Permission;
  dataDomain: DataDomain;
  path: string;
  consent?: ConsentGrant;
}

export interface GatewayDecision extends AccessDecision {
  service?: ServiceManifest;
  route?: string;
  externalBridgeAllowed: boolean;
}

export function authorizeGateway(request: GatewayRequest, now = new Date()): GatewayDecision {
  const service = getService(request.serviceId);
  if (!service) {
    return { allowed: false, reason: 'Unknown I-NET service', requiresConsent: false, externalBridgeAllowed: false };
  }
  if (!service.permissions.includes(request.permission)) {
    return { allowed: false, reason: 'Service does not declare the requested permission', requiresConsent: false, service, externalBridgeAllowed: false };
  }
  if (!service.dataDomains.includes(request.dataDomain)) {
    return { allowed: false, reason: 'Service does not declare the requested data domain', requiresConsent: false, service, externalBridgeAllowed: false };
  }
  if (!request.path.startsWith(service.route)) {
    return { allowed: false, reason: 'Route is outside the service boundary', requiresConsent: false, service, externalBridgeAllowed: false };
  }
  const decision = decideAccess(request.consent, request.permission, request.dataDomain, now);
  return {
    ...decision,
    service,
    route: service.route,
    externalBridgeAllowed: decision.allowed && service.externalAdaptersReplaceable,
  };
}
