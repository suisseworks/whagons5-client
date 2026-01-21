import { useState, useRef, useCallback, useEffect } from "react";
import { getEnvVariables } from "@/lib/getEnvVariables";

const { VITE_API_URL, VITE_CHAT_URL } = getEnvVariables();
const CHAT_HOST = VITE_CHAT_URL || VITE_API_URL || window.location.origin;

// Defaults requested (ElevenLabs TTS voices; kept here for consistency with audio UX).
const DEFAULT_VOICE_ID_EN = "ZoiZ8fuDWInAcwPXaVeq";
const DEFAULT_VOICE_ID_ES = "452WrNT9o8dphaYW5YGU";

interface UseSpeechToTextOptions {
  conversationId: string;
  gettingResponse: boolean;
  onTranscript: (text: string) => void;
  /**
   * Two-letter language code (e.g., "en", "es") derived from the app's language setting.
   * If omitted, falls back to browser language detection.
   */
  languageCode?: string;
}

/**
 * Custom hook for managing speech-to-text functionality
 * Handles WebSocket connection, audio capture, and transcript processing
 */
export function useSpeechToText({
  conversationId,
  gettingResponse,
  onTranscript,
  languageCode,
}: UseSpeechToTextOptions) {
  const [isListening, setIsListening] = useState<boolean>(false);
  const isListeningRef = useRef<boolean>(false);
  const [voiceLevel, setVoiceLevel] = useState<number>(0); // 0..1 (smoothed)
  const voiceLevelRef = useRef<number>(0);
  const lastLevelUpdateRef = useRef<number>(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  
  // Store callback in ref so it can be updated without recreating the hook
  const onTranscriptRef = useRef(onTranscript);
  
  // Audio processing refs
  const sttWsRef = useRef<WebSocket | null>(null);
  const sttStreamRef = useRef<MediaStream | null>(null);
  const sttAudioCtxRef = useRef<AudioContext | null>(null);
  const sttProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sttSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sttMediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  // Transcript queue management
  const pendingTranscriptQueueRef = useRef<string[]>([]);
  const lastCommittedAtRef = useRef<number>(0);

  // Update callback ref when it changes
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Keep a ref in sync so audio callbacks don't capture stale state.
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const getSttWsBase = useCallback(() => {
    // Mirror logic from SessionWSManager, but for /api/v1/stt/ws/:session_id.
    const urlBase = CHAT_HOST;
    if (!urlBase.includes("://")) {
      return `ws://${urlBase}`;
    }
    return urlBase.startsWith("https")
      ? urlBase.replace("https", "wss")
      : urlBase.replace("http", "ws");
  }, []);

  const stopListening = useCallback(() => {
    setIsListening(false);
    isListeningRef.current = false;
    setVoiceLevel(0);
    voiceLevelRef.current = 0;
    setMediaRecorder(null);

    const ws = sttWsRef.current;
    sttWsRef.current = null;
    try {
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close(1000, "stop listening");
      }
    } catch {}

    const mr = sttMediaRecorderRef.current;
    sttMediaRecorderRef.current = null;
    try {
      if (mr && mr.state !== "inactive") {
        mr.stop();
      }
    } catch {}

    const proc = sttProcessorRef.current;
    sttProcessorRef.current = null;
    try { proc?.disconnect(); } catch {}

    const src = sttSourceRef.current;
    sttSourceRef.current = null;
    try { src?.disconnect(); } catch {}

    const stream = sttStreamRef.current;
    sttStreamRef.current = null;
    try { stream?.getTracks()?.forEach(t => t.stop()); } catch {}

    const ac = sttAudioCtxRef.current;
    sttAudioCtxRef.current = null;
    try { ac?.close(); } catch {}
  }, []);

  const startListening = useCallback(async () => {
    if (isListening) return;
    if (!conversationId) return;

    try {
      // Close any previous session cleanly.
      stopListening();
      setIsListening(true);
      isListeningRef.current = true;

      const wsBase = getSttWsBase();
      const lang =
        (languageCode || "").toLowerCase().startsWith("es")
          ? "es"
          : (navigator.language || "en").toLowerCase().startsWith("es")
            ? "es"
            : "en";
      // keep requested defaults (currently unused in STT, but ensures we persist your chosen defaults for future TTS)
      const _defaultVoiceId = lang === "es" ? DEFAULT_VOICE_ID_ES : DEFAULT_VOICE_ID_EN;
      void _defaultVoiceId;

      const sttUrl =
        `${wsBase}/api/v1/stt/ws/${encodeURIComponent(conversationId)}` +
        `?include_timestamps=true&include_language_detection=true&audio_format=pcm_16000&commit_strategy=vad&language_code=${encodeURIComponent(lang)}`;

      console.log("[STT] Connecting:", sttUrl);
      const ws = new WebSocket(sttUrl);
      sttWsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(String(evt.data));
          if (data?.type === "stt_error") {
            console.error("[STT] error:", data.error);
            return;
          }
          if (data?.type !== "stt_event") return;
          const ev = data.event;
          const mt = ev?.message_type;

          if (mt === "committed_transcript" || mt === "committed_transcript_with_timestamps") {
            const text = String(ev?.text || "").trim();
            if (!text) return;

            // Simple debounce: ElevenLabs can emit multiple small commits quickly; group within 350ms.
            const now = Date.now();
            const gap = now - (lastCommittedAtRef.current || 0);
            lastCommittedAtRef.current = now;

            if (gettingResponse) {
              pendingTranscriptQueueRef.current.push(text);
              return;
            }

            if (gap < 350 && pendingTranscriptQueueRef.current.length > 0) {
              // Merge with previous buffered segment.
              const prev = pendingTranscriptQueueRef.current.pop() || "";
              const merged = `${prev} ${text}`.trim();
              pendingTranscriptQueueRef.current.push(merged);
              return;
            }

            // Send immediately when not blocked.
            onTranscriptRef.current(text);
            return;
          }

          // partial_transcript is ignored for now (we auto-send on commits).
        } catch (e) {
          console.error("[STT] Failed to parse message:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("[STT] websocket error:", e);
      };

      ws.onclose = (e) => {
        console.log("[STT] closed:", e.code, e.reason);
        // If this was our current ws, stop resources.
        if (sttWsRef.current === ws) {
          stopListening();
        }
      };

      ws.onopen = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          sttStreamRef.current = stream;

          // Create a MediaRecorder purely for visualization. (We don't persist audio blobs.)
          try {
            if (typeof MediaRecorder !== "undefined") {
              const mr = new MediaRecorder(stream);
              mr.ondataavailable = () => {};
              mr.onerror = () => {};
              // Many visualizers expect `state === 'recording'` even if we don't consume data.
              // Use a timeslice to avoid unbounded buffering.
              try { mr.start(500); } catch {}
              sttMediaRecorderRef.current = mr;
              setMediaRecorder(mr);
            }
          } catch (e) {
            console.debug("[STT] MediaRecorder unavailable for visualizer:", e);
            sttMediaRecorderRef.current = null;
            setMediaRecorder(null);
          }

          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          sttAudioCtxRef.current = audioCtx;

          const source = audioCtx.createMediaStreamSource(stream);
          sttSourceRef.current = source;

          // ScriptProcessorNode is deprecated but widely supported and simplest for this use-case.
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          sttProcessorRef.current = processor;

          const targetSampleRate = 16000;
          let sentChunks = 0;
          processor.onaudioprocess = (event) => {
            const socket = sttWsRef.current;
            if (!socket || socket.readyState !== WebSocket.OPEN) return;
            if (!isListeningRef.current) return;

            const input = event.inputBuffer.getChannelData(0);

            // Compute RMS mic level (0..1-ish), then smooth and throttle state updates.
            let sumSq = 0;
            for (let i = 0; i < input.length; i++) {
              const v = input[i] || 0;
              sumSq += v * v;
            }
            const rms = Math.sqrt(sumSq / Math.max(1, input.length)); // 0..~1
            const scaled = Math.min(1, rms * 3.5); // boost sensitivity for UI
            const prev = voiceLevelRef.current;
            const smoothed = prev * 0.85 + scaled * 0.15;
            voiceLevelRef.current = smoothed;
            const nowMs = performance.now();
            if (nowMs - lastLevelUpdateRef.current > 50) { // ~20fps
              lastLevelUpdateRef.current = nowMs;
              setVoiceLevel(smoothed);
            }

            const pcm16 = floatTo16BitPCM(resampleFloat32(input, audioCtx.sampleRate, targetSampleRate));
            if (pcm16.byteLength === 0) return;

            const audioBase64 = arrayBufferToBase64(pcm16.buffer as ArrayBuffer);
            const msg = {
              message_type: "input_audio_chunk",
              audio_base_64: audioBase64,
              commit: false,
              sample_rate: targetSampleRate,
            };
            try {
              socket.send(JSON.stringify(msg));
              sentChunks++;
              if (sentChunks === 1 || sentChunks % 25 === 0) {
                console.log(`[STT] sent audio chunks: ${sentChunks}`);
              }
            } catch (err) {
              console.error("[STT] send failed:", err);
            }
          };

          source.connect(processor);
          // Keep the processor alive without audible output.
          const gain = audioCtx.createGain();
          gain.gain.value = 0;
          processor.connect(gain);
          gain.connect(audioCtx.destination);
        } catch (err) {
          console.error("[STT] mic init failed:", err);
          stopListening();
        }
      };
    } catch (err) {
      console.error("[STT] startListening failed:", err);
      stopListening();
    }
  }, [conversationId, getSttWsBase, gettingResponse, isListening, languageCode, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  // Note: onWidgetClose is handled by the parent component via useEffect

  // If we buffered transcripts while the AI was responding, flush them when it finishes.
  useEffect(() => {
    if (!gettingResponse && pendingTranscriptQueueRef.current.length > 0) {
      const queued = pendingTranscriptQueueRef.current.splice(0);
      for (const t of queued) {
        try {
          onTranscriptRef.current(t);
        } catch (e) {
          console.error("Failed to submit queued transcript:", e);
        }
      }
    }
  }, [gettingResponse]);

  return {
    isListening,
    startListening,
    stopListening,
    voiceLevel,
    mediaRecorder,
  };
}

// ---- Audio helpers (browser) ----

function resampleFloat32(input: Float32Array, inputSampleRate: number, targetSampleRate: number): Float32Array {
  if (inputSampleRate === targetSampleRate) return input;
  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.round(input.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    // Simple average for downsampling window.
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < input.length; i++) {
      accum += input[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    let s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk) as any);
  }
  return btoa(binary);
}
