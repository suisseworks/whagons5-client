export interface ImageData {
  url: string;
  media_type: string;
  kind: "image-url";
  serverUrl?: string;
  isUploading?: boolean;
}

export interface PdfData {
  filename: string;
  media_type: string;
  kind: "pdf-file";
  url?: string;
  serverUrl?: string;
  isUploading?: boolean;
}

export interface ContentItem {
  content: string | ImageData | PdfData;
  type?: "str" | "ImageUrl" | "PdfFile";
  part_kind?: "text" | "image-url" | "pdf-file";
}

export interface ToolCallContent {
  name: string;
  args: Record<string, any> | string;
  tool_call_id?: string;
}

export interface ToolResultContent {
  name: string;
  content: any;
  tool_call_id?: string;
}

export interface Message {
  role: "user" | "assistant" | "tool_call" | "tool_result";
  content: string | ContentItem[] | ToolCallContent | ToolResultContent;
  reasoning?: string;
  meta?: {
    /** Dev-only: voice TTS latency from submit to first scheduled playback. */
    ttsTimeToPlaybackMs?: number;
    /** Dev-only: voice latency measured from speech end → first TTS playback. */
    voiceTotalMs?: number;
    /** Dev-only: Groq STT duration (speech end → transcript ready). */
    voiceSttMs?: number;
    /** Dev-only: LLM+TTS portion (transcript ready/submit → first playback). */
    voiceLlmToPlaybackMs?: number;
  };
}

export interface ModelConfig {
  id: string;
  display_name: string;
  provider: string;
  description: string;
  context_size: number;
  capabilities: string[];
  enabled: boolean;
}

export interface ModelsResponse {
  models: ModelConfig[];
}
