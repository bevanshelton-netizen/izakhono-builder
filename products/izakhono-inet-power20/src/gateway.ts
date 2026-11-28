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

/**
 * Enforce a path boundary, not a string-prefix boundary. Decode before
 * checking so encoded dot segments cannot escape the service namespace.
 */
function isWithinServiceRoute(path: string, route: string): boolean {
  if (!path.startsWith('/') || path.includes('\\')) return false;

  let pathname: string;
  try {
    pathname = decodeURIComponent(path.split(/[?#]/, 1)[0]);
  } catch {
    return false;
  }

  if (pathname.includes('\\')) return false;
  const segments = pathname.split('/');
  if (segments.some((segment) => segment === '.' || segment === '..')) return false;

  return pathname === route || pathname.startsWith(`${route}/`);
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
  if (!isWithinServiceRoute(request.path, service.route)) {
    return { allowed: false, reason: 'Route is outside the service boundary', requiresConsent: false, service, externalBridgeAllowed: false };
  }

  // A valid consent grant must belong to this exact subject and service.
  // Matching permission/domain scopes alone must never authorise cross-user
  // or cross-service reuse of another grant.
  if (!request.consent ||
      request.consent.subjectId !== request.subjectId ||
      request.consent.serviceId !== request.serviceId) {
    return {
      allowed: false,
      reason: 'Consent grant does not match the requesting subject and service',
      requiresConsent: true,
      service,
      externalBridgeAllowed: false,
    };
  }

  const decision = decideAccess(request.consent, request.permission, request.dataDomain, now);
  return {
    ...decision,
    service,
    route: service.route,
    externalBridgeAllowed: decision.allowed && service.externalAdaptersReplaceable,
  };
}
