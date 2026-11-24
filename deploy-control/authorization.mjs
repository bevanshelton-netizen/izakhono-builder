/**
 * Server-side DEPLOY authorization boundary.
 *
 * This is a policy boundary, not a production verifier. The injected JWT verifier
 * must validate signature/algorithm, issuer and audience. The separate live-session
 * callback must validate JTI, subject, tenant, expiry and revocation at FORTRESS.
 */
const trustedPrincipals = new WeakSet();
const verifiedAccessTokens = new WeakSet();

/**
 * Mark claims returned by a trusted identity service that has already verified
 * both the JWT and its live parent session. A token payload cannot forge this
 * process-local WeakSet marker.
 */
export function createVerifiedAccessToken(claims, { sessionActive = false } = {}) {
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) {
    throw new TypeError("Verified access-token claims must be an object.");
  }
  const result = Object.freeze({ claims, sessionActive: sessionActive === true });
  verifiedAccessTokens.add(result);
  return result;
}

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
 * A trusted identity-service verifier may return createVerifiedAccessToken()
 * after checking signature and live session together. Otherwise verifyActiveSession
 * must perform a separate live, fail-closed JTI lookup.
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
  if (typeof verifyAccessToken !== "function" ||
      !nonEmpty(issuer) || !nonEmpty(audience) ||
      !Number.isInteger(maxTokenLifetimeSeconds) || maxTokenLifetimeSeconds < 1 ||
      maxTokenLifetimeSeconds > DEFAULT_MAX_TOKEN_LIFETIME_SECONDS) {
    throw new DeploymentAuthorizationError("AUTH_CONFIG_INVALID", "Trusted DEPLOY identity and live-session verification are not configured.");
  }
  if (!nonEmpty(authorization) || !/^Bearer\s+\S+$/i.test(authorization)) {
    throw new DeploymentAuthorizationError("AUTHENTICATION_REQUIRED", "A bearer access token is required.");
  }

  const token = authorization.replace(/^Bearer\s+/i, "");
  let verification;
  try {
    verification = await verifyAccessToken(token, { issuer, audience });
  } catch (error) {
    if (error?.code === "IDENTITY_VERIFIER_UNAVAILABLE") {
      throw new DeploymentAuthorizationError("SESSION_VERIFICATION_UNAVAILABLE", "FORTRESS identity introspection is unavailable.");
    }
    throw new DeploymentAuthorizationError("TOKEN_INVALID", "The access token could not be verified.");
  }
  const combinedVerification = Boolean(verification && verifiedAccessTokens.has(verification));
  const claims = combinedVerification ? verification.claims : verification;

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

  if (combinedVerification) {
    if (verification.sessionActive !== true) {
      throw new DeploymentAuthorizationError("SESSION_INVALID", "The identity service reports that the token session is inactive or revoked.");
    }
  } else {
    if (typeof verifyActiveSession !== "function") {
      throw new DeploymentAuthorizationError("AUTH_CONFIG_INVALID", "A separate live-session verifier is required for this token verifier.");
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
