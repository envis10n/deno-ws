import { serve } from "https://deno.land/std/http/server.ts";
import {
  acceptWebSocket,
  isWebSocketCloseEvent,
  isWebSocketPingEvent,
  WebSocket
} from "https://deno.land/std/ws/mod.ts";
import { v4 } from "https://deno.land/std/uuid/mod.ts";
import { EventEmitter } from "https://raw.githubusercontent.com/envis10n/deno-events/master/mod.ts";

interface IWServerEvents {
  connection(socket: WS): boolean;
  listening(): void;
  error(err: Error): boolean;
  close(): void;
}

interface IWSocketEvents {
  open(): void;
  message(data: string): void;
  binary(data: Uint8Array): void;
  ping(body: Uint8Array): void;
  error(err: Error): void;
  close(code?: number, reason?: string): void;
}

class WS extends EventEmitter<IWSocketEvents> {
  public readonly uuid: string = v4.generate();
  constructor(public readonly _socket: WebSocket) {
    super();
  }
  public async run(): Promise<void> {
    const it = this._socket.receive();
    this.emit("open");
    while (true) {
      try {
        const { done, value } = await it.next();
        if (done) {
          break;
        }
        const ev = value;
        if (typeof ev === "string") {
          // text message
          this.emit("message", ev);
        } else if (ev instanceof Uint8Array) {
          // binary message
          this.emit("binary", ev);
        } else if (isWebSocketPingEvent(ev)) {
          const [, body] = ev;
          // ping
          this.emit("ping", body);
        } else if (isWebSocketCloseEvent(ev)) {
          // close
          const { code, reason } = ev;
          this.emit("close", code, reason);
        }
      } catch (e) {
        this.emit("error", e);
        await this._socket.close(1000).catch(console.error);
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
      this.emit("listening");
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
              this.emit("connection", client);
              client.on("close", (code, reason) => {
                this.clients.delete(uuid);
                client = null;
              });
              client.run();
            },
          )
          .catch((err: Error): void => {
            const close = this.emit("error", err);
            if (close) {
              this.willClose = true;
            }
          });
      }
    }
  }
}

export default WS;
