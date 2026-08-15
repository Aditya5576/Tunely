import { DurableObject } from 'cloudflare:workers';

export interface SyncEvent {
  type: string;
  userId: string;
  action: string;
  data?: any;
  updatedAt: string;
}

export interface AuthState {
  authVersion: number;
  isBanned: boolean;
}

export class UserSyncDurableObject extends DurableObject {
  private sockets: Set<WebSocket>;
  private activityState: any = null;
  private authState: AuthState = { authVersion: 1, isBanned: false };
  private isInitialized = false;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.sockets = new Set<WebSocket>();
  }

  private async ensureInitialized(userId?: string): Promise<void> {
    if (this.isInitialized) return;

    try {
      const stored = await this.ctx.storage.get<AuthState>('auth');
      if (stored) {
        this.authState = stored;
        this.isInitialized = true;
        return;
      }
    } catch {}

    // Fallback reconciliation query against D1 SQL source of truth
    if (userId && (this.env as any)?.DB) {
      try {
        const db = (this.env as any).DB as D1Database;
        const row = await db.prepare('SELECT auth_version, is_banned FROM users WHERE id = ?').bind(userId).first() as any;
        if (row) {
          this.authState = {
            authVersion: row.auth_version || 1,
            isBanned: row.is_banned === 1
          };
          await this.ctx.storage.put('auth', this.authState);
        }
      } catch (e) {
        console.warn('DO D1 auth initialization fallback failed:', e);
      }
    }

    this.isInitialized = true;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userIdFromQuery = url.searchParams.get('userId');
    await this.ensureInitialized(userIdFromQuery || undefined);

    // 1. Internal auth status query called by Worker isolates
    if (url.pathname === '/auth-check' && request.method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        authVersion: this.authState.authVersion,
        isBanned: this.authState.isBanned
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Internal auth mutation handler called on logout, ban, unban, password reset
    if (url.pathname === '/update-auth' && request.method === 'POST') {
      try {
        const body: { authVersion?: number; isBanned?: boolean; userId?: string } = await request.json();
        if (typeof body.authVersion === 'number') {
          this.authState.authVersion = body.authVersion;
        }
        if (typeof body.isBanned === 'boolean') {
          this.authState.isBanned = body.isBanned;
        }

        // Persist state to Durable Object disk storage (survives restarts/hibernation)
        await this.ctx.storage.put('auth', this.authState);

        // Instantly sever all active WebSocket connections on ban or revocation
        if (this.authState.isBanned || typeof body.authVersion === 'number') {
          this.closeAllSockets(4001, this.authState.isBanned ? 'Account Banned' : 'Session Revoked');
        }

        return new Response(JSON.stringify({ success: true, authState: this.authState }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
      }
    }

    // 3. Internal broadcast endpoint called by Worker after D1 mutation
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

    // 4. Ephemeral Activity / Presence endpoint (0 KV PUTs!)
    if (url.pathname === '/activity' && request.method === 'POST') {
      try {
        const data = await request.json();
        this.activityState = data;
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
      }
    }

    if (url.pathname === '/activity' && request.method === 'GET') {
      // Check stale presence (5 min)
      if (this.activityState?.lastActive) {
        const diff = Date.now() - new Date(this.activityState.lastActive).getTime();
        if (diff > 300000) {
          this.activityState = null;
        }
      }
      return new Response(JSON.stringify({ success: true, activity: this.activityState }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. WebSocket Upgrade handling for client connections
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    // Reject WebSocket connection immediately if user is banned
    if (this.authState.isBanned) {
      return new Response('Account suspended', { status: 403 });
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

  private closeAllSockets(code: number, reason: string): void {
    for (const ws of this.sockets) {
      try {
        ws.close(code, reason);
      } catch {}
      this.sockets.delete(ws);
    }
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
