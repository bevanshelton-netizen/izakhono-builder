/**
 * FORTRESS device/session policy primitives.
 * These functions enforce policy decisions only; cryptographic verification,
 * persistence, token issuance and platform attestation belong to trusted adapters.
 */
export const DEVICE_STATES = Object.freeze(["pending","active","revoked","blocked"]);
export const SESSION_STATES = Object.freeze(["active","revoked","expired"]);
const ALLOWED_SCOPES = new Set(["profile:read","profile:write","contacts:read","contacts:write","channel:join","channel:manage","message:send","location:share","emergency:create","emergency:read:self","device:manage:self"]);

export function evaluateDeviceRegistration(input = {}) {
  const failures = [];
  if (input.accountStatus !== "active") failures.push("account_not_active");
  if (input.challengeVerified !== true) failures.push("challenge_not_verified");
  if (input.deviceKeyProofVerified !== true) failures.push("device_key_proof_not_verified");
  if (input.attestationRequired === true && input.attestationVerified !== true) failures.push("attestation_not_verified");
  if (input.userConfirmationRequired === true && input.userConfirmed !== true) failures.push("user_confirmation_missing");
  if (typeof input.devicePublicKeyFingerprint !== "string" || !/^[a-f0-9]{32,128}$/i.test(input.devicePublicKeyFingerprint)) failures.push("invalid_device_key_fingerprint");
  return Object.freeze({ allowed: failures.length === 0, state: failures.length === 0 ? "active" : "pending", failures });
}

export function evaluateSessionAccess(input = {}) {
  const reasons = [];
  if (input.accountStatus !== "active") reasons.push("account_not_active");
  if (input.deviceState !== "active") reasons.push("device_not_active");
  if (input.sessionState !== "active") reasons.push("session_not_active");
  if (typeof input.expiresAt !== "number" || !Number.isFinite(input.now) || input.expiresAt <= input.now) reasons.push("session_expired");
  if (input.sessionAuthEpoch !== input.currentAuthEpoch) reasons.push("session_auth_epoch_stale");
  if (input.stepUpRequired === true && input.stepUpVerified !== true) reasons.push("step_up_required");
  if (input.riskDecision !== undefined && input.riskDecision !== "allow") reasons.push("risk_policy_denied");
  const requested = Array.isArray(input.requiredScopes) ? input.requiredScopes : [];
  const granted = new Set(Array.isArray(input.grantedScopes) ? input.grantedScopes : []);
  for (const scope of requested) {
    if (!ALLOWED_SCOPES.has(scope) || !granted.has(scope)) reasons.push("scope_denied:" + String(scope));
  }
  return Object.freeze({ allowed: reasons.length === 0, reasons });
}

export function canRevokeDevice(input = {}) {
  if (input.actorAccountId !== input.ownerAccountId && input.actorRole !== "security_admin") return Object.freeze({ allowed: false, reason: "not_authorised" });
  if (input.deviceState === "revoked") return Object.freeze({ allowed: true, idempotent: true });
  if (!DEVICE_STATES.includes(input.deviceState)) return Object.freeze({ allowed: false, reason: "unknown_device_state" });
  if (input.deviceState === "blocked" && input.actorRole !== "security_admin") return Object.freeze({ allowed: false, reason: "admin_required" });
  return Object.freeze({ allowed: true, idempotent: false });
}

export function sessionRevocationPlan(input = {}) {
  if (typeof input.accountId !== "string" || !input.accountId.trim()) throw new Error("accountId is required");
  if (typeof input.reason !== "string" || !input.reason.trim()) throw new Error("revocation reason is required");
  const scope = input.deviceId ? "device" : "all";
  return Object.freeze({ accountId: input.accountId, deviceId: input.deviceId ?? null, scope, revokeRefreshTokens: true, incrementAuthEpoch: true, requireReauthentication: true, reason: input.reason, initiatedAt: typeof input.initiatedAt === "string" ? input.initiatedAt : null });
}
