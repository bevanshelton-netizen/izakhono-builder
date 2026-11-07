export interface VoiceStreamAuthorization {
  /** Canonical IZAKHONO tenant resolved by the server, never from client input. */
  tenantId: string;
  /** Canonical IZAKHONO call record associated with this provider call. */
  callId: string;
}

export interface VoiceStreamSession {
  receiveAudio(frame: Uint8Array): Promise<void> | void;
  close(reason?: string): Promise<void> | void;
}

export interface VoiceStreamSessionFactory {
  create(input: {
    callSid: string;
    streamSid: string;
    authorization: VoiceStreamAuthorization;
    customParameters: Record<string, string>;
    sendAudio: (frame: Uint8Array) => void;
    sendMark: (name: string) => void;
    onError: (error: unknown) => void;
  }): Promise<VoiceStreamSession>;
}

export interface TwilioMediaSocket {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface TwilioMediaBridgeOptions {
  socket: TwilioMediaSocket;
  sessions: VoiceStreamSessionFactory;
  /** Must look up CallSid in IZAKHONO's server-side call registry and enforce tenant ownership. */
  authorizeStart: (input: {
    callSid: string;
    streamSid: string;
    customParameters: Record<string, string>;
  }) => Promise<VoiceStreamAuthorization | null>;
  maxFrameBytes?: number;
  onDtmf?: (callSid: string, digit: string) => void;
  onMark?: (callSid: string, name: string) => void;
  onError?: (error: unknown) => void;
}

const OPEN = 1;
const DEFAULT_MAX_FRAME_BYTES = 16 * 1024;

function decodeBase64(value: unknown, maxBytes: number): Uint8Array {
  if (typeof value !== "string" || value.length === 0 || value.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error("Invalid base64 media payload");
  }
  const estimatedBytes = (value.length / 4) * 3 - (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0);
  if (estimatedBytes > maxBytes) throw new Error("Media frame exceeds configured size limit");
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function encodeBase64(value: Uint8Array): string {
  let raw = "";
  for (let i = 0; i < value.length; i += 0x8000) {
    raw += String.fromCharCode(...value.subarray(i, i + 0x8000));
  }
  return btoa(raw);
}

/** One bridge instance per authenticated, upgraded WebSocket. Runtime owns upgrade and socket lifecycle. */
export class TwilioMediaStreamBridge {
  private session?: VoiceStreamSession;
  private authorization?: VoiceStreamAuthorization;
  private callSid?: string;
  private streamSid?: string;
  private closed = false;
  private starting = false;
  private readonly maxFrameBytes: number;

  constructor(private readonly options: TwilioMediaBridgeOptions) {
    if (typeof options.authorizeStart !== "function") {
      throw new Error("A server-side call authorization function is required");
    }
    this.maxFrameBytes = options.maxFrameBytes ?? DEFAULT_MAX_FRAME_BYTES;
    if (!Number.isInteger(this.maxFrameBytes) || this.maxFrameBytes < 160 || this.maxFrameBytes > 1024 * 1024) {
      throw new Error("maxFrameBytes must be an integer between 160 and 1048576");
    }
  }

  async handleMessage(raw: string): Promise<void> {
    if (this.closed) return;
    try {
      const message = JSON.parse(raw) as Record<string, any>;
      if (message.event === "connected") return;
      if (message.event === "start") {
        await this.start(message);
        return;
      }
      if (message.event === "media") {
        if (!this.session || message.streamSid !== this.streamSid) {
          throw new Error("Media received before authorized stream start or for an unknown stream");
        }
        if (message.media?.track !== "inbound") throw new Error("Unexpected media track");
        const frame = decodeBase64(message.media.payload, this.maxFrameBytes);
        await this.session.receiveAudio(frame);
        return;
      }
      if (message.event === "mark") {
        this.assertStream(message.streamSid);
        this.options.onMark?.(this.callSid!, String(message.mark?.name ?? ""));
        return;
      }
      if (message.event === "dtmf") {
        this.assertStream(message.streamSid);
        const digit = message.dtmf?.digit;
        if (typeof digit !== "string" || !/^[0-9*#A-D]$/i.test(digit)) throw new Error("Invalid DTMF digit");
        this.options.onDtmf?.(this.callSid!, digit);
        return;
      }
      if (message.event === "stop") {
        this.assertStream(message.streamSid);
        await this.close("Twilio stream stopped");
        return;
      }
      throw new Error("Unsupported Twilio stream event");
    } catch (error) {
      this.fail(error);
    }
  }

  sendAudio(frame: Uint8Array): void {
    this.assertActive();
    if (!(frame instanceof Uint8Array) || frame.byteLength === 0 || frame.byteLength > this.maxFrameBytes) {
      throw new Error("Outbound audio frame is empty or exceeds configured size limit");
    }
    this.send({ event: "media", streamSid: this.streamSid, media: { payload: encodeBase64(frame) } });
  }

  sendMark(name: string): void {
    this.assertActive();
    if (!name || name.length > 128) throw new Error("Mark name must contain 1 to 128 characters");
    this.send({ event: "mark", streamSid: this.streamSid, mark: { name } });
  }

  async close(reason = "WebSocket closed"): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const active = this.session;
    this.session = undefined;
    if (active) await active.close(reason);
  }

  private async start(message: Record<string, any>): Promise<void> {
    if (this.callSid || this.starting) throw new Error("Duplicate stream start");
    const start = message.start;
    if (typeof start?.callSid !== "string" || !/^CA[0-9a-f]{32}$/i.test(start.callSid) ||
        typeof start?.streamSid !== "string" || !/^MZ[0-9a-f]{32}$/i.test(start.streamSid)) {
      throw new Error("Stream start contains invalid Twilio CallSid or StreamSid");
    }
    const format = start.mediaFormat;
    if (!format || format.encoding !== "audio/x-mulaw" || format.sampleRate !== 8000 || format.channels !== 1) {
      throw new Error("Expected mono G.711 μ-law audio at 8 kHz");
    }
    const customParameters = start.customParameters ?? {};
    if (typeof customParameters !== "object" || Array.isArray(customParameters)) {
      throw new Error("Invalid stream custom parameters");
    }
    this.starting = true;
    this.callSid = start.callSid;
    this.streamSid = start.streamSid;
    try {
      const authorization = await this.options.authorizeStart({
        callSid: this.callSid,
        streamSid: this.streamSid,
        customParameters,
      });
      if (!authorization?.tenantId || !authorization.callId) {
        throw new Error("Twilio call is not authorized by the IZAKHONO call registry");
      }
      this.authorization = authorization;
      const session = await this.options.sessions.create({
        callSid: this.callSid,
        streamSid: this.streamSid,
        authorization,
        customParameters,
        sendAudio: frame => this.sendAudio(frame),
        sendMark: name => this.sendMark(name),
        onError: error => this.fail(error),
      });
      if (this.closed) await session.close("Socket closed during startup");
      else this.session = session;
    } finally {
      this.starting = false;
    }
  }

  private assertStream(streamSid: unknown): void {
    if (!this.session || streamSid !== this.streamSid) {
      throw new Error("Event received before authorized stream start or for an unknown stream");
    }
  }

  private assertActive(): void {
    if (!this.session || !this.authorization || !this.streamSid || this.closed) {
      throw new Error("Media stream is not active");
    }
  }

  private send(value: Record<string, unknown>): void {
    if (this.options.socket.readyState !== OPEN) throw new Error("Media WebSocket is not open");
    this.options.socket.send(JSON.stringify(value));
  }

  private fail(error: unknown): void {
    this.options.onError?.(error);
    void this.close("Media bridge error").catch(() => undefined);
    if (this.options.socket.readyState === OPEN) this.options.socket.close(1011, "Media bridge error");
  }
}
