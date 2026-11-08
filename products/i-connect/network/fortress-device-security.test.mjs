import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDeviceRegistration, evaluateSessionAccess, canRevokeDevice, sessionRevocationPlan } from "./fortress-device-security.mjs";

const fingerprint = "a".repeat(64);
test("device registration requires verified challenge and key proof", () => {
  const good = evaluateDeviceRegistration({accountStatus:"active",challengeVerified:true,deviceKeyProofVerified:true,devicePublicKeyFingerprint:fingerprint});
  assert.equal(good.allowed,true);
  const bad = evaluateDeviceRegistration({accountStatus:"active",challengeVerified:false,deviceKeyProofVerified:true,devicePublicKeyFingerprint:fingerprint});
  assert.equal(bad.allowed,false);
  assert.ok(bad.failures.includes("challenge_not_verified"));
});
test("required platform attestation and user confirmation fail closed", () => {
  const result = evaluateDeviceRegistration({accountStatus:"active",challengeVerified:true,deviceKeyProofVerified:true,devicePublicKeyFingerprint:fingerprint,attestationRequired:true,userConfirmationRequired:true});
  assert.equal(result.allowed,false);
  assert.ok(result.failures.includes("attestation_not_verified"));
  assert.ok(result.failures.includes("user_confirmation_missing"));
});
test("valid session requires active account/device/session and current auth epoch", () => {
  const base = {accountStatus:"active",deviceState:"active",sessionState:"active",expiresAt:2000,now:1000,sessionAuthEpoch:4,currentAuthEpoch:4,grantedScopes:["emergency:create"],requiredScopes:["emergency:create"],riskDecision:"allow"};
  assert.equal(evaluateSessionAccess(base).allowed,true);
  assert.equal(evaluateSessionAccess({...base,deviceState:"revoked"}).allowed,false);
  assert.equal(evaluateSessionAccess({...base,sessionAuthEpoch:3}).allowed,false);
  assert.equal(evaluateSessionAccess({...base,expiresAt:1000}).allowed,false);
});
test("unknown or ungranted scopes are denied", () => {
  const result = evaluateSessionAccess({accountStatus:"active",deviceState:"active",sessionState:"active",expiresAt:2000,now:1000,sessionAuthEpoch:1,currentAuthEpoch:1,grantedScopes:["profile:read"],requiredScopes:["admin:all"]});
  assert.equal(result.allowed,false);
  assert.ok(result.reasons.includes("scope_denied:admin:all"));
});
test("step-up and risk policy are enforced", () => {
  const base = {accountStatus:"active",deviceState:"active",sessionState:"active",expiresAt:2000,now:1000,sessionAuthEpoch:1,currentAuthEpoch:1};
  assert.equal(evaluateSessionAccess({...base,stepUpRequired:true}).allowed,false);
  assert.equal(evaluateSessionAccess({...base,riskDecision:"deny"}).allowed,false);
});
test("device revocation requires owner or security admin", () => {
  assert.equal(canRevokeDevice({actorAccountId:"a",ownerAccountId:"b",actorRole:"user",deviceState:"active"}).allowed,false);
  assert.equal(canRevokeDevice({actorAccountId:"a",ownerAccountId:"a",actorRole:"user",deviceState:"active"}).allowed,true);
  assert.equal(canRevokeDevice({actorAccountId:"x",ownerAccountId:"a",actorRole:"security_admin",deviceState:"active"}).allowed,true);
});
test("revocation plan invalidates refresh tokens and auth epoch", () => {
  const plan = sessionRevocationPlan({accountId:"acct_1",deviceId:"dev_1",reason:"lost_device"});
  assert.equal(plan.scope,"device");
  assert.equal(plan.revokeRefreshTokens,true);
  assert.equal(plan.incrementAuthEpoch,true);
  assert.equal(plan.requireReauthentication,true);
});
