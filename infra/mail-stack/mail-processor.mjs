import crypto from "node:crypto";
import { scoreMessage } from "./mail-priority.mjs";

const MAX_MESSAGE_BYTES = 25 * 1024 * 1024;
const MAX_RECIPIENTS = 100;
const normalizeAddress = (value) => String(value || "").trim().toLowerCase();

function address(value) {
  const normalized = normalizeAddress(value);
  const match = normalized.match(/^(?:[^<>]+\s*<)?([^<>\s]+@[^<>\s]+)>?$/);
  return match ? match[1] : normalized;
}

function stableMessageId(message) {
  if (message.messageId) return String(message.messageId);
  const material = [address(message.from), ...(message.to || []).map(address).sort(), String(message.subject || ""), String(message.date || message.receivedAt || ""), String(message.bodyText || "").slice(0, 4096)].join("\n");
  return `izm-${crypto.createHash("sha256").update(material).digest("hex").slice(0, 32)}`;
}

function classify(message) {
  const from = address(message.from);
  const text = `${String(message.subject || "").toLowerCase()}\n${String(message.bodyText || "").toLowerCase()}`;
  const phishing = [/verify\s+(your|the)\s+account/, /urgent(?:ly)?\s+action\s+required/, /password\s+(expires|expired|reset)/, /click\s+(here|the\s+link)\s+to\s+(verify|secure)/, /send\s+(me|us)\s+(your|the)\s+(password|otp|pin)/];
  const malware = [/\.(exe|scr|bat|cmd|com|js|vbs|ps1|jar)(\s|$)/i, /macro\s+enabled/i, /ransomware/i];
  const bulk = [/unsubscribe/i, /newsletter/i, /promotion|promo|special offer/i];
  let risk = "normal", category = "general";
  const reasons = [];
  if (malware.some((rx) => rx.test(text))) { risk = "critical"; category = "malware"; reasons.push("malware indicators"); }
  else if (phishing.some((rx) => rx.test(text))) { risk = "high"; category = "phishing"; reasons.push("phishing indicators"); }
  else if (bulk.some((rx) => rx.test(text))) { risk = "low"; category = "bulk"; reasons.push("bulk/promotional indicators"); }
  return { risk, category, reasons, sender: from };
}

export function processMessage(input, registry) {
  const message = { ...input, from: address(input.from), to: (input.to || []).map(address), cc: (input.cc || []).map(address), bcc: (input.bcc || []).map(address), subject: String(input.subject || "").trim(), bodyText: String(input.bodyText || ""), receivedAt: input.receivedAt || new Date().toISOString() };
  if (!message.from || !message.from.includes("@")) throw new Error("INVALID_SENDER");
  const allRecipients = [...message.to, ...message.cc, ...message.bcc];
  if (!message.to.length) throw new Error("NO_RECIPIENTS");
  if (allRecipients.length > MAX_RECIPIENTS) throw new Error("TOO_MANY_RECIPIENTS");
  if (Number(input.sizeBytes || 0) > MAX_MESSAGE_BYTES) throw new Error("MESSAGE_TOO_LARGE");

  const id = stableMessageId(message);
  const analysis = classify(message);
  const routes = [], unknown = [];
  for (const recipient of allRecipients) {
    const platform = registry.findByAddress?.(recipient);
    if (platform) routes.push({ recipient, platformId: platform.id, mailbox: platform.mailbox || recipient, role: platform.role || "primary" });
    else unknown.push(recipient);
  }

  const priority = scoreMessage(message, analysis, routes);
  const disposition = analysis.risk === "critical" ? "quarantine" : analysis.risk === "high" ? "security-review" : unknown.length ? "unrouted" : "deliver";
  return { id, receivedAt: message.receivedAt, message, analysis, priority, routes, unknownRecipients: unknown, disposition, alert: priority.alert, audit: { processor: "izakhono-mail-processor", version: 3, checks: ["address-normalization", "recipient-policy", "size-policy", "stable-id", "risk-classification", "priority-classification", "routing-policy", "audit-disposition"] } };
}

export function createRegistry(platforms) {
  const map = new Map();
  for (const platform of platforms) {
    const domain = platform.domain || "izakhonoafrica.co.za";
    const identities = platform.addresses || { primary: `${platform.slug}@${domain}`, support: `${platform.slug}-support@${domain}`, partnerships: `${platform.slug}-partners@${domain}`, accounts: `${platform.slug}-accounts@${domain}`, noreply: `noreply-${platform.slug}@${domain}` };
    for (const [role, value] of Object.entries(identities)) {
      const mailbox = address(value);
      if (mailbox) map.set(mailbox, { id: platform.id, mailbox, role });
    }
  }
  return { findByAddress: (value) => map.get(address(value)) || null };
}

export { address, classify, stableMessageId };
