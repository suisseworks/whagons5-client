import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Send, Paperclip, Smile } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { genericActions } from "@/store/genericSlices";
import { useAuth } from "@/providers/AuthProvider";
import dayjs from "dayjs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getUserDisplayName, getUserInitials } from "./workspaceTable/userUtils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

interface WorkspaceChatMessage {
  id: number;
  uuid: string;
  workspace_id: number;
  message: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
    url_picture?: string;
  };
}

export default function ChatTab({ workspaceId }: { workspaceId: string | undefined }) {
  const [input, setInput] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const dispatch = useDispatch<any>();
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { user } = useAuth();
  const users = useSelector((state: RootState) => (state.users as any).value);
  const workspaceChat = useSelector((state: RootState) => (state.workspaceChat as any).value);

  // Load messages when workspaceId changes
  useEffect(() => {
    if (workspaceId && !isNaN(Number(workspaceId))) {
      // Load from IndexedDB first
      dispatch(genericActions.workspaceChat.getFromIndexedDB());
      // Then fetch from API
      dispatch(genericActions.workspaceChat.fetchFromAPI({ workspace_id: Number(workspaceId) }));
    }
  }, [workspaceId, dispatch]);

  // Filter messages by workspace_id and sort by created_at
  const messages = workspaceId && !isNaN(Number(workspaceId))
    ? (workspaceChat || [])
        .filter((m: WorkspaceChatMessage) => Number(m.workspace_id) === Number(workspaceId))
        .sort((a: WorkspaceChatMessage, b: WorkspaceChatMessage) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
    : [];

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [messages.length]);

  const handleSend = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!input.trim() || !workspaceId || !user || isNaN(Number(workspaceId))) {
      return;
    }

    const messageText = input.trim();
    setInput("");

    try {
      const chatMessage = {
        uuid: crypto.randomUUID(),
        workspace_id: Number(workspaceId),
        message: messageText,
        user_id: Number(user.id)
      };

      await dispatch(genericActions.workspaceChat.addAsync(chatMessage)).unwrap();

      // Refresh messages from IndexedDB
      dispatch(genericActions.workspaceChat.getFromIndexedDB());
    } catch (error: any) {
      console.error("Failed to send message:", error);
      // Restore input on error
      setInput(messageText);

      const errorMessage = error?.response?.data?.message || error?.message || "Failed to send message. Please try again.";
      alert(`Error: ${errorMessage}`);
    }
  };

  const getUser = (id: number) => users?.find((u: any) => Number(u.id) === Number(id));

  // Helper function to detect if a character is an emoji
  const isEmoji = (char: string): boolean => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{2934}\u{2935}]|[\u{2190}-\u{21FF}]/u;
    return emojiRegex.test(char);
  };

  // Render message text with emojis larger
  const renderMessageWithEmojis = (text: string) => {
    return text.split('').map((char, index) => {
      if (isEmoji(char)) {
        return <span key={index} className="text-2xl inline-block align-middle">{char}</span>;
      }
      return <span key={index} className="text-sm">{char}</span>;
    });
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    setInput(prev => prev + emoji);
    setTimeout(() => {
      inputRef.current?.focus();
      setEmojiPickerOpen(false);
    }, 100);
  };

  return (
    <div className="h-full w-full flex flex-col">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        <MessageSquare className="w-4 h-4" />
        <span>Workspace Chat</span>
      </div>
      <Card className="flex-1 flex overflow-hidden">
        <CardContent className="p-0 flex-1 flex flex-col">
          <div className="flex-1 overflow-auto p-4 space-y-4 bg-muted/10">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                No messages yet. Start the conversation!
              </div>
            )}

            {messages.map((msg: WorkspaceChatMessage) => {
              const isMe = Number(msg.user_id) === Number(user?.id);
              const msgUser = getUser(msg.user_id);

              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <Avatar className="w-8 h-8 border bg-background">
                    <AvatarFallback className="text-xs">{getUserInitials(msgUser)}</AvatarFallback>
                  </Avatar>
                  <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {getUserDisplayName(msgUser)}
                      </span>
                      <span className="text-[10px] text-muted-foreground/70">
                        {dayjs(msg.created_at).format('MMM D, h:mm A')}
                      </span>
                    </div>
                    <div className={`rounded-lg px-3 py-2 text-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground border border-border shadow-sm'}`}>
                      <span className="leading-relaxed whitespace-pre-wrap break-words">
                        {renderMessageWithEmojis(msg.message)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          <div className="border-t p-3 bg-background">
            <div className="flex items-center gap-2">
              <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen} modal={false}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                  >
                    <Smile className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 border-0"
                  align="start"
                  side="top"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  onPointerDownOutside={(e) => {
                    const target = e.target as HTMLElement;
                    if (!target.closest('[data-radix-popper-content-wrapper]')) {
                      return;
                    }
                    e.preventDefault();
                  }}
                >
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    autoFocusSearch={false}
                    theme="light"
                    width={350}
                    height={400}
                    previewConfig={{ showPreview: false }}
                  />
                </PopoverContent>
              </Popover>
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1"
                disabled={!workspaceId || isNaN(Number(workspaceId))}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || !workspaceId || isNaN(Number(workspaceId))}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
