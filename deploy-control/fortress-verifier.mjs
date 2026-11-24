import { createVerifiedAccessToken } from "./authorization.mjs";

/**
 * Verify a DEPLOY token through FORTRESS's internal introspection endpoint.
 * FORTRESS validates the JWT and the live D1 parent-session/capability row in
 * one operation; the returned claims are marked with a process-local trust token.
 */
export function createFortressAccessTokenVerifier({
  introspectionUrl,
  introspectionSecret,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5000
} = {}) {
  if (typeof introspectionUrl !== "string" || !introspectionUrl.trim() ||
      typeof introspectionSecret !== "string" || Buffer.byteLength(introspectionSecret) < 32 ||
      typeof fetchImpl !== "function" || !Number.isInteger(timeoutMs) ||
      timeoutMs < 100 || timeoutMs > 15000) {
    throw new TypeError("FORTRESS DEPLOY introspection configuration is invalid.");
  }
  const endpoint = new URL(introspectionUrl);
  if ((endpoint.protocol !== "https:" &&
       !(endpoint.protocol === "http:" && ["127.0.0.1", "localhost"].includes(endpoint.hostname))) ||
      !endpoint.pathname.endsWith("/api/fortress/deploy-token/introspect") ||
      endpoint.username || endpoint.password) {
    throw new TypeError("FORTRESS introspection must use the HTTPS deploy-token introspection endpoint.");
  }

  return async function verifyFortressDeployToken(token) {
    if (typeof token !== "string" || token.length < 20 || token.length > 8192) return null;
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "x-fortress-internal-secret": introspectionSecret,
          accept: "application/json"
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (response.status === 401) return null;
      if (!response.ok) {
        const error = new Error("FORTRESS introspection service is unavailable.");
        error.code = "IDENTITY_VERIFIER_UNAVAILABLE";
        throw error;
      }
      let result;
      try { result = await response.json(); }
      catch {
        const error = new Error("FORTRESS introspection returned invalid JSON.");
        error.code = "IDENTITY_VERIFIER_UNAVAILABLE";
        throw error;
      }
      if (result?.valid !== true) return null;
      if (result?.sessionActive !== true || !result.claims ||
          typeof result.claims !== "object" || Array.isArray(result.claims)) {
        const error = new Error("FORTRESS introspection response is incomplete.");
        error.code = "IDENTITY_VERIFIER_UNAVAILABLE";
        throw error;
      }
      return createVerifiedAccessToken(result.claims, { sessionActive: true });
    } catch (error) {
      if (error?.code === "IDENTITY_VERIFIER_UNAVAILABLE") throw error;
      const unavailable = new Error("FORTRESS introspection request failed.");
      unavailable.code = "IDENTITY_VERIFIER_UNAVAILABLE";
      throw unavailable;
    }
  };
}
