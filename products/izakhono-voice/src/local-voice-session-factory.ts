import type {
  VoiceStreamAuthorization,
  VoiceStreamSession,
  VoiceStreamSessionFactory,
} from "./twilio-media-stream-bridge.js";

export interface LocalVoicePipelineConfig {
  speechRecognitionUrl: string;
  speechRecognitionKey: string;
  languageModelUrl: string;
  languageModelName: string;
  instructionsForCall: (authorization: VoiceStreamAuthorization) => Promise<string>;
  speechSynthesisUrl: string;
  speechSynthesisKey: string;
  voice?: string;
  language?: string;
  startupTimeoutMs?: number;
  silenceMs?: number;
  maxUtteranceMs?: number;
  onTranscript?: (tenantId: string, transcript: string) => void;
  onResponse?: (tenantId: string, response: string) => void;
}

const FRAME_BYTES = 160; // 20 ms of mono G.711 μ-law at 8 kHz.
const SAMPLE_RATE = 8000;
const MAX_UTTERANCE_BYTES = SAMPLE_RATE * 2 * 12;
const MULAW_BIAS = 0x84;
const MULAW_CLIP = 32635;

function decodeMulawSample(value: number): number {
  const encoded = (~value) & 0xff;
  let sample = ((encoded & 0x0f) << 3) + MULAW_BIAS;
  sample <<= (encoded & 0x70) >> 4;
  return (encoded & 0x80) ? MULAW_BIAS - sample : sample - MULAW_BIAS;
}

function encodeMulawSample(sample: number): number {
  let pcm = Math.max(-MULAW_CLIP, Math.min(MULAW_CLIP, sample));
  const sign = pcm < 0 ? 0x80 : 0;
  if (pcm < 0) pcm = -pcm;
  pcm += MULAW_BIAS;
  let exponent = 7;
  for (let mask = 0x4000; exponent > 0 && (pcm & mask) === 0; mask >>= 1) exponent--;
  const mantissa = (pcm >> (exponent + 3)) & 0x0f;
  return (~(sign | (exponent << 4) | mantissa)) & 0xff;
}

function wavPcm16(samples: Int16Array, rate: number): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(out.buffer);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) out[offset + i] = value.charCodeAt(i);
  };
  write(0, "RIFF"); view.setUint32(4, 36 + samples.length * 2, true); write(8, "WAVE");
  write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, "data"); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i], true);
  return out;
}

function parsePcmWav(bytes: Uint8Array): { samples: Int16Array; sampleRate: number } {
  if (bytes.length < 44) throw new Error("Speech service returned an incomplete WAV file");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const read = (offset: number) => String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
  if (read(0) !== "RIFF" || read(8) !== "WAVE") throw new Error("Speech service did not return WAV audio");
  let offset = 12, dataOffset = -1, dataSize = 0, sampleRate = 0, channels = 0, bits = 0, format = 0;
  while (offset + 8 <= bytes.length) {
    const id = read(offset), size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + size > bytes.length) throw new Error("Invalid WAV chunk size");
    if (id === "fmt ") { format = view.getUint16(start, true); channels = view.getUint16(start + 2, true); sampleRate = view.getUint32(start + 4, true); bits = view.getUint16(start + 14, true); }
    if (id === "data") { dataOffset = start; dataSize = size; break; }
    offset = start + size + (size % 2);
  }
  if (format !== 1 || channels !== 1 || bits !== 16 || dataOffset < 0 || dataSize % 2) {
    throw new Error("Expected mono PCM16 WAV audio");
  }
  const samples = new Int16Array(dataSize / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(dataOffset + i * 2, true);
  return { samples, sampleRate };
}

function resampleToMulaw(samples: Int16Array, sourceRate: number): Uint8Array {
  if (sourceRate < 8000 || sourceRate > 96000) throw new Error("Unsupported speech output sample rate");
  const count = Math.floor(samples.length * SAMPLE_RATE / sourceRate);
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const position = i * sourceRate / SAMPLE_RATE;
    const left = Math.floor(position), right = Math.min(left + 1, samples.length - 1);
    const fraction = position - left;
    const pcm = samples[left] * (1 - fraction) + samples[right] * fraction;
    out[i] = encodeMulawSample(Math.round(pcm));
  }
  return out;
}

function base64(bytes: Uint8Array): string {
  let raw = "";
  for (let i = 0; i < bytes.length; i += 0x8000) raw += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(raw);
}
function fromBase64(value: string): Uint8Array {
  const raw = atob(value), out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

/**
 * Owned-first turn-based speech pipeline. It deliberately composes the existing
 * IZAKHONO speech runtime with a local ASR service and a self-hosted Ollama API.
 * Twilio's PCMU stream is decoded to PCM16 for recognition and returned to PCMU
 * after local Kokoro synthesis. No external realtime model endpoint is required.
 */
export class LocalVoiceStreamSessionFactory implements VoiceStreamSessionFactory {
  constructor(private readonly config: LocalVoicePipelineConfig) {
    for (const [label, value] of [
      ["speech recognition URL", config.speechRecognitionUrl],
      ["speech recognition key", config.speechRecognitionKey],
      ["language model URL", config.languageModelUrl],
      ["language model name", config.languageModelName],
      ["speech synthesis URL", config.speechSynthesisUrl],
      ["speech synthesis key", config.speechSynthesisKey],
    ] as Array<[string, string]>) if (!value?.trim()) throw new Error("Missing local voice " + label);
  }

  async create(input: {
    callSid: string; streamSid: string; authorization: VoiceStreamAuthorization;
    customParameters: Record<string, string>; sendAudio: (frame: Uint8Array) => void;
    sendMark: (name: string) => void; onError: (error: unknown) => void;
  }): Promise<VoiceStreamSession> {
    const instructions = await this.config.instructionsForCall(input.authorization);
    if (!instructions?.trim()) throw new Error("Tenant voice instructions are required");
    return new LocalVoiceStreamSession(this.config, instructions, input.authorization, input.sendAudio, input.onError);
  }
}

class LocalVoiceStreamSession implements VoiceStreamSession {
  private readonly chunks: Uint8Array[] = [];
  private totalBytes = 0;
  private activeSpeech = false;
  private silenceBytes = 0;
  private processing: Promise<void> = Promise.resolve();
  private closed = false;
  private turn = 0;
  private readonly silenceMs: number;
  private readonly maxUtteranceBytes: number;

  constructor(
    private readonly config: LocalVoicePipelineConfig,
    private readonly instructions: string,
    private readonly authorization: VoiceStreamAuthorization,
    private readonly sendAudio: (frame: Uint8Array) => void,
    private readonly onError: (error: unknown) => void,
  ) {
    this.silenceMs = config.silenceMs ?? 700;
    this.maxUtteranceBytes = Math.min(MAX_UTTERANCE_BYTES / 2, Math.max(8000, Math.floor(SAMPLE_RATE * (config.maxUtteranceMs ?? 12000) / 1000)));
  }

  receiveAudio(frame: Uint8Array): void {
    if (this.closed) throw new Error("Local voice session is closed");
    if (!frame.length || frame.length > 4096) throw new Error("Invalid inbound audio frame");
    let energy = 0;
    for (const byte of frame) energy += Math.abs(decodeMulawSample(byte));
    const average = energy / frame.length;
    if (average > 420) { this.activeSpeech = true; this.silenceBytes = 0; }
    else if (this.activeSpeech) this.silenceBytes += frame.length;
    if (this.activeSpeech) {
      this.chunks.push(frame.slice()); this.totalBytes += frame.length;
    }
    const silenceLimit = Math.floor(SAMPLE_RATE * this.silenceMs / 1000);
    if (this.activeSpeech && (this.silenceBytes >= silenceLimit || this.totalBytes >= this.maxUtteranceBytes)) {
      const utterance = this.takeUtterance();
      this.processing = this.processing.then(() => this.processUtterance(utterance)).catch(error => this.onError(error));
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    if (this.totalBytes >= 1600) {
      const utterance = this.takeUtterance();
      this.processing = this.processing.then(() => this.processUtterance(utterance));
    }
    await this.processing;
    this.closed = true;
  }

  private takeUtterance(): Uint8Array {
    const out = new Uint8Array(this.totalBytes);
    let offset = 0;
    for (const chunk of this.chunks) { out.set(chunk, offset); offset += chunk.length; }
    this.chunks.length = 0; this.totalBytes = 0; this.silenceBytes = 0; this.activeSpeech = false;
    return out;
  }

  private async processUtterance(mulaw: Uint8Array): Promise<void> {
    if (mulaw.length === 0) return;
    const pcm = new Int16Array(mulaw.length);
    for (let i = 0; i < mulaw.length; i++) pcm[i] = decodeMulawSample(mulaw[i]);
    const wav = wavPcm16(pcm, SAMPLE_RATE);
    const asr = await fetchWithTimeout(this.config.speechRecognitionUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-izakhono-speech-key": this.config.speechRecognitionKey },
      body: JSON.stringify({ schema: "izakhono.speech.transcribe.v1", audio_base64: base64(wav), language: this.config.language ?? "en" }),
    }, 20_000);
    if (!asr.ok) throw new Error("Local speech recognition failed: HTTP " + asr.status);
    const asrBody = await asr.json() as { text?: string };
    const transcript = String(asrBody.text ?? "").trim();
    if (!transcript) return;
    this.config.onTranscript?.(this.authorization.tenantId, transcript);
    const response = await fetchWithTimeout(this.config.languageModelUrl.replace(/\/$/, "") + "/api/chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.config.languageModelName, stream: false,
        messages: [
          { role: "system", content: "You are the telephone receptionist for this business. Be warm, concise, accurate and helpful. Never invent prices, availability, policies or promises. If uncertain, take a message or offer a human callback. Business instructions:\n" + this.instructions },
          { role: "user", content: transcript },
        ],
        options: { temperature: 0.3 },
      }),
    }, 30_000);
    if (!response.ok) throw new Error("Local language model failed: HTTP " + response.status);
    const modelBody = await response.json() as { message?: { content?: string } };
    const answer = String(modelBody.message?.content ?? "").trim();
    if (!answer) throw new Error("Local language model returned an empty response");
    this.config.onResponse?.(this.authorization.tenantId, answer);
    const speech = await fetchWithTimeout(this.config.speechSynthesisUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-izakhono-speech-key": this.config.speechSynthesisKey },
      body: JSON.stringify({
        schema: "izakhono.speech.generate.v1", text: answer.slice(0, 1800),
        language: this.config.language ?? "English", voice: this.config.voice ?? "af_heart", format: "wav", speed: 1.0,
      }),
    }, 30_000);
    if (!speech.ok) throw new Error("Local speech synthesis failed: HTTP " + speech.status);
    const speechBody = await speech.json() as { audio?: { data_url?: string; sample_rate?: number } };
    const dataUrl = String(speechBody.audio?.data_url ?? "");
    const match = /^data:audio\/wav;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) throw new Error("Local speech synthesis returned an invalid audio payload");
    const wavOutput = parsePcmWav(fromBase64(match[1]));
    const encoded = resampleToMulaw(wavOutput.samples, wavOutput.sampleRate);
    for (let offset = 0; offset < encoded.length; offset += FRAME_BYTES) {
      const frame = new Uint8Array(FRAME_BYTES);
      frame.fill(0xff);
      frame.set(encoded.subarray(offset, Math.min(offset + FRAME_BYTES, encoded.length)));
      this.sendAudio(frame);
    }
    this.turn++;
  }
}
