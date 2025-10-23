import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Image as ImageIcon, Smile } from 'lucide-react';

export default function CreateMessageDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (data: { title: string; content: string; pinned: boolean }) => void; }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { if (open) { setTitle(''); setContent(''); setPinned(false); } }, [open]);
  const canPost = content.trim().length > 0;

  const insertAtCursor = (text: string) => {
    const el = textareaRef.current; if (!el) { setContent((prev) => prev + text); return; }
    const start = el.selectionStart ?? el.value.length; const end = el.selectionEnd ?? el.value.length;
    const next = `${el.value.slice(0, start)}${text}${el.value.slice(end)}`; setContent(next);
    requestAnimationFrame(() => { el.focus(); const caret = start + text.length; el.setSelectionRange(caret, caret); });
  };
  const handlePickEmoji = (e: string) => insertAtCursor(e);
  const handleChooseImage = (file: File) => { if (!file || !file.type.startsWith('image/')) return; const reader = new FileReader(); reader.onload = () => insertAtCursor(`\n![image](${String(reader.result || '')})\n`); reader.readAsDataURL(file); };
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => { const items = e.clipboardData?.items; if (!items) return; for (let i=0;i<items.length;i++){ const it = items[i]; if (it.kind==='file'){ const f=it.getAsFile(); if (f && f.type.startsWith('image/')){ e.preventDefault(); handleChooseImage(f); break; } } } };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>Write an announcement or update for this board.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="msg-title">Title</Label>
            <Input id="msg-title" placeholder="Optional title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="msg-content">Content</Label>
            <div className="flex items-center gap-2 mb-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" title="Insert emoji"><Smile className="h-4 w-4" /></Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px]">
                  <div className="grid grid-cols-8 gap-1 text-lg">
                    {['😀','😅','😂','😍','👍','🙏','🔥','🎉','✅','❗','❓','🕒','📎','📷','🤝','🚀','💡','📌','📣','😎','🤔','😮','😇','😴','😢','😡','🤯'].map((e) => (
                      <button key={e} className="hover:bg-accent rounded" onClick={() => handlePickEmoji(e)}>{e}</button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Button type="button" variant="outline" size="icon" className="h-8 w-8" title="Insert image" onClick={() => fileInputRef.current?.click()}>
                <ImageIcon className="h-4 w-4" />
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f=e.target.files?.[0]; if (f) handleChooseImage(f); }} />
            </div>
            <textarea id="msg-content" rows={6} value={content} onChange={(e) => setContent(e.target.value)} onPaste={handlePaste} ref={textareaRef} className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent" />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Pin this message</label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { if (content.trim()) { onSubmit({ title: title.trim(), content: content.trim(), pinned }); onOpenChange(false); } }} disabled={!canPost}>Post</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


