export type IdentityContext = {
  userId: string;
  entityId: string;
  entitySlug: string;
  membershipId: string;
  sessionId: string;
  role: string;
  expiresAt: string;
};

export type IdentityAuthResult =
  | { ok: true; context: IdentityContext }
  | { ok: false; status: 401 | 503; error: string };

const USER_ID = /^usr_[0-9a-f]{32}$/i;
const ENTITY_ID = /^ent_[0-9a-f]{32}$/i;
const MEMBERSHIP_ID = /^mem_[0-9a-f]{32}$/i;

export function parseIdentityIntrospection(
  value: unknown,
  now = Date.now(),
): IdentityContext | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.ok !== true || v.active !== true) return null;

  const userId = typeof v.user_id === "string" ? v.user_id : "";
  const entityId = typeof v.entity_id === "string" ? v.entity_id : "";
  const entitySlug = typeof v.entity_slug === "string" ? v.entity_slug : "";
  const membershipId = typeof v.membership_id === "string" ? v.membership_id : "";
  const sessionId = typeof v.session_id === "string" ? v.session_id : "";
  const role = typeof v.role === "string" ? v.role : "";
  const expiresAt = typeof v.expires_at === "string" ? v.expires_at : "";
  const expiry = Date.parse(expiresAt);

  if (!USER_ID.test(userId) || !ENTITY_ID.test(entityId) ||
      !MEMBERSHIP_ID.test(membershipId) || !entitySlug ||
      !sessionId || sessionId.length > 160 ||
      !/^[a-z][a-z0-9_-]{0,39}$/i.test(role) ||
      !Number.isFinite(expiry) || expiry <= now) return null;

  return { userId, entityId, entitySlug, membershipId, sessionId, role, expiresAt };
}

export function isAllowedOrigin(origin: string | null, allowlist: string[]): boolean {
  if (!origin) return true;
  return allowlist.includes(origin);
}

export function productEntityAllowed(
  rawMap: string,
  productCode: string,
  entityId: string,
): boolean {
  if (!rawMap.trim()) return false;
  try {
    const parsed = JSON.parse(rawMap);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
    const entities = (parsed as Record<string, unknown>)[productCode];
    return Array.isArray(entities) &&
      entities.every((x) => typeof x === "string") &&
      entities.includes(entityId);
  } catch {
    return false;
  }
}

export async function resolveIdentityContext(req: Request): Promise<IdentityAuthResult> {
  const authorization = req.headers.get("authorization") || "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  if (!match) return { ok: false, status: 401, error: "Valid IZAKHONO ID session required." };

  const base = (Deno.env.get("IZAKHONO_ID_INTERNAL_URL") || "").trim();
  const internalKey = Deno.env.get("IZAKHONO_ID_INTERNAL_KEY") || "";
  if (!base || !internalKey) {
    return { ok: false, status: 503, error: "Canonical identity service is not configured." };
  }

  let endpoint: URL;
  try {
    endpoint = new URL("/api/v1/internal/introspect", base);
  } catch {
    return { ok: false, status: 503, error: "Canonical identity service configuration is invalid." };
  }
  if (endpoint.protocol !== "https:") {
    return { ok: false, status: 503, error: "Canonical identity service must use HTTPS." };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-izakhono-id-internal-key": internalKey,
      },
      body: JSON.stringify({ token: match[1] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return { ok: false, status: 503, error: "Canonical identity service is unavailable." };
    }

    const payload = await response.json();
    if (payload && typeof payload === "object" &&
        (payload as Record<string, unknown>).active === false) {
      return { ok: false, status: 401, error: "IZAKHONO ID session is inactive or revoked." };
    }

    const context = parseIdentityIntrospection(payload);
    if (!context) {
      return { ok: false, status: 503, error: "Canonical identity response failed validation." };
    }
    return { ok: true, context };
  } catch {
    return { ok: false, status: 503, error: "Canonical identity service is unavailable." };
  }
}
