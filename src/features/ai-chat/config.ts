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
export const PREFERRED_MODEL = "moonshotai/kimi-k2-instruct-0905";

/**
 * TTS (Text-to-Speech) voice defaults.
 *
 * NOTE: Today the actual voice selection happens server-side in `whagons_assistant`
 * (see `godantic/sessions/websocket_session.go` -> ensureTTS()).
 *
 * These constants mirror those server defaults so the frontend config is a single
 * place to see "what voices are we using", and to support future client-side
 * voice selection if we add it.
 */
export const PREFERRED_TTS_VOICE_ID_EN = "ZoiZ8fuDWInAcwPXaVeq";
export const PREFERRED_TTS_VOICE_ID_ES = "p5EUznrYaWnafKvUkNiR";

/**
 * Get the preferred model, checking localStorage first, then falling back to PREFERRED_MODEL
 */
export const getPreferredModel = (): string | undefined => {
  const stored = localStorage.getItem("preferred_model");
  return stored || PREFERRED_MODEL;
};

/**
 * Get the preferred TTS voice id, checking localStorage first, then falling back to defaults.
 *
 * Overrides:
 * - localStorage.setItem("preferred_tts_voice_id_en", "<voice_id>")
 * - localStorage.setItem("preferred_tts_voice_id_es", "<voice_id>")
 *
 * NOTE: This does not currently change playback voice by itself because TTS
 * voice selection is server-side. It exists for visibility and future wiring.
 */
export const getPreferredTtsVoiceId = (languageCode?: string): string => {
  const lang = (languageCode || "en").toLowerCase().startsWith("es") ? "es" : "en";
  const key = lang === "es" ? "preferred_tts_voice_id_es" : "preferred_tts_voice_id_en";
  const stored = localStorage.getItem(key);
  if (stored) return stored;
  return lang === "es" ? PREFERRED_TTS_VOICE_ID_ES : PREFERRED_TTS_VOICE_ID_EN;
};
