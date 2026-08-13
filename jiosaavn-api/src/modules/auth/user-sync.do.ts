import { DurableObject } from 'cloudflare:workers';

export interface SyncEvent {
  type: string;
  userId: string;
  action: string;
  data?: any;
  updatedAt: string;
}

export class UserSyncDurableObject extends DurableObject {
  private sockets: Set<WebSocket>;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.sockets = new Set<WebSocket>();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 1. Internal broadcast endpoint called by Worker after D1 mutation
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      try {
        const payload = await request.text();
        this.broadcast(payload);
        return new Response(JSON.stringify({ success: true, count: this.sockets.size }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
      }
    }

    // 2. WebSocket Upgrade handling for client connections
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [clientSocket, serverSocket] = Object.values(webSocketPair);

    // Accept WebSocket connection on server side
    this.ctx.acceptWebSocket(serverSocket);
    this.sockets.add(serverSocket);

    return new Response(null, {
      status: 101,
      webSocket: clientSocket,
    });
  }

  // Handle incoming WebSocket messages (ping/pong)
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message === 'string') {
      try {
        const data = JSON.parse(message);
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch {
        // ignore invalid ping JSON
      }
    }
  }

  // Clean socket removal on close/error
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    this.sockets.delete(ws);
    try { ws.close(code, reason); } catch {}
  }

  async webSocketError(ws: WebSocket, error: any): Promise<void> {
    this.sockets.delete(ws);
    try { ws.close(1011, 'WebSocket Error'); } catch {}
  }

  // Fan-out broadcast message to all connected devices for this userId
  private broadcast(message: string): void {
    for (const ws of this.sockets) {
      try {
        ws.send(message);
      } catch (err) {
        // Dead socket cleanup
        this.sockets.delete(ws);
        try { ws.close(); } catch {}
      }
    }
  }
}
