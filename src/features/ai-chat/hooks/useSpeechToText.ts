import { useState, useRef, useCallback, useEffect } from "react";
import { getEnvVariables } from "@/lib/getEnvVariables";

const { VITE_API_URL, VITE_CHAT_URL } = getEnvVariables();
const CHAT_HOST = VITE_CHAT_URL || VITE_API_URL || window.location.origin;

interface UseSpeechToTextOptions {
  conversationId: string;
  gettingResponse: boolean;
  onTranscript: (text: string, info?: { provider: "groq" | "elevenlabs"; sttMs?: number }) => void;
  /**
   * Which STT backend to use.
   * - "groq": record short audio segments and send to /api/v1/stt/transcribe
   * - "elevenlabs": stream PCM frames to /api/v1/stt/ws/:session_id (ElevenLabs realtime bridge)
   */
  provider?: "groq" | "elevenlabs";
  /**
   * Fired when frontend VAD detects the user has started speaking.
   * Useful for "barge-in" interruption: stop TTS + cancel streaming response.
   */
  onSpeechStart?: () => void;
  /**
   * Fired when frontend VAD detects the user has stopped speaking.
   */
  onSpeechEnd?: () => void;
  /**
   * Frontend VAD config (lightweight RMS-based).
   * This is independent of server-side STT VAD (commit_strategy=vad).
   */
  vad?: {
    enabled?: boolean;
    /** Start talking threshold on raw RMS (0..1). */
    startThreshold?: number;
    /** Stop talking threshold on raw RMS (0..1). */
    stopThreshold?: number;
    /** Require this many ms above startThreshold before firing onSpeechStart. */
    minSpeechMs?: number;
    /** Require this many ms below stopThreshold before firing onSpeechEnd. */
    hangoverMs?: number;
    /**
     * Fail-safe: force a "speech end" after this many ms, even if the mic never drops below stopThreshold
     * (e.g., noisy environments). Prevents the UI from getting stuck in "speaking" and permanently ducking TTS.
     */
    maxSpeechMs?: number;
  };
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
  provider = "groq",
  onSpeechStart,
  onSpeechEnd,
  vad,
  languageCode,
}: UseSpeechToTextOptions) {
  const [isListening, setIsListening] = useState<boolean>(false);
  const isListeningRef = useRef<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  // Monotonic token to cancel an in-flight start when the user stops quickly or component unmounts.
  const startSeqRef = useRef<number>(0);
  const [voiceLevel, setVoiceLevel] = useState<number>(0); // 0..1 (smoothed)
  const voiceLevelRef = useRef<number>(0);
  const lastLevelUpdateRef = useRef<number>(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);
  
  // Store callback in ref so it can be updated without recreating the hook
  const onTranscriptRef = useRef(onTranscript);
  const onSpeechStartRef = useRef(onSpeechStart);
  const onSpeechEndRef = useRef(onSpeechEnd);
  const vadRef = useRef(vad);
  const providerRef = useRef<"groq" | "elevenlabs">(provider);
  
  // Audio processing refs
  const sttWsRef = useRef<WebSocket | null>(null);
  const sttStreamRef = useRef<MediaStream | null>(null);
  const sttAudioCtxRef = useRef<AudioContext | null>(null);
  const sttProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sttSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sttMediaRecorderRef = useRef<MediaRecorder | null>(null);
  // Groq STT: capture raw PCM in a ring buffer so we can safely prepend pre-roll.
  // This avoids invalid container files from concatenating MediaRecorder chunks.
  const GROQ_TARGET_SAMPLE_RATE = 16000;
  const groqPcmRingRef = useRef<Int16Array>(new Int16Array(GROQ_TARGET_SAMPLE_RATE * 2)); // 2s ring; we snapshot last GROQ_PREROLL_MS
  const groqPcmRingWriteIdxRef = useRef<number>(0);
  const groqSegmentPcmChunksRef = useRef<Int16Array[]>([]);
  const groqSegmentActiveRef = useRef<boolean>(false);
  const groqFinalizePendingRef = useRef<boolean>(false);
  const groqLangRef = useRef<string>("en");
  const transcribingRef = useRef<boolean>(false);
  const lastTranscribeStartPerfMsRef = useRef<number>(0);
  
  // Transcript queue management
  const pendingTranscriptQueueRef = useRef<string[]>([]);
  const lastCommittedAtRef = useRef<number>(0);

  // Update callback ref when it changes
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onSpeechStartRef.current = onSpeechStart;
  }, [onSpeechStart]);

  useEffect(() => {
    onSpeechEndRef.current = onSpeechEnd;
  }, [onSpeechEnd]);

  useEffect(() => {
    vadRef.current = vad;
  }, [vad]);

  useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  const resolveLang = useCallback((): "en" | "es" => {
    const raw = String(languageCode || navigator.language || "en").toLowerCase();
    // Be forgiving: app may pass "es", "es-es", "spanish", etc.
    if (raw.startsWith("es") || raw.includes("spanish") || raw.includes("españ")) return "es";
    return "en";
  }, [languageCode]);

  // Keep Groq language in sync with app language while listening (used when we POST the WAV).
  useEffect(() => {
    try {
      groqLangRef.current = resolveLang();
    } catch {}
  }, [resolveLang]);

  // Keep a ref in sync so audio callbacks don't capture stale state.
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const getHttpBase = useCallback(() => {
    const urlBase = CHAT_HOST;
    if (!urlBase.includes("://")) {
      // Prefer current page protocol if CHAT_HOST is just host:port
      return `${window.location.protocol}//${urlBase}`;
    }
    return urlBase;
  }, []);

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
    // Cancel any in-flight startListening() work.
    startSeqRef.current++;
    setIsStarting(false);
    isStartingRef.current = false;
    setIsListening(false);
    isListeningRef.current = false;
    setVoiceLevel(0);
    voiceLevelRef.current = 0;
    setIsUserSpeaking(false);
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

    groqSegmentPcmChunksRef.current = [];
    groqSegmentActiveRef.current = false;
    groqFinalizePendingRef.current = false;
    try {
      // no-op: Groq mode uses PCM capture via AudioContext processor
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

  const transcribeBlob = useCallback(async (blob: Blob, lang: string) => {
    if (!blob || blob.size === 0) return "";
    const base = getHttpBase();
    const url = `${base}/api/v1/stt/transcribe`;
    const form = new FormData();

    // Prefer a stable mime; Groq accepts common formats incl webm/ogg/mp3/m4a/wav.
    // Some recorders report mime with codec params (e.g. "audio/webm;codecs=opus").
    // Groq (or intermediary libs) may reject unknown/parameterized mime types, so normalize.
    const mimeRaw = blob.type || "audio/webm";
    const mime = mimeRaw.split(";")[0]?.trim() || "audio/webm";
    const ext =
      mime.includes("wav") ? "wav" :
      mime.includes("ogg") ? "ogg" :
      mime.includes("mp4") || mime.includes("m4a") ? "m4a" :
      mime.includes("mpeg") ? "mp3" :
      "webm";
    const file = new File([blob], `audio.${ext}`, { type: mime });
    form.append("file", file);
    form.append("model", "whisper-large-v3");
    form.append("temperature", "0");
    form.append("response_format", "verbose_json");
    if (lang) form.append("language", lang);

    // Capture a tiny signature for debugging invalid-media 400s.
    let sig = "";
    try {
      const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      sig = Array.from(head).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch {}

    const res = await fetch(url, { method: "POST", body: form });
    const text = await res.text();
    if (!res.ok) {
      console.error("[STT] Groq transcription failed:", res.status, {
        body: text,
        file: { name: file.name, type: file.type, size: file.size, sigHex16: sig },
      });
      return "";
    }
    try {
      const json = JSON.parse(text);
      const t = String(json?.text || "").trim();
      if (t) return t;
      // Fallback: join segments if present.
      if (Array.isArray(json?.segments)) {
        const segText = json.segments.map((s: any) => String(s?.text || "").trim()).filter(Boolean).join(" ").trim();
        return segText;
      }
      return "";
    } catch (e) {
      console.error("[STT] Failed to parse Groq JSON:", e);
      return "";
    }
  }, [getHttpBase]);

  const GROQ_PREROLL_MS = 1000;

  const appendToGroqRing = useCallback((pcm: Int16Array) => {
    const ring = groqPcmRingRef.current;
    if (!ring || ring.length === 0 || pcm.length === 0) return;
    let idx = groqPcmRingWriteIdxRef.current % ring.length;
    for (let i = 0; i < pcm.length; i++) {
      ring[idx] = pcm[i]!;
      idx++;
      if (idx >= ring.length) idx = 0;
    }
    groqPcmRingWriteIdxRef.current = idx;
  }, []);

  const snapshotGroqPreroll = useCallback((): Int16Array => {
    const ring = groqPcmRingRef.current;
    const n = ring?.length || 0;
    if (!ring || n === 0) return new Int16Array(0);
    const need = Math.max(0, Math.min(n, Math.floor((GROQ_TARGET_SAMPLE_RATE * GROQ_PREROLL_MS) / 1000)));
    if (need === 0) return new Int16Array(0);

    const out = new Int16Array(need);
    const end = groqPcmRingWriteIdxRef.current % n; // next write position
    const start = (end - need + n) % n;

    if (start < end) {
      out.set(ring.subarray(start, end), 0);
    } else {
      const firstLen = n - start;
      out.set(ring.subarray(start), 0);
      out.set(ring.subarray(0, end), firstLen);
    }
    return out;
  }, []);

  const queueGroqTranscription = useCallback(async () => {
    if (transcribingRef.current) return;
    const chunks = groqSegmentPcmChunksRef.current.splice(0);
    if (!chunks.length) return;

    let total = 0;
    for (const c of chunks) total += c.length;
    // Too small/noise guard: < ~200ms at 16k
    if (total < Math.floor(GROQ_TARGET_SAMPLE_RATE * 0.2)) return;
    const pcm = new Int16Array(total);
    let off = 0;
    for (const c of chunks) {
      pcm.set(c, off);
      off += c.length;
    }
    const wav = encodeWavFromPcm16(pcm, GROQ_TARGET_SAMPLE_RATE);
    const blob = new Blob([wav], { type: "audio/wav" });

    const lang = groqLangRef.current || "en";
    transcribingRef.current = true;
    try {
      lastTranscribeStartPerfMsRef.current = performance.now();
      const text = (await transcribeBlob(blob, lang)).trim();
      if (!text) return;

      // Mirror old behavior: debounce/merge very-close commits.
      const now = Date.now();
      const gap = now - (lastCommittedAtRef.current || 0);
      lastCommittedAtRef.current = now;

      if (gettingResponse) {
        pendingTranscriptQueueRef.current.push(text);
        return;
      }
      if (gap < 350 && pendingTranscriptQueueRef.current.length > 0) {
        const prev = pendingTranscriptQueueRef.current.pop() || "";
        pendingTranscriptQueueRef.current.push(`${prev} ${text}`.trim());
        return;
      }

      const sttMs = Math.max(0, performance.now() - (lastTranscribeStartPerfMsRef.current || performance.now()));
      onTranscriptRef.current(text, { provider: "groq", sttMs });
    } finally {
      transcribingRef.current = false;
    }
  }, [gettingResponse, transcribeBlob]);

  const beginGroqUtterance = useCallback(() => {
    if (groqSegmentActiveRef.current) return;
    // Seed with last ~1s of PCM so we don't clip the start.
    groqSegmentPcmChunksRef.current = [snapshotGroqPreroll()];
    groqSegmentActiveRef.current = true;
  }, [snapshotGroqPreroll]);

  const cancelGroqUtterance = useCallback(() => {
    groqSegmentActiveRef.current = false;
    groqFinalizePendingRef.current = false;
    groqSegmentPcmChunksRef.current = [];
  }, []);

  const finalizeGroqUtterance = useCallback(() => {
    if (!groqSegmentActiveRef.current) return;
    groqSegmentActiveRef.current = false;
    groqFinalizePendingRef.current = false;
    // We already have PCM from the audio processor; transcribe immediately.
    void queueGroqTranscription();
  }, [queueGroqTranscription]);

  const startListeningElevenlabs = useCallback(async (lang: string) => {
    const wsBase = getSttWsBase();
    const sttUrl =
      `${wsBase}/api/v1/stt/ws/${encodeURIComponent(conversationId)}` +
      `?include_timestamps=true&include_language_detection=true&audio_format=pcm_16000&commit_strategy=vad&language_code=${encodeURIComponent(lang)}`;

    console.log("[STT] Connecting (ElevenLabs WS):", sttUrl);
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

          const now = Date.now();
          const gap = now - (lastCommittedAtRef.current || 0);
          lastCommittedAtRef.current = now;

          if (gettingResponse) {
            pendingTranscriptQueueRef.current.push(text);
            return;
          }
          if (gap < 350 && pendingTranscriptQueueRef.current.length > 0) {
            const prev = pendingTranscriptQueueRef.current.pop() || "";
            pendingTranscriptQueueRef.current.push(`${prev} ${text}`.trim());
            return;
          }
          onTranscriptRef.current(text, { provider: "elevenlabs" });
        }
      } catch (e) {
        console.error("[STT] Failed to parse message:", e);
      }
    };

    ws.onerror = (e) => {
      console.error("[STT] websocket error:", e);
    };

    ws.onclose = (e) => {
      console.log("[STT] closed:", e.code, e.reason);
      if (sttWsRef.current === ws) stopListening();
    };

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("stt ws open failed"));
    });
  }, [conversationId, getSttWsBase, gettingResponse, stopListening]);

  const startListening = useCallback(async () => {
    if (isListeningRef.current || isStartingRef.current) return;
    if (!conversationId) return;

    try {
      // Close any previous session cleanly.
      stopListening();
      const mySeq = ++startSeqRef.current;
      setIsStarting(true);
      isStartingRef.current = true;
      setIsUserSpeaking(false);

      const lang = resolveLang();
      // IMPORTANT: Groq mode reads this ref when uploading the WAV.
      groqLangRef.current = lang;

      // Use built-in WebRTC audio processing. This is the "good" AEC most apps rely on.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (startSeqRef.current !== mySeq) {
        // User stopped before permission grant / device open finished.
        try { stream.getTracks()?.forEach(t => t.stop()); } catch {}
        return;
      }
      sttStreamRef.current = stream;

      // MediaRecorder for visualization only (no persistence).
      try {
        if (typeof MediaRecorder !== "undefined") {
          const mr = new MediaRecorder(stream);
          mr.ondataavailable = () => {};
          mr.onerror = () => {};
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

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      sttProcessorRef.current = processor;

      // Lightweight frontend VAD (RMS-based) for "barge-in" + segment recording.
      const vadState = {
        speaking: false,
        aboveSince: 0,
        belowSince: 0,
        // In Groq mode we "prime" the recorder as soon as RMS crosses startTh,
        // so we don't cut off the first syllable while waiting minSpeechMs.
        primed: false,
        speechStartedAt: 0,
      };

      processor.onaudioprocess = (event) => {
        if (!isListeningRef.current) return;
        const p = providerRef.current || provider;
        const socket = sttWsRef.current;

        const input = event.inputBuffer.getChannelData(0);

        // Groq mode: maintain a PCM pre-roll ring buffer + capture the current utterance.
        if (p === "groq") {
          const pcm16 = floatTo16BitPCM(resampleFloat32(input, audioCtx.sampleRate, GROQ_TARGET_SAMPLE_RATE));
          if (pcm16.length > 0) {
            appendToGroqRing(pcm16);
            if (groqSegmentActiveRef.current) {
              groqSegmentPcmChunksRef.current.push(pcm16);
            }
          }
        }

        // RMS mic level (0..~1), smoothed for UI.
        let sumSq = 0;
        for (let i = 0; i < input.length; i++) {
          const v = input[i] || 0;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / Math.max(1, input.length));
        const scaled = Math.min(1, rms * 3.5);
        const prev = voiceLevelRef.current;
        const smoothed = prev * 0.85 + scaled * 0.15;
        voiceLevelRef.current = smoothed;
        const nowMs = performance.now();
        if (nowMs - lastLevelUpdateRef.current > 50) {
          lastLevelUpdateRef.current = nowMs;
          setVoiceLevel(smoothed);
        }

        const cfg = vadRef.current || {};
        const enabled = cfg.enabled !== false;
        if (!enabled) return;

        const startTh = Number.isFinite(cfg.startThreshold) ? (cfg.startThreshold as number) : 0.02;
        // Slightly higher default stop threshold so we don't get stuck "speaking" in mild noise.
        const stopTh = Number.isFinite(cfg.stopThreshold) ? (cfg.stopThreshold as number) : 0.015;
        const minSpeechMs = Number.isFinite(cfg.minSpeechMs) ? (cfg.minSpeechMs as number) : 180;
        const hangoverMs = Number.isFinite(cfg.hangoverMs) ? (cfg.hangoverMs as number) : 450;
        const maxSpeechMs = Number.isFinite(cfg.maxSpeechMs) ? (cfg.maxSpeechMs as number) : 8000;

        if (!vadState.speaking) {
          if (rms >= startTh) {
            if (!vadState.aboveSince) vadState.aboveSince = nowMs;

            // Groq mode: start recording immediately on threshold crossing (pre-roll),
            // but only mark "speaking" after minSpeechMs.
            if (p === "groq" && !vadState.primed) {
              vadState.primed = true;
              beginGroqUtterance();
            }

            if (nowMs - vadState.aboveSince >= minSpeechMs) {
              vadState.speaking = true;
              vadState.belowSince = 0;
              vadState.speechStartedAt = nowMs;
              setIsUserSpeaking(true);
              try { onSpeechStartRef.current?.(); } catch {}
              // no-op for groq; utterance is already being buffered
            }
          } else {
            // If we primed recording but the user didn't actually start speaking, stop and discard.
            if (p === "groq" && vadState.primed) {
              vadState.primed = false;
              cancelGroqUtterance();
              // Reset timer so the next threshold crossing behaves correctly.
              vadState.aboveSince = 0;
            }
            vadState.aboveSince = 0;
          }
        } else {
          // Fail-safe: don't let VAD get stuck forever in noisy environments.
          if (maxSpeechMs > 0 && vadState.speechStartedAt && nowMs - vadState.speechStartedAt >= maxSpeechMs) {
            vadState.speaking = false;
            vadState.aboveSince = 0;
            vadState.belowSince = 0;
            vadState.primed = false;
            vadState.speechStartedAt = 0;
            setIsUserSpeaking(false);
            try { onSpeechEndRef.current?.(); } catch {}
            if (p === "groq") {
              finalizeGroqUtterance();
            }
          } else if (rms <= stopTh) {
            if (!vadState.belowSince) vadState.belowSince = nowMs;
            if (nowMs - vadState.belowSince >= hangoverMs) {
              vadState.speaking = false;
              vadState.aboveSince = 0;
              vadState.primed = false;
              vadState.speechStartedAt = 0;
              setIsUserSpeaking(false);
              try { onSpeechEndRef.current?.(); } catch {}
              if (p === "groq") {
                finalizeGroqUtterance();
              }
            }
          } else {
            vadState.belowSince = 0;
          }
        }

        // ElevenLabs mode: stream PCM frames continuously while listening.
        if (p === "elevenlabs") {
          if (!socket || socket.readyState !== WebSocket.OPEN) return;
          const targetSampleRate = 16000;
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
          } catch (err) {
            console.error("[STT] send failed:", err);
          }
        }
      };

      source.connect(processor);
      // Keep the processor alive without audible output.
      const gain = audioCtx.createGain();
      gain.gain.value = 0;
      processor.connect(gain);
      gain.connect(audioCtx.destination);

      // Groq mode: pre-roll is handled via the PCM ring buffer in `onaudioprocess`.

      // If ElevenLabs streaming is selected, wait for the WS to be open *after* we have mic permission.
      // This prevents the UI from saying "listening" while the browser is still prompting/connecting.
      if ((providerRef.current || provider) === "elevenlabs") {
        await startListeningElevenlabs(lang);
        if (startSeqRef.current !== mySeq) return;
      }

      // Now we're actually ready to capture/stream audio.
      setIsStarting(false);
      isStartingRef.current = false;
      setIsListening(true);
      isListeningRef.current = true;
    } catch (err) {
      console.error("[STT] startListening failed:", err);
      stopListening();
    }
  }, [appendToGroqRing, beginGroqUtterance, cancelGroqUtterance, conversationId, finalizeGroqUtterance, gettingResponse, isListening, languageCode, provider, startListeningElevenlabs, stopListening]);

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
    isUserSpeaking,
    isStarting,
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
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function encodeWavFromPcm16(pcm: Int16Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  let offset = 0;
  const writeString = (s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    offset += s.length;
  };

  // RIFF header
  writeString("RIFF");
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString("WAVE");

  // fmt chunk
  writeString("fmt ");
  view.setUint32(offset, 16, true); offset += 4;              // chunk size
  view.setUint16(offset, 1, true); offset += 2;               // audio format = PCM
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, byteRate, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bitsPerSample, true); offset += 2;

  // data chunk
  writeString("data");
  view.setUint32(offset, dataSize, true); offset += 4;

  // PCM samples
  for (let i = 0; i < pcm.length; i++, offset += 2) {
    view.setInt16(offset, pcm[i]!, true);
  }
  return buffer;
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
