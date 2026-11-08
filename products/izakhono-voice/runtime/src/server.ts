import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import { GptLiveVoiceStreamSessionFactory } from "../../src/gpt-live-session-factory.js";
import { TwilioMediaStreamBridge } from "../../src/twilio-media-stream-bridge.js";
import { NodeGptLiveSocketConnector } from "./node-gpt-live-connector.js";
import { verifyTwilioWebSocketHandshake } from "./twilio-websocket-security.js";
import type { VoiceRuntimeAdapterModule } from "./runtime-contract.js";

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing required runtime environment variable: ${key}`);
  return value;
}

const env = process.env;
const host = env.IZAKHONO_VOICE_HOST ?? "127.0.0.1";
const port = Number(env.IZAKHONO_VOICE_PORT ?? "8962");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("IZAKHONO_VOICE_PORT must be a valid TCP port");

const canonicalPublicUrl = required(env, "IZAKHONO_TWILIO_MEDIA_PUBLIC_URL");
const twilioAuthToken = required(env, "IZAKHONO_TWILIO_AUTH_TOKEN");
const openAiApiKey = required(env, "OPENAI_API_KEY");
const adapterPath = required(env, "IZAKHONO_VOICE_RUNTIME_ADAPTER");
const adapterUrl = pathToFileURL(resolve(adapterPath)).href;
const adapter = await import(adapterUrl) as VoiceRuntimeAdapterModule;
const dependencies = await adapter.createVoiceRuntimeDependencies(env);
if (!dependencies?.callRegistry?.authorizeStart || !dependencies.instructionsForCall) {
  throw new Error("Runtime adapter must provide a durable call registry and tenant-scoped instructions");
}

const sessions = new GptLiveVoiceStreamSessionFactory({
  apiKey: openAiApiKey,
  model: env.IZAKHONO_GPT_LIVE_MODEL ?? "gpt-live-1",
  voice: env.IZAKHONO_GPT_LIVE_VOICE ?? "marin",
  instructions: "You are an IZAKHONO VOICE call session. Follow the tenant policy supplied for this call.",
  onUsage: (tenantId, usage) => {
    // The call/tenant association is resolved by the registry before a session exists.
    // Durable attribution is completed through the audit/usage adapter after stream close.
    void dependencies.audit?.({ tenantId, callId: "resolved-at-call-start", event: "gpt_live_usage", details: usage });
  },
}, new NodeGptLiveSocketConnector());

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify({ ok: true, service: "izakhono-voice-runtime", status: "ready" }));
    return;
  }
  response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ error: "not_found" }));
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: false });

server.on("upgrade", (request, socket, head) => {
  const valid = verifyTwilioWebSocketHandshake({
    method: request.method ?? "",
    requestUrl: request.url ?? "",
    signature: request.headers["x-twilio-signature"],
    canonicalPublicUrl,
    authToken: twilioAuthToken,
  });
  if (!valid) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (websocket) => {
    wss.emit("connection", websocket, request);
  });
});

wss.on("connection", (websocket: WebSocket) => {
  const bridge = new TwilioMediaStreamBridge({
    socket: {
      get readyState() { return websocket.readyState; },
      send(data) { if (websocket.readyState === WebSocket.OPEN) websocket.send(data); },
      close(code, reason) { websocket.close(code, reason); },
    },
    sessions,
    authorizeStart: input => dependencies.callRegistry.authorizeStart(input),
    onError: error => {
      // Avoid logging payloads, credentials, caller audio, or raw provider events.
      console.error("IZAKHONO VOICE stream failed", error instanceof Error ? error.message : "unknown_error");
    },
  });

  websocket.on("message", data => {
    void bridge.handleMessage(data.toString("utf8"));
  });
  websocket.on("close", () => { void bridge.close("Twilio WebSocket closed"); });
  websocket.on("error", () => { void bridge.close("Twilio WebSocket error"); });
});

server.listen(port, host, () => {
  console.log(`IZAKHONO VOICE runtime listening on ${host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    wss.clients.forEach(client => client.close(1001, "Runtime shutting down"));
    setTimeout(() => process.exit(0), 5_000).unref();
  });
}
