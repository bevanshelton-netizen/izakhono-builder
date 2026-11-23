/**
 * Server-side DEPLOY authorization boundary.
 *
 * This is a policy boundary, not a production verifier. The injected JWT verifier
 * must validate signature/algorithm, issuer and audience. The separate live-session
 * callback must validate JTI, subject, tenant, expiry and revocation at FORTRESS.
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
const DEFAULT_MAX_TOKEN_LIFETIME_SECONDS = 600;

/**
 * Authenticate a DEPLOY bearer token through owner-approved adapters.
 * verifyActiveSession must perform a live, fail-closed JTI lookup; it is not
 * interchangeable with JWT signature verification or a cached role check.
 */
export async function authenticateDeploymentRequest({
  authorization,
  verifyAccessToken,
  verifyActiveSession,
  issuer,
  audience,
  now = Date.now(),
  maxTokenLifetimeSeconds = DEFAULT_MAX_TOKEN_LIFETIME_SECONDS
} = {}) {
  if (typeof verifyAccessToken !== "function" || typeof verifyActiveSession !== "function" ||
      !nonEmpty(issuer) || !nonEmpty(audience) ||
      !Number.isInteger(maxTokenLifetimeSeconds) || maxTokenLifetimeSeconds < 1 ||
      maxTokenLifetimeSeconds > DEFAULT_MAX_TOKEN_LIFETIME_SECONDS) {
    throw new DeploymentAuthorizationError("AUTH_CONFIG_INVALID", "Trusted DEPLOY identity and live-session verification are not configured.");
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
      !audiences.includes(audience) || !Number.isInteger(claims.iat) ||
      !Number.isInteger(claims.nbf) || !Number.isInteger(claims.exp) ||
      claims.iat > nowSeconds || claims.nbf > nowSeconds || claims.exp <= nowSeconds ||
      claims.exp <= claims.iat || claims.exp - claims.iat > maxTokenLifetimeSeconds ||
      !nonEmpty(claims.jti) || !nonEmpty(claims.sub) || !nonEmpty(claims.tenant_id) ||
      !stringArray(claims.application_ids) || !stringArray(claims.environment_ids) ||
      !stringArray(claims.scopes)) {
    throw new DeploymentAuthorizationError("TOKEN_CLAIMS_INVALID", "Verified token claims do not grant a valid DEPLOY principal.");
  }

  let session;
  try {
    session = await verifyActiveSession({
      jti: claims.jti,
      subject: claims.sub,
      tenantId: claims.tenant_id,
      expiresAt: claims.exp,
      issuer,
      audience
    });
  } catch {
    throw new DeploymentAuthorizationError("SESSION_VERIFICATION_UNAVAILABLE", "The live identity session could not be verified.");
  }
  if (!session || session.active !== true || session.jti !== claims.jti ||
      session.subject !== claims.sub || session.tenantId !== claims.tenant_id ||
      !Number.isInteger(session.expiresAt) || session.expiresAt <= nowSeconds ||
      session.expiresAt < claims.exp) {
    throw new DeploymentAuthorizationError("SESSION_INVALID", "The token session is inactive, revoked, expired or does not match its principal.");
  }

  const principal = Object.freeze({
    subject: claims.sub,
    tenantId: claims.tenant_id,
    applicationIds: Object.freeze([...new Set(claims.application_ids)]),
    environmentIds: Object.freeze([...new Set(claims.environment_ids)]),
    scopes: Object.freeze([...new Set(claims.scopes)]),
    tokenId: claims.jti,
    issuedAt: claims.iat,
    expiresAt: claims.exp
  });
  trustedPrincipals.add(principal);
  return principal;
}

/** Authorize one deployment resource against a verified, live-session principal. */
export function authorizeDeploymentAccess(principal, resource, action) {
  if (!principal || !trustedPrincipals.has(principal)) {
    throw new DeploymentAuthorizationError("PRINCIPAL_UNTRUSTED", "A verified server-side principal is required.");
  }
  if (principal.expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new DeploymentAuthorizationError("PRINCIPAL_EXPIRED", "The authenticated principal has expired.");
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
  const requiredScope = { read: "deploy:read", mutate: "deploy:write", approve: "deploy:approve" }[action];
  if (!requiredScope) {
    throw new DeploymentAuthorizationError("ACTION_INVALID", "The requested deployment action is not supported.");
  }
  if (!principal.scopes.includes(requiredScope) && !principal.scopes.includes("deploy:admin")) {
    throw new DeploymentAuthorizationError("SCOPE_FORBIDDEN", "The principal lacks the required deployment action scope.");
  }
  return true;
}
