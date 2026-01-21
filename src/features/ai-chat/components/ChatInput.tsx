import React, { useState, useEffect, useRef, forwardRef } from "react";
import { ContentItem, ImageData, PdfData } from "../models";
import WaveIcon from "./WaveIcon";
import { api } from "@/store/api/internalApi";
import { MicOff } from "lucide-react";

interface ChatInputProps {
  onSubmit: (content: string | ContentItem[]) => void;
  gettingResponse: boolean;
  setIsListening?: (isListening: boolean) => void;
  isListening?: boolean;
  voiceLevel?: number; // 0..1 (smoothed)
  handleStopRequest: () => void;
  conversationId: string;
}

const isImageData = (content: any): content is ImageData => {
  return typeof content === "object" && content !== null && "kind" in content && content.kind === "image-url";
};

const isPdfData = (content: any): content is PdfData => {
  return typeof content === "object" && content !== null && "kind" in content && content.kind === "pdf-file";
};

function VoiceVisualizer({ level }: { level: number }) {
  const lvl = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0));
  const bars = 25; // odd number so we have a true center bar
  const center = (bars - 1) / 2;
  const maxD = center;

  return (
    <div
      className="relative w-full h-7 rounded-xl bg-muted/40 border border-border/40 overflow-hidden"
      style={{ ["--wh-lvl" as any]: lvl }}
      aria-hidden="true"
    >
      {/* Center glow beam + ripples */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="wh-voice-beam" />
        <div className="wh-voice-ripple wh-voice-ripple-1" />
        <div className="wh-voice-ripple wh-voice-ripple-2" />
      </div>

      {/* Bars (propagate from center via staggered delay) */}
      <div className="relative h-full flex items-center justify-center gap-[3px] px-3">
        {Array.from({ length: bars }).map((_, i) => {
          const d = Math.abs(i - center);
          const falloff = 1 - (d / maxD) * 0.45; // center tallest, edges shorter
          return (
            <span
              key={i}
              className="wh-voice-bar"
              style={{
                ["--wh-d" as any]: d,
                ["--wh-f" as any]: falloff,
              }}
            />
          );
        })}
      </div>

      <style>{`
        .wh-voice-bar {
          width: 3px;
          height: 18px;
          border-radius: 9999px;
          background: linear-gradient(
            180deg,
            rgba(0, 212, 170, 0.95) 0%,
            rgba(0, 180, 216, 0.95) 55%,
            rgba(0, 120, 212, 0.95) 100%
          );
          opacity: calc(0.30 + var(--wh-lvl) * 0.70);
          transform-origin: center;
          filter: drop-shadow(0 0 calc(6px * var(--wh-lvl)) rgba(0, 180, 216, 0.6));
          animation: wh-voice-bar 920ms cubic-bezier(0.22, 1, 0.36, 1) infinite;
          animation-delay: calc(var(--wh-d) * 26ms);
        }

        /* A “burst” that travels outward (via delay), scaled by voice level */
        @keyframes wh-voice-bar {
          0% {
            transform: scaleY(calc((0.22 + var(--wh-lvl) * 0.25) * var(--wh-f)));
          }
          38% {
            transform: scaleY(calc((0.55 + var(--wh-lvl) * 1.55) * var(--wh-f)));
          }
          100% {
            transform: scaleY(calc((0.22 + var(--wh-lvl) * 0.25) * var(--wh-f)));
          }
        }

        .wh-voice-beam {
          width: min(78%, 520px);
          height: 2px;
          border-radius: 9999px;
          background: radial-gradient(
            closest-side,
            rgba(0, 212, 170, calc(0.10 + var(--wh-lvl) * 0.22)),
            rgba(0, 180, 216, calc(0.12 + var(--wh-lvl) * 0.28)),
            rgba(0, 120, 212, 0)
          );
          filter: blur(0.3px);
          animation: wh-voice-beam 980ms ease-in-out infinite;
        }

        @keyframes wh-voice-beam {
          0%, 100% {
            transform: scaleX(0.85);
            opacity: calc(0.55 + var(--wh-lvl) * 0.45);
          }
          50% {
            transform: scaleX(1);
            opacity: 1;
          }
        }

        .wh-voice-ripple {
          position: absolute;
          left: 50%;
          top: 50%;
          border-radius: 9999px;
          transform: translate(-50%, -50%) scale(0.2);
          opacity: 0;
          border: 1px solid rgba(0, 180, 216, 0.55);
          box-shadow: 0 0 16px rgba(0, 180, 216, 0.18);
          animation: wh-voice-ripple 1200ms ease-out infinite;
          pointer-events: none;
        }

        .wh-voice-ripple-1 {
          width: 34px;
          height: 34px;
          animation-delay: 0ms;
        }

        .wh-voice-ripple-2 {
          width: 52px;
          height: 52px;
          animation-delay: 600ms;
          border-color: rgba(0, 212, 170, 0.45);
        }

        @keyframes wh-voice-ripple {
          0% {
            transform: translate(-50%, -50%) scale(0.22);
            opacity: calc(0.10 + var(--wh-lvl) * 0.45);
          }
          65% {
            opacity: 0;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.9);
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .wh-voice-bar,
          .wh-voice-beam,
          .wh-voice-ripple {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>((props, ref) => {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [textInput, setTextInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  
  // Ref callback to handle both forwarded ref and internal ref
  const setTextareaRef = (element: HTMLTextAreaElement | null) => {
    // Internal ref is always mutable
    textInputRef.current = element;
    if (typeof ref === 'function') {
      ref(element);
    } else if (ref && 'current' in ref) {
      // Type assertion for mutable ref object - refs from useRef are mutable
      (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = element;
    }
  };

  const loadModelsAndConversation = async () => {
    // Model loading can be added here later if needed
  };

  useEffect(() => {
    loadModelsAndConversation();
  }, [props.conversationId]);

  const isUploading = () => pendingUploads > 0;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    await handleFiles(files);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files = Array.from(input.files || []);
    await handleFiles(files);
    if (input) {
      input.value = "";
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData?.items) return;

    const files: File[] = [];
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      await handleFiles(files);
    }
    textInputRef.current?.focus();
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const allowedFiles = files.filter(file => file.type.startsWith("image/") || file.type === "application/pdf");
    if (allowedFiles.length === 0) return;

    setPendingUploads(prev => prev + allowedFiles.length);

    for (const file of allowedFiles) {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      const blobUrl = isImage ? URL.createObjectURL(file) : null;

      let uploadingContentItem: ContentItem;

      if (isImage) {
        uploadingContentItem = {
          content: {
            url: blobUrl!,
            media_type: file.type,
            kind: "image-url",
            isUploading: true,
            serverUrl: "",
          },
          type: "ImageUrl",
          part_kind: "image-url"
        };
      } else {
        uploadingContentItem = {
          content: {
            filename: file.name,
            media_type: file.type,
            kind: "pdf-file",
            isUploading: true,
            serverUrl: "",
          },
          type: "PdfFile",
          part_kind: "pdf-file"
        };
      }

      setContent(prev => [...prev, uploadingContentItem]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.post(`/files/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        const serverFileUrl = response.data?.url || response.data?.data?.url;

        setContent(prev =>
          prev.map(item => {
            if (isImage && isImageData(item.content) && item.content.url === blobUrl && item.content.isUploading) {
              return {
                ...item,
                content: { ...item.content, serverUrl: serverFileUrl, isUploading: false }
              };
            } else if (isPdf && isPdfData(item.content) && item.content.filename === file.name && item.content.isUploading) {
              return {
                ...item,
                content: { ...item.content, serverUrl: serverFileUrl, isUploading: false }
              };
            }
            return item;
          })
        );
      } catch (error) {
        console.error("Error uploading file:", file.name, error);
        setContent(prev =>
          prev.filter(item => {
            if (isImage && isImageData(item.content) && item.content.url === blobUrl) {
              URL.revokeObjectURL(blobUrl!);
              return false;
            }
            if (isPdf && isPdfData(item.content) && item.content.filename === file.name && item.content.isUploading) {
              return false;
            }
            return true;
          })
        );
      } finally {
        setPendingUploads(prev => Math.max(0, prev - 1));
      }
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();

    const hasUploadingItems = content.some(
      item => (isImageData(item.content) || isPdfData(item.content)) && item.content.isUploading === true
    );
    const uploadingSignal = isUploading();

    if (hasUploadingItems || uploadingSignal || props.gettingResponse) {
      return;
    }

    const currentText = textInput.trim();
    const currentContent = content;

    if (currentText || currentContent.length > 0) {
      if (currentText && currentContent.length === 0) {
        props.onSubmit(currentText);
        setContent([]);
        setTextInput("");
        if (textInputRef.current) {
          textInputRef.current.style.height = '56px';
        }
        // Refocus the textarea after submission and clearing
        requestAnimationFrame(() => {
          setTimeout(() => {
            textInputRef.current?.focus();
          }, 10);
        });
      } else if (currentContent.length > 0) {
        const validContent = currentContent.filter(item => {
          if ((isImageData(item.content) || isPdfData(item.content)) && item.content.serverUrl && !item.content.isUploading) {
            return true;
          }
          return false;
        });

        if (currentText) {
          validContent.push({
            content: currentText,
            type: "str",
            part_kind: "text"
          });
        }

        if (validContent.length === 0) {
          console.error("No valid content (text or files) to send.");
          return;
        }

        props.onSubmit(validContent);
        setContent([]);
        setTextInput("");
        if (textInputRef.current) {
          textInputRef.current.style.height = '56px';
        }
        // Refocus the textarea after submission and clearing
        requestAnimationFrame(() => {
          setTimeout(() => {
            textInputRef.current?.focus();
          }, 10);
        });
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const removeContent = (index: number) => {
    const itemToRemove = content[index];
    if (isImageData(itemToRemove.content) && itemToRemove.content.url?.startsWith('blob:')) {
      URL.revokeObjectURL(itemToRemove.content.url);
    }
    setContent(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`flex-1 border border-transparent ${
          isDragging
            ? "border-2 border-dashed border-primary bg-primary/10 rounded-lg p-2"
            : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {content.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-2 pt-2">
            {content.map((item, index) => (
              <div key={index} className="relative group">
                {(() => {
                  const currentContent = item.content;
                  if (isImageData(currentContent)) {
                    return (
                      <div className="relative">
                        <img
                          src={currentContent.url}
                          alt="Uploaded image"
                          className="h-20 w-20 object-cover rounded-lg border border-border"
                        />
                        {currentContent.isUploading && (
                          <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                          </div>
                        )}
                        {!currentContent.isUploading && !currentContent.serverUrl && currentContent.url?.startsWith('blob:') && (
                          <div className="absolute inset-0 bg-red-500/70 rounded-lg flex items-center justify-center text-white" title="Upload failed">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        )}
                        <button
                          type="button" title="Remove" onClick={() => removeContent(index)}
                          className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >✕</button>
                      </div>
                    );
                  } else if (isPdfData(currentContent)) {
                    return (
                      <div className="relative h-20 w-20 flex flex-col items-center justify-center bg-muted rounded-lg border border-border p-1 text-center">
                        <svg className="h-8 w-8 text-red-500 mb-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 11-2 0V4H6v12a3 3 0 106 0V4a.5.5 0 01.5-.5h.5a.5.5 0 01.5.5v12a5 5 0 11-10 0V4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs break-all line-clamp-2" title={currentContent.filename}>{currentContent.filename}</span>
                        {currentContent.isUploading && (
                          <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                          </div>
                        )}
                        {!currentContent.isUploading && !currentContent.serverUrl && (
                          <div className="absolute inset-0 bg-red-500/70 rounded-lg flex items-center justify-center text-white" title="Upload failed">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        )}
                        <button
                          type="button" title="Remove" onClick={() => removeContent(index)}
                          className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >✕</button>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-3 border-x border-t border-b-0 border-[0.5px] border-border/80 rounded-t-2xl rounded-b-none bg-secondary/10 px-3 pt-3 pb-0">
          <div className="flex flex-col gap-2 px-2 py-1 rounded-t-2xl rounded-b-none bg-transparent w-full">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            {props.isListening && (
              <div className="w-full px-2 pb-1">
                <VoiceVisualizer level={props.voiceLevel ?? 0} />
              </div>
            )}

            <textarea
              ref={setTextareaRef}
              rows={1}
              className="flex-1 bg-transparent px-2 py-2 text-sm md:text-base focus:outline-none resize-none text-foreground placeholder-muted-foreground leading-relaxed min-h-[56px] w-full overflow-y-hidden"
              style={{ maxHeight: "180px" }}
              value={textInput}
              onChange={(e) => {
                setTextInput(e.currentTarget.value);
                e.currentTarget.style.height = 'auto';
                e.currentTarget.style.height = `${Math.max(52, e.currentTarget.scrollHeight)}px`;
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Type your message here..."
              autoComplete="off"
              spellCheck={false}
              disabled={isUploading() || props.isListening}
            />

            <div className="flex items-center justify-between pt-1 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="Attach file"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                  disabled={isUploading() || props.gettingResponse}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center">
                {props.gettingResponse ? (
                  props.isListening ? (
                    // Voice combo mode: one button stops both chat + mic.
                    <button
                      type="button"
                      title="Stop voice chat"
                      className="rounded-xl w-11 h-11 bg-muted text-foreground flex items-center justify-center transition-all hover:bg-muted/80 hover:shadow-md hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/25 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => {
                        try { props.handleStopRequest(); } catch {}
                        try { props.setIsListening?.(false); } catch {}
                      }}
                      disabled={isUploading()}
                      aria-label="Stop voice chat"
                    >
                      <MicOff className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      title="Stop response"
                      className="rounded-xl w-11 h-11 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors"
                      onClick={props.handleStopRequest}
                      aria-label="Stop response"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <rect x="6" y="6" width="12" height="12" />
                      </svg>
                    </button>
                  )
                ) : (
                  props.isListening ? (
                    <button
                      type="button"
                      title="Stop listening"
                      className="rounded-xl w-11 h-11 bg-muted text-foreground flex items-center justify-center transition-all hover:bg-muted/80 hover:shadow-md hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/25 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => props.setIsListening?.(false)}
                      disabled={isUploading()}
                      aria-label="Stop voice input"
                    >
                      <MicOff className="w-5 h-5" />
                    </button>
                  ) : textInput.trim() === "" && content.length === 0 ? (
                    <button
                      type="button"
                      title="Start listening"
                      className="rounded-xl w-11 h-11 bg-muted text-foreground flex items-center justify-center transition-all hover:bg-muted/80 hover:shadow-md hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/25 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => props.setIsListening?.(true)}
                      disabled={isUploading()}
                      aria-label="Start voice input"
                    >
                      <WaveIcon />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-xl w-11 h-11 bg-muted text-foreground flex items-center justify-center transition-all hover:bg-muted/80 hover:shadow-md hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/25 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={handleSubmit}
                      aria-label="Send message"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ChatInput.displayName = "ChatInput";

export default ChatInput;
