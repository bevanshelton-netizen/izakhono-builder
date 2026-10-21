import crypto from "node:crypto";

const USER_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function normalizeAddress(address) {
  const value = String(address ?? "").trim().toLowerCase();
  const parts = value.split("@");
  if (parts.length !== 2 || !USER_RE.test(parts[0]) || !DOMAIN_RE.test(parts[1])) {
    throw new Error(`Invalid email address: ${address}`);
  }
  return `${parts[0]}@${parts[1]}`;
}

export function buildMailboxPlan({
  address,
  displayName = "",
  quotaMb = 2048,
  aliases = [],
  status = "PROVISIONING"
}) {
  const primary = normalizeAddress(address);
  if (!Number.isInteger(quotaMb) || quotaMb < 256 || quotaMb > 1048576) {
    throw new Error("quotaMb must be an integer between 256 and 1048576");
  }

  const normalizedAliases = [...new Set(aliases.map(normalizeAddress))]
    .filter((alias) => alias !== primary);

  return {
    version: 1,
    mailboxId: crypto.randomUUID(),
    address: primary,
    displayName: String(displayName).trim().slice(0, 120),
    quotaMb,
    aliases: normalizedAliases,
    status,
    auth: {
      passwordProvisioned: false,
      resetRequired: true
    },
    policy: {
      smtpSubmission: true,
      imapAccess: true,
      webmailAccess: true,
      forwardingAllowed: false,
      externalAutoForwardAllowed: false
    },
    audit: {
      createdAt: new Date().toISOString(),
      source: "izakhono-mail-host-builder"
    }
  };
}

export function buildProvisioningPlan(options) {
  const mailbox = buildMailboxPlan(options);
  const domain = mailbox.address.split("@")[1];
  const local = mailbox.address.split("@")[0];

  return {
    kind: "IZAKHONO_MAILBOX_PROVISIONING_PLAN",
    version: 1,
    domain,
    mailbox,
    steps: [
      "ensure-domain-authority",
      "ensure-mx-route",
      "ensure-spf",
      "ensure-dkim",
      "ensure-dmarc",
      "create-mailbox",
      "create-aliases",
      "enable-imap",
      "enable-smtp-submission",
      "enable-webmail",
      "run-send-receive-verification",
      "mark-live-only-after-verification"
    ],
    identity: `${local}@${domain}`
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [address, displayName = ""] = process.argv.slice(2);
  if (!address) {
    console.error("Usage: node mailbox-builder.mjs <address> [display name]");
    process.exit(2);
  }
  console.log(JSON.stringify(buildProvisioningPlan({ address, displayName }), null, 2));
}
