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
      
      console.log('[BROWSER_PROMPT] User response:', responseMessage);
      
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
 * Handler function for Browser_Navigate tool
 * Navigates to a different route without reloading the browser
 */
function handleBrowserNavigate(result: FrontendToolResult, sendMessage?: SendMessageCallback, navigate?: NavigateCallback): boolean {
  // Handle both tool_result format (path directly) and frontend_tool_prompt format (action + data.path)
  const path = result.path || result.data?.path;
  const action = result.action;
  
  if ((action === "browser_navigate" || !action) && path) {
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
  return false;
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
