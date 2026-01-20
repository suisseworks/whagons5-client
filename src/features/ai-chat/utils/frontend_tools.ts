/**
 * Frontend Tool Handler
 * 
 * Handles execution of tools that run in the browser (frontend-side tools).
 * These are tools that the AI can call to interact with the browser directly,
 * such as displaying alerts, notifications, or manipulating the DOM.
 */

export interface FrontendToolResult {
  action: string;
  [key: string]: any;
}

/**
 * Callback type for sending messages back to the backend
 */
export type SendMessageCallback = (message: string) => void;

/**
 * Callback type for navigating to different routes
 */
export type NavigateCallback = (path: string) => void;

/**
 * Handler function for Browser_Alert tool
 */
function handleBrowserAlert(result: FrontendToolResult, sendMessage?: SendMessageCallback): boolean {
  if (result.action === "browser_alert" && result.message) {
    console.log('[BROWSER_ALERT]', result.message);
    alert(result.message);
    return true;
  }
  return false;
}

/**
 * Handler function for Browser_Prompt tool
 */
function handleBrowserPrompt(result: FrontendToolResult, sendMessage?: SendMessageCallback): boolean {
  if (result.action === "browser_prompt" && result.message) {
    console.log('[BROWSER_PROMPT]', result.message);
    
    // Show the prompt dialog with optional default value
    const userInput = prompt(result.message, result.default_value || '');
    
    // If user clicked OK (even with empty string) or Cancel (null)
    if (userInput !== null && sendMessage) {
      // Send the user's response back to the AI as a new message
      const responseMessage = userInput.trim() === '' 
        ? '(User provided empty response)' 
        : userInput;
      
      // Log metadata only, not the actual user input to avoid PII exposure
      console.log('[BROWSER_PROMPT] User responded', userInput.trim() === '' ? '(empty)' : '(non-empty)');
      
      // Send it back as a message
      setTimeout(() => {
        sendMessage(responseMessage);
      }, 100); // Small delay to ensure UI updates
    } else {
      console.log('[BROWSER_PROMPT] User cancelled the prompt');
      if (sendMessage) {
        setTimeout(() => {
          sendMessage('(User cancelled the prompt)');
        }, 100);
      }
    }
    
    return true;
  }
  return false;
}

/**
 * Validates that a navigation path is safe to use.
 * Allows:
 * - Relative paths starting with "/" (e.g., "/dashboard", "/tasks/123")
 * - Same-origin absolute URLs
 * 
 * Rejects:
 * - Protocol-relative URLs (e.g., "//evil.com")
 * - JavaScript URLs (e.g., "javascript:alert('xss')")
 * - External domains
 * - Malformed URLs
 */
function validateNavigationPath(path: string): { valid: boolean; error?: string } {
  if (!path || typeof path !== 'string') {
    return { valid: false, error: 'Invalid path: path must be a non-empty string' };
  }

  // Allow safe relative paths (must start with "/" and not "//")
  if (path.startsWith('/') && !path.startsWith('//')) {
    // Additional check: ensure it's not a protocol-relative URL disguised as a path
    if (path.match(/^\/\/[^\/]/)) {
      return { valid: false, error: 'Invalid path: protocol-relative URLs are not allowed' };
    }
    return { valid: true };
  }

  // For absolute URLs, parse and validate
  try {
    const url = new URL(path, window.location.origin);
    
    // Reject javascript: and other dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    if (dangerousProtocols.some(proto => url.protocol.toLowerCase().startsWith(proto))) {
      return { valid: false, error: `Invalid path: dangerous protocol "${url.protocol}" is not allowed` };
    }

    // Only allow same-origin URLs
    if (url.origin === window.location.origin) {
      return { valid: true };
    }

    // Reject external domains
    return { 
      valid: false, 
      error: `Invalid path: external domain "${url.hostname}" is not allowed` 
    };
  } catch (error) {
    // URL parsing failed - might be a malformed URL or relative path that doesn't start with "/"
    return { 
      valid: false, 
      error: `Invalid path: "${path}" is not a valid relative path or same-origin URL` 
    };
  }
}

/**
 * Handler function for Browser_Navigate tool
 * Navigates to a different route without reloading the browser
 * Only navigates when action === "browser_navigate" and path is validated as safe
 */
function handleBrowserNavigate(result: FrontendToolResult, sendMessage?: SendMessageCallback, navigate?: NavigateCallback): boolean {
  const action = result.action;
  
  // Only proceed if action is explicitly "browser_navigate"
  if (action !== "browser_navigate") {
    return false;
  }

  // Handle both tool_result format (path directly) and frontend_tool_prompt format (action + data.path)
  const path = result.path || result.data?.path;
  
  if (!path) {
    console.warn('[BROWSER_NAVIGATE] No path provided');
    return false;
  }

  // Validate the path before navigating
  const validation = validateNavigationPath(path);
  
  if (!validation.valid) {
    // Log error and do not navigate
    console.error('[BROWSER_NAVIGATE] Validation failed:', validation.error, 'Path:', path);
    return false;
  }

  // Path is valid, proceed with navigation
  console.log('[BROWSER_NAVIGATE] Navigating to:', path);
  
  if (navigate) {
    navigate(path);
    return true;
  } else {
    // Fallback to window.location if navigate callback is not provided
    console.warn('[BROWSER_NAVIGATE] Navigate callback not provided, using window.location');
    window.location.href = path;
    return true;
  }
}

/**
 * Registry of frontend tool handlers
 * Add new frontend tools here as they are created
 */
const FRONTEND_TOOL_HANDLERS: Record<string, (result: FrontendToolResult, sendMessage?: SendMessageCallback, navigate?: NavigateCallback) => boolean> = {
  'Browser_Alert': handleBrowserAlert,
  'Browser_Prompt': handleBrowserPrompt,
  'Browser_Navigate': handleBrowserNavigate,
  // Add more frontend tools here:
  // 'Browser_Confirm': handleBrowserConfirm,
  // 'Show_Notification': handleShowNotification,
};

/**
 * Process a tool result and execute frontend action if applicable
 * 
 * @param toolName - Name of the tool that was executed
 * @param result - The result data from the tool execution
 * @param sendMessage - Optional callback to send a message back to the backend
 * @param navigate - Optional callback to navigate to different routes
 * @returns true if a frontend action was executed, false otherwise
 */
export function processFrontendTool(toolName: string, result: any, sendMessage?: SendMessageCallback, navigate?: NavigateCallback): boolean {
  // Check if this is a registered frontend tool
  const handler = FRONTEND_TOOL_HANDLERS[toolName];
  if (!handler) {
    return false; // Not a frontend tool
  }

  try {
    // Parse result if it's a string
    let resultData = result;
    if (typeof resultData === 'string') {
      try {
        resultData = JSON.parse(resultData);
      } catch (e) {
        console.error(`[FrontendTools] Failed to parse result for ${toolName}:`, e);
        return false;
      }
    }

    // Execute the handler with optional callbacks
    return handler(resultData, sendMessage, navigate);
  } catch (error) {
    console.error(`[FrontendTools] Error processing ${toolName}:`, error);
    return false;
  }
}

/**
 * Check if a tool name is a frontend tool
 */
export function isFrontendTool(toolName: string): boolean {
  return toolName in FRONTEND_TOOL_HANDLERS;
}

/**
 * Get list of all registered frontend tool names
 */
export function getFrontendToolNames(): string[] {
  return Object.keys(FRONTEND_TOOL_HANDLERS);
}
