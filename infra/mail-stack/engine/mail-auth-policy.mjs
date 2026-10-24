/** IZAKHONO MAIL AUTH POLICY — SPF/DKIM/DMARC decision boundary. */

export const DMARC_MODES = new Set(["none", "quarantine", "reject"]);

export function parseDmarcRecord(record) {
  const text = String(record || "").trim();
  if (!/^v=dmarc1(?:;|$)/i.test(text)) return null;
  const tags = {};
  for (const part of text.split(";").slice(1)) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey || !rawValue.length) continue;
    tags[rawKey.trim().toLowerCase()] = rawValue.join("=").trim();
  }
  const policy = (tags.p || "none").toLowerCase();
  if (!DMARC_MODES.has(policy)) throw new Error("INVALID_DMARC_POLICY");
  return { version: "DMARC1", policy, subdomainPolicy: (tags.sp || policy).toLowerCase(), percentage: Number.isFinite(Number(tags.pct)) ? Number(tags.pct) : 100, tags };
}

export function evaluateAuthentication({ spf = "none", dkim = "none", dmarc = null, fromDomain = null } = {}) {
  const spfPass = String(spf).toLowerCase() === "pass";
  const dkimPass = String(dkim).toLowerCase() === "pass";
  const dmarcPass = dmarc?.pass === true;
  const authenticated = spfPass || dkimPass || dmarcPass;
  const policy = dmarc?.record?.policy || "none";
  const disposition = authenticated ? "accept" : policy === "reject" ? "reject" : policy === "quarantine" ? "quarantine" : "accept";
  return { authenticated, spf: String(spf).toLowerCase(), dkim: String(dkim).toLowerCase(), dmarc: dmarcPass ? "pass" : "fail", fromDomain, policy, disposition };
}

export function shouldRejectAuthentication(result) {
  return result?.disposition === "reject";
}
