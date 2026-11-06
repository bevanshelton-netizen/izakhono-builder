export interface VoiceStreamSession {
  receiveAudio(frame: Uint8Array): Promise<void> | void;
  close(reason?: string): Promise<void> | void;
}

export interface VoiceStreamSessionFactory {
  create(input: { callSid: string; streamSid: string; customParameters: Record<string, string>; sendAudio: (frame: Uint8Array) => void; sendMark: (name: string) => void; onError: (error: unknown) => void }): Promise<VoiceStreamSession>;
}

export interface TwilioMediaSocket { readonly readyState: number; send(data: string): void; close(code?: number, reason?: string): void; }

export interface TwilioMediaBridgeOptions { socket: TwilioMediaSocket; sessions: VoiceStreamSessionFactory; onDtmf?: (callSid: string, digit: string) => void; onMark?: (callSid: string, name: string) => void; onError?: (error: unknown) => void; }

const OPEN = 1;
function decode(value: string): Uint8Array { const raw = atob(value); const bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i); return bytes; }
function encode(value: Uint8Array): string { let raw = ""; for (let i = 0; i < value.length; i += 0x8000) raw += String.fromCharCode(...value.subarray(i, i + 0x8000)); return btoa(raw); }

/** One bridge instance per upgraded WebSocket. Runtime owns upgrade and socket lifecycle. */
export class TwilioMediaStreamBridge {
  private session?: VoiceStreamSession;
  private callSid?: string;
  private streamSid?: string;
  private closed = false;
  private starting = false;
  constructor(private readonly options: TwilioMediaBridgeOptions) {}

  async handleMessage(raw: string): Promise<void> {
    if (this.closed) return;
    try {
      const message = JSON.parse(raw) as any;
      if (message.event === "connected") return;
      if (message.event === "start") { await this.start(message); return; }
      if (message.event === "media") {
        if (!this.session || message.streamSid !== this.streamSid) throw new Error("Media received before stream start or for an unknown stream");
        if (message.media?.track === "inbound") await this.session.receiveAudio(decode(message.media.payload));
        return;
      }
      if (message.event === "mark" && message.streamSid === this.streamSid) this.options.onMark?.(this.callSid!, message.mark?.name ?? "");
      else if (message.event === "dtmf" && message.streamSid === this.streamSid) this.options.onDtmf?.(this.callSid!, message.dtmf?.digit ?? "");
      else if (message.event === "stop") await this.close("Twilio stream stopped");
      else if (!["mark", "dtmf"].includes(message.event)) throw new Error("Unsupported Twilio stream event");
    } catch (error) { this.fail(error); }
  }

  sendAudio(frame: Uint8Array): void { if (!this.session || !this.streamSid || this.closed) throw new Error("Media stream is not active"); this.send({ event: "media", streamSid: this.streamSid, media: { payload: encode(frame) } }); }
  sendMark(name: string): void { if (!this.session || !this.streamSid || this.closed) throw new Error("Media stream is not active"); this.send({ event: "mark", streamSid: this.streamSid, mark: { name } }); }
  async close(reason = "WebSocket closed"): Promise<void> { if (this.closed) return; this.closed = true; const active = this.session; this.session = undefined; if (active) await active.close(reason); }

  private async start(message: any): Promise<void> {
    if (this.callSid || this.starting) throw new Error("Duplicate stream start");
    const format = message.start?.mediaFormat;
    if (!message.start?.callSid || !message.start?.streamSid) throw new Error("Stream start is missing call or stream ID");
    if (format && (format.encoding !== "audio/x-mulaw" || format.sampleRate !== 8000 || format.channels !== 1)) throw new Error("Expected mono G.711 μ-law audio at 8 kHz");
    this.starting = true; this.callSid = message.start.callSid; this.streamSid = message.start.streamSid;
    try {
      const session = await this.options.sessions.create({ callSid: this.callSid, streamSid: this.streamSid, customParameters: message.start.customParameters ?? {}, sendAudio: frame => this.sendAudio(frame), sendMark: name => this.sendMark(name), onError: error => this.fail(error) });
      if (this.closed) await session.close("Socket closed during startup"); else this.session = session;
    } finally { this.starting = false; }
  }
  private send(value: Record<string, unknown>): void { if (this.options.socket.readyState !== OPEN) throw new Error("Media WebSocket is not open"); this.options.socket.send(JSON.stringify(value)); }
  private fail(error: unknown): void { this.options.onError?.(error); void this.close("Media bridge error").catch(() => undefined); if (this.options.socket.readyState === OPEN) this.options.socket.close(1011, "Media bridge error"); }
}
