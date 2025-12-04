import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Send, Paperclip } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export default function ChatTab({ workspaceId }: { workspaceId: string | undefined }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: "seed-1",
    role: "assistant",
    content: "Welcome to Space Chat. This is a mock chat for workspace exploration.",
    createdAt: new Date().toISOString()
  }]);
  const [input, setInput] = useState("");
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    // Mock assistant reply
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Echo in space ${workspaceId ?? ""}: ${trimmed}`,
        createdAt: new Date().toISOString()
      }]);
    }, 450);
  };

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFileName(file.name);
    // Simulate an upload
    setTimeout(() => {
      setUploadingFileName(null);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Attached file: ${file.name}`,
        createdAt: new Date().toISOString()
      }]);
    }, 600);
  };

  return (
    <div className="h-full w-full flex flex-col">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        <MessageSquare className="w-4 h-4" />
        <span>Space Chat (mock)</span>
      </div>
      <Card className="flex-1 flex overflow-hidden">
        <CardContent className="p-0 flex-1 flex flex-col">
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {messages.map(m => (
              <div key={m.id} className={`max-w-[80%] ${m.role === "user" ? "ml-auto text-right" : "mr-auto"}`}>
                <div className={`inline-block rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent"}`}>
                  {m.content}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {new Date(m.createdAt).toLocaleTimeString()}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="border-t p-2 flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-muted-foreground cursor-pointer">
              <Paperclip className="w-4 h-4" />
              <input type="file" className="hidden" onChange={handleAttach} />
            </label>
            {uploadingFileName && (
              <span className="text-xs text-muted-foreground">Uploading {uploadingFileName}…</span>
            )}
            <Input
              placeholder="Type a message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
            />
            <Button size="sm" onClick={sendMessage} className="gap-1">
              <Send className="w-4 h-4" />
              Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


