export interface CommunicationsRuntimeConfig {
  runtime: string;
  sipDomain: string;
  sipBindAddress: string;
  sipPublicAddress: string;
  sipTlsEnabled: boolean;
  sipSecretRef: string;
  carrierSecretRef?: string;
  databaseUrl: string;
}

export function loadCommunicationsRuntimeConfig(env: Record<string, string | undefined>): CommunicationsRuntimeConfig {
  const required = (name: string): string => {
    const value = env[name];
    if (!value) throw new Error(`missing_runtime_config:${name}`);
    return value;
  };

  const tls = env.IZAKHONO_SIP_TLS_ENABLED ?? "true";
  if (tls !== "true" && tls !== "false") throw new Error("invalid_runtime_config:IZAKHONO_SIP_TLS_ENABLED");

  return {
    runtime: required("IZAKHONO_COMMUNICATIONS_RUNTIME"),
    sipDomain: required("IZAKHONO_SIP_DOMAIN"),
    sipBindAddress: required("IZAKHONO_SIP_BIND_ADDRESS"),
    sipPublicAddress: required("IZAKHONO_SIP_PUBLIC_ADDRESS"),
    sipTlsEnabled: tls === "true",
    sipSecretRef: required("IZAKHONO_SIP_SECRET_REF"),
    carrierSecretRef: env.IZAKHONO_CARRIER_SECRET_REF,
    databaseUrl: required("IZAKHONO_DATABASE_URL"),
  };
}

/** Prevent accidental credential leakage when logging runtime configuration. */
export function redactCommunicationsRuntimeConfig(config: CommunicationsRuntimeConfig) {
  return {
    ...config,
    sipSecretRef: "[REDACTED]",
    carrierSecretRef: config.carrierSecretRef ? "[REDACTED]" : undefined,
    databaseUrl: "[REDACTED]",
  };
}
