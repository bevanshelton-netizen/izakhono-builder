/**
 * IZAKHONO MAIL — DKIM signing boundary.
 * Uses the Node crypto primitive; key material is injected at runtime and is
 * never stored in source control. The signer deliberately stays transport
 * agnostic so NODE01 can sign before any local or fallback transport.
 */
import crypto from "node:crypto";

function canonicalBody(body) {
  return String(body ?? "").replace(/\r?\n/g, "\r\n").replace(/(?:\r\n)+$/, "\r\n") || "\r\n";
}

function canonicalHeaderValue(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim().replace(/\s+/g, " ");
}

function bodyHash(body) {
  return crypto.createHash("sha256").update(canonicalBody(body), "utf8").digest("base64");
}

export function createDkimSigner({ domain, selector, privateKey, headers = ["from", "to", "subject", "date", "message-id"] } = {}) {
  if (!domain || !selector || !privateKey) throw new Error("DKIM_SIGNER_CONFIGURATION_REQUIRED");
  const signingHeaders = headers.map(h => String(h).toLowerCase()).filter(Boolean);
  return {
    sign({ body = "", headerMap = {} } = {}) {
      const normalized = {};
      for (const [name, value] of Object.entries(headerMap)) normalized[name.toLowerCase()] = canonicalHeaderValue(value);
      const hList = signingHeaders.filter(name => normalized[name] !== undefined);
      const bh = bodyHash(body);
      const unsigned = `v=1; a=rsa-sha256; c=relaxed/relaxed; d=${domain}; s=${selector}; h=${hList.join(":")}; bh=${bh}; b=`;
      const signingInput = [
        ...hList.map(name => `${name}:${normalized[name]}`),
        `dkim-signature:${unsigned}`,
      ].join("\r\n");
      const signature = crypto.createSign("RSA-SHA256").update(signingInput, "utf8").sign(privateKey, "base64");
      return `DKIM-Signature: ${unsigned}${signature}`;
    },
    bodyHash,
  };
}
