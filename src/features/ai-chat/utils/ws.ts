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

  private connect(sessionId: string, modelId?: string): WebSocket {
    const existing = this.connections.get(sessionId);
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return existing;
    }

    let wsUrl = `${this.urlBase}/api/v1/chat/ws/${sessionId}`;
    
    if (modelId) {
      wsUrl += `?model=${encodeURIComponent(modelId)}`;
    }
    
    console.log(`[WS] Connecting to: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    this.connections.set(sessionId, ws);
    this.shouldReconnect.set(sessionId, true);

    ws.onopen = () => {
      console.log(`[WS] Connected to session: ${sessionId}`);
      const timer = this.reconnectTimers.get(sessionId);
      if (timer !== undefined) {
        clearTimeout(timer);
        this.reconnectTimers.delete(sessionId);
      }
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data as string);
        console.log(`[WS] Message received:`, data.type || 'unknown');
        
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
      this.connections.delete(sessionId);
      
      const hasHandlers = this.handlers.get(sessionId)?.size || 0 > 0;
      const shouldReconnect = this.shouldReconnect.get(sessionId);
      
      if (hasHandlers && shouldReconnect) {
        console.log(`[WS] Scheduling reconnect for session ${sessionId}...`);
        const timer = window.setTimeout(() => {
          this.reconnectTimers.delete(sessionId);
          const model = this.sessionModels.get(sessionId);
          this.connect(sessionId, model);
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
    };

    return ws;
  }

  subscribe(sessionId: string, handler: EventHandler, modelId?: string): () => void {
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

    this.connect(sessionId, modelId);

    return () => {
      const listeners = this.handlers.get(sessionId);
      if (!listeners) return;
      
      listeners.delete(handler);
      
      if (listeners.size === 0) {
        console.log(`[WS] No more listeners for session ${sessionId}, closing connection`);
        this.handlers.delete(sessionId);
        this.shouldReconnect.set(sessionId, false);
        this.sessionModels.delete(sessionId);
        
        const ws = this.connections.get(sessionId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'No more listeners');
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
}

// Factory function to create WebSocket manager
export function createWSManager(host: string) {
  return new SessionWSManager(host);
}
