import { TwilioMediaStreamBridge, type VoiceStreamSessionFactory } from "./twilio-media-stream-bridge";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const sent: string[] = [];
  const received: Uint8Array[] = [];
  let closed = false;
  let outbound: ((frame: Uint8Array) => void) | undefined;
  let dtmf = "";
  let authorizedTenant = "";
  let bridgeError: unknown;
  let releasedStream = "";
  const factory: VoiceStreamSessionFactory = {
    async create(input) {
      authorizedTenant = input.authorization.tenantId;
      outbound = input.sendAudio;
      return {
        receiveAudio(frame) { received.push(frame); },
        close() { closed = true; },
      };
    },
  };
  const socket = {
    readyState: 1,
    send(value: string) { sent.push(value); },
    close() { /* test socket */ },
  };
  const bridge = new TwilioMediaStreamBridge({
    socket,
    sessions: factory,
    async authorizeStart(input) {
      assert(input.callSid === "CA" + "a".repeat(32), "Unexpected provider call ID");
      return { tenantId: "tenant-verified-by-server", callId: "call-internal-42" };
    },
    onDtmf(_callSid, digit) { dtmf = digit; },
    onStreamClosed(input) { releasedStream = input.streamSid; },
    onError(error) { bridgeError = error; },
  });
  await bridge.handleMessage(JSON.stringify({ event: "connected" }));
  await bridge.handleMessage(JSON.stringify({
    event: "start",
    start: {
      callSid: "CA" + "a".repeat(32),
      streamSid: "MZ" + "b".repeat(32),
      customParameters: { tenant: "untrusted-client-value" },
      mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
    },
  }));
  assert(authorizedTenant === "tenant-verified-by-server", "Session did not receive server-authorized tenant");
  await bridge.handleMessage(JSON.stringify({
    event: "media",
    streamSid: "MZ" + "b".repeat(32),
    media: { track: "inbound", payload: btoa(String.fromCharCode(1, 2, 3)) },
  }));
  assert(received.length === 1 && received[0][2] === 3, "Inbound μ-law frame was not delivered");
  outbound?.(new Uint8Array([4, 5, 6]));
  const media = JSON.parse(sent[0]);
  assert(media.event === "media" && media.streamSid === "MZ" + "b".repeat(32), "Outbound media envelope is invalid");
  assert(atob(media.media.payload) === String.fromCharCode(4, 5, 6), "Outbound audio payload was corrupted");
  await bridge.handleMessage(JSON.stringify({ event: "dtmf", streamSid: "MZ" + "b".repeat(32), dtmf: { digit: "5" } }));
  assert(dtmf === "5", "DTMF event was not forwarded");
  await bridge.handleMessage(JSON.stringify({ event: "stop", streamSid: "MZ" + "b".repeat(32) }));
  assert(closed, "Voice session was not closed on stream stop");
  assert(releasedStream === "MZ" + "b".repeat(32), "Durable stream lease was not released on stop");
  assert(!bridgeError, "Valid stream unexpectedly raised an error");

  let rejectedSocketClosed = false;
  const rejectedBridge = new TwilioMediaStreamBridge({
    socket: { readyState: 1, send() {}, close() { rejectedSocketClosed = true; } },
    sessions: factory,
    async authorizeStart() { return null; },
  });
  await rejectedBridge.handleMessage(JSON.stringify({
    event: "start",
    start: {
      callSid: "CA" + "c".repeat(32),
      streamSid: "MZ" + "d".repeat(32),
      customParameters: { tenant: "attacker-controlled" },
      mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
    },
  }));
  assert(rejectedSocketClosed, "Unauthorized call was not rejected");
  console.log("IZAKHONO VOICE Twilio media bridge tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
