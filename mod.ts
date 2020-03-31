import { serve } from "https://deno.land/std/http/server.ts";
import {
  acceptWebSocket,
  connectWebSocket,
  isWebSocketCloseEvent,
  isWebSocketPingEvent,
  isWebSocketPongEvent,
  WebSocket
} from "https://deno.land/std/ws/mod.ts";
import { v4 } from "https://deno.land/std/uuid/mod.ts";
import { EventEmitter } from "https://raw.githubusercontent.com/envis10n/deno-events/0.1.0/mod.ts";

interface IWServerEvents {
  connection(socket: WS): boolean | undefined;
  error(err: Error): void;
  close(): void;
}

interface IWSocketEvents {
  open(): void;
  message(data: string): void;
  binary(data: Uint8Array): void;
  ping(body: Uint8Array): void;
  pong(body: Uint8Array): void;
  error(err: Error): void;
  close(code?: number, reason?: string): void;
}

class WS extends EventEmitter<IWSocketEvents> {
  public readonly uuid: string = v4.generate();
  public _socket: WebSocket | null = null;
  public readonly uri: string | null = null;
  constructor(uri: string);
  constructor(socket: WebSocket);
  constructor(arg: WebSocket | string) {
    super();
    if (typeof arg === "string") {
      this.uri = arg;
      connectWebSocket(this.uri).then((socket) => {
        this._socket = socket;
        this.run(this._socket);
      }).catch((err) => {
        this.emit("error", err);
      });
    } else {
      this._socket = arg;
      this.uri = arg.conn.remoteAddr.transport;
      this.run(this._socket);
    }
  }
  public send(data: Uint8Array): Promise<void>;
  public send(message: string): Promise<void>;
  public async send(data: string | Uint8Array): Promise<void> {
    if (this._socket !== null) {
      await this._socket.send(data);
    }
  }
  public async close(code: number = 1005, reason: string = ""): Promise<void> {
    if (this._socket !== null) {
      return await this._socket.close(code, reason).catch(console.error);
    }
  }
  private async run(socket: WebSocket): Promise<void> {
    const it = socket.receive();
    this.emit("open");
    while (true) {
      try {
        const { done, value } = await it.next();
        if (done) {
          break;
        }
        const ev = value;
        if (typeof ev === "string") {
          this.emit("message", ev);
        } else if (ev instanceof Uint8Array) {
          this.emit("binary", ev);
        } else if (isWebSocketPingEvent(ev)) {
          const [, body] = ev;
          this.emit("ping", body);
        } else if (isWebSocketCloseEvent(ev)) {
          const { code, reason } = ev;
          this.emit("close", code, reason);
        } else if (isWebSocketPongEvent(ev)) {
          const [, body] = ev;
          this.emit("pong", body);
        }
      } catch (e) {
        this.emit("error", e);
        await this.close(1000);
      }
    }
  }
}

module WS {
  export class Server extends EventEmitter<IWServerEvents> {
    private willClose: boolean = false;
    public clients: Map<string, WS> = new Map();
    constructor(
      public readonly host: string = "localhost",
      public readonly port: number = 8080,
    ) {
      super();
      this.run();
    }
    private async run(): Promise<void> {
      for await (const req of serve(`${this.host}:${this.port}`)) {
        if (this.willClose) break;
        const { headers, conn } = req;
        acceptWebSocket({
          conn,
          headers,
          bufReader: req.r,
          bufWriter: req.w,
        })
          .then(
            async (sock: WebSocket): Promise<void> => {
              let client: WS | null = new WS(sock);
              const uuid = client.uuid;
              this.clients.set(client.uuid, client);
              client.on("close", (code, reason) => {
                this.clients.delete(uuid);
                client = null;
              });
              const allowConnect = this.emit("connection", client);
              if (allowConnect !== undefined && !allowConnect) {
                await client.close(1002, "Access Denied");
              }
            },
          )
          .catch((err: Error): void => {
            this.emit("error", err);
          });
      }
    }
  }
}

export default WS;
