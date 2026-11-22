/**
 * Server-side DEPLOY authorization boundary.
 *
 * The verifier MUST be the trusted IZAKHONO ID/JWT adapter and must validate
 * signature, issuer, audience, expiry and not-before claims. Never accept claims
 * supplied by a browser or a request body as a principal.
 */
const trustedPrincipals = new WeakSet();

export class DeploymentAuthorizationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DeploymentAuthorizationError";
    this.code = code;
  }
}

const nonEmpty = value => typeof value === "string" && value.trim().length > 0;
const stringArray = value => Array.isArray(value) && value.length > 0 &&
  value.every(item => nonEmpty(item));

/**
 * Verify a bearer token using the trusted identity adapter and mint a
 * request-scoped principal. verifyAccessToken must reject invalid signatures,
 * issuer, audience, exp and nbf; this function independently checks key claims.
 */
export async function authenticateDeploymentRequest({
  authorization,
  verifyAccessToken,
  issuer,
  audience,
  now = Date.now()
} = {}) {
  if (typeof verifyAccessToken !== "function" || !nonEmpty(issuer) || !nonEmpty(audience)) {
    throw new DeploymentAuthorizationError("AUTH_CONFIG_INVALID", "Trusted identity verification is not configured.");
  }
  if (!nonEmpty(authorization) || !/^Bearer\s+\S+$/i.test(authorization)) {
    throw new DeploymentAuthorizationError("AUTHENTICATION_REQUIRED", "A bearer access token is required.");
  }

  const token = authorization.replace(/^Bearer\s+/i, "");
  let claims;
  try {
    claims = await verifyAccessToken(token, { issuer, audience });
  } catch {
    throw new DeploymentAuthorizationError("TOKEN_INVALID", "The access token could not be verified.");
  }

  const nowSeconds = Math.floor(now / 1000);
  const audiences = typeof claims?.aud === "string" ? [claims.aud] : claims?.aud;
  if (!claims || claims.iss !== issuer || !Array.isArray(audiences) ||
      !audiences.includes(audience) || !Number.isInteger(claims.exp) ||
      claims.exp <= nowSeconds || !nonEmpty(claims.sub) ||
      !nonEmpty(claims.tenant_id) || !stringArray(claims.application_ids) ||
      !stringArray(claims.environment_ids) || !stringArray(claims.scopes)) {
    throw new DeploymentAuthorizationError("TOKEN_CLAIMS_INVALID", "Verified token claims do not grant a valid DEPLOY principal.");
  }

  const principal = Object.freeze({
    subject: claims.sub,
    tenantId: claims.tenant_id,
    applicationIds: Object.freeze([...new Set(claims.application_ids)]),
    environmentIds: Object.freeze([...new Set(claims.environment_ids)]),
    scopes: Object.freeze([...new Set(claims.scopes)]),
    expiresAt: claims.exp
  });
  trustedPrincipals.add(principal);
  return principal;
}

/**
 * Authorize one deployment resource against the verified principal.
 * The resource scope is checked server-side; caller-supplied tenant IDs never
 * become authority. Actions: read, mutate, approve.
 */
export function authorizeDeploymentAccess(principal, resource, action) {
  if (!principal || !trustedPrincipals.has(principal)) {
    throw new DeploymentAuthorizationError("PRINCIPAL_UNTRUSTED", "A verified server-side principal is required.");
  }
  if (!resource || !nonEmpty(resource.tenantId) || !nonEmpty(resource.applicationId) ||
      !nonEmpty(resource.environmentId)) {
    throw new DeploymentAuthorizationError("RESOURCE_SCOPE_REQUIRED", "Tenant, application and environment scope are required.");
  }
  if (resource.tenantId !== principal.tenantId) {
    throw new DeploymentAuthorizationError("TENANT_FORBIDDEN", "The principal cannot access another tenant.");
  }
  if (!principal.applicationIds.includes(resource.applicationId)) {
    throw new DeploymentAuthorizationError("APPLICATION_FORBIDDEN", "The principal cannot access this application.");
  }
  if (!principal.environmentIds.includes(resource.environmentId)) {
    throw new DeploymentAuthorizationError("ENVIRONMENT_FORBIDDEN", "The principal cannot access this environment.");
  }

  const requiredScope = {
    read: "deploy:read",
    mutate: "deploy:write",
    approve: "deploy:approve"
  }[action];
  if (!requiredScope) {
    throw new DeploymentAuthorizationError("ACTION_INVALID", "The requested deployment action is not supported.");
  }
  if (!principal.scopes.includes(requiredScope) && !principal.scopes.includes("deploy:admin")) {
    throw new DeploymentAuthorizationError("SCOPE_FORBIDDEN", "The principal lacks the required deployment action scope.");
  }
  return true;
}
