// API Loading Tracker - tracks active GET requests for syncing indicator
// Uses debouncing to prevent flickering: waits 500ms before showing/hiding syncing state
export class ApiLoadingTracker {
  private static activeGetRequests = 0;
  private static debouncedLoadingState = false;
  private static listeners: Map<string, ((isLoading: boolean) => void)[]> = new Map();
  private static hideTimeout: NodeJS.Timeout | null = null;
  private static readonly DEBOUNCE_MS = 500;

  // Subscribe to loading state changes (returns debounced loading state)
  static on(event: string, callback: (isLoading: boolean) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    // Immediately call with current debounced state
    callback(this.debouncedLoadingState);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  // Emit loading state changes
  private static emit(event: string, isLoading: boolean) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(isLoading));
    }
  }

  // Update debounced loading state
  private static updateDebouncedState() {
    const hasActiveRequests = this.activeGetRequests > 0;

    // Clear any pending hide timeout (we'll set a new one if needed)
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    if (hasActiveRequests && !this.debouncedLoadingState) {
      // Requests started - show syncing immediately
      this.debouncedLoadingState = true;
      this.emit('loading-changed', true);
    } else if (!hasActiveRequests && this.debouncedLoadingState) {
      // Requests finished - wait 500ms before hiding syncing (debounce to prevent flickering)
      this.hideTimeout = setTimeout(() => {
        // Double-check no new requests started during the timeout
        if (this.activeGetRequests === 0) {
          this.debouncedLoadingState = false;
          this.emit('loading-changed', false);
        }
        this.hideTimeout = null;
      }, this.DEBOUNCE_MS);
    }
  }

  // Increment active GET requests
  static increment() {
    this.activeGetRequests++;
    this.updateDebouncedState();
  }

  // Decrement active GET requests
  static decrement() {
    if (this.activeGetRequests > 0) {
      this.activeGetRequests--;
      this.updateDebouncedState();
    }
  }

  // Get current count
  static getCount(): number {
    return this.activeGetRequests;
  }

  // Check if any GET requests are active (raw count, not debounced)
  static isLoading(): boolean {
    return this.activeGetRequests > 0;
  }

  // Get debounced loading state
  static isDebouncedLoading(): boolean {
    return this.debouncedLoadingState;
  }

  // Pre-defined event types
  static readonly EVENTS = {
    LOADING_CHANGED: 'loading-changed',
  } as const;
}

