import {
  validateBrowserRedirect,
  validateBrowserUrl,
  validateReadOnlyBrowserTask
} from "./url-policy.mjs";

const DEFAULT_MAX_BYTES = 256 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function extractVisibleText(html) {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  ).replace(/[\t\r ]+/g, " ").replace(/ *\n */g, "\n").trim();
}

async function readBoundedBody(response, maxBytes) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("response_too_large");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("response_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(joined);
}

/**
 * Minimal read-only HTTP adapter for local fixture testing.
 * This is not a Chromium controller. Public network access remains disabled
 * by default; a production adapter must add DNS resolution/pinning and
 * network-level egress enforcement before enabling public destinations.
 */
export function createReadOnlyBrowserAdapter({
  allowLocalFixtures = false,
  maxBytes = DEFAULT_MAX_BYTES,
  maxRedirects = DEFAULT_MAX_REDIRECTS,
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation required");
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 2 * 1024 * 1024) {
    throw new RangeError("maxBytes must be between 1 and 2097152");
  }
  if (!Number.isInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > 3) {
    throw new RangeError("maxRedirects must be between 0 and 3");
  }

  return Object.freeze({
    async run(task) {
      const contract = validateReadOnlyBrowserTask(task);
      if (!contract.ok) return { ok: false, reason: contract.reason };
      const initial = validateBrowserUrl(task.url, { allowLocalFixtures });
      if (!initial.ok) return { ok: false, reason: initial.reason };

      const controller = new AbortController();
      const timeoutMs = task.timeoutMs ?? 10000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let currentUrl = initial.url;
      let redirects = 0;

      try {
        while (true) {
          let response;
          try {
            response = await fetchImpl(currentUrl, {
              method: "GET",
              redirect: "manual",
              signal: controller.signal,
              headers: { accept: "text/html,text/plain;q=0.9" }
            });
          } catch (error) {
            if (controller.signal.aborted) return { ok: false, reason: "task_timeout" };
            return { ok: false, reason: "navigation_failed" };
          }

          if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get("location");
            if (!location || redirects >= maxRedirects) {
              return { ok: false, reason: "redirect_limit_or_location" };
            }
            const target = new URL(location, currentUrl).href;
            const checked = validateBrowserRedirect(currentUrl, target, { allowLocalFixtures });
            if (!checked.ok) return { ok: false, reason: checked.reason };
            currentUrl = checked.url;
            redirects += 1;
            continue;
          }

          if (!response.ok) return { ok: false, reason: "http_error", status: response.status };
          const contentType = (response.headers.get("content-type") || "").toLowerCase();
          if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
            return { ok: false, reason: "unsupported_content_type" };
          }

          let body;
          try {
            body = await readBoundedBody(response, maxBytes);
          } catch (error) {
            return { ok: false, reason: error.message === "response_too_large"
              ? "response_too_large" : "response_read_failed" };
          }

          const title = contentType.includes("text/html")
            ? (body.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] || "")
                .replace(/<[^>]+>/g, "").trim()
            : "";
          return {
            ok: true,
            mode: "read_only_http_fixture",
            method: "GET",
            url: currentUrl,
            status: response.status,
            redirects,
            title: decodeEntities(title),
            text: contentType.includes("text/html") ? extractVisibleText(body) : body.trim(),
            bytes: new TextEncoder().encode(body).byteLength
          };
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  });
}
