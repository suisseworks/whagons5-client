import { useMemo, useEffect, useState, useRef } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import { ContentItem } from "../models";
import Prism from "prismjs";

interface AssistantMessageProps {
  fullContent: string | ContentItem[] | { name: string };
  gettingResponse: boolean;
  reasoning?: string | undefined;
  isLast: boolean;
}

function isContentItemArray(
  content: string | ContentItem[] | { name: string }
): content is ContentItem[] {
  return Array.isArray(content);
}

const AssistantMessageRenderer: React.FC<AssistantMessageProps> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);

  const content = useMemo(() => props.fullContent, [props.fullContent]);
  const reasoning = useMemo(() => props.reasoning, [props.reasoning]);

  const [bufferedContent, setBufferedContent] = useState("");
  const [renderTrigger, setRenderTrigger] = useState(0);

  useEffect(() => {
    const rawContent = String(content || "");
    if (!rawContent) {
      setBufferedContent("");
      return;
    }

    if (!props.gettingResponse) {
      setBufferedContent(rawContent);
      setRenderTrigger(prev => prev + 1);
      return;
    }

    if (rawContent.length > bufferedContent.length) {
      const newContent = rawContent.slice(bufferedContent.length);
      let shouldRender = false;
      let accumulatedBuffer = bufferedContent + newContent;

      if (accumulatedBuffer.includes('|') && /\|\s*$/m.test(accumulatedBuffer)) {
        const lines = accumulatedBuffer.split('\n');
        let tableRowCount = 0;
        let inTable = false;

        for (const line of lines) {
          if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            tableRowCount++;
            inTable = true;
          } else if (inTable && line.trim() === '') {
            shouldRender = true;
            break;
          } else if (inTable && !line.trim().startsWith('|')) {
            shouldRender = tableRowCount >= 3;
            break;
          }
        }
      }

      if (accumulatedBuffer.includes('```')) {
        const codeBlockMatches = accumulatedBuffer.match(/```[\s\S]*?```/g);
        if (codeBlockMatches && codeBlockMatches.length > 0) {
          const lastBlock = codeBlockMatches[codeBlockMatches.length - 1];
          if (lastBlock.endsWith('```')) {
            shouldRender = true;
          }
        }
      }

      if (accumulatedBuffer.includes('\n\n')) {
        shouldRender = true;
      }

      if (accumulatedBuffer.length - bufferedContent.length > 1000) {
        shouldRender = true;
      }

      if (shouldRender) {
        setBufferedContent(accumulatedBuffer);
        setRenderTrigger(prev => prev + 1);
      }
    }
  }, [content, props.gettingResponse, bufferedContent]);

  useEffect(() => {
    if (containerRef.current) {
      const codeElements = containerRef.current.querySelectorAll('code');
      codeElements.forEach((el) => {
        if (el.className) {
          const lang = el.className.replace('language-', '');
          if (lang && Prism.languages[lang]) {
            Prism.highlightElement(el as HTMLElement);
          }
        }
      });
    }
  }, [renderTrigger, bufferedContent]);

  return (
    <div ref={containerRef} className="assistant-message-container p-1">
      {reasoning && (
        <div className="mb-4">
          <button
            onClick={() => setIsReasoningOpen(!isReasoningOpen)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transform transition-transform ${isReasoningOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
            <span>{isReasoningOpen ? "Hide Reasoning" : "View Reasoning"}</span>
          </button>
          {isReasoningOpen && (
            <div className="mt-2 p-4 bg-muted rounded-lg">
              <pre className="whitespace-pre-wrap text-sm font-mono">{reasoning || ""}</pre>
            </div>
          )}
        </div>
      )}

      <div className="markdown-content">
        {typeof content === "string" ? (
          <div>
            <MarkdownRenderer
              isStreaming={props.gettingResponse && props.isLast}
            >
              {bufferedContent || (props.gettingResponse ? "" : String(content || ""))}
            </MarkdownRenderer>
            {props.gettingResponse && props.isLast && (
              <span className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </span>
            )}
          </div>
        ) : isContentItemArray(content) ? (
          <div>
            {content.map((item, index) => (
              <div key={index}>{typeof item.content === "string" ? item.content : JSON.stringify(item.content)}</div>
            ))}
          </div>
        ) : (
          <pre className="text-xs bg-muted p-2 rounded-md overflow-auto">
            {JSON.stringify(content, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};

export default AssistantMessageRenderer;
