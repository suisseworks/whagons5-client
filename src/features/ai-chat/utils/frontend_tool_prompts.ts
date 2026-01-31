export type FrontendToolPromptMessage = {
  type: "frontend_tool_prompt";
  tool?: string;
  action?: string;
  data?: {
    message?: string;
    default_value?: string;
    path?: string;
    code?: string;
    timeout_ms?: number;
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
 * Trusted domains allowed for navigation (configurable allowlist)
 * Add domains here if you need to allow navigation to external trusted sites
 */
const TRUSTED_DOMAINS: string[] = [
  // Add trusted domains here, e.g.:
  // 'trusted-partner.com',
  // 'docs.example.com',
];

/**
 * Validates that a navigation path is safe to use.
 * Allows:
 * - Relative paths starting with "/" (e.g., "/dashboard", "/tasks/123")
 * - Same-origin absolute URLs
 * - URLs from trusted domains (if configured)
 * 
 * Rejects:
 * - Protocol-relative URLs (e.g., "//evil.com")
 * - JavaScript URLs (e.g., "javascript:alert('xss')")
 * - External domains not in allowlist
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

    // Allow same-origin URLs
    if (url.origin === window.location.origin) {
      return { valid: true };
    }

    // Check against trusted domains allowlist
    const hostname = url.hostname.toLowerCase();
    const isTrusted = TRUSTED_DOMAINS.some(domain => {
      const trustedDomain = domain.toLowerCase();
      return hostname === trustedDomain || hostname.endsWith('.' + trustedDomain);
    });

    if (isTrusted) {
      return { valid: true };
    }

    return { 
      valid: false, 
      error: `Invalid path: external domain "${hostname}" is not in the trusted domains allowlist` 
    };
  } catch (error) {
    // URL parsing failed - might be a malformed URL or relative path that doesn't start with "/"
    return { 
      valid: false, 
      error: `Invalid path: "${path}" is not a valid relative path or URL` 
    };
  }
}

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
    const path = data.data.path;
    
    // Validate the path before navigating
    const validation = validateNavigationPath(path);
    
    if (!validation.valid) {
      // Send error response and do not navigate
      send({
        type: "frontend_tool_response",
        tool: data?.tool,
        response: `Error: ${validation.error || 'Invalid navigation path'}`,
      });
      return true;
    }

    // Path is valid, proceed with navigation
    if (navigate) {
      navigate(path);
    } else {
      // Fallback to window.location if navigate callback is not provided
      window.location.href = path;
    }
    send({ type: "frontend_tool_response", tool: data?.tool, response: "ok" });
    return true;
  }

  if (action === "sandbox_run") {
    // Zod-validate the prompt payload shape and run inside QuickJS sandbox.
    // Note: the sandbox can only call explicitly exposed `api.*` capabilities.
    // For now, that's just api.addUser({email,name?}) which is stubbed.
    import('zod')
      .then(async ({ z }) => {
        const schema = z.object({
          code: z.string().min(1),
          timeout_ms: z.number().int().positive().optional(),
        });

        const parsed = schema.safeParse({
          code: data?.data?.code,
          timeout_ms: data?.data?.timeout_ms,
        });

        if (!parsed.success) {
          send({
            type: "frontend_tool_response",
            tool: data?.tool,
            response: JSON.stringify({
              ok: false,
              error: { code: "VALIDATION_ERROR", message: "Invalid sandbox_run payload", details: parsed.error.flatten() },
            }),
          });
          return;
        }

        const timeoutMs = parsed.data.timeout_ms ?? 15000;
        const { SandboxClient } = await import('@/sandbox/SandboxClient');
        const client = new SandboxClient();

        try {
          const result = await Promise.race([
            client.run(parsed.data.code),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Sandbox_Run timeout")), timeoutMs)),
          ]);
          send({
            type: "frontend_tool_response",
            tool: data?.tool,
            response: JSON.stringify({ ok: true, result }),
          });
        } catch (e: any) {
          send({
            type: "frontend_tool_response",
            tool: data?.tool,
            response: JSON.stringify({ ok: false, error: { code: "SANDBOX_ERROR", message: String(e?.message || e) } }),
          });
        } finally {
          try { client.terminate(); } catch {}
        }
      })
      .catch((e) => {
        send({
          type: "frontend_tool_response",
          tool: data?.tool,
          response: JSON.stringify({ ok: false, error: { code: "SANDBOX_ERROR", message: String((e as any)?.message || e) } }),
        });
      });

    return true;
  }

  return false;
}
