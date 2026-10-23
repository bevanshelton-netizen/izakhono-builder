/**
 * IZAKHONO MAIL — NODE01 transport security policy.
 * Secrets and credential storage remain injected by the deployment environment.
 */

export function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+$/.test(email)) {
    throw new Error("INVALID_EMAIL_ADDRESS");
  }
  return email;
}

export function createRecipientPolicy({ localDomains = [], allowRelay = false } = {}) {
  const domains = new Set(localDomains.map(domain => String(domain).trim().toLowerCase()).filter(Boolean));
  return async (recipient, context = {}) => {
    const email = normalizeEmail(recipient);
    const domain = email.slice(email.lastIndexOf("@") + 1);
    if (context.submission && context.authenticated) return true;
    if (allowRelay) return true;
    return domains.has(domain);
  };
}

export function createCredentialAuth(verify) {
  if (typeof verify !== "function") throw new Error("AUTH_VERIFIER_REQUIRED");
  return async (username, password) => {
    const user = normalizeEmail(username);
    if (!password || String(password).length > 1024) return false;
    return Boolean(await verify(user, String(password)));
  };
}

export function createConnectionLimiter({ maxConnections = 100, maxConnectionsPerIp = 20 } = {}) {
  const active = new Map();
  const total = () => [...active.values()].reduce((sum, value) => sum + value, 0);
  return {
    acquire(ip = "unknown") {
      const count = active.get(ip) || 0;
      if (total() >= maxConnections || count >= maxConnectionsPerIp) return false;
      active.set(ip, count + 1);
      return true;
    },
    release(ip = "unknown") {
      const count = active.get(ip) || 0;
      if (count <= 1) active.delete(ip); else active.set(ip, count - 1);
    },
    snapshot() { return { active: total(), clients: Object.fromEntries(active) }; }
  };
}
