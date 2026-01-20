/**
 * AI Chat Configuration
 * 
 * Change PREFERRED_MODEL to set the default model for chat conversations.
 * This can be overridden at runtime via localStorage.setItem("preferred_model", "model-id")
 */

// Default model to use when no model is specified in localStorage
// Examples:
//   "gemini-2.0-flash" - Google Gemini 2.0 Flash
//   "openai/gpt-4o-mini" - OpenAI GPT-4o Mini via OpenRouter
//   "anthropic/claude-3.5-sonnet" - Anthropic Claude 3.5 Sonnet via OpenRouter
//   "accounts/fireworks/models/glm-4p7" - Fireworks GLM-4 Plus 7B
//export const PREFERRED_MODEL = "accounts/fireworks/models/qwen3-vl-30b-a3b-instruct";
export const PREFERRED_MODEL = "gemini-2.0-flash";

/**
 * Get the preferred model, checking localStorage first, then falling back to PREFERRED_MODEL
 */
export const getPreferredModel = (): string | undefined => {
  const stored = localStorage.getItem("preferred_model");
  return stored || PREFERRED_MODEL;
};
