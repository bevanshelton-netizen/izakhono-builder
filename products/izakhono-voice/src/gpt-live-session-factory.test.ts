import {
  GptLiveVoiceStreamSessionFactory,
  type GptLiveSocket,
  type GptLiveSocketConnector,
} from "./gpt-live-session-factory";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class FakeSocket implements GptLiveSocket {
  sent: Array<Record<string, any>> = [];
  closed = false;
  private messages = new Set<(data: string) => void>();
  private closes = new Set<() => void>();
  private errors = new Set<(error: unknown) => void>();

  send(data: string): void {
    const event = JSON.parse(data);
    this.sent.push(event);
    if (event.type === "session.start") {
      queueMicrotask(() => this.emit({ type: "session.started", session: { id: "live_test" } }));
    }
    if (event.type === "session.close") {
      queueMicrotask(() => this.emit({ type: "session.closed", usage: { duration_seconds: 12 } }));
    }
  }
  close(): void {
    this.closed = true;
    for (const listener of this.closes) listener();
  }
  onMessage(handler: (data: string) => void): () => void {
    this.messages.add(handler);
    return () => this.messages.delete(handler);
  }
  onClose(handler: () => void): () => void {
    this.closes.add(handler);
    return () => this.closes.delete(handler);
  }
  onError(handler: (error: unknown) => void): () => void {
    this.errors.add(handler);
    return () => this.errors.delete(handler);
  }
  emit(event: Record<string, unknown>): void {
    const data = JSON.stringify(event);
    for (const listener of this.messages) listener(data);
  }
}

async function main(): Promise<void> {
  const socket = new FakeSocket();
  let url = "";
  let auth = "";
  let output = new Uint8Array();
  let usageTenant = "";
  const connector: GptLiveSocketConnector = {
    async connect(target, headers) {
      url = target;
      auth = headers.authorization;
      return socket;
    },
  };
  const factory = new GptLiveVoiceStreamSessionFactory({
    apiKey: "runtime-only-test-key",
    instructions: "Be a helpful, concise business receptionist.",
    onUsage(tenantId) { usageTenant = tenantId; },
  }, connector);

  const session = await factory.create({
    callSid: "CA" + "a".repeat(32),
    streamSid: "MZ" + "b".repeat(32),
    authorization: { tenantId: "tenant-7", callId: "call-7" },
    customParameters: {},
    sendAudio(frame) { output = frame; },
    sendMark() {},
    onError(error) { throw error; },
  });

  assert(url === "wss://api.openai.com/v1/live/sessions", "Incorrect GPT-Live endpoint");
  assert(auth === "Bearer runtime-only-test-key", "Server API key was not passed to connector");
  const start = socket.sent[0];
  assert(start.type === "session.start", "Session start was not the first event");
  assert(start.session.audio.format.type === "audio/pcmu" && start.session.audio.format.rate === 8000, "G.711 μ-law pass-through format was not configured");

  session.receiveAudio(new Uint8Array([1, 2, 3]));
  const input = socket.sent.find(event => event.type === "session.input_audio.append");
  assert(input && atob(input.audio) === String.fromCharCode(1, 2, 3), "Inbound audio was not forwarded unchanged");

  socket.emit({ type: "session.output_audio.delta", delta: btoa(String.fromCharCode(4, 5, 6)) });
  assert(output.length === 3 && output[2] === 6, "Generated audio was not forwarded to Twilio");

  await session.close("Test complete");
  assert(socket.sent.some(event => event.type === "session.close"), "Session close event was not sent");
  assert(socket.closed, "GPT-Live socket was not closed after finalization");
  assert(usageTenant === "tenant-7", "Final usage was not attributed to the authorised tenant");
  console.log("IZAKHONO VOICE GPT-Live session adapter tests passed");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
