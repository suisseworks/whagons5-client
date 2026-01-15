import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Paperclip, File, X, Smile } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { genericActions } from "@/store/genericSlices";
import { useAuth } from "@/providers/AuthProvider";
import dayjs from "dayjs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getUserDisplayName, getUserInitials } from "./workspaceTable/utils/userUtils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { uploadFile, getFileUrl } from "@/api/assetApi";

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
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const dispatch = useDispatch<any>();
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { user } = useAuth();
  const users = useSelector((state: RootState) => (state.users as any).value);
  const taskNotes = useSelector((state: RootState) => (state.taskNotes as any).value);
  const taskAttachments = useSelector((state: RootState) => (state.taskAttachments as any).value);

  // Listen for open event and load notes
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<any>;
      if (custom.detail) {
        const newTaskId = Number(custom.detail.taskId);
        setTaskId(newTaskId);
        setTaskName(custom.detail.taskName || "Task Notes");
        setIsOpen(true);
        
        // Load task notes and attachments for this task
        dispatch(genericActions.taskNotes.getFromIndexedDB());
        dispatch(genericActions.taskAttachments.getFromIndexedDB());
        // Optionally fetch from API to ensure we have latest data
        dispatch(genericActions.taskNotes.fetchFromAPI({ task_id: newTaskId }));
        dispatch(genericActions.taskAttachments.fetchFromAPI({ task_id: newTaskId }));
      }
    };
    window.addEventListener('wh:openTaskNotes', handler);
    return () => window.removeEventListener('wh:openTaskNotes', handler);
  }, [dispatch]);

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
    
    const noteText = input.trim();
    setInput(""); // Clear input immediately for better UX
    
    try {
      const note: TaskNote = {
        uuid: crypto.randomUUID(),
        task_id: taskId,
        note: noteText,
        user_id: Number(user.id)
      };
      
      console.log("Sending note:", note);
      const result = await dispatch(genericActions.taskNotes.addAsync(note)).unwrap();
      console.log("Note sent successfully:", result);
      
      // Refresh notes from IndexedDB to ensure UI updates
      dispatch(genericActions.taskNotes.getFromIndexedDB());
    } catch (error: any) {
      console.error("Failed to send note:", error);
      // Restore input on error
      setInput(noteText);
      
      // Show user-friendly error message
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to send note. Please try again.";
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !taskId || !user) {
      console.log("File upload blocked:", { file: !!file, taskId, user: !!user });
      return;
    }

    // Check file size (limit to 100MB - same as backend)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      alert(`File size exceeds the maximum limit of ${Math.round(maxSize / 1024 / 1024)}MB. Please choose a smaller file.`);
      e.target.value = '';
      return;
    }

    // Reset the input so the same file can be selected again
    e.target.value = '';

    // Determine file type
    let fileType: 'IMAGE' | 'FILE' | 'VIDEO' | 'VOICE' = 'FILE';
    if (file.type.startsWith('image/')) {
      fileType = 'IMAGE';
    } else if (file.type.startsWith('video/')) {
      fileType = 'VIDEO';
    } else if (file.type.startsWith('audio/')) {
      fileType = 'VOICE';
    }

    // Get file extension
    const fileExtension = file.name.split('.').pop() || '';
    
    try {
        console.log("Uploading file to asset storage:", {
          file_name: file.name,
          file_size: file.size,
          file_type: file.type
        });

        // Step 1: Upload file to asset storage (same as profile pictures)
        const uploadedFile = await uploadFile(file);
        console.log("File uploaded to asset storage:", uploadedFile);

        // Step 2: Store the file URL/ID in the task attachment
        const fileUrl = uploadedFile.url || getFileUrl(uploadedFile.id);
        
        const attachment = {
            uuid: crypto.randomUUID(),
            task_id: taskId,
            type: fileType,
            file_path: fileUrl, // Store the asset URL instead of base64
            file_name: file.name,
            file_extension: fileExtension,
            file_size: file.size,
            user_id: Number(user.id)
        };

        console.log("Creating task attachment record:", attachment);
        const result_data = await dispatch(genericActions.taskAttachments.addAsync(attachment)).unwrap();
        console.log("Attachment created successfully:", result_data);
        
        // Refresh attachments from IndexedDB to ensure UI updates
        dispatch(genericActions.taskAttachments.getFromIndexedDB());
    } catch (error: any) {
        console.error("Failed to upload attachment:", error);
        console.error("Full error object:", JSON.stringify(error, null, 2));
        console.error("Error details:", {
            status: error?.response?.status,
            statusText: error?.response?.statusText,
            data: error?.response?.data,
            message: error?.message,
            code: error?.code,
        });
        
        let errorMessage = "Failed to upload attachment. Please try again.";
        if (error?.response) {
            const response = error.response;
            if (response.data) {
                if (response.data.message) {
                    errorMessage = response.data.message;
                } else if (response.data.errors) {
                    const errors = Object.entries(response.data.errors)
                        .map(([key, value]: [string, any]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                        .join('\n');
                    errorMessage = `Validation errors:\n${errors}`;
                } else if (response.data.error) {
                    errorMessage = response.data.error;
                } else if (typeof response.data === 'string') {
                    errorMessage = response.data;
                }
            }
            if (response.status) {
                errorMessage = `[${response.status}] ${errorMessage}`;
            }
        } else if (error?.message) {
            errorMessage = error.message;
        }
        
        alert(`Error: ${errorMessage}`);
    }
  };

  const getUser = (id: number) => users?.find((u: any) => Number(u.id) === Number(id));

  // Helper function to detect if a character is an emoji
  const isEmoji = (char: string): boolean => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{2934}\u{2935}]|[\u{2190}-\u{21FF}]/u;
    return emojiRegex.test(char);
  };

  // Render note text with emojis larger
  const renderNoteWithEmojis = (text: string) => {
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
    // Focus back on input after selecting emoji
    setTimeout(() => {
      inputRef.current?.focus();
      setEmojiPickerOpen(false);
    }, 100);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md h-[600px] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4" />
            <span className="truncate">{taskName}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            View and add notes and attachments for this task
          </DialogDescription>
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
                        <div className={`rounded-lg px-3 py-2 text-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground border border-border shadow-sm'}`}>
                            <span className="leading-relaxed whitespace-pre-wrap break-words">
                                {renderNoteWithEmojis(item.data.note)}
                            </span>
                        </div>
                    ) : (
                        <div className={`rounded-lg p-2 border text-sm bg-card text-card-foreground border-border shadow-sm ${isMe ? 'border-primary/20' : ''}`}>
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
                  // Allow closing when clicking outside
                  const target = e.target as HTMLElement;
                  // Don't prevent if clicking outside the popover
                  if (!target.closest('[data-radix-popper-content-wrapper]')) {
                    return;
                  }
                  // Prevent closing if clicking inside popover content
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

