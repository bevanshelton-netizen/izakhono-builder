import type {
  VoiceStreamAuthorization,
  VoiceStreamSession,
  VoiceStreamSessionFactory,
} from "./twilio-media-stream-bridge";

export interface GptLiveSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onMessage(handler: (data: string) => void): () => void;
  onClose(handler: () => void): () => void;
  onError(handler: (error: unknown) => void): () => void;
}

export interface GptLiveSocketConnector {
  /** The host runtime performs the WebSocket handshake with these server-only headers. */
  connect(url: string, headers: Record<string, string>): Promise<GptLiveSocket>;
}

export interface GptLiveVoiceConfig {
  apiKey: string;
  model?: string;
  voice?: string;
  instructions?: string;
  instructionsForCall?: (authorization: VoiceStreamAuthorization) => Promise<string>;
  startupTimeoutMs?: number;
  closeTimeoutMs?: number;
  onEvent?: (tenantId: string, event: Record<string, unknown>) => void;
  onUsage?: (tenantId: string, usage: unknown, authorization: VoiceStreamAuthorization) => void;
}

const LIVE_SOCKET_URL = "wss://api.openai.com/v1/live/sessions";

function decodeBase64(value: string): Uint8Array {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function encodeBase64(value: Uint8Array): string {
  let raw = "";
  for (let index = 0; index < value.length; index += 0x8000) {
    raw += String.fromCharCode(...value.subarray(index, index + 0x8000));
  }
  return btoa(raw);
}

function waitFor<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`GPT-Live ${label} timed out`)), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * GPT-Live adapter for Twilio Media Streams. Both ends support G.711 μ-law
 * at 8 kHz, so audio passes through without resampling or PCM conversion.
 * The host supplies the socket connector to keep runtime and provider concerns
 * separate and to avoid committing credentials or a fixed WebSocket library.
 */
export class GptLiveVoiceStreamSessionFactory implements VoiceStreamSessionFactory {
  private readonly startupTimeoutMs: number;
  private readonly closeTimeoutMs: number;

  constructor(
    private readonly config: GptLiveVoiceConfig,
    private readonly connector: GptLiveSocketConnector,
  ) {
    if (!config.apiKey.trim()) throw new Error("GPT-Live API key is required at runtime");
    if (!config.instructions?.trim() && !config.instructionsForCall) throw new Error("GPT-Live instructions or a per-call instruction resolver is required");
    this.startupTimeoutMs = config.startupTimeoutMs ?? 15_000;
    this.closeTimeoutMs = config.closeTimeoutMs ?? 15_000;
  }

  async create(input: {
    callSid: string;
    streamSid: string;
    authorization: VoiceStreamAuthorization;
    customParameters: Record<string, string>;
    sendAudio: (frame: Uint8Array) => void;
    sendMark: (name: string) => void;
    onError: (error: unknown) => void;
  }): Promise<VoiceStreamSession> {
    const instructions = this.config.instructionsForCall
      ? await this.config.instructionsForCall(input.authorization)
      : this.config.instructions;
    if (!instructions?.trim()) throw new Error("Resolved GPT-Live instructions must not be empty");
    const sessionConfig = { ...this.config, instructions };
    const socket = await this.connector.connect(LIVE_SOCKET_URL, {
      authorization: `Bearer ${this.config.apiKey}`,
    });
    const session = new GptLiveVoiceStreamSession(
      socket,
      input.authorization,
      input.sendAudio,
      input.onError,
      sessionConfig,
      this.closeTimeoutMs,
    );
    try {
      await waitFor(session.start(), this.startupTimeoutMs, "session startup");
      return session;
    } catch (error) {
      session.abort("GPT-Live session startup failed");
      throw error;
    }
  }
}

class GptLiveVoiceStreamSession implements VoiceStreamSession {
  private readyResolve!: () => void;
  private readyReject!: (error: Error) => void;
  private closedResolve!: () => void;
  private closedReject!: (error: Error) => void;
  private readonly ready: Promise<void>;
  private readonly finalized: Promise<void>;
  private readonly unsubscribe: Array<() => void> = [];
  private started = false;
  private closing = false;
  private closed = false;
  private eventSequence = 0;

  constructor(
    private readonly socket: GptLiveSocket,
    private readonly authorization: VoiceStreamAuthorization,
    private readonly sendAudio: (frame: Uint8Array) => void,
    private readonly onError: (error: unknown) => void,
    private readonly config: GptLiveVoiceConfig,
    private readonly closeTimeoutMs: number,
  ) {
    this.ready = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.finalized = new Promise<void>((resolve, reject) => {
      this.closedResolve = resolve;
      this.closedReject = reject;
    });
    this.unsubscribe.push(
      socket.onMessage(data => this.handleMessage(data)),
      socket.onClose(() => this.handleSocketClose()),
      socket.onError(error => this.handleSocketError(error)),
    );
  }

  start(): Promise<void> {
    this.send({
      type: "session.start",
      event_id: this.nextEventId("start"),
      session: {
        model: this.config.model ?? "gpt-live-1",
        instructions: this.config.instructions,
        audio: {
          format: { type: "audio/pcmu", rate: 8000 },
          output: { voice: this.config.voice ?? "marin" },
        },
      },
    });
    return this.ready;
  }

  receiveAudio(frame: Uint8Array): void {
    if (!this.started || this.closing || this.closed) throw new Error("GPT-Live session is not accepting audio");
    if (!(frame instanceof Uint8Array) || frame.byteLength === 0) throw new Error("Audio frame must not be empty");
    this.send({
      type: "session.input_audio.append",
      event_id: this.nextEventId("input"),
      audio: encodeBase64(frame),
    });
  }

  async close(reason = "Call ended"): Promise<void> {
    if (this.closed) return;
    if (!this.started) {
      this.abort(reason);
      return;
    }
    if (!this.closing) {
      this.closing = true;
      this.send({ type: "session.close", event_id: this.nextEventId("close") });
    }
    try {
      await waitFor(this.finalized, this.closeTimeoutMs, "session finalization");
    } finally {
      this.closed = true;
      this.cleanup();
      this.socket.close(1000, reason.slice(0, 120));
    }
  }

  abort(reason: string): void {
    if (this.closed) return;
    this.closed = true;
    this.cleanup();
    this.socket.close(1011, reason.slice(0, 120));
    this.closedResolve();
  }

  private handleMessage(raw: string): void {
    let event: Record<string, any>;
    try {
      event = JSON.parse(raw) as Record<string, any>;
    } catch {
      this.fail(new Error("GPT-Live returned a malformed event"));
      return;
    }
    if (event.type === "session.started") {
      if (this.started) return;
      this.started = true;
      this.readyResolve();
      return;
    }
    if (event.type === "session.output_audio.delta") {
      if (typeof event.delta !== "string") {
        this.fail(new Error("GPT-Live output audio event is missing its delta"));
        return;
      }
      try {
        this.sendAudio(decodeBase64(event.delta));
      } catch (error) {
        this.fail(error);
      }
      return;
    }
    if (event.type === "session.closed") {
      this.closed = true;
      try {
        this.config.onUsage?.(this.authorization.tenantId, event.usage, this.authorization);
      } catch (error) {
        this.onError(error);
      }
      this.closedResolve();
      this.cleanup();
      this.socket.close(1000, "GPT-Live session finalized");
      return;
    }
    if (event.type === "error") {
      const detail = event.error?.message ?? "GPT-Live session error";
      this.fail(new Error(String(detail)));
      return;
    }
    if (typeof event.type === "string" && (
      event.type.includes("transcript") ||
      event.type === "response.event" ||
      event.type === "session.updated"
    )) {
      try {
        this.config.onEvent?.(this.authorization.tenantId, event);
      } catch (error) {
        this.onError(error);
      }
    }
  }

  private handleSocketClose(): void {
    if (this.closed) return;
    const error = new Error("GPT-Live WebSocket closed before session finalization");
    if (!this.started) this.readyReject(error);
    if (this.closing) this.closedReject(error);
    else {
      this.onError(error);
      this.closedResolve();
    }
    this.closed = true;
    this.cleanup();
  }

  private handleSocketError(error: unknown): void {
    this.fail(error);
  }

  private fail(error: unknown): void {
    if (this.closed) return;
    if (!this.started) this.readyReject(error instanceof Error ? error : new Error(String(error)));
    this.onError(error);
    this.closed = true;
    if (this.closing) this.closedReject(error instanceof Error ? error : new Error(String(error)));
    else this.closedResolve();
    this.cleanup();
    this.socket.close(1011, "GPT-Live session error");
  }

  private send(event: Record<string, unknown>): void {
    if (this.closed) throw new Error("GPT-Live socket is closed");
    this.socket.send(JSON.stringify(event));
  }

  private nextEventId(kind: string): string {
    this.eventSequence += 1;
    return `izakhono_${kind}_${this.eventSequence}`;
  }

  private cleanup(): void {
    while (this.unsubscribe.length) this.unsubscribe.pop()?.();
  }
}
