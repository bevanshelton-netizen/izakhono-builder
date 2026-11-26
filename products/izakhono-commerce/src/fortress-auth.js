const ALLOWED_ADMIN_ROLES = new Set(["OWNER", "SECURITY_ADMIN"]);

export async function resolveCommerceAdmin(request, env) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer ([A-Za-z0-9._~-]{20,8192})$/);
  if (!match || !env.FORTRESS_IDENTITY || typeof env.FORTRESS_IDENTITY.fetch !== "function") {
    return { ok: false, status: 401, code: "fortress_session_required" };
  }
  let response;
  try {
    response = await env.FORTRESS_IDENTITY.fetch(new Request("https://fortress.internal/api/fortress/session", {
      method: "GET",
      headers: { authorization: `Bearer ${match[1]}` }
    }));
  } catch {
    return { ok: false, status: 503, code: "fortress_identity_unavailable" };
  }
  if (!response || response.status !== 200) {
    return { ok: false, status: 401, code: "fortress_session_invalid" };
  }
  let body;
  try { body = await response.json(); } catch {
    return { ok: false, status: 503, code: "fortress_identity_invalid_response" };
  }
  const p = body?.principal;
  if (body?.valid !== true || body?.audience !== "izakhono-commerce" || !p || typeof p.id !== "string" || !p.id.trim() ||
      typeof p.tenantId !== "string" || !p.tenantId.trim() ||
      !ALLOWED_ADMIN_ROLES.has(p.role)) {
    return { ok: false, status: 403, code: "commerce_admin_permission_denied" };
  }
  return { ok: true, principal: { id: p.id, tenantId: p.tenantId, role: p.role } };
}
