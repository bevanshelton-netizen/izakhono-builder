import net from "node:net";

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".test"];

function isPrivateIpv4(host) {
  if (net.isIP(host) !== 4) return false;
  const octets = host.split(".").map(Number);
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224;
}

/**
 * Validate a URL before browser navigation.
 * Public navigation requires HTTPS. HTTP is allowed only for explicitly
 * enabled loopback fixtures. DNS resolution/pinning is still required at
 * the eventual network adapter to prevent DNS rebinding.
 */
export function validateBrowserUrl(input, { allowLocalFixtures = false } = {}) {
  if (typeof input !== "string" || input.length === 0 || input.length > 2048) {
    return { ok: false, reason: "invalid_url_input" };
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "malformed_url" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "unsupported_protocol" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "embedded_credentials" };
  }
  if (!url.hostname) return { ok: false, reason: "missing_hostname" };

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const isIp = net.isIP(host);
  const isLoopback = host === "localhost" || host === "::1" ||
    (isIp === 4 && host.startsWith("127."));
  const blockedSuffix = host === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some(suffix => host.endsWith(suffix));

  if (isLoopback) {
    if (allowLocalFixtures && url.protocol === "http:") {
      return { ok: true, url: url.href, origin: url.origin, fixture: true };
    }
    return { ok: false, reason: "loopback_blocked" };
  }
  if (blockedSuffix) return { ok: false, reason: "non_public_hostname" };
  if (isIp === 4 && isPrivateIpv4(host)) {
    return { ok: false, reason: "private_ip_blocked" };
  }
  if (isIp === 6) return { ok: false, reason: "ipv6_literal_blocked" };
  if (url.protocol !== "https:") return { ok: false, reason: "https_required" };

  return { ok: true, url: url.href, origin: url.origin, fixture: false };
}

/** Redirects are constrained to the exact origin approved for the task. */
export function validateBrowserRedirect(currentUrl, targetUrl, options = {}) {
  const current = validateBrowserUrl(currentUrl, options);
  if (!current.ok) return { ok: false, reason: "invalid_current_url" };
  const target = validateBrowserUrl(targetUrl, options);
  if (!target.ok) return target;
  if (current.origin !== target.origin) {
    return { ok: false, reason: "cross_origin_redirect_blocked" };
  }
  return target;
}

/** Explicit allow-list for the read-only POC task interface. */
export function validateReadOnlyBrowserTask(task) {
  if (!task || typeof task !== "object" || Array.isArray(task)) {
    return { ok: false, reason: "invalid_task" };
  }
  const allowedKeys = new Set(["type", "url", "maxPages", "timeoutMs"]);
  if (Object.keys(task).some(key => !allowedKeys.has(key))) {
    return { ok: false, reason: "unknown_task_field" };
  }
  if (task.type !== "navigate" && task.type !== "extract_text") {
    return { ok: false, reason: "unsupported_task_type" };
  }
  if (typeof task.url !== "string") return { ok: false, reason: "missing_task_url" };
  if (task.maxPages !== undefined &&
      (!Number.isInteger(task.maxPages) || task.maxPages < 1 || task.maxPages > 5)) {
    return { ok: false, reason: "page_limit_out_of_range" };
  }
  if (task.timeoutMs !== undefined &&
      (!Number.isInteger(task.timeoutMs) || task.timeoutMs < 1000 || task.timeoutMs > 30000)) {
    return { ok: false, reason: "timeout_out_of_range" };
  }
  return { ok: true };
}
