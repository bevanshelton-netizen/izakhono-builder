function isLoopback(host) {
  return ["127.0.0.1", "::1", "localhost"].includes(String(host || "").toLowerCase());
}

function assertNetworkSafety({ bindHost, tlsEnabled }) {
  if (!isLoopback(bindHost) && !tlsEnabled) {
    throw new Error("refusing_non_loopback_without_tls");
  }
}

function redact(value) {
  if (!value) return null;
  const s = String(value);
  return s.length <= 8 ? "********" : s.slice(0,4) + "…" + s.slice(-4);
}

module.exports = { isLoopback, assertNetworkSafety, redact };
