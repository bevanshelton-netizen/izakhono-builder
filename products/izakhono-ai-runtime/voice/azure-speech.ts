import type { TextToSpeechAdapter, VoiceStyle } from "./voice-profiles.js";

export interface AzureSpeechConfig {
  subscriptionKey: string;
  region: string;
  /** Server-only map from IZAKHONO logical voice keys to Azure voice names. */
  voices: Readonly<Record<string, { name: string; locale: string; pitch?: string }>>;
  fetchImpl?: typeof fetch;
}

const escapeXml = (value: string): string => value
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const SAFE_REGION = /^[a-z0-9-]+$/i;
const SAFE_VOICE = /^[A-Za-z0-9-]{3,80}$/;
const SAFE_LOCALE = /^[a-z]{2,3}-[A-Z]{2}$/;
const SAFE_PITCH = /^[+-]?(?:\d{1,2}|\d{1,2}%)$/;

export class AzureSpeechAdapter implements TextToSpeechAdapter {
  readonly provider = "azure-speech";
  private readonly fetcher: typeof fetch;

  constructor(private readonly config: AzureSpeechConfig) {
    if (!config.subscriptionKey.trim()) throw new Error("speech-provider-not-configured");
    if (!SAFE_REGION.test(config.region)) throw new Error("speech-region-invalid");
    if (!Object.keys(config.voices).length) throw new Error("speech-voice-map-empty");
    this.fetcher = config.fetchImpl ?? fetch;
  }

  async synthesize(input: {
    text: string; voiceKey: string; locale: string; speechRate: number;
    style: VoiceStyle; signal?: AbortSignal;
  }): Promise<{ audio: Uint8Array; contentType: string }> {
    if (!input.text.trim() || input.text.length > 5000) throw new Error("speech-text-invalid");
    const voice = this.config.voices[input.voiceKey];
    if (!voice || !SAFE_VOICE.test(voice.name) || !SAFE_LOCALE.test(voice.locale)) {
      throw new Error("speech-voice-not-configured");
    }
    if (input.locale !== voice.locale) {
      throw new Error("speech-locale-voice-mismatch");
    }
    const rate = Math.max(0.8, Math.min(1.2, input.speechRate));
    const ratePercent = Math.round((rate - 1) * 100);
    const pitch = voice.pitch && SAFE_PITCH.test(voice.pitch) ? voice.pitch : "0%";
    const ssml = `<speak version="1.0" xml:lang="${voice.locale}"><voice name="${voice.name}"><prosody rate="${ratePercent >= 0 ? "+" : ""}${ratePercent}%" pitch="${pitch}">${escapeXml(input.text)}</prosody></voice></speak>`;
    const response = await this.fetcher(
      `https://${this.config.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "IZAKHONO-Voice-Engine",
        },
        body: ssml,
        signal: input.signal,
      },
    );
    if (!response.ok) {
      // Do not leak provider response bodies, keys or account details to callers.
      throw new Error(`speech-provider-failed:${response.status}`);
    }
    const contentType = response.headers.get("content-type") ?? "audio/mpeg";
    if (!contentType.startsWith("audio/")) throw new Error("speech-provider-invalid-content");
    return { audio: new Uint8Array(await response.arrayBuffer()), contentType };
  }
}
