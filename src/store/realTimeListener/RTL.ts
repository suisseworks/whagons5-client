import { getTokenForUser } from "@/api/whagonsApi";
import { auth } from "@/firebase/firebaseConfig";
import { getEnvVariables } from "@/lib/getEnvVariables";
// Removed direct TasksCache usage; routed through CacheRegistry
import { getCacheForTable } from "@/store/indexedDB/CacheRegistry";
import { syncReduxForTable } from "@/store/indexedDB/CacheRegistry";

interface RTLMessage {
  type: 'ping' | 'system' | 'error' | 'echo' | 'database';
  operation?: string;
  message?: string;
  data?: any;
  tenant_name?: string;
  table?: string;
  new_data?: any;
  old_data?: any;
  db_timestamp?: number;
  client_timestamp?: string;
  sessionId?: string;
}

interface ConnectionOptions {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  debug?: boolean;
}

export class RealTimeListener {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private options: ConnectionOptions;
  
  // Event listeners
  private listeners: Map<string, ((data: any) => void)[]> = new Map();

  constructor(options: ConnectionOptions = {}) {
    this.options = {
      autoReconnect: true,
      reconnectInterval: 5000, // 5 seconds
      maxReconnectAttempts: 5,
      debug: false,
      ...options
    };
  }

  /**
   * Debug logging - only logs when debug flag is enabled
   */
  private debugLog(message: string, ...args: any[]): void {
    if (this.options.debug) {
      console.log(`RTL: ${message}`, ...args);
    }
  }

  /**
   * Get the WebSocket URL for connection
   */
  private getWebSocketUrl(): string {
    const { VITE_API_URL, VITE_DEVELOPMENT } = getEnvVariables();
    const subdomain = this.getSubdomain();
    const token = this.getStoredToken();
    
    if (!token) {
      throw new Error('No authentication token available');
    }

    // Clean up subdomain - ensure it has trailing dot if not empty
    let cleanSubdomain = subdomain.trim();
    if (cleanSubdomain && !cleanSubdomain.endsWith('.')) {
      cleanSubdomain += '.';
    }

    // Construct domain from subdomain and API URL (remove port for domain param)
    const apiUrlWithoutPort = VITE_API_URL.replace(/:\d+$/, ''); // Remove port from API URL
    const domain = cleanSubdomain ? `${cleanSubdomain}${apiUrlWithoutPort}` : apiUrlWithoutPort;
    
    // WebSocket uses ws:// or wss:// protocol
    const protocol = VITE_DEVELOPMENT === 'true' ? 'ws' : 'wss';
    const host = VITE_DEVELOPMENT === 'true' ? 'localhost:8082' : domain;
    
    const wsUrl = `${protocol}://${host}/ws?domain=${encodeURIComponent(domain)}&token=${encodeURIComponent(token)}`;
    
    // Enhanced debug logging
    this.debugLog('WebSocket URL construction:', {
      VITE_API_URL,
      VITE_DEVELOPMENT,
      rawSubdomain: subdomain,
      cleanSubdomain,
      apiUrlWithoutPort,
      domain,
      protocol,
      host,
      wsUrl,
      tokenPreview: token.substring(0, 10) + '...'
    });
    
    return wsUrl;
  }

  /**
   * Get subdomain from localStorage
   */
  private getSubdomain(): string {
    return localStorage.getItem('whagons-subdomain') || '';
  }

  /**
   * Get stored authentication token
   */
  private getStoredToken(): string | null {
    const currentUser = auth.currentUser;
    if (currentUser) {
      return getTokenForUser(currentUser.uid);
    }
    return null;
  }

  /**
   * Check if WebSocket server is available
   */
  async checkServerAvailability(): Promise<boolean> {
    const { VITE_DEVELOPMENT } = getEnvVariables();
    
    if (VITE_DEVELOPMENT === 'true') {
      // In development, check if localhost:8082 is accessible
      try {
        const response = await fetch('http://localhost:8082/api/health', { 
          method: 'GET',
          mode: 'no-cors' // Allow connection even if CORS isn't configured
        });
        this.debugLog('Server health check response:', response.status);
        return true;
      } catch (error) {
        this.debugLog('Server health check failed:', error);
        console.warn('⚠️  WebSocket server appears to be offline at localhost:8082');
        console.warn('💡 Make sure your WebSocket server is running before connecting');
        return false;
      }
    }
    
    // In production, assume server is available (will be handled by connection timeout)
    return true;
  }

  /**
   * Connect to WebSocket and immediately send a keep-alive message
   */
  async connectAndHold(): Promise<void> {
   //check if server is available
   const serverAvailable = await this.checkServerAvailability();
   if(!serverAvailable) {
    throw new Error('WebSocket server is not available. Please start the server and try again.');
   }
   
   this.connect();
   
   // Remove any existing keep-alive listeners first
   this.off('connection:status', this.keepAliveHandler);
   this.on('connection:status', this.keepAliveHandler);
  }

  private keepAliveHandler = (data: any) => {
    if(data.status === 'authenticated') {
      this.send('keep alive');
    }
  };

  /**
   * Connect to WebSocket
   */
  async connect(): Promise<void> {
    if (this.isConnected || this.isConnecting) {
      this.debugLog('Already connected or connecting');
      return;
    }

    try {
      this.isConnecting = true;
      const wsUrl = this.getWebSocketUrl();
      
      this.debugLog('Connecting to WebSocket...', { subdomain: this.getSubdomain(), wsUrl });
      this.emit('connection:status', { status: 'connecting', message: 'Connecting to WebSocket...' });

      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);

    } catch (error) {
      console.error('RTL: Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      this.emit('connection:error', { error: error instanceof Error ? error.message : String(error) });
      
      if (this.options.autoReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Smart connect - checks server availability first, then connects
   */
  async smartConnect(): Promise<void> {
    this.debugLog('Starting smart connect...');
    
    // Check server availability in development
    const serverAvailable = await this.checkServerAvailability();
    if (!serverAvailable) {
      throw new Error('WebSocket server is not available. Please start the server and try again.');
    }
    
    return this.connect();
  }

  /**
   * Smart connect and hold - checks server, connects, and sends keep-alive
   */
  async smartConnectAndHold(): Promise<void> {
    this.debugLog('Starting smart connect and hold...');
    
    // Check server availability in development
    const serverAvailable = await this.checkServerAvailability();
    if (!serverAvailable) {
      throw new Error('WebSocket server is not available. Please start the server and try again.');
    }
    
    return this.connectAndHold();
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.debugLog('Disconnecting...');
    this.options.autoReconnect = false; // Disable auto-reconnect for manual disconnect
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    
    this.emit('connection:status', { status: 'disconnected', message: 'Disconnected' });
  }

  /**
   * Send a message through WebSocket
   */
  send(message: string | object): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('RTL: Cannot send message - not connected');
      return;
    }

    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    this.ws.send(payload);
    this.debugLog('Message sent:', payload);
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    this.debugLog('WebSocket connected');
    this.isConnected = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    
    // Start ping interval to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Send ping every 30 seconds
    
    this.emit('connection:status', { status: 'connected', message: 'Connected - Authenticating...' });
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data: RTLMessage = JSON.parse(event.data);
      this.debugLog('Message received:', data);
      
      this.handleRTLMessage(data);
    } catch (error) {
      console.error('RTL: Failed to parse message:', error);
      this.emit('message:error', { error: 'Failed to parse message', rawData: event.data });
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    this.debugLog('WebSocket disconnected', { code: event.code, reason: event.reason });
    this.isConnected = false;
    this.isConnecting = false;
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    this.emit('connection:status', { status: 'disconnected', message: 'Connection closed' });

    // Auto-reconnect if enabled and not a manual disconnect
    if (this.options.autoReconnect && event.code !== 1000) { // 1000 = normal closure
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(error: Event): void {
    console.error('RTL: WebSocket error:', error);
    this.isConnecting = false;
    
    // More specific error message based on the current state
    const wsUrl = this.ws?.url || 'unknown';
    const errorMessage = this.getConnectionErrorMessage(wsUrl);
    
    console.error('❌ WebSocket Connection Failed');
    console.error('📍 URL:', wsUrl);
    console.error('💡 Suggestion:', errorMessage);
    
    this.emit('connection:error', { error: errorMessage, url: wsUrl });

    if (this.options.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Get user-friendly error message based on connection URL
   */
  private getConnectionErrorMessage(wsUrl: string): string {
    if (wsUrl.includes('localhost:8082')) {
      return 'WebSocket server not running on localhost:8082. Please start your WebSocket server.';
    } else if (wsUrl.includes('localhost')) {
      return 'Local WebSocket server connection failed. Check if the server is running.';
    } else {
      return 'WebSocket connection failed. Check your network connection and server status.';
    }
  }

      /**
   * Handle different types of RTL messages
   */
  private handleRTLMessage(data: RTLMessage): void {
    switch (data.type) {
      case 'ping':
        // Silently handle server ping messages for health checks
        break;

      case 'system':
        this.handleSystemMessage(data);
        break;

      case 'error':
        this.handleErrorMessage(data);
        break;

      case 'echo':
        this.emit('message:echo', { message: data.message, data: data.data });
        break;

      case 'database':
        this.handlePublicationMessage(data);
        break;

      default:
        // Handle unknown message types
        this.emit('message:unknown', data);
        break;
    }
  }

  /**
   * Handle system messages
   */
  private handleSystemMessage(data: RTLMessage): void {
    if (data.operation === 'authenticated') {
      this.debugLog('Successfully authenticated', data.data);
      this.emit('connection:status', { 
        status: 'authenticated', 
        message: 'Authenticated ✅',
        data: data.data 
      });
      this.emit('auth:success', data.data);
    } else {
      this.emit('message:system', { message: data.message, data: data.data });
    }
  }

  /**
   * Handle error messages
   */
  private handleErrorMessage(data: RTLMessage): void {
    console.error('RTL: Received error message:', data);
    this.emit('message:error', { message: data.message, data: data });
    
    if (data.operation === 'auth_error') {
      this.emit('connection:status', { status: 'auth_failed', message: 'Authentication Failed ❌' });
      this.emit('auth:error', data);
    }
  }

  /**
   * Handle publication messages (database changes)
   */
  private handlePublicationMessage(data: RTLMessage): void {
    this.debugLog('Database change received:', {
      tenant: data.tenant_name,
      table: data.table,
      operation: data.operation,
      new_data: data.new_data,
      old_data: data.old_data
    });

    // Emit general publication event
    this.emit('publication:received', data);

    // Route to appropriate cache by table name
    this.handleTablePublication(data).catch(error => {
      console.error('Error handling table publication:', error);
    });
  }

  /**
   * Generic table publication handler using CacheRegistry
   */
  private async handleTablePublication(data: RTLMessage): Promise<void> {
    const table = data.table;
    if (!table) return;

    const cache = getCacheForTable(table);

    if (!cache) {
      return;
    }

    const operation = data.operation?.toUpperCase();
    try {
      switch (operation) {
        case 'INSERT':
          if (data.new_data) {
            this.debugLog(`Processing INSERT for ${table}`, {
              newData: data.new_data,
              hasId: data.new_data.id !== undefined && data.new_data.id !== null,
              idValue: data.new_data.id,
              idType: typeof data.new_data.id,
              tableName: data.table,
              allFields: Object.keys(data.new_data),
              fullMessage: data
            });

            // Log the complete new_data object to see what's different
            this.debugLog(`Full ${table} INSERT data:`, JSON.stringify(data.new_data, null, 2));

            // Check if the data has a valid ID before proceeding
            if (data.new_data.id === undefined || data.new_data.id === null) {
              console.error(`RTL: Skipping INSERT for ${table} - missing ID`, data.new_data);
              return;
            }

            // Additional validation: Check if this ID already exists in IndexedDB
            this.debugLog(`About to add ${table} with ID ${data.new_data.id} to IndexedDB`);

            try {
                const existing = await cache.getAll();
              const existingRecord = existing.find((record: any) => record.id === data.new_data.id);

              if (existingRecord) {
                console.warn(`RTL: ID ${data.new_data.id} already exists in ${table}, skipping duplicate INSERT`, {
                  existing: existingRecord,
                  incoming: data.new_data
                });
                return;
              }

              await cache.add(data.new_data);
              await syncReduxForTable(table);
            } catch (dbError) {
              console.error(`RTL: IndexedDB error for ${table} with ID ${data.new_data.id}:`, dbError);
              // Don't throw - just log the error to prevent crashes
              return;
            }
          }
          break;
        case 'UPDATE':
          if (data.new_data && data.new_data.id != null) {
            this.debugLog(`Processing UPDATE for ${table}`, {
              newData: data.new_data,
              id: data.new_data.id
            });
            // Extra debug: ensure id visibility just before cache.update
            try {
              const dbg = localStorage.getItem('wh-debug-cache') === 'true';
              if (dbg) {
                this.debugLog('pre-cache.update payload check', {
                  table,
                  idPresent: data.new_data.id !== undefined && data.new_data.id !== null,
                  idType: typeof data.new_data.id,
                  keys: Object.keys(data.new_data || {}),
                });
              }
            } catch {}
            await cache.update(data.new_data.id, data.new_data);
            await syncReduxForTable(table);
          }
          break;
        case 'DELETE':
          if (data.old_data && data.old_data.id != null) {
            this.debugLog(`Processing DELETE for ${table}`, {
              oldData: data.old_data,
              id: data.old_data.id
            });
            await cache.remove(data.old_data.id);
            await syncReduxForTable(table);
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('RTL cache handler error', { table, operation, error });
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= (this.options.maxReconnectAttempts || 5)) {
      this.debugLog('Max reconnection attempts reached');
      this.emit('connection:status', { 
        status: 'failed', 
        message: 'Max reconnection attempts reached' 
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.options.reconnectInterval || 5000;
    
    this.debugLog(`Scheduling reconnection attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts} in ${delay}ms`);
    
    this.emit('connection:status', { 
      status: 'reconnecting', 
      message: `Reconnecting... (${this.reconnectAttempts}/${this.options.maxReconnectAttempts})` 
    });

    this.reconnectTimer = setTimeout(() => {
      this.connectAndHold();
    }, delay);
  }

  /**
   * Subscribe to RTL events
   */
  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  /**
   * Unsubscribe from RTL events
   */
  off(event: string, callback: (data: any) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit RTL events
   */
  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  /**
   * Get connection status
   */
  get connectionStatus(): { connected: boolean; connecting: boolean } {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting
    };
  }

  /**
   * Enable/disable auto-reconnect
   */
  setAutoReconnect(enabled: boolean): void {
    this.options.autoReconnect = enabled;
  }

  /**
   * Enable/disable debug logging
   */
  setDebug(enabled: boolean): void {
    this.options.debug = enabled;
    this.debugLog(`Debug logging ${enabled ? 'enabled' : 'disabled'}`);
  }
}