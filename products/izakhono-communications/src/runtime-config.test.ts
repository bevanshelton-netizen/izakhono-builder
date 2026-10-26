import { loadCommunicationsRuntimeConfig, redactCommunicationsRuntimeConfig } from "./runtime-config";

const env = {
  IZAKHONO_COMMUNICATIONS_RUNTIME: "owned-sip",
  IZAKHONO_SIP_DOMAIN: "voice.izakhono.local",
  IZAKHONO_SIP_BIND_ADDRESS: "0.0.0.0",
  IZAKHONO_SIP_PUBLIC_ADDRESS: "198.51.100.10",
  IZAKHONO_SIP_TLS_ENABLED: "true",
  IZAKHONO_SIP_SECRET_REF: "secret://sip/runtime",
  IZAKHONO_CARRIER_SECRET_REF: "secret://carrier/default",
  IZAKHONO_DATABASE_URL: "postgres://private@example.invalid/communications",
};

const config = loadCommunicationsRuntimeConfig(env);
if (!config.sipTlsEnabled) throw new Error("tls_default_failed");
if (config.sipSecretRef !== env.IZAKHONO_SIP_SECRET_REF) throw new Error("secret_ref_failed");

const redacted = redactCommunicationsRuntimeConfig(config);
if (redacted.sipSecretRef !== "[REDACTED]") throw new Error("sip_secret_leak");
if (redacted.carrierSecretRef !== "[REDACTED]") throw new Error("carrier_secret_leak");
if (redacted.databaseUrl !== "[REDACTED]") throw new Error("database_url_leak");

console.log("runtime configuration safety test: PASS");
