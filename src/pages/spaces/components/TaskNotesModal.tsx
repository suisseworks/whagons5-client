import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Paperclip, File, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { genericActions } from "@/store/genericSlices";
import { useAuth } from "@/providers/AuthProvider";
import dayjs from "dayjs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getUserDisplayName, getUserInitials } from "./workspaceTable/userUtils";

interface TaskNotesModalProps {}

interface TaskNote {
    uuid: string;
    task_id: number;
    note: string;
    user_id: number;
}

export default function TaskNotesModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [taskName, setTaskName] = useState<string>("");
  const [input, setInput] = useState("");
  const dispatch = useDispatch<any>();
  const endRef = useRef<HTMLDivElement | null>(null);

  const { user } = useAuth();
  const users = useSelector((state: RootState) => (state.users as any).value);
  const taskNotes = useSelector((state: RootState) => (state.taskNotes as any).value);
  const taskAttachments = useSelector((state: RootState) => (state.taskAttachments as any).value);

  // Listen for open event
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<any>;
      if (custom.detail) {
        setTaskId(Number(custom.detail.taskId));
        setTaskName(custom.detail.taskName || "Task Notes");
        setIsOpen(true);
      }
    };
    window.addEventListener('wh:openTaskNotes', handler);
    return () => window.removeEventListener('wh:openTaskNotes', handler);
  }, []);

  // Combine and sort notes/attachments
  const items = taskId ? [
    ...(taskNotes || [])
      .filter((n: any) => Number(n.task_id) === taskId)
      .map((n: any) => ({ type: 'note', data: n, date: new Date(n.created_at) })),
    ...(taskAttachments || [])
      .filter((a: any) => Number(a.task_id) === taskId)
      .map((a: any) => ({ type: 'attachment', data: a, date: new Date(a.created_at) }))
  ].sort((a, b) => a.date.getTime() - b.date.getTime()) : [];

  // Scroll to bottom on open or new item
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [isOpen, items.length]);

  const handleSend = async (e?: React.MouseEvent) => {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    if (!input.trim() || !taskId || !user) {
        console.log("Send blocked:", { input: input.trim(), taskId, user });
        return;
    }
    
    try {
      const note: TaskNote = {
        uuid: crypto.randomUUID(),
        task_id: taskId,
        note: input.trim(),
        user_id: Number(user.id)
      };
      
      console.log("Sending note:", note);
      await dispatch(genericActions.taskNotes.addAsync(note)).unwrap();
      setInput("");
    } catch (error) {
      console.error("Failed to send note:", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !taskId || !user) return;

    // Mock upload for now (or use real upload service if available)
    // For real implementation: Upload to S3/Storage, get URL, then save
    
    // Temporary mock using data URL for immediate feedback
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const result = ev.target?.result as string;
        
        try {
            await dispatch(genericActions.taskAttachments.addAsync({
                uuid: crypto.randomUUID(),
                task_id: taskId,
                type: file.type.startsWith('image/') ? 'IMAGE' : 'FILE',
                file_path: result, // storing base64 for now as placeholder
                file_name: file.name,
                file_extension: file.name.split('.').pop() || '',
                file_size: file.size,
                user_id: user.id
            })).unwrap();
        } catch (error) {
            console.error("Failed to upload attachment:", error);
        }
    };
    reader.readAsDataURL(file);
  };

  const getUser = (id: number) => users?.find((u: any) => Number(u.id) === Number(id));

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md h-[600px] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4" />
            <span className="truncate">{taskName}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
          {items.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              No notes or attachments yet.
            </div>
          )}
          
          {items.map((item, idx) => {
            const isMe = Number(item.data.user_id) === Number(user?.id);
            const itemUser = getUser(item.data.user_id);
            
            return (
              <div key={idx} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <Avatar className="w-8 h-8 border bg-background">
                    <AvatarFallback className="text-xs">{getUserInitials(itemUser)}</AvatarFallback>
                </Avatar>
                <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground">
                            {getUserDisplayName(itemUser)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70">
                            {dayjs(item.date).format('MMM D, h:mm A')}
                        </span>
                    </div>
                    
                    {item.type === 'note' ? (
                        <div className={`rounded-lg px-3 py-2 text-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-white border shadow-sm'}`}>
                            {item.data.note}
                        </div>
                    ) : (
                        <div className={`rounded-lg p-2 border text-sm bg-white shadow-sm ${isMe ? 'border-primary/20' : ''}`}>
                            {item.data.type === 'IMAGE' ? (
                                <div className="space-y-1">
                                    <img 
                                        src={item.data.file_path} 
                                        alt={item.data.file_name} 
                                        className="max-w-full h-auto rounded max-h-48 object-cover" 
                                    />
                                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">{item.data.file_name}</div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <File className="w-4 h-4 text-blue-500" />
                                    <span className="truncate max-w-[150px]">{item.data.file_name}</span>
                                    <span className="text-xs text-muted-foreground">({Math.round(item.data.file_size / 1024)}KB)</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div className="p-3 border-t bg-background">
          <div className="flex items-center gap-2">
            <label className="cursor-pointer p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors">
                <Paperclip className="w-4 h-4" />
                <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
            <Input 
                value={input} 
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                placeholder="Type a note..."
                className="flex-1"
            />
            <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
                <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

