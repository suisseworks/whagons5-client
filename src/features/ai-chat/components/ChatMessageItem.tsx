import { useMemo } from "react";
import { Message, ContentItem, ImageData, PdfData } from "../models";
import AssistantMessageRenderer from "./AssistantMessageRenderer";

interface ChatMessageItemProps {
  message: Message;
  messages: Message[];
  isLast: boolean;
  gettingResponse: boolean;
  isLastUser?: boolean;
}

const isImageData = (content: any): content is ImageData => {
  return typeof content === "object" && content !== null && "kind" in content && content.kind === "image-url";
};

const isPdfData = (content: any): content is PdfData => {
  return typeof content === "object" && content !== null && "kind" in content && content.kind === "pdf-file";
};

const ChatMessageItem: React.FC<ChatMessageItemProps> = (props) => {
  const isUser = useMemo(() => props.message.role === "user", [props.message.role]);
  const isLast = useMemo(() => props.isLast, [props.isLast]);

  const renderUserContent = () => {
    const content = props.message.content as string | ContentItem[] | { name: string };
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      if (content.length === 0) return "";
      const elements = content.map((item, index) => {
        if (typeof item === "object" && item !== null) {
          if (typeof (item as ContentItem).content === "string") {
            return <span key={index} className="mr-1">{(item as ContentItem).content as string}</span>;
          }
          const inner = (item as ContentItem).content as any;
          if (inner && typeof inner === "object") {
            if ((item as ContentItem).type === "ImageUrl" || inner.kind === "image-url") {
              const imageContent = inner as ImageData;
              return (
                <div key={index} className="my-2 w-full flex justify-end">
                  <img
                    src={imageContent.serverUrl || imageContent.url}
                    alt="User uploaded image"
                    className="max-w-full h-auto rounded-lg shadow-lg hover:shadow-xl transition-shadow max-w-md"
                  />
                </div>
              );
            }
            if (inner.kind === "pdf-file") {
              const pdfContent = inner as PdfData;
              return (
                <div key={index} className="my-1 p-2 bg-muted rounded text-sm flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 11-2 0V4H6v12a3 3 0 106 0V4a.5.5 0 01.5-.5h.5a.5.5 0 01.5.5v12a5 5 0 11-10 0V4z" clipRule="evenodd" />
                  </svg>
                  <span>{pdfContent.filename || "PDF File"}</span>
                </div>
              );
            }
          }
        }
        return null;
      });
      return <div className="flex flex-col w-full">{elements}</div>;
    }
    if (content && typeof content === "object") {
      if ((content as any).name) return (content as any).name || "[No name provided]";
      try {
        return JSON.stringify(content);
      } catch (e) {
        return "[Complex object]";
      }
    }
    return "[Unknown content format]";
  };

  return (
    <div
      className={`md:max-w-[900px] w-full flex message pt-3 pl-3 pr-3 ${
        isUser ? " user justify-end items-start pt-4" : " assistant justify-start items-start"
      }`}
      id={props.isLastUser ? "last-user-message" : undefined}
    >
      <div
        className={`message-content ${
          isUser ? "max-w-[85%] flex items-end self-start" : "w-full"
        } rounded-tl-3xl rounded-tr-3xl rounded-bl-3xl rounded-br-[6px] px-3 py-2 ${
          isUser ? "bubble-user" : "bubble-assistant"
        } break-words overflow-hidden`}
      >
        {isUser ? (
          <div className="text-sm md:text-base flex flex-col gap-8 w-full items-end">
            <div className="p-2">{renderUserContent()}</div>
          </div>
        ) : (
          <AssistantMessageRenderer
            fullContent={props.message.content as any}
            gettingResponse={props.gettingResponse && isLast}
            isLast={isLast}
            reasoning={props.message.reasoning}
          />
        )}
      </div>
    </div>
  );
};

export default ChatMessageItem;
