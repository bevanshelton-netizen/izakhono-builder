import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGINS = (Deno.env.get("FORTRESS_ALLOWED_ORIGINS") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const json = (body: unknown, status = 200, origin?: string | null) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...(origin && ALLOWED_ORIGINS.includes(origin) ? { "access-control-allow-origin": origin, "vary": "Origin" } : {}),
  },
});

function b64urlDecode(value: string): Uint8Array {
  const normal = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normal + "=".repeat((4 - normal.length % 4) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}
function b64Decode(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function getJwtClaims(jwt: string): Record<string, unknown> {
  try { return JSON.parse(new TextDecoder().decode(b64urlDecode(jwt.split(".")[1]))); }
  catch { return {}; }
}
function getSessionId(jwt: string): string | null {
  const id = getJwtClaims(jwt).session_id;
  return typeof id === "string" ? id : null;
}
function hasStepUp(jwt: string): boolean {
  return getJwtClaims(jwt).aal === "aal2";
}
async function fingerprint(spki: string): Promise<string> {
  const bytes = b64Decode(spki);
  if (bytes.length < 64 || bytes.length > 2048) throw new Error("Invalid public key");
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}
async function verifyProof(spki: string, challenge: string, signature: string): Promise<boolean> {
  const keyBytes = b64Decode(spki);
  const sigBytes = b64Decode(signature);
  if (sigBytes.length !== 64) return false; // ECDSA P-256 raw r||s encoding
  const key = await crypto.subtle.importKey("spki", keyBytes, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, sigBytes, new TextEncoder().encode(challenge));
}
async function authenticate(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return { error: "Authentication required" } as const;
  const token = match[1];
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { error: "Invalid or expired session" } as const;
  const sessionId = getSessionId(token);
  if (!sessionId) return { error: "Session identifier missing" } as const;
  const { data: active, error: sessionError } = await admin.rpc("fortress_auth_session_is_active", {
    p_user_id: data.user.id,
    p_session_id: sessionId,
  });
  if (sessionError || active !== true) return { error: "Session is no longer active" } as const;
  return { user: data.user, token, sessionId } as const;
}
async function audit(userId: string, deviceId: string | null, eventType: string, outcome: string, metadata: Record<string, unknown> = {}) {
  await admin.from("fortress_security_audit").insert({
    user_id: userId, device_id: deviceId, event_type: eventType, outcome, metadata,
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ error: "Origin not permitted" }, 403);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-max-age": "600",
      ...(origin ? { "access-control-allow-origin": origin, "vary": "Origin" } : {}),
    }});
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > 16384) return json({ error: "Request too large" }, 413, origin);

  try {
    const auth = await authenticate(req);
    if ("error" in auth) return json({ error: auth.error }, 401, origin);
    const raw = await req.text();
    if (raw.length > 16384) return json({ error: "Request too large" }, 413, origin);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400, origin); }
    const action = body.action;

    if (action === "challenge") {
      if (!hasStepUp(auth.token)) return json({ error: "Step-up authentication required (AAL2)" }, 403, origin);
      const { count: recentChallenges, error: rateError } = await admin.from("fortress_device_challenges")
        .select("id", { count: "exact", head: true }).eq("user_id", auth.user.id)
        .eq("auth_session_id", auth.sessionId).gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
      if (rateError) throw rateError;
      if ((recentChallenges ?? 0) >= 5) return json({ error: "Device enrolment rate limit reached" }, 429, origin);
      const spki = typeof body.publicKeySpki === "string" ? body.publicKeySpki : "";
      const platform = typeof body.platform === "string" ? body.platform : "other";
      if (!["android", "ios", "web", "other"].includes(platform)) return json({ error: "Unsupported platform" }, 400, origin);
      const keyFingerprint = await fingerprint(spki);
      const challengeBytes = crypto.getRandomValues(new Uint8Array(32));
      const challenge = btoa(String.fromCharCode(...challengeBytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      const challengeHash = toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(challenge))));
      const { data, error } = await admin.from("fortress_device_challenges").insert({
        user_id: auth.user.id, auth_session_id: auth.sessionId, key_fingerprint: keyFingerprint,
        challenge_hash: challengeHash, expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      }).select("id, expires_at").single();
      if (error) throw error;
      return json({ challengeId: data.id, challenge, expiresAt: data.expires_at, algorithm: "ECDSA_P256_SHA256", signatureEncoding: "raw-rs-64-byte" }, 200, origin);
    }

    if (action === "register") {
      if (!hasStepUp(auth.token)) return json({ error: "Step-up authentication required (AAL2)" }, 403, origin);
      const challengeId = String(body.challengeId ?? "");
      const challenge = String(body.challenge ?? "");
      const signature = String(body.signature ?? "");
      const spki = String(body.publicKeySpki ?? "");
      const platform = String(body.platform ?? "other");
      const deviceLabel = typeof body.deviceLabel === "string" ? body.deviceLabel.slice(0, 80) : null;
      if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !challenge || !signature || !spki) return json({ error: "Registration fields missing" }, 400, origin);
      if (!["android", "ios", "web", "other"].includes(platform)) return json({ error: "Unsupported platform" }, 400, origin);
      const keyFingerprint = await fingerprint(spki);
      const challengeHash = toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(challenge))));
      const { data: pending, error: pendingError } = await admin.from("fortress_device_challenges")
        .select("id, key_fingerprint, auth_session_id, expires_at, consumed_at")
        .eq("id", challengeId).eq("user_id", auth.user.id).maybeSingle();
      if (pendingError || !pending || pending.consumed_at || pending.expires_at <= new Date().toISOString()
        || pending.auth_session_id !== auth.sessionId || pending.key_fingerprint !== keyFingerprint) {
        return json({ error: "Challenge invalid, expired or already used" }, 409, origin);
      }
      const { data: stored } = await admin.from("fortress_device_challenges").select("challenge_hash").eq("id", challengeId).single();
      if (!stored || stored.challenge_hash !== challengeHash) return json({ error: "Challenge verification failed" }, 401, origin);
      if (!(await verifyProof(spki, challenge, signature))) return json({ error: "Device key proof failed" }, 401, origin);

      const { data: consumed, error: consumeError } = await admin.from("fortress_device_challenges")
        .update({ consumed_at: new Date().toISOString() }).eq("id", challengeId).eq("user_id", auth.user.id)
        .is("consumed_at", null).gt("expires_at", new Date().toISOString()).select("id").maybeSingle();
      if (consumeError || !consumed) return json({ error: "Challenge already consumed" }, 409, origin);

      const { data: device, error: deviceError } = await admin.from("fortress_device_registry").insert({
        user_id: auth.user.id, key_fingerprint: keyFingerprint, public_key_spki: spki,
        device_label: deviceLabel, platform, status: "active",
      }).select("id, status, platform, device_label, registered_at").single();
      if (deviceError) {
        await audit(auth.user.id, null, "device_registration", "failed", { reason: "device_insert_failed" });
        return json({ error: "Device registration could not be completed" }, 409, origin);
      }
      const { error: linkError } = await admin.from("fortress_device_sessions").insert({
        user_id: auth.user.id, device_id: device.id, auth_session_id: auth.sessionId,
      });
      if (linkError) {
        await admin.from("fortress_device_registry").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", device.id);
        throw linkError;
      }
      await audit(auth.user.id, device.id, "device_registration", "completed", { platform });
      return json({ device }, 201, origin);
    }

    if (action === "verify_session") {
      const { data: link, error: linkError } = await admin.from("fortress_device_sessions")
        .select("id, device_id, revoked_at").eq("user_id", auth.user.id).eq("auth_session_id", auth.sessionId).maybeSingle();
      if (linkError || !link || link.revoked_at) return json({ allowed: false, reason: "device_session_not_registered" }, 403, origin);
      const { data: device, error: deviceError } = await admin.from("fortress_device_registry")
        .select("id, status, platform, device_label, last_seen_at").eq("id", link.device_id).eq("user_id", auth.user.id).maybeSingle();
      if (deviceError || !device || device.status !== "active") return json({ allowed: false, reason: "device_not_active" }, 403, origin);
      await admin.from("fortress_device_sessions").update({ last_validated_at: new Date().toISOString() }).eq("id", link.id);
      await admin.from("fortress_device_registry").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
      return json({ allowed: true, device }, 200, origin);
    }

    if (action === "list_devices") {
      const { data, error } = await admin.from("fortress_device_registry")
        .select("id, device_label, platform, status, registered_at, last_seen_at, revoked_at")
        .eq("user_id", auth.user.id).order("registered_at", { ascending: false });
      if (error) throw error;
      return json({ devices: data ?? [] }, 200, origin);
    }

    if (action === "revoke_device") {
      if (!hasStepUp(auth.token)) return json({ error: "Step-up authentication required (AAL2)" }, 403, origin);
      const deviceId = String(body.deviceId ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(deviceId)) return json({ error: "Valid deviceId required" }, 400, origin);
      const now = new Date().toISOString();
      const { data, error } = await admin.from("fortress_device_registry").update({ status: "revoked", revoked_at: now })
        .eq("id", deviceId).eq("user_id", auth.user.id).neq("status", "revoked")
        .select("id").maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Device not found or already revoked" }, 404, origin);
      await admin.from("fortress_device_sessions").update({ revoked_at: now }).eq("device_id", deviceId).eq("user_id", auth.user.id).is("revoked_at", null);
      await audit(auth.user.id, deviceId, "device_revocation", "completed", { enforcement: "fortress_session_gate" });
      return json({ revoked: true, deviceId, note: "Protected services must enforce verify_session; Supabase access tokens remain valid until expiry unless Auth sessions are separately signed out." }, 200, origin);
    }

    if (action === "revoke_all_devices") {
      if (!hasStepUp(auth.token)) return json({ error: "Step-up authentication required (AAL2)" }, 403, origin);
      const now = new Date().toISOString();
      await admin.from("fortress_device_registry").update({ status: "revoked", revoked_at: now }).eq("user_id", auth.user.id).neq("status", "revoked");
      await admin.from("fortress_device_sessions").update({ revoked_at: now }).eq("user_id", auth.user.id).is("revoked_at", null);
      const signOut = await admin.auth.admin.signOut(auth.token, "global");
      await audit(auth.user.id, null, "all_devices_revocation", signOut.error ? "failed" : "completed", { auth_global_signout: !signOut.error });
      if (signOut.error) return json({ revoked: true, authSessionsRevoked: false, warning: "FORTRESS device access has been revoked, but Auth global sign-out failed. Existing JWTs may remain valid until expiry." }, 202, origin);
      return json({ revoked: true, authSessionsRevoked: true }, 200, origin);
    }

    return json({ error: "Unsupported action" }, 400, origin);
  } catch (_error) {
    return json({ error: "Security operation failed" }, 500, origin);
  }
});
