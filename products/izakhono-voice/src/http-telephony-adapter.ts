import type { TelephonyAdapter } from "./types";

export interface TelephonyGatewayConfig {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}

/**
 * Provider-neutral production boundary for a SIP/telephony gateway.
 *
 * The gateway can be backed by any SIP carrier, PBX or telephony provider.
 * IZAKHONO VOICE talks only HTTP to this boundary; provider SDKs stay outside
 * the core runtime. Credentials are supplied at runtime and never committed.
 */
export class HttpTelephonyAdapter implements TelephonyAdapter {
  private readonly timeoutMs: number;

  constructor(private readonly config: TelephonyGatewayConfig) {
    if (!config.baseUrl) throw new Error("Telephony gateway baseUrl is required");
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  async answer(callId: string): Promise<void> {
    await this.command("answer", { callId });
  }

  async dial(phone: string, callId: string): Promise<void> {
    await this.command("dial", { phone, callId });
  }

  async transfer(callId: string, destination: string): Promise<void> {
    await this.command("transfer", { callId, destination });
  }

  async sendSms(phone: string, body: string): Promise<void> {
    await this.command("sms", { phone, body });
  }

  async hangup(callId: string): Promise<void> {
    await this.command("hangup", { callId });
  }

  private async command(action: string, payload: Record<string, string>): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/v1/${action}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Telephony gateway ${action} failed (${response.status}): ${body}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
