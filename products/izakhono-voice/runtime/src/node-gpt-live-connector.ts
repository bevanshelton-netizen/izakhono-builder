import WebSocket from "ws";
import type { GptLiveSocket, GptLiveSocketConnector } from "../../src/gpt-live-session-factory.js";

class NodeGptLiveSocket implements GptLiveSocket {
  constructor(private readonly socket: WebSocket) {}

  send(data: string): void {
    if (this.socket.readyState !== WebSocket.OPEN) throw new Error("GPT-Live socket is not open");
    this.socket.send(data);
  }

  close(code?: number, reason?: string): void {
    if (this.socket.readyState === WebSocket.CLOSED || this.socket.readyState === WebSocket.CLOSING) return;
    this.socket.close(code, reason);
  }

  onMessage(handler: (data: string) => void): () => void {
    const listener = (data: WebSocket.RawData) => {
      if (typeof data === "string") handler(data);
      else handler(data.toString("utf8"));
    };
    this.socket.on("message", listener);
    return () => this.socket.off("message", listener);
  }

  onClose(handler: () => void): () => void {
    this.socket.on("close", handler);
    return () => this.socket.off("close", handler);
  }

  onError(handler: (error: unknown) => void): () => void {
    this.socket.on("error", handler);
    return () => this.socket.off("error", handler);
  }
}

/** Server-only connector. API credentials are supplied as handshake headers at runtime. */
export class NodeGptLiveSocketConnector implements GptLiveSocketConnector {
  connect(url: string, headers: Record<string, string>): Promise<GptLiveSocket> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url, { headers, handshakeTimeout: 15_000, perMessageDeflate: false });
      const onError = (error: Error) => {
        socket.off("open", onOpen);
        reject(error);
      };
      const onOpen = () => {
        socket.off("error", onError);
        resolve(new NodeGptLiveSocket(socket));
      };
      socket.once("error", onError);
      socket.once("open", onOpen);
    });
  }
}
