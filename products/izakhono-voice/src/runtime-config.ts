export interface IzakhonoVoiceRuntimeConfig {
  telephonyGatewayUrl: string;
  telephonyGatewayApiKey?: string;
  tenantId: string;
  inboundWebhookSecret?: string;
}

/** Loads runtime-only configuration; secrets must come from the deployment secret store. */
export function loadVoiceRuntimeConfig(env: Record<string, string | undefined>): IzakhonoVoiceRuntimeConfig {
  const telephonyGatewayUrl = env.IZAKHONO_VOICE_TELEPHONY_GATEWAY_URL;
  const tenantId = env.IZAKHONO_VOICE_TENANT_ID;

  if (!telephonyGatewayUrl) throw new Error("Missing IZAKHONO_VOICE_TELEPHONY_GATEWAY_URL");
  if (!tenantId) throw new Error("Missing IZAKHONO_VOICE_TENANT_ID");

  return {
    telephonyGatewayUrl,
    telephonyGatewayApiKey: env.IZAKHONO_VOICE_TELEPHONY_GATEWAY_API_KEY,
    tenantId,
    inboundWebhookSecret: env.IZAKHONO_VOICE_INBOUND_WEBHOOK_SECRET,
  };
}
