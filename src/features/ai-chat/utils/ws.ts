export type EventHandler = (data: any) => void;

/**
 * WebSocket manager for per-session connections to the backend.
 * Each conversation gets its own WebSocket connection to /api/v1/chat/ws/{session_id}
 */
class SessionWSManager {
  private connections: Map<string, WebSocket> = new Map();
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private urlBase: string;
  private reconnectTimers: Map<string, number> = new Map();
  private shouldReconnect: Map<string, boolean> = new Map();
  private sessionModels: Map<string, string> = new Map();
  private sessionTokens: Map<string, string> = new Map();
  private lastUrlBySession: Map<string, string> = new Map();
  private lastCloseBySession: Map<
    string,
    { code: number; reason: string; wasClean: boolean; at: number }
  > = new Map();
  private lastErrorBySession: Map<string, { at: number; readyState: number }> = new Map();

  constructor(urlBase: string) {
    // Normalize URL: if no scheme provided, assume ws:// for localhost or http:// otherwise
    if (!urlBase.includes("://")) {
      // If it's localhost or starts with a number (IP), add ws://
      if (urlBase.startsWith("localhost") || /^\d+\.\d+\.\d+\.\d+/.test(urlBase)) {
        this.urlBase = `ws://${urlBase}`;
      } else {
        // Otherwise assume it's a domain and add ws://
        this.urlBase = `ws://${urlBase}`;
      }
    } else {
      // Convert http/https to ws/wss
      this.urlBase = urlBase.startsWith("https") 
        ? urlBase.replace("https", "wss") 
        : urlBase.replace("http", "ws");
    }
  }

  private buildWsUrl(sessionId: string, modelId?: string, token?: string): string {
    // Support either:
    // - host only: "localhost:8080" => ws://localhost:8080/api/v1/chat/ws/{id}
    // - full base including /api/v1: "https://example.com/api/v1" => wss://example.com/api/v1/chat/ws/{id}
    const baseHasApiV1 = /\/api\/v1\/?$/.test(this.urlBase);
    let wsUrl = baseHasApiV1
      ? `${this.urlBase.replace(/\/+$/, "")}/chat/ws/${sessionId}`
      : `${this.urlBase.replace(/\/+$/, "")}/api/v1/chat/ws/${sessionId}`;

    const params = [];
    if (token) {
      params.push(`token=${encodeURIComponent(token)}`);
    }
    if (modelId) {
      params.push(`model=${encodeURIComponent(modelId)}`);
    }
    if (params.length > 0) {
      wsUrl += `?${params.join('&')}`;
    }
    return wsUrl;
  }

  private connect(sessionId: string, modelId?: string, token?: string): WebSocket {
    const existing = this.connections.get(sessionId);
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return existing;
    }

    const wsUrl = this.buildWsUrl(sessionId, modelId, token);
    this.lastUrlBySession.set(sessionId, wsUrl);
    
    console.log(`[WS] Connecting to: ${wsUrl.replace(/token=[^&]+/, 'token=***')}`); // Hide token in logs
    
    const ws = new WebSocket(wsUrl);
    this.connections.set(sessionId, ws);
    this.shouldReconnect.set(sessionId, true);

    ws.onopen = () => {
      console.log(`[WS] Connected to session: ${sessionId}`);
      // Clear previous errors/close info when we successfully connect.
      this.lastErrorBySession.delete(sessionId);
      this.lastCloseBySession.delete(sessionId);
      const timer = this.reconnectTimers.get(sessionId);
      if (timer !== undefined) {
        clearTimeout(timer);
        this.reconnectTimers.delete(sessionId);
      }
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data as string);
        const label =
          (data && typeof data.type === "string" && data.type) ||
          (data && Array.isArray((data as any).parts) ? "parts" : "") ||
          (data && typeof (data as any).event === "string" && (data as any).event) ||
          (data && typeof (data as any).kind === "string" && (data as any).kind) ||
          "unknown";
        console.log(`[WS] Message received:`, label);
        
        const listeners = this.handlers.get(sessionId);
        if (listeners && listeners.size > 0) {
          for (const fn of listeners) {
            try {
              fn(data);
            } catch (error) {
              console.error('[WS] Handler error:', error);
            }
          }
        }
      } catch (error) {
        console.error('[WS] Failed to parse message:', error);
      }
    };

    ws.onclose = (event) => {
      console.log(`[WS] Disconnected from session ${sessionId}:`, {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        url: wsUrl
      });
      this.lastCloseBySession.set(sessionId, {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        at: Date.now(),
      });

      // Notify listeners so UI can stop "loading forever" if the socket drops mid-stream/tool.
      try {
        const listeners = this.handlers.get(sessionId);
        if (listeners && listeners.size > 0) {
          const payload = {
            type: "ws_closed",
            session_id: sessionId,
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            url: wsUrl,
            at: Date.now(),
          };
          for (const fn of listeners) {
            try {
              fn(payload);
            } catch (error) {
              console.error("[WS] Handler error (ws_closed):", error);
            }
          }
        }
      } catch {}

      this.connections.delete(sessionId);
      
      const hasHandlers = this.handlers.get(sessionId)?.size || 0 > 0;
      const shouldReconnect = this.shouldReconnect.get(sessionId);
      
      if (hasHandlers && shouldReconnect) {
        console.log(`[WS] Scheduling reconnect for session ${sessionId}...`);
        const timer = window.setTimeout(() => {
          this.reconnectTimers.delete(sessionId);
          const model = this.sessionModels.get(sessionId);
          const token = this.sessionTokens.get(sessionId);
          this.connect(sessionId, model, token);
        }, 2000);
        this.reconnectTimers.set(sessionId, timer);
      }
    };

    ws.onerror = (event) => {
      console.error(`[WS] Connection error on session ${sessionId}:`, {
        type: event.type,
        target: event.target,
        wsUrl: wsUrl,
        readyState: ws.readyState
      });
      this.lastErrorBySession.set(sessionId, { at: Date.now(), readyState: ws.readyState });
    };

    return ws;
  }

  subscribe(sessionId: string, handler: EventHandler, modelId?: string, token?: string): () => void {
    if (!sessionId) {
      console.warn('[WS] Cannot subscribe without session ID');
      return () => {};
    }

    if (!this.handlers.has(sessionId)) {
      this.handlers.set(sessionId, new Set());
    }
    const set = this.handlers.get(sessionId)!;
    set.add(handler);

    if (modelId) {
      this.sessionModels.set(sessionId, modelId);
    }
    if (token) {
      this.sessionTokens.set(sessionId, token);
    }

    this.connect(sessionId, modelId, token);

    return () => {
      const listeners = this.handlers.get(sessionId);
      if (!listeners) return;
      
      listeners.delete(handler);
      
      if (listeners.size === 0) {
        console.log(`[WS] No more listeners for session ${sessionId}, closing connection`);
        this.handlers.delete(sessionId);
        this.shouldReconnect.set(sessionId, false);
        this.sessionModels.delete(sessionId);
        this.sessionTokens.delete(sessionId);
        
        const ws = this.connections.get(sessionId);
        // Close even if still CONNECTING to avoid stray sockets and reconnect races.
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
          try {
            ws.close(1000, 'No more listeners');
          } catch {}
        }
        this.connections.delete(sessionId);
        
        const timer = this.reconnectTimers.get(sessionId);
        if (timer !== undefined) {
          clearTimeout(timer);
          this.reconnectTimers.delete(sessionId);
        }
      }
    };
  }

  send(sessionId: string, data: any): boolean {
    const ws = this.connections.get(sessionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error(`[WS] Cannot send message - not connected to session ${sessionId}`);
      return false;
    }

    try {
      ws.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`[WS] Failed to send message:`, error);
      return false;
    }
  }

  close(sessionId: string) {
    this.shouldReconnect.set(sessionId, false);
    const ws = this.connections.get(sessionId);
    if (ws) {
      ws.close(1000, 'Manual close');
      this.connections.delete(sessionId);
    }
    this.handlers.delete(sessionId);
    this.sessionModels.delete(sessionId);
    this.sessionTokens.delete(sessionId);
    // Keep lastUrl/close/error for debug after close.
    
    const timer = this.reconnectTimers.get(sessionId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.reconnectTimers.delete(sessionId);
    }
  }

  getState(sessionId: string): number {
    const ws = this.connections.get(sessionId);
    return ws?.readyState ?? WebSocket.CLOSED;
  }

  getDebugInfo(sessionId: string): {
    sessionId: string;
    url?: string;
    readyState: number;
    lastClose?: { code: number; reason: string; wasClean: boolean; at: number };
    lastError?: { at: number; readyState: number };
    handlersCount: number;
    shouldReconnect?: boolean;
  } {
    const handlersCount = this.handlers.get(sessionId)?.size ?? 0;
    return {
      sessionId,
      url: this.lastUrlBySession.get(sessionId),
      readyState: this.getState(sessionId),
      lastClose: this.lastCloseBySession.get(sessionId),
      lastError: this.lastErrorBySession.get(sessionId),
      handlersCount,
      shouldReconnect: this.shouldReconnect.get(sessionId),
    };
  }
}

// Factory function to create WebSocket manager
export function createWSManager(host: string) {
  return new SessionWSManager(host);
}
