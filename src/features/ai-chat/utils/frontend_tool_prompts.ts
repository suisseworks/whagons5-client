export type FrontendToolPromptMessage = {
  type: "frontend_tool_prompt";
  tool?: string;
  action?: string;
  data?: {
    message?: string;
    default_value?: string;
    path?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

export type SendFrontendToolResponse = (payload: {
  type: "frontend_tool_response";
  tool?: string;
  response: string;
}) => void;

/**
 * Handle "frontend_tool_prompt" messages from the backend.
 * Keep UI-side tool behavior out of ChatWindow.
 */
export function handleFrontendToolPromptMessage(
  data: FrontendToolPromptMessage,
  send: SendFrontendToolResponse,
  navigate?: (path: string) => void,
): boolean {
  const action = data?.action;
  const msg = data?.data?.message;

  if (action === "browser_prompt" && msg) {
    const userInput = prompt(msg, data?.data?.default_value || "");
    send({
      type: "frontend_tool_response",
      tool: data?.tool,
      response: userInput !== null ? userInput : "(User cancelled)",
    });
    return true;
  }

  if (action === "browser_alert" && msg) {
    alert(msg);
    send({ type: "frontend_tool_response", tool: data?.tool, response: "ok" });
    return true;
  }

  if (action === "browser_navigate" && data?.data?.path) {
    // Navigate to the specified path
    if (navigate) {
      navigate(data.data.path);
    } else {
      // Fallback to window.location if navigate callback is not provided
      window.location.href = data.data.path;
    }
    send({ type: "frontend_tool_response", tool: data?.tool, response: "ok" });
    return true;
  }

  return false;
}
