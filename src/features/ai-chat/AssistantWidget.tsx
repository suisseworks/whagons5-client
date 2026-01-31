import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Prism from "prismjs";
import { Message, ContentItem } from "./models";
import ChatInput from "./components/ChatInput";
import ChatMessageItem from "./components/ChatMessageItem";
import ToolMessageRenderer, { ToolCallMap } from "./components/ToolMessageRenderer";
import NewChat from "./components/NewChat";
import { createWSManager } from "./utils/ws";
import { getEnvVariables } from "@/lib/getEnvVariables";
import { processFrontendTool, isFrontendTool } from "./utils/frontend_tools";
import { handleFrontendToolPromptMessage } from "./utils/frontend_tool_prompts";
import { getPreferredModel } from "./config";
import { StreamingTtsPlayer } from "./utils/StreamingTtsPlayer";
import { useLanguage } from "@/providers/LanguageProvider";
import { useAuthUser } from "@/providers/AuthProvider";
import { auth } from "@/firebase/firebaseConfig";
import { useSelector, shallowEqual } from "react-redux";
import type { RootState } from "@/store/store";
import { 
  getConversations, 
  saveMessages, 
  loadMessages, 
  createConversation,
  type Conversation 
} from "./utils/conversationStorage";
import { useSpeechToText } from "./hooks/useSpeechToText";
import "./styles.css";

const { VITE_API_URL, VITE_CHAT_URL, VITE_DEVELOPMENT, VITE_CLIENT_ID } = getEnvVariables();
// Use separate chat URL, fallback to API URL, then to current origin
const CHAT_HOST = VITE_CHAT_URL || VITE_API_URL || window.location.origin;
const IS_DEV = (import.meta as any).env?.DEV === true || VITE_DEVELOPMENT === "true";
const CLIENT_ID = VITE_CLIENT_ID || "";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const FloatingButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('assistant:btn-pos');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: 0, y: 0 };
  });
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const dragging = useRef(false);
  const start = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const origin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      const pt = 'touches' in e ? e.touches[0] : (e as MouseEvent);
      const dx = pt.clientX - start.current.x;
      const dy = pt.clientY - start.current.y;
      const x = origin.current.x + dx;
      const y = origin.current.y + dy;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const size = 48;
      const clampedX = clamp(x, -vw/2 + 16, vw/2 - size - 16);
      const clampedY = clamp(y, -vh/2 + 16, vh/2 - size - 16);
      setPosition({ x: clampedX, y: clampedY });
    };
    const handleUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      try { localStorage.setItem('assistant:btn-pos', JSON.stringify(position)); } catch {}
      document.removeEventListener('mousemove', handleMove as any);
      document.removeEventListener('mouseup', handleUp as any);
      document.removeEventListener('touchmove', handleMove as any);
      document.removeEventListener('touchend', handleUp as any);
    };
    if (dragging.current) {
      document.addEventListener('mousemove', handleMove as any);
      document.addEventListener('mouseup', handleUp as any);
      document.addEventListener('touchmove', handleMove as any, { passive: false } as any);
      document.addEventListener('touchend', handleUp as any);
    }
    return () => {
      document.removeEventListener('mousemove', handleMove as any);
      document.removeEventListener('mouseup', handleUp as any);
      document.removeEventListener('touchmove', handleMove as any);
      document.removeEventListener('touchend', handleUp as any);
    };
  }, [position]);

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const pt = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
    dragging.current = true;
    start.current = { x: pt.clientX, y: pt.clientY };
    origin.current = { x: position.x, y: position.y };
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={btnRef}
            variant="default"
            size="icon"
            aria-label="Open Copilot"
            onClick={onClick}
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            className="fixed bottom-5 right-5 z-[60] shadow-lg rounded-full size-12 p-0 bg-gradient-to-br from-[#0078D4] via-[#00B4D8] to-[#00D4AA] hover:from-[#006BB3] hover:via-[#0099B8] hover:to-[#00B899] transition-all"
            style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
          >
            <Sparkles className="size-5 text-white" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Copilot</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export interface AssistantWidgetProps {
  floating?: boolean;
  renderTrigger?: (open: () => void) => React.ReactNode;
}

type PromptUserContext = {
  user?: { id?: number; name?: string; email?: string };
  teams?: Array<{ id: number; name: string }>;
  workspaces?: Array<{ id: number; name: string }>;
};

const wsManager = createWSManager(CHAT_HOST);

export const AssistantWidget: React.FC<AssistantWidgetProps> = ({ floating = true, renderTrigger }) => {
  const navigate = useNavigate();
  const authedUser = useAuthUser();
  // STT provider is controlled server-side (whagons_assistant/config/stt_config.go).
  // Frontend default is Groq, and we best-effort fetch the server default on mount.
  const [sttProvider, setSttProvider] = useState<"groq" | "elevenlabs">("groq");

  // Pull from generic slices (populated during AuthProvider hydration).
  const teams = useSelector(
    (state: RootState) => (((state as any)?.teams?.value ?? []) as Array<{ id: number; name: string }>),
    shallowEqual
  );
  const workspaces = useSelector(
    (state: RootState) => (((state as any)?.workspaces?.value ?? []) as Array<{ id: number; name: string }>),
    shallowEqual
  );
  const userTeams = useSelector(
    (state: RootState) => (((state as any)?.userTeams?.value ?? []) as Array<{ user_id?: number; team_id?: number }>),
    shallowEqual
  );

  const userContext = useMemo<PromptUserContext | undefined>(() => {
    if (!authedUser) return undefined;

    const uid = Number((authedUser as any)?.id);
    const name = String((authedUser as any)?.name || "");
    const email = String((authedUser as any)?.email || "");

    const teamIdSet = new Set<number>();
    for (const ut of userTeams || []) {
      if (Number((ut as any)?.user_id) === uid) {
        const tid = Number((ut as any)?.team_id);
        if (Number.isFinite(tid)) teamIdSet.add(tid);
      }
    }

    const myTeams = (teams || [])
      .filter((t) => teamIdSet.has(Number((t as any)?.id)))
      .map((t) => ({ id: Number((t as any)?.id), name: String((t as any)?.name || "") }))
      .filter((t) => Number.isFinite(t.id) && t.name)
      .slice(0, 200);

    const visibleWorkspaces = (workspaces || [])
      .map((w) => ({ id: Number((w as any)?.id), name: String((w as any)?.name || "") }))
      .filter((w) => Number.isFinite(w.id) && w.name)
      .slice(0, 200);

    return {
      user: {
        id: Number.isFinite(uid) ? uid : undefined,
        name,
        email,
      },
      teams: myTeams,
      workspaces: visibleWorkspaces,
    };
  }, [authedUser, teams, workspaces, userTeams]);

  const [open, setOpen] = useState(false);
  const [gettingResponse, setGettingResponse] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string>(() => {
    // Try to get the last used conversation, or create a new one
    const conversations = getConversations();
    return conversations.length > 0 ? conversations[0].id : crypto.randomUUID().toString();
  });
  const [conversations, setConversations] = useState<Conversation[]>(() => getConversations());
  const abortControllerRef = useRef(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState<boolean>(false);
  const [scrollBtnLeft, setScrollBtnLeft] = useState<number | undefined>(undefined);
  const unsubscribeWSRef = useRef<(() => void) | null>(null);
  // Keep a single WS subscription per conversation and route events through a ref so we don't
  // have to unsubscribe/re-subscribe (which can close the socket and cause intermittent timeouts).
  const wsEventHandlerRef = useRef<(data: any) => void>(() => {});
  const stableWsHandlerRef = useRef<(data: any) => void>();
  // Only keep the message WS warm between sends for voice mode.
  const keepWsOpenForVoiceRef = useRef<boolean>(false);
  const wsIdleCloseTimerRef = useRef<number | null>(null);
  if (!stableWsHandlerRef.current) {
    stableWsHandlerRef.current = (data: any) => {
      try {
        wsEventHandlerRef.current?.(data);
      } catch (e) {
        console.error("[WS] handler error:", e);
      }
    };
  }
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const previousConversationIdRef = useRef<string>(conversationId);
  const ttsPlayerRef = useRef<StreamingTtsPlayer | null>(null);
  const expectingTtsRef = useRef<boolean>(false);
  const activeTtsContextIdRef = useRef<string>("");
  const ttsCloseTimerRef = useRef<number | null>(null);
  const lastTtsChunkAtRef = useRef<number>(0);
  const lastBargeInAtRef = useRef<number>(0);
  const lastWsClosedNoticeAtRef = useRef<number>(0);
  const lastWsClosedNoticeKeyRef = useRef<string>("");
  const voiceTurnSubmitPerfMsRef = useRef<number>(0);
  const voiceTurnPlaybackRecordedRef = useRef<boolean>(false);
  const voiceTurnSpeechEndPerfMsRef = useRef<number>(0);
  const voiceTurnSttMsRef = useRef<number | null>(null);
  // Dev-only timing probes to diagnose “STT is fast but response takes forever” and “no TTS”.
  const voiceTurnIdRef = useRef<number>(0);
  const voiceTurnTranscriptPerfMsRef = useRef<number>(0);
  const voiceTurnWsSendPerfMsRef = useRef<number>(0);
  const voiceTurnFirstAssistantPerfMsRef = useRef<number>(0);
  const voiceTurnFirstTtsChunkPerfMsRef = useRef<number>(0);

  const scheduleWsIdleClose = useCallback((ms: number) => {
    try {
      if (wsIdleCloseTimerRef.current) window.clearTimeout(wsIdleCloseTimerRef.current);
      wsIdleCloseTimerRef.current = window.setTimeout(() => {
        // Only auto-close if we're still in voice-keepalive mode.
        if (!keepWsOpenForVoiceRef.current) return;
        if (unsubscribeWSRef.current) {
          try { unsubscribeWSRef.current(); } catch {}
          unsubscribeWSRef.current = null;
        }
        wsManager.close(conversationId);
        wsIdleCloseTimerRef.current = null;
      }, ms);
    } catch {}
  }, [conversationId]);

  const VOICE_WS_IDLE_CLOSE_MS = 5 * 60 * 1000; // 5 minutes (voice sessions should not churn sockets)

  // Prime AudioContext on a real user gesture to avoid autoplay restrictions blocking TTS playback.
  const primeTtsAudio = useCallback(() => {
    try {
      if (!ttsPlayerRef.current) ttsPlayerRef.current = new StreamingTtsPlayer();
      void ttsPlayerRef.current.ensureStarted();
    } catch {}
  }, []);

  const memoizedMessages = useMemo(() => messages, [messages]);
  
  const lastUserIndex = useMemo(() => {
    const arr = memoizedMessages;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i]?.role === "user") return i;
    }
    return -1;
  }, [memoizedMessages]);

  // Create a memoized map of tool_call_id to the tool_call message
  const toolCallMap = useMemo<ToolCallMap>(() => {
    const map: ToolCallMap = new Map();
    for (const msg of memoizedMessages) { 
      if (msg.role === 'tool_call' && typeof msg.content === 'object' && msg.content !== null) {
        const contentObj = msg.content as any; 
        if (contentObj.tool_call_id) { 
          const toolCallId = String(contentObj.tool_call_id);
          if (toolCallId && toolCallId.length > 0) { 
            map.set(toolCallId, msg);
          }
        }
      }
    }
    return map;
  }, [memoizedMessages]);

  const scrollToBottom = useCallback(() => {
    const lastUser = document.getElementById("last-user-message");
    const target = lastUser || document.getElementById("last-message");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const scrollContainerToBottom = useCallback(() => {
    if (!chatContainerRef.current) return;
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    setShowScrollToBottom(false);
  }, []);

  const updateScrollBottomVisibility = useCallback(() => {
    if (!chatContainerRef.current) return;
    const distanceFromBottom =
      chatContainerRef.current.scrollHeight - chatContainerRef.current.scrollTop - chatContainerRef.current.clientHeight;
    setShowScrollToBottom(distanceFromBottom > 120);
    updateScrollButtonPosition();
  }, []);

  const updateScrollButtonPosition = useCallback(() => {
    try {
      const rect = inputContainerRef.current?.getBoundingClientRect();
      if (rect) {
        setScrollBtnLeft(rect.left + rect.width / 2);
      }
    } catch {}
  }, []);

  type SubmitOptions = { inputMode?: "text" | "voice" };

  // Create a ref for handleSubmit so it can be used in the hook before it's defined
  const handleSubmitRef = useRef<(content: string | ContentItem[], opts?: SubmitOptions) => Promise<void>>();
  
  // Speech-to-text hook (uses ref for callback so handleSubmit can be defined later)
  const handleTranscript = useCallback((text: string, info?: { provider: "groq" | "elevenlabs"; sttMs?: number }) => {
    // New voice turn marker (best-effort). This is dev-only instrumentation.
    if (IS_DEV) {
      voiceTurnIdRef.current = (voiceTurnIdRef.current || 0) + 1;
      voiceTurnTranscriptPerfMsRef.current = performance.now();
      voiceTurnWsSendPerfMsRef.current = 0;
      voiceTurnFirstAssistantPerfMsRef.current = 0;
      voiceTurnFirstTtsChunkPerfMsRef.current = 0;
      // eslint-disable-next-line no-console
      console.debug("[VOICE]", {
        turn: voiceTurnIdRef.current,
        event: "transcript_committed",
        chars: String(text || "").length,
        provider: info?.provider,
        sttMs: info?.sttMs,
      });
    }
    if (IS_DEV && typeof info?.sttMs === "number") {
      voiceTurnSttMsRef.current = Math.max(0, info.sttMs);
    } else {
      voiceTurnSttMsRef.current = null;
    }
    // Use the ref to call handleSubmit when it's available
    if (handleSubmitRef.current) {
      handleSubmitRef.current(text, { inputMode: "voice" });
    }
  }, []);
  
  const { language } = useLanguage();
  const appLanguageCode = useMemo(() => (language || "en").toLowerCase().startsWith("es") ? "es" : "en", [language]);

  const handleStopRequest = useCallback(async () => {
    abortControllerRef.current = true;
    setGettingResponse(false);
    
    try {
      try { ttsPlayerRef.current?.stop(); } catch {}
      if (unsubscribeWSRef.current) {
        try { unsubscribeWSRef.current(); } catch {}
        unsubscribeWSRef.current = null;
      }
      wsManager.close(conversationId);
      console.log('[WS] Stopped chat by closing WebSocket connection');
    } catch (e) {
      console.error("Failed to stop chat:", e);
    }
  }, [conversationId]);

  const onSpeechStart = useCallback(() => {
    // "Barge-in": if the user starts speaking, stop local TTS immediately,
    // but do NOT cancel the in-flight stream by closing the WS.
    //
    // Important: STT already buffers transcripts while `gettingResponse` is true
    // (see `useSpeechToText`), so the user can speak over the assistant and the
    // utterance will be submitted right after the assistant finishes.
    //
    // Closing the message WS here was causing frequent disconnects (especially when
    // the mic picks up TTS and VAD false-triggers).
    const now = Date.now();
    if (now - (lastBargeInAtRef.current || 0) < 750) return; // rate-limit
    lastBargeInAtRef.current = now;

    // Duck assistant audio ONLY if the assistant is currently responding / expected to speak.
    // If we duck while the assistant is idle, and VAD gets stuck, it can make later TTS feel "broken".
    if (gettingResponse || expectingTtsRef.current) {
      // This prevents perceived "latency" spikes (audio starts late) and reduces mic feedback.
      try { ttsPlayerRef.current?.setDucked(true); } catch {}
    }
    // IMPORTANT:
    // Do NOT auto-cancel the assistant on VAD start. VAD can false-trigger on noise / TTS bleed,
    // which would cancel TTS and make it feel like "only the first message plays".
    // We already buffer transcripts during `gettingResponse`, so the user can speak over the assistant
    // and their utterance will be submitted right after the assistant finishes.
  }, [gettingResponse]);

  const onSpeechEnd = useCallback(() => {
    // Always un-duck: otherwise a single VAD trigger can leave TTS permanently quiet in production.
    try { ttsPlayerRef.current?.setDucked(false); } catch {}

    // Dev-only: record timing metrics.
    if (!IS_DEV) return;
    voiceTurnSpeechEndPerfMsRef.current = performance.now();
    voiceTurnSttMsRef.current = null;
    voiceTurnPlaybackRecordedRef.current = false;
  }, []);

  const { isListening, isStarting: isSttStarting, startListening, stopListening, voiceLevel, mediaRecorder } = useSpeechToText({
    conversationId,
    gettingResponse,
    onTranscript: handleTranscript,
    onSpeechStart,
    onSpeechEnd,
    // Keep VAD lightweight + browser-friendly. Tune to be less aggressive (fewer false starts).
    // NOTE: The previous thresholds were too high and could make it feel like "I speak and nothing happens".
    // We also set a maxSpeechMs fail-safe in the hook to prevent "stuck speaking" which can keep TTS ducked.
    vad: { enabled: true, startThreshold: 0.02, stopThreshold: 0.015, minSpeechMs: 200, hangoverMs: 450, maxSpeechMs: 8000 },
    languageCode: appLanguageCode,
    provider: sttProvider,
  });

  // Best-effort: fetch server-side default STT provider (no UI toggle).
  useEffect(() => {
    let cancelled = false;
    const base = CHAT_HOST.includes("://") ? CHAT_HOST : `${window.location.protocol}//${CHAT_HOST}`;
    const url = `${base}/api/v1/config`;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        const p = String(json?.stt?.default_provider || "").toLowerCase();
        const next = p === "elevenlabs" ? "elevenlabs" : "groq";
        if (!cancelled) setSttProvider(next);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Save messages when they change
  useEffect(() => {
    if (messages.length > 0 && conversationId) {
      saveMessages(conversationId, messages);
    }
  }, [messages, conversationId]);

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationId !== previousConversationIdRef.current) {
      const loadedMessages = loadMessages(conversationId);
      setMessages(loadedMessages);
      previousConversationIdRef.current = conversationId;
      
      // Update conversations list
      setConversations(getConversations());
    }
  }, [conversationId]);

  // Load conversations when sheet opens
  useEffect(() => {
    if (open) {
      setConversations(getConversations());
      // Load messages for current conversation
      const loadedMessages = loadMessages(conversationId);
      if (loadedMessages.length > 0) {
        setMessages(loadedMessages);
      }
    }
  }, [open, conversationId]);

  useEffect(() => {
    if (messages.length > 0) {
      Prism.highlightAll();
    }
    queueMicrotask(() => updateScrollBottomVisibility());
  }, [messages, updateScrollBottomVisibility]);

  // Auto-scroll to bottom during voice chat
  useEffect(() => {
    if (isListening) {
      // Scroll immediately when voice listening starts
      queueMicrotask(() => {
        scrollContainerToBottom();
      });
    }
  }, [isListening, scrollContainerToBottom]);

  // Auto-scroll when messages change during voice chat
  useEffect(() => {
    if (isListening && messages.length > 0) {
      // Small delay to ensure DOM has updated
      const timeoutId = setTimeout(() => {
        scrollContainerToBottom();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, isListening, scrollContainerToBottom]);

  // Auto-scroll when assistant starts responding during voice chat
  useEffect(() => {
    if (isListening && gettingResponse) {
      // Scroll when assistant starts responding
      queueMicrotask(() => {
        scrollContainerToBottom();
      });
    }
  }, [gettingResponse, isListening, scrollContainerToBottom]);

  useEffect(() => {
    return () => {
      if (unsubscribeWSRef.current) {
        try { unsubscribeWSRef.current(); } catch {}
        unsubscribeWSRef.current = null;
      }
      try { ttsPlayerRef.current?.dispose(); } catch {}
      ttsPlayerRef.current = null;
      try {
        if (ttsCloseTimerRef.current) window.clearTimeout(ttsCloseTimerRef.current);
        ttsCloseTimerRef.current = null;
      } catch {}
      try {
        if (wsIdleCloseTimerRef.current) window.clearTimeout(wsIdleCloseTimerRef.current);
        wsIdleCloseTimerRef.current = null;
      } catch {}
    };
  }, []);

  // Stop mic streaming if widget is closed.
  useEffect(() => {
    if (!open) {
      stopListening();
      // Fully dispose audio only when closing the widget (re-open will re-prime on user gesture).
      try { ttsPlayerRef.current?.dispose(); } catch {}
      ttsPlayerRef.current = null;
      expectingTtsRef.current = false;
      keepWsOpenForVoiceRef.current = false;
      try {
        if (ttsCloseTimerRef.current) window.clearTimeout(ttsCloseTimerRef.current);
        ttsCloseTimerRef.current = null;
      } catch {}
      try {
        if (wsIdleCloseTimerRef.current) window.clearTimeout(wsIdleCloseTimerRef.current);
        wsIdleCloseTimerRef.current = null;
      } catch {}
      // Close message WS when widget closes (avoid keeping sockets around in background).
      if (unsubscribeWSRef.current) {
        try { unsubscribeWSRef.current(); } catch {}
        unsubscribeWSRef.current = null;
      }
      wsManager.close(conversationId);
    }
  }, [open, stopListening]);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => scrollToBottom());
    }
  }, [open, scrollToBottom]);

  const handleSubmit = async (content: string | ContentItem[], opts?: SubmitOptions) => {
    if (gettingResponse) return;
    setGettingResponse(true);

    // Voice mode: keep the message WS warm between sends.
    // Important: do NOT reset voice mode just because `opts` is omitted (e.g., tool follow-ups or typed
    // messages during a voice session). Only change it when explicitly provided.
    const voiceSessionWasEnabled = keepWsOpenForVoiceRef.current;
    if (opts?.inputMode) {
      keepWsOpenForVoiceRef.current = opts.inputMode === "voice";
    }
    const effectiveInputMode: SubmitOptions["inputMode"] =
      opts?.inputMode ?? (voiceSessionWasEnabled ? "voice" : undefined);

    if (effectiveInputMode === "voice") {
      voiceTurnSubmitPerfMsRef.current = performance.now();
      voiceTurnPlaybackRecordedRef.current = false;
      if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.debug("[VOICE]", {
          turn: voiceTurnIdRef.current,
          event: "submit_begin",
          transcriptToSubmitMs:
            voiceTurnTranscriptPerfMsRef.current > 0
              ? Math.max(0, voiceTurnSubmitPerfMsRef.current - voiceTurnTranscriptPerfMsRef.current)
              : undefined,
        });
      }
    }

    // Create conversation if it doesn't exist
    if (messages.length === 0) {
      const title = typeof content === "string" 
        ? content.slice(0, 50) 
        : "New conversation";
      createConversation(conversationId, title);
      setConversations(getConversations());
    }

    const newMessage: Message = {
      role: "user",
      content: content,
    };
    const currentMessages = [...messages];
    const updatedMessages = [...currentMessages, newMessage];

    setMessages(updatedMessages);
    const assistantPlaceholder: Message = { role: "assistant", content: "", reasoning: "" };
    const withAssistantPlaceholder = [...updatedMessages, assistantPlaceholder];
    setMessages(withAssistantPlaceholder);
    queueMicrotask(scrollToBottom);

    const parts: Array<{ text?: string; inline_data?: any; image_data?: any; file_data?: any }> = [];

    if (typeof content === "string") {
      parts.push({ text: content });
    } else {
      for (const item of content) {
        if (typeof item.content === "string") {
          parts.push({ text: item.content });
        } else if (item.content.kind === "image-url" && item.content.serverUrl) {
          parts.push({
            image_data: {
              mimeType: item.content.media_type,
              fileUrl: item.content.serverUrl,
            }
          });
        } else if (item.content.kind === "pdf-file" && item.content.serverUrl) {
          parts.push({
            file_data: {
              mimeType: item.content.media_type,
              fileUrl: item.content.serverUrl,
            }
          });
        }
      }
    }

    if (parts.length === 0) {
      console.error("No valid content to send.");
      setGettingResponse(false);
      return;
    }

    const handleWebSocketEvent = (data: any) => {
      // Handle frontend tool prompts (tool-specific messages, not chat content)
      if (data.type === "frontend_tool_prompt") {
        handleFrontendToolPromptMessage(data, (payload) => {
          wsManager.send(conversationId, payload);
        }, navigate);
        return; // Don't process as chat message
      }

      // ElevenLabs TTS audio stream (voice mode)
      if (data.type === "tts_audio_chunk") {
        // While the user is speaking, we duck audio (see onSpeechStart) instead of dropping chunks.
        const audioB64 = typeof data.audio === "string" ? data.audio : "";
        const ctxId = typeof data.context_id === "string" ? data.context_id : "";
        // Ignore chunks from old contexts (prevents old audio bleeding into the next turn).
        if (ctxId && activeTtsContextIdRef.current && ctxId !== activeTtsContextIdRef.current) {
          return;
        }
        if (audioB64) {
          lastTtsChunkAtRef.current = Date.now();
          // Helpful for debugging “no audio” issues.
          // eslint-disable-next-line no-console
          console.debug("[TTS] audio chunk received:", audioB64.length);
          if (!ttsPlayerRef.current) ttsPlayerRef.current = new StreamingTtsPlayer();
          if (IS_DEV && voiceTurnFirstTtsChunkPerfMsRef.current <= 0) {
            voiceTurnFirstTtsChunkPerfMsRef.current = performance.now();
            const turn = voiceTurnIdRef.current;
            const t0 = voiceTurnTranscriptPerfMsRef.current || 0;
            const tSend = voiceTurnWsSendPerfMsRef.current || 0;
            const tFirstTok = voiceTurnFirstAssistantPerfMsRef.current || 0;
            const tFirstTts = voiceTurnFirstTtsChunkPerfMsRef.current || 0;
            // eslint-disable-next-line no-console
            console.debug("[VOICE]", {
              turn,
              event: "first_tts_chunk",
              transcriptToFirstTtsMs: t0 > 0 ? Math.max(0, tFirstTts - t0) : undefined,
              sendToFirstTtsMs: tSend > 0 ? Math.max(0, tFirstTts - tSend) : undefined,
              sendToFirstTokenMs: tSend > 0 && tFirstTok > 0 ? Math.max(0, tFirstTok - tSend) : undefined,
              transcriptToFirstTokenMs: t0 > 0 && tFirstTok > 0 ? Math.max(0, tFirstTok - t0) : undefined,
            });
          }
          ttsPlayerRef.current.enqueueBase64Mp3(audioB64, (playbackStartPerfMs) => {
            if (!IS_DEV) return;
            if (voiceTurnPlaybackRecordedRef.current) return;
            voiceTurnPlaybackRecordedRef.current = true;

            const speechEndMs = voiceTurnSpeechEndPerfMsRef.current || 0;
            const total = speechEndMs > 0 ? playbackStartPerfMs - speechEndMs : 0;
            const sttMs = typeof voiceTurnSttMsRef.current === "number" ? voiceTurnSttMsRef.current : null;
            const llmToPlaybackMs = sttMs != null ? Math.max(0, total - sttMs) : undefined;

            // Attach metric to the latest assistant message (best-effort).
            setMessages(prev => {
              const next = [...prev];
              for (let i = next.length - 1; i >= 0; i--) {
                if (next[i]?.role === "assistant") {
                  next[i] = {
                    ...next[i],
                    meta: {
                      ...(next[i].meta || {}),
                      voiceTotalMs: Math.max(0, total),
                      voiceSttMs: sttMs != null ? Math.max(0, sttMs) : undefined,
                      voiceLlmToPlaybackMs: llmToPlaybackMs,
                      // Keep the old metric for backward compatibility (was "submit → playback").
                      ttsTimeToPlaybackMs:
                        voiceTurnSubmitPerfMsRef.current > 0
                          ? Math.max(0, playbackStartPerfMs - voiceTurnSubmitPerfMsRef.current)
                          : undefined,
                    },
                  };
                  break;
                }
              }
              return next;
            });
          });

          // In voice mode, keep the WS open between turns but still auto-close after a longer idle.
          if (keepWsOpenForVoiceRef.current) {
            scheduleWsIdleClose(VOICE_WS_IDLE_CLOSE_MS);
          }
        }
        return;
      }
      if (data.type === "tts_context_final") {
        const ctxId = typeof (data as any)?.context_id === "string" ? String((data as any).context_id) : "";
        if (!ctxId || !activeTtsContextIdRef.current || ctxId === activeTtsContextIdRef.current) {
          expectingTtsRef.current = false;
          activeTtsContextIdRef.current = "";
        }
        try {
          if (ttsCloseTimerRef.current) window.clearTimeout(ttsCloseTimerRef.current);
          ttsCloseTimerRef.current = null;
        } catch {}

        // For voice mode, keep the WS open between turns.
        if (keepWsOpenForVoiceRef.current) {
          scheduleWsIdleClose(VOICE_WS_IDLE_CLOSE_MS);
        } else {
          // Non-voice: close promptly once the streaming context ends.
          if (unsubscribeWSRef.current) {
            try { unsubscribeWSRef.current(); } catch {}
            unsubscribeWSRef.current = null;
          }
        }
        return;
      }
      if (data.type === "tts_error") {
        console.error("[TTS] error:", data.error || data.message);
        return;
      }

      if (data.type === "tts_context_started") {
        const ctxId = typeof (data as any)?.context_id === "string" ? String((data as any).context_id) : "";
        if (ctxId) {
          activeTtsContextIdRef.current = ctxId;
          // New context means new turn; don't let old audio continue.
          try { ttsPlayerRef.current?.stop(); } catch {}
          expectingTtsRef.current = true;
          if (IS_DEV) {
            // eslint-disable-next-line no-console
            console.debug("[TTS] context started:", ctxId);
          }
        }
        return;
      }

      if (data.type === "done" || data.type === "stopped" || data.type === "error") {
        setGettingResponse(false);
        if (data.type === "error") {
          console.error("WebSocket error:", data.error || data.message);
        }

        // Voice mode: keep WS warm between turns (still auto-close after idle).
        if (keepWsOpenForVoiceRef.current) {
          scheduleWsIdleClose(VOICE_WS_IDLE_CLOSE_MS);
          return;
        }

        // Do NOT close the AudioContext here; it can break subsequent turns due to autoplay restrictions.
        try { ttsPlayerRef.current?.stop(); } catch {}
        if (unsubscribeWSRef.current) {
          try { unsubscribeWSRef.current(); } catch {}
          unsubscribeWSRef.current = null;
        }
        return;
      }

      // If the WebSocket drops mid-stream/tool, stop loading and show a recoverable message.
      if (data.type === "ws_closed") {
        const key = `${String((data as any)?.at || "")}:${String((data as any)?.code || "")}:${String((data as any)?.reason || "")}`;
        const now = Date.now();
        // De-dupe: only surface this once per close (and ignore rapid repeats).
        if (key && key === lastWsClosedNoticeKeyRef.current) return;
        if (now - (lastWsClosedNoticeAtRef.current || 0) < 1000) return;
        lastWsClosedNoticeAtRef.current = now;
        lastWsClosedNoticeKeyRef.current = key;

        expectingTtsRef.current = false;
        setGettingResponse(false);
        try { ttsPlayerRef.current?.stop(); } catch {}

        const LOST_MSG =
          "Connection lost while the assistant was responding. Please try again (voice or text).";

        setMessages(prev => {
          const next = [...prev];
          // Don't spam duplicates.
          const last = next[next.length - 1];
          if (last?.role === "assistant" && typeof last.content === "string" && last.content.trim() === LOST_MSG) {
            return prev;
          }
          // If the last assistant message is still the empty placeholder, replace it with a helpful error.
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i]?.role === "assistant") {
              const cur = next[i];
              if (typeof cur.content === "string" && cur.content.trim() === "") {
                next[i] = {
                  ...cur,
                  content: LOST_MSG,
                };
              } else {
                // Otherwise append a short note.
                next.push({
                  role: "assistant",
                  content: LOST_MSG,
                } as any);
              }
              break;
            }
          }
          return next;
        });

        // Reconnect is handled by wsManager's onclose auto-reconnect (as long as we're subscribed).
        return;
      }

      // Handle structured tool_result messages
      if (data.type === "tool_result") {
        const toolName = data.function_name || '';
        const toolResult = data.result || data.result_json;
        
        // Process frontend tools (Browser_Alert, Browser_Prompt, Browser_Navigate, etc.) if applicable
        if (toolName && isFrontendTool(toolName)) {
          // Create a callback to send user responses back to the AI
          const sendResponseMessage = (message: string) => {
            if (message && !gettingResponse) {
              // Preserve voice mode when we're in a voice session (prevents disabling WS keepalive).
              const voiceMode = keepWsOpenForVoiceRef.current || isListening;
              handleSubmit(message, voiceMode ? { inputMode: "voice" } : undefined);
            }
          };
          
          // Create a callback to navigate to different routes
          const navigateToRoute = (path: string) => {
            navigate(path);
          };
          
          processFrontendTool(toolName, toolResult, sendResponseMessage, navigateToRoute);
        }
        
        setMessages(prevMessages => {
          const currentMessageState = [...prevMessages];
          
          // Try to find the matching tool_call and update its ID if it was temporary
          const toolCallIndex = currentMessageState.findIndex(
            msg => msg.role === "tool_call" && 
                   typeof msg.content === "object" &&
                   (msg.content as any).name === data.function_name &&
                   (msg.content as any).tool_call_id?.startsWith('temp_')
          );
          
          if (toolCallIndex !== -1) {
            const updatedToolCall = { ...currentMessageState[toolCallIndex] };
            (updatedToolCall.content as any).tool_call_id = data.function_id;
            currentMessageState[toolCallIndex] = updatedToolCall;
          }
          
          const newToolResultMessage: Message = {
            role: "tool_result",
            content: {
              tool_call_id: data.function_id,
              name: data.function_name,
              content: data.result || data.result_json,
            }
          };
          currentMessageState.push(newToolResultMessage);
          return currentMessageState;
        });
        return;
      }

      if (data.parts && Array.isArray(data.parts)) {
        if (IS_DEV && voiceTurnFirstAssistantPerfMsRef.current <= 0 && (keepWsOpenForVoiceRef.current || expectingTtsRef.current)) {
          voiceTurnFirstAssistantPerfMsRef.current = performance.now();
          const t0 = voiceTurnTranscriptPerfMsRef.current || 0;
          const tSend = voiceTurnWsSendPerfMsRef.current || 0;
          // eslint-disable-next-line no-console
          console.debug("[VOICE]", {
            turn: voiceTurnIdRef.current,
            event: "first_assistant_chunk",
            transcriptToFirstTokenMs: t0 > 0 ? Math.max(0, voiceTurnFirstAssistantPerfMsRef.current - t0) : undefined,
            sendToFirstTokenMs: tSend > 0 ? Math.max(0, voiceTurnFirstAssistantPerfMsRef.current - tSend) : undefined,
            kind: "parts",
          });
        }
        setMessages(prevMessages => {
          let currentMessageState = [...prevMessages];
          let lastMessage = currentMessageState[currentMessageState.length - 1];
          
          if (!lastMessage || lastMessage.role !== "assistant") {
            const newAssistantMessage: Message = { role: "assistant", content: "", reasoning: "" };
            currentMessageState = [...currentMessageState, newAssistantMessage];
            lastMessage = newAssistantMessage;
          }
          
          for (const part of data.parts) {
            if (part.text && typeof lastMessage.content === "string") {
              const updated = { ...lastMessage } as Message;
              updated.content = (lastMessage.content as string) + part.text;
              currentMessageState[currentMessageState.length - 1] = updated;
              lastMessage = updated;
            }
            
            // Handle function calls in raw format
            if (part.functionCall) {
              const hasId = part.functionCall.id && part.functionCall.id.length > 0;
              const toolCallId = hasId ? part.functionCall.id : `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const newToolCallMessage: Message = {
                role: "tool_call",
                content: {
                  tool_call_id: toolCallId,
                  name: part.functionCall.name,
                  args: part.functionCall.args,
                }
              };
              currentMessageState.push(newToolCallMessage);
            }
          }
          
          return currentMessageState;
        });
        return;
      }

      if (
        IS_DEV &&
        voiceTurnFirstAssistantPerfMsRef.current <= 0 &&
        (keepWsOpenForVoiceRef.current || expectingTtsRef.current) &&
        (data.type === "part_start" || data.type === "part_delta" || data.type === "content_chunk")
      ) {
        voiceTurnFirstAssistantPerfMsRef.current = performance.now();
        const t0 = voiceTurnTranscriptPerfMsRef.current || 0;
        const tSend = voiceTurnWsSendPerfMsRef.current || 0;
        // eslint-disable-next-line no-console
        console.debug("[VOICE]", {
          turn: voiceTurnIdRef.current,
          event: "first_assistant_chunk",
          transcriptToFirstTokenMs: t0 > 0 ? Math.max(0, voiceTurnFirstAssistantPerfMsRef.current - t0) : undefined,
          sendToFirstTokenMs: tSend > 0 ? Math.max(0, voiceTurnFirstAssistantPerfMsRef.current - tSend) : undefined,
          kind: data.type,
        });
      }
      setMessages(prevMessages => {
        let currentMessageState = [...prevMessages];
        let lastMessage = currentMessageState[currentMessageState.length - 1];
        const isAssistantMessage = lastMessage?.role === "assistant";

        if (!isAssistantMessage && (data.type === "part_start" || data.type === "part_delta" || data.type === "content_chunk")) {
          const newAssistantMessage: Message = { role: "assistant", content: "", reasoning: "" };
          currentMessageState = [...currentMessageState, newAssistantMessage];
          lastMessage = newAssistantMessage;
        }

        if (data.type === "part_start" || data.type === "part_delta") {
          const part = data.data?.part || data.data?.delta;
          if (part && lastMessage?.role === "assistant") {
            const updated = { ...lastMessage } as Message;
            
            if (part.part_kind === "text" && typeof lastMessage.content === "string") {
              const newContent = (lastMessage.content as string) + (part.content || "");
              updated.content = newContent;
            }
            
            if (part.part_kind === "reasoning") {
              const deltaText = typeof (part as any).reasoning === 'string' && (part as any).reasoning !== ''
                ? (part as any).reasoning
                : (typeof (part as any).content === 'string' ? (part as any).content : '');
              if (deltaText) {
                const prevReasoning = typeof lastMessage.reasoning === "string" ? lastMessage.reasoning : "";
                updated.reasoning = prevReasoning + deltaText;
              }
            }
            
            currentMessageState[currentMessageState.length - 1] = updated;
          }
        } else if (data.type === "content_chunk" && data.data) {
          if (lastMessage?.role === "assistant" && typeof lastMessage.content === "string") {
            const updated = { ...lastMessage } as Message;
            const newContent = (lastMessage.content as string) + data.data;
            updated.content = newContent;
            currentMessageState[currentMessageState.length - 1] = updated;
          }
        } else if (data.type === "tool_call" && data.data?.tool_call) {
          const newToolCallMessage: Message = { role: "tool_call", content: data.data.tool_call };
          currentMessageState.push(newToolCallMessage);
        } else if (data.type === "tool_result" && data.data?.tool_result) {
          const newToolResultMessage: Message = { role: "tool_result", content: data.data.tool_result };
          currentMessageState.push(newToolResultMessage);
        }

        return currentMessageState;
      });
    };

    // Ensure the stable subscription always uses the latest handler closure for this submit.
    wsEventHandlerRef.current = handleWebSocketEvent;

    const ensureSubscription = async () => {
      // If we're already subscribed AND the underlying socket is alive, keep it.
      // If the socket was closed by the server between turns (common in voice mode),
      // re-subscribe to force `wsManager.connect(...)` to run again.
      const state = wsManager.getState(conversationId);
      const socketAlive = state === WebSocket.OPEN || state === WebSocket.CONNECTING;
      if (unsubscribeWSRef.current && socketAlive) return;

      // If we had a stale subscription but the socket is dead, clear it to avoid confusion.
      if (unsubscribeWSRef.current && !socketAlive) {
        try { unsubscribeWSRef.current(); } catch {}
        unsubscribeWSRef.current = null;
      }

      const selectedModel = getPreferredModel();
      
      // Get Firebase ID token for authentication
      let token: string | undefined;
      try {
        if (auth.currentUser) {
          token = await auth.currentUser.getIdToken();
        }
      } catch (error) {
        console.warn('[WS] Failed to get Firebase token:', error);
      }
      
      unsubscribeWSRef.current = wsManager.subscribe(conversationId, stableWsHandlerRef.current!, selectedModel, token);
    };

    try {
      abortControllerRef.current = false;
      // If we have a pending timer that would close the WS after TTS, cancel it when starting a new send.
      try {
        if (ttsCloseTimerRef.current) window.clearTimeout(ttsCloseTimerRef.current);
        ttsCloseTimerRef.current = null;
      } catch {}
      // If we have a pending idle close (voice keepalive), cancel it when starting a new send.
      try {
        if (wsIdleCloseTimerRef.current) window.clearTimeout(wsIdleCloseTimerRef.current);
        wsIdleCloseTimerRef.current = null;
      } catch {}
      await ensureSubscription();

      // Increased timeout for voice chat scenarios where server might be processing previous requests
      // Also allow CONNECTING state since the connection might be establishing
      const maxWaitTime = opts?.inputMode === "voice" ? 25000 : 15000;
      const checkInterval = 100;
      const maxAttempts = maxWaitTime / checkInterval;
      
      let connected = false;
      let reconnectBudget = 3;
      for (let i = 0; i < maxAttempts; i++) {
        const wsState = wsManager.getState(conversationId);
        if (wsState === WebSocket.OPEN) {
          connected = true;
          break;
        }
        // Don't fail if still connecting - give it more time
        if (wsState === WebSocket.CONNECTING && i < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          continue;
        }
        // If closed/closing, try a limited reconnect instead of failing immediately.
        if (wsState === WebSocket.CLOSED || wsState === WebSocket.CLOSING) {
          if (reconnectBudget > 0) {
            reconnectBudget--;
            try {
              // Force a re-subscribe attempt (common in prod when the server/proxy closes idle sockets).
              await ensureSubscription();
            } catch {}
            await new Promise(resolve => setTimeout(resolve, 250));
            continue;
          }
          break;
        }
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }

      if (!connected) {
        const wsState = wsManager.getState(conversationId);
        const wsDebug = (wsManager as any)?.getDebugInfo?.(conversationId);
        console.error('[WS] Connection failed.', { wsState, wsDebug, CHAT_HOST });
        const urlHint =
          wsDebug?.url ? ` url=${wsDebug.url}` : ` chatHost=${String(CHAT_HOST || "")}`;
        const closeHint =
          wsDebug?.lastClose
            ? ` close=${wsDebug.lastClose.code}${wsDebug.lastClose.reason ? `(${wsDebug.lastClose.reason})` : ""}`
            : "";
        throw new Error(`WebSocket connection failed (state=${wsState}).${urlHint}${closeHint}`);
      }

      // Use app language (from LanguageProvider) so voice/text chat matches the UI language toggle.
      const messagePayload: any = {
        message: {
          role: "user",
          content: {
            parts: parts
          }
        },
        language_code: appLanguageCode,
      };
      if (CLIENT_ID) {
        messagePayload.client_id = CLIENT_ID;
      }
      if (userContext) {
        messagePayload.user_context = userContext;
      }
      if (effectiveInputMode) {
        messagePayload.input_mode = effectiveInputMode;
      }
      expectingTtsRef.current = effectiveInputMode === "voice";
      
      if (IS_DEV && effectiveInputMode === "voice") {
        voiceTurnWsSendPerfMsRef.current = performance.now();
        // eslint-disable-next-line no-console
        console.debug("[VOICE]", { turn: voiceTurnIdRef.current, event: "ws_send" });
      }
      const sent = wsManager.send(conversationId, messagePayload);
      
      if (!sent) {
        throw new Error("Failed to send message via WebSocket - connection not ready");
      }
      
    } catch (error) {
      console.error("Error sending message:", error);
      setGettingResponse(false);
      
      setMessages(prev => {
        if (
          prev.length >= 2 &&
          prev[prev.length - 2] === newMessage &&
          prev[prev.length - 1]?.role === "assistant" &&
          typeof prev[prev.length - 1]?.content === "string" &&
          (prev[prev.length - 1]?.content as string) === ""
        ) {
          return prev.slice(0, -2);
        }
        if (prev.length > 0 && prev[prev.length - 1] === newMessage) {
          return prev.slice(0, -1);
        }
        return prev;
      });
      
      if (!(error instanceof DOMException && error.name === 'AbortError') && !abortControllerRef.current) {
        alert(`Error sending message: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };

  // Update the ref when handleSubmit is defined
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const wasClosedRef = useRef<boolean>(true); // Track if sheet was closed
  
  const handleNewConversation = useCallback(() => {
    // Save current messages before creating new conversation
    if (messages.length > 0) {
      saveMessages(conversationId, messages);
    }
    
    const newId = crypto.randomUUID().toString();
    createConversation(newId, "New conversation");
    setConversationId(newId);
    setMessages([]);
    setGettingResponse(false);
    previousConversationIdRef.current = newId;
    setConversations(getConversations());
    wasClosedRef.current = false; // Mark that we're now in a conversation
  }, [messages, conversationId]);
  
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === 'k';
      if ((e.ctrlKey || e.metaKey) && isK) {
        e.preventDefault();
        // Prevent other window-level Ctrl+K handlers from running.
        // (stopPropagation does not stop other listeners on the same target)
        e.stopImmediatePropagation();

        // Prevent sidebar "hover open" from triggering due to DOM changes under the cursor
        // when this sheet opens.
        try {
          (window as any).__wh_suppressSidebarHoverUntil = Date.now() + 500;
        } catch {}
        // If sheet was closed, start a new conversation when opening
        if (!open && wasClosedRef.current) {
          handleNewConversation();
        }
        setOpen(true);
        primeTtsAudio();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, handleNewConversation, primeTtsAudio]);

  useEffect(() => {
    // Track when sheet closes
    if (!open) {
      wasClosedRef.current = true;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Focus the textarea when the sheet opens (works for both Ctrl+K and button click)
    const id = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => window.clearTimeout(id);
  }, [open]);


  const handleConversationChange = (newConversationId: string) => {
    if (newConversationId === conversationId) return;
    
    // Save current messages before switching
    if (messages.length > 0) {
      saveMessages(conversationId, messages);
    }
    
    setConversationId(newConversationId);
    setGettingResponse(false);
    
    // Close any existing WebSocket connection
    if (unsubscribeWSRef.current) {
      try { unsubscribeWSRef.current(); } catch {}
      unsubscribeWSRef.current = null;
    }
    wsManager.close(conversationId);
  };

  const handleOpenSheet = () => {
    // If sheet was closed, start a new conversation when opening
    if (!open && wasClosedRef.current) {
      handleNewConversation();
    }
    setOpen(true);
    primeTtsAudio();
  };

  return (
    <>
      {renderTrigger ? (
        renderTrigger(handleOpenSheet)
      ) : (
        floating && <FloatingButton onClick={handleOpenSheet} />
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="max-w-full sm:max-w-2xl p-0 gap-0 flex flex-col h-full"
          onPointerDown={primeTtsAudio}
        >
          {/* Radix Sheet is built on Dialog primitives; it requires a Title + Description for a11y */}
          <SheetHeader className="sr-only">
            <SheetTitle>Copilot</SheetTitle>
            <SheetDescription>AI chat panel</SheetDescription>
          </SheetHeader>
          <div className="flex w-full h-full flex-col justify-between z-5 bg-background rounded-lg">
            {/* Conversation Selector Dropdown */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border/50">
              <Select value={conversationId} onValueChange={handleConversationChange}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue>
                    {(() => {
                      const currentConv = conversations.find(c => c.id === conversationId);
                      return currentConv ? currentConv.title : "New conversation";
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    // Deduplicate conversations by ID, keeping most recent
                    const uniqueConversations = Array.from(
                      new Map(conversations.map(c => [c.id, c])).values()
                    );
                    
                    // Filter to conversations with messages, or include current conversation
                    const conversationsWithMessages = uniqueConversations.filter(
                      conv => conv.messageCount > 0 || conv.id === conversationId
                    );
                    
                    return conversationsWithMessages.length === 0 ? (
                      <SelectItem value={conversationId} disabled>
                        <span className="text-sm text-muted-foreground">No previous conversations</span>
                      </SelectItem>
                    ) : (
                      conversationsWithMessages.map((conv) => (
                        <SelectItem key={conv.id} value={conv.id}>
                          <div className="flex flex-col items-start gap-0.5 min-w-0 w-full">
                            <span className="text-sm truncate w-full">{conv.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(conv.updatedAt).toLocaleDateString()} • {conv.messageCount} messages
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    );
                  })()}
                </SelectContent>
              </Select>
              {/* STT provider is configured server-side (no frontend toggle). */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewConversation}
                className="h-8 px-3 shrink-0"
                title="New conversation"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 w-full overflow-hidden flex flex-col">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col w-full md:max-w-[900px] mx-auto justify-center">
                  <NewChat onPromptClick={(prompt) => handleSubmit(prompt)} />
                </div>
              ) : (
                <div className="w-full h-full flex flex-col flex-1">
                  {false ? (
                    <div className="w-full h-full flex flex-col gap-6 p-4 md:max-w-[900px] mx-auto">
                      {[...Array(5)].map((_, index) => (
                        <div
                          key={index}
                          className={`flex gap-4 ${
                            index % 2 === 0 ? "justify-start" : "justify-end"
                          }`}
                        >
                          {index % 2 !== 0 && (
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-[200px] ml-auto" />
                              <Skeleton className="h-4 w-[350px] ml-auto" />
                            </div>
                          )}
                          <Skeleton className="h-10 w-10 rounded-full" />
                          {index % 2 === 0 && (
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-[250px]" />
                              <Skeleton className="h-4 w-[400px]" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div
                        ref={chatContainerRef}
                        className="flex-1 overflow-y-auto overscroll-contain Chat-Container scrollbar rounded-t-lg w-full"
                        onScroll={() => { updateScrollBottomVisibility(); }}
                      >
                        <div className="mx-auto flex w-full max-w-3xl flex-col px-4 pb-10 pt-4">
                          {memoizedMessages.map((message, index) => (
                            message.role === "user" || message.role === "assistant" ? (
                              <ChatMessageItem
                                key={index}
                                message={message}
                                messages={memoizedMessages}
                                isLast={index === memoizedMessages.length - 1}
                                gettingResponse={
                                  gettingResponse &&
                                  index === memoizedMessages.length - 1
                                }
                                isLastUser={index === lastUserIndex}
                              />
                            ) : (
                              <ToolMessageRenderer
                                key={index}
                                message={message}
                                messages={memoizedMessages}
                                index={index}
                                toolCallMap={toolCallMap}
                              />
                            )
                          ))}
                          {gettingResponse &&
                            memoizedMessages.length > 0 &&
                            memoizedMessages[memoizedMessages.length - 1].role === "user" && (
                            <div className="pl-5 pt-2">
                              <span className="loading-dots">
                                <span></span>
                                <span></span>
                                <span></span>
                              </span>
                            </div>
                          )}
                          <div id="last-message" className="h-1"></div>
                        </div>
                      </div>
                      {showScrollToBottom && (
                        <div
                          className="fixed z-[1050]"
                          style={{ bottom: `${((inputContainerRef.current?.offsetHeight ?? 84) + 12)}px`, left: `${scrollBtnLeft ?? window.innerWidth / 2}px`, transform: 'translateX(-50%)' }}
                        >
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-full bg-card/70 backdrop-blur border border-border/60 shadow-sm text-xs text-foreground hover:bg-card/90 transition-colors flex items-center gap-1.5"
                            onClick={() => scrollContainerToBottom()}
                          >
                            <span>Scroll to bottom</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="opacity-80">
                              <path d="M12 16a1 1 0 0 1-.707-.293l-6-6a1 1 0 1 1 1.414-1.414L12 13.586l5.293-5.293a1 1 0 0 1 1.414 1.414l-6 6A1 1 0 0 1 12 16z"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="w-full md:max-w-[760px] mx-auto px-4 pb-4" ref={inputContainerRef}>
              <ChatInput
                ref={textareaRef}
                onSubmit={handleSubmit}
                gettingResponse={gettingResponse}
                setIsListening={(v) => {
                  if (v) {
                    // Prime audio on the *same user gesture* that starts mic capture.
                    // This avoids AudioContext being stuck suspended, which manifests as “agent not talking”.
                    primeTtsAudio();
                    try { ttsPlayerRef.current?.setDucked(false); } catch {}
                    startListening();
                  } else {
                    stopListening();
                    // User explicitly turned off the mic: end voice keepalive and close the chat WS.
                    keepWsOpenForVoiceRef.current = false;
                    expectingTtsRef.current = false;
                    activeTtsContextIdRef.current = "";
                    try { ttsPlayerRef.current?.stop(); } catch {}
                    if (unsubscribeWSRef.current) {
                      try { unsubscribeWSRef.current(); } catch {}
                      unsubscribeWSRef.current = null;
                    }
                    wsManager.close(conversationId);
                  }
                }}
                isListening={isListening}
                isStarting={isSttStarting}
                voiceLevel={voiceLevel}
                mediaRecorder={mediaRecorder}
                handleStopRequest={handleStopRequest}
                conversationId={conversationId}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AssistantWidget;
