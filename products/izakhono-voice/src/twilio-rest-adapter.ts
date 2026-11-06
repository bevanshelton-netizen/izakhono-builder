import type { TelephonyAdapter } from "./types";

export interface TwilioVoiceConfig {
  accountSid: string;
  authToken?: string;
  /** Prefer a restricted API key over the account Auth Token in production. */
  apiKeySid?: string;
  apiKeySecret?: string;
  fromNumber: string;
  voiceWebhookUrl: string;
  statusCallbackUrl: string;
  /** Public wss:// endpoint that bridges Twilio Media Streams to IZAKHONO VOICE. */
  mediaStreamUrl: string;
  timeoutMs?: number;
  apiBaseUrl?: string;
}

type TwilioApiError = { message?: string; code?: number; more_info?: string };

function required(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Missing Twilio configuration: ${name}`);
  return trimmed;
}

function xml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
  })[char] ?? char);
}

/**
 * Twilio's REST adapter implements IZAKHONO's existing TelephonyAdapter.
 * It deliberately uses fetch rather than the vendor SDK so the integration
 * remains small, auditable and replaceable.
 */
export class TwilioRestTelephonyAdapter implements TelephonyAdapter {
  private readonly timeoutMs: number;
  private readonly apiBaseUrl: string;

  constructor(private readonly config: TwilioVoiceConfig) {
    required(config.accountSid, "accountSid");
    if (config.apiKeySid && !config.apiKeySecret) throw new Error("Missing Twilio configuration: apiKeySecret");
    if (!config.apiKeySid && !config.authToken) throw new Error("Configure a Twilio API key pair or account Auth Token");
    required(config.fromNumber, "fromNumber");
    required(config.voiceWebhookUrl, "voiceWebhookUrl");
    required(config.statusCallbackUrl, "statusCallbackUrl");
    required(config.mediaStreamUrl, "mediaStreamUrl");
    if (!/^wss:\/\//i.test(config.mediaStreamUrl)) {
      throw new Error("Twilio mediaStreamUrl must use wss://");
    }
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.apiBaseUrl = (config.apiBaseUrl ?? "https://api.twilio.com/2010-04-01").replace(/\/$/, "");
  }

  /** Replaces the active call instructions with a secure Media Streams bridge. */
  async answer(callId: string): Promise<void> {
    const streamUrl = new URL(this.config.mediaStreamUrl);
    streamUrl.searchParams.set("callId", callId);
    const twiml = `<Response><Connect><Stream url="${xml(streamUrl.toString())}"><Parameter name="callId" value="${xml(callId)}"/></Stream></Connect></Response>`;
    await this.updateCall(callId, { Twiml: twiml });
  }

  async dial(phone: string, callId: string): Promise<void> {
    const to = required(phone, "destination phone number");
    const clientCallId = required(callId, "client call ID");
    const callback = new URL(this.config.statusCallbackUrl);
    callback.searchParams.set("clientCallId", clientCallId);
    await this.request("/Calls.json", {
      To: to,
      From: this.config.fromNumber,
      Url: this.config.voiceWebhookUrl,
      Method: "POST",
      StatusCallback: callback.toString(),
      StatusCallbackMethod: "POST",
      StatusCallbackEvent: "initiated ringing answered completed",
    });
  }

  async transfer(callId: string, destination: string): Promise<void> {
    const target = required(destination, "transfer destination");
    const twiml = `<Response><Dial answerOnBridge="true"><Number>${xml(target)}</Number></Dial></Response>`;
    await this.updateCall(callId, { Twiml: twiml });
  }

  async sendSms(phone: string, body: string): Promise<void> {
    const to = required(phone, "SMS destination");
    if (!body.trim()) throw new Error("SMS body is required");
    await this.request("/Messages.json", { To: to, From: this.config.fromNumber, Body: body });
  }

  async hangup(callId: string): Promise<void> {
    await this.updateCall(callId, { Status: "completed" });
  }

  private async updateCall(callId: string, fields: Record<string, string>): Promise<void> {
    await this.request(`/Calls/${encodeURIComponent(required(callId, "provider call ID"))}.json`, fields);
  }

  private async request(path: string, fields: Record<string, string>): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const username = this.config.apiKeySid ?? this.config.accountSid;
    const password = this.config.apiKeySecret ?? this.config.authToken!;
    const credentials = btoa(`${username}:${password}`);
    try {
      const response = await fetch(`${this.apiBaseUrl}/Accounts/${encodeURIComponent(this.config.accountSid)}${path}`, {
        method: "POST",
        headers: {
          authorization: `Basic ${credentials}`,
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body: new URLSearchParams(fields),
        signal: controller.signal,
      });
      if (!response.ok) {
        let detail = "";
        try {
          const payload = await response.json() as TwilioApiError;
          detail = payload.message ? `: ${payload.message}` : "";
        } catch { /* Do not echo raw provider responses or credentials. */ }
        throw new Error(`Twilio telephony request failed (${response.status})${detail}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
