import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { GptLiveVoiceStreamSessionFactory } from "../../src/gpt-live-session-factory.js";
import { TwilioMediaStreamBridge } from "../../src/twilio-media-stream-bridge.js";
import { verifyTwilioWebhook } from "../../src/twilio-webhook-security.js";
import { NodeGptLiveSocketConnector } from "./node-gpt-live-connector.js";
import { verifyTwilioWebSocketHandshake } from "./twilio-websocket-security.js";
import { createVoiceRuntimeDependencies } from "./postgres-runtime-adapter.js";

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
const voiceWebhookPublicUrl = required(env, "IZAKHONO_TWILIO_VOICE_WEBHOOK_PUBLIC_URL");
const statusCallbackPublicUrl = required(env, "IZAKHONO_TWILIO_STATUS_CALLBACK_PUBLIC_URL");
const twilioAccountSid = required(env, "IZAKHONO_TWILIO_ACCOUNT_SID");
for (const value of [voiceWebhookPublicUrl, statusCallbackPublicUrl]) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.search || url.hash || url.username || url.password) {
    throw new Error("Twilio webhook public URLs must be canonical HTTPS URLs without query strings or credentials");
  }
}
const openAiApiKey = required(env, "OPENAI_API_KEY");
const dependencies = await createVoiceRuntimeDependencies(env);
if (!dependencies?.callRegistry?.authorizeStart || !dependencies.instructionsForCall) {
  throw new Error("Runtime adapter must provide a durable call registry and tenant-scoped instructions");
}

const sessions = new GptLiveVoiceStreamSessionFactory({
  apiKey: openAiApiKey,
  model: env.IZAKHONO_GPT_LIVE_MODEL ?? "gpt-live-1",
  voice: env.IZAKHONO_GPT_LIVE_VOICE ?? "marin",
  instructionsForCall: authorization => dependencies.instructionsForCall(authorization),
  onUsage: async (tenantId, usage, authorization) => {
      await dependencies.callRegistry.recordUsage?.({
        tenantId,
        callId: authorization.callId,
        usage,
      });
      await dependencies.audit?.({
        tenantId,
        callId: authorization.callId,
        event: "gpt_live_usage",
        details: usage,
      });
    },
}, new NodeGptLiveSocketConnector());

function xml(value: string): string {
  return value.replace(/[<>&"']/g, char => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
  })[char] ?? char);
}

function reply(response: ServerResponse, status: number, contentType: string, body = ""): void {
  response.writeHead(status, { "content-type": contentType, "cache-control": "no-store" });
  response.end(body);
}

async function readTwilioForm(request: IncomingMessage): Promise<Record<string, string>> {
  const contentType = request.headers["content-type"]?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded") throw new Error("Unsupported webhook content type");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 16 * 1024) throw new Error("Webhook body exceeds size limit");
    chunks.push(buffer);
  }
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString("utf8")).entries());
}

async function verifyFormWebhook(
  request: IncomingMessage,
  params: Record<string, string>,
  publicUrl: string,
): Promise<boolean> {
  const configured = new URL(publicUrl);
  if (request.url !== configured.pathname + configured.search) return false;
  const signature = request.headers["x-twilio-signature"];
  return verifyTwilioWebhook({
    authToken: twilioAuthToken,
    signature: typeof signature === "string" ? signature : null,
    publicUrl,
    params,
  });
}

async function handleHttpRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method === "GET" && request.url === "/health") {
    reply(response, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true, service: "izakhono-voice-runtime", status: "ready" }));
    return;
  }

  const voiceWebhookPath = new URL(voiceWebhookPublicUrl).pathname;
  const incomingRequestUrl = new URL(request.url ?? "/", "http://runtime.invalid");
  if (request.method === "POST" && incomingRequestUrl.pathname === voiceWebhookPath) {
    let params: Record<string, string>;
    try { params = await readTwilioForm(request); } catch {
      reply(response, 400, "application/json; charset=utf-8", JSON.stringify({ error: "invalid_request" }));
      return;
    }

    const callSid = params.CallSid ?? "";
    if (!/^CA[0-9a-f]{32}$/i.test(callSid) || params.AccountSid !== twilioAccountSid) {
      reply(response, 400, "application/json; charset=utf-8", JSON.stringify({ error: "invalid_call" }));
      return;
    }

    const outboundIds = incomingRequestUrl.searchParams.getAll("callId");
    const isOutbound = outboundIds.length === 1 && incomingRequestUrl.searchParams.size === 1;
    let signedVoiceUrl = voiceWebhookPublicUrl;
    let callId: string;
    let tenantId: string | null;

    if (isOutbound) {
      callId = outboundIds[0];
      if (!/^[0-9a-f-]{36}$/i.test(callId)) {
        reply(response, 400, "application/json; charset=utf-8", JSON.stringify({ error: "invalid_call_reference" }));
        return;
      }
      const canonical = new URL(voiceWebhookPublicUrl);
      canonical.searchParams.set("callId", callId);
      signedVoiceUrl = canonical.toString();
    } else {
      callId = "";
      if (incomingRequestUrl.search) {
        reply(response, 400, "application/json; charset=utf-8", JSON.stringify({ error: "invalid_webhook_query" }));
        return;
      }
    }

    if (!await verifyFormWebhook(request, params, signedVoiceUrl)) {
      reply(response, 401, "application/json; charset=utf-8", JSON.stringify({ error: "unauthorized" }));
      return;
    }

    const to = params.To ?? "";
    if (!isOutbound && !/^\+[1-9][0-9]{7,14}$/.test(to)) {
      reply(response, 400, "application/json; charset=utf-8", JSON.stringify({ error: "invalid_destination_number" }));
      return;
    }

    try {
      if (isOutbound) {
        tenantId = await dependencies.callRegistry.bindProviderCall(callId, callSid);
        if (!tenantId) {
          reply(response, 404, "application/json; charset=utf-8", JSON.stringify({ error: "outbound_call_not_registered" }));
          return;
        }
      } else {
        tenantId = await dependencies.callRegistry.resolveTenantForInboundNumber(to);
        if (!tenantId) {
          reply(response, 404, "application/json; charset=utf-8", JSON.stringify({ error: "number_not_configured" }));
          return;
        }
        callId = randomUUID();
        await dependencies.callRegistry.registerCall({
          callId, tenantId, providerCallSid: callSid, direction: "inbound", status: "ringing",
        });
      }

      const streamToken = await dependencies.callRegistry.issueStreamCredential(callSid);
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${xml(canonicalPublicUrl)}"><Parameter name="callId" value="${xml(callId)}"/><Parameter name="streamToken" value="${xml(streamToken)}"/></Stream></Connect></Response>`;
      reply(response, 200, "application/xml; charset=utf-8", twiml);
    } catch (error) {
      console.error("IZAKHONO VOICE call provisioning failed", error instanceof Error ? error.message : "unknown_error");
      reply(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: "call_setup_failed" }));
    }
    return;
  }

  if (request.method === "POST" && request.url === new URL(statusCallbackPublicUrl).pathname) {
    let params: Record<string, string>;
    try { params = await readTwilioForm(request); } catch {
      reply(response, 400, "application/json; charset=utf-8", JSON.stringify({ error: "invalid_request" }));
      return;
    }
    if (!await verifyFormWebhook(request, params, statusCallbackPublicUrl)) {
      reply(response, 401, "application/json; charset=utf-8", JSON.stringify({ error: "unauthorized" }));
      return;
    }
    const callSid = params.CallSid ?? "";
    const providerStatus = (params.CallStatus ?? "").toLowerCase();
    if (!/^CA[0-9a-f]{32}$/i.test(callSid) || params.AccountSid !== twilioAccountSid) {
      reply(response, 400, "application/json; charset=utf-8", JSON.stringify({ error: "invalid_call" }));
      return;
    }
    const mappedStatus = providerStatus === "completed" ? "completed"
      : ["busy", "failed", "no-answer", "canceled"].includes(providerStatus) ? "failed"
      : providerStatus === "in-progress" ? "active" : "ringing";
    try {
      await dependencies.callRegistry.updateCallStatus(callSid, mappedStatus);
      reply(response, 204, "text/plain; charset=utf-8");
    } catch {
      reply(response, 404, "application/json; charset=utf-8", JSON.stringify({ error: "call_not_registered" }));
    }
    return;
  }

  reply(response, 404, "application/json; charset=utf-8", JSON.stringify({ error: "not_found" }));
}

const server = createServer((request, response) => {
  void handleHttpRequest(request, response).catch(error => {
    console.error("IZAKHONO VOICE HTTP handler failed", error instanceof Error ? error.message : "unknown_error");
    if (!response.headersSent) reply(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: "internal_error" }));
    else response.destroy();
  });
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: false });

server.on("upgrade", (request, socket, head) => {
  const valid = verifyTwilioWebSocketHandshake({
    method: request.method ?? "",
    requestUrl: request.url ?? "",
    signature: Array.isArray(request.headers["x-twilio-signature"]) ? undefined : request.headers["x-twilio-signature"],
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
    onStreamClosed: input => dependencies.callRegistry.releaseStream({
      tenantId: input.authorization.tenantId,
      callId: input.authorization.callId,
      streamSid: input.streamSid,
    }),
    onError: error => {
      // Avoid logging payloads, credentials, caller audio, or raw provider events.
      console.error("IZAKHONO VOICE stream failed", error instanceof Error ? error.message : "unknown_error");
    },
  });

  websocket.on("message", data => {
    void bridge.handleMessage(data.toString("utf8"));
  });
  websocket.on("close", () => { void bridge.close("Twilio WebSocket closed").catch(() => undefined); });
  websocket.on("error", () => { void bridge.close("Twilio WebSocket error").catch(() => undefined); });
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
