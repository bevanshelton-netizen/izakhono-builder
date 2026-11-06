import { TwilioMediaStreamBridge, type VoiceStreamSessionFactory } from "./twilio-media-stream-bridge";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const sent: string[] = [];
const received: Uint8Array[] = [];
let closed = false;
let outbound: ((frame: Uint8Array) => void) | undefined;
let dtmf = "";
const factory: VoiceStreamSessionFactory = {
  async create(input) {
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
  socket, sessions: factory,
  onDtmf(_callSid, digit) { dtmf = digit; },
});
await bridge.handleMessage(JSON.stringify({ event: "connected" }));
await bridge.handleMessage(JSON.stringify({
  event: "start",
  start: {
    callSid: "CA_TEST",
    streamSid: "MZ_TEST",
    customParameters: { tenant: "test" },
    mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
  },
}));
await bridge.handleMessage(JSON.stringify({
  event: "media", streamSid: "MZ_TEST",
  media: { track: "inbound", payload: btoa(String.fromCharCode(1, 2, 3)) },
}));
assert(received.length === 1 && received[0][2] === 3, "Inbound μ-law frame was not delivered");
outbound?.(new Uint8Array([4, 5, 6]));
const media = JSON.parse(sent[0]);
assert(media.event === "media" && media.streamSid === "MZ_TEST", "Outbound media envelope is invalid");
assert(atob(media.media.payload) === String.fromCharCode(4, 5, 6), "Outbound audio payload was corrupted");
await bridge.handleMessage(JSON.stringify({ event: "dtmf", streamSid: "MZ_TEST", dtmf: { digit: "5" } }));
assert(dtmf === "5", "DTMF event was not forwarded");
await bridge.handleMessage(JSON.stringify({ event: "stop", streamSid: "MZ_TEST" }));
assert(closed, "Voice session was not closed on stream stop");
console.log("IZAKHONO VOICE Twilio media bridge tests passed");
