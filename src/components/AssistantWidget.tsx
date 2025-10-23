import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Bot } from 'lucide-react';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const FloatingButton: React.FC<{ onClick: () => void }>= ({ onClick }) => {
  const [position, setPosition] = React.useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('assistant:btn-pos');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: 0, y: 0 };
  });
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const dragging = React.useRef(false);
  const start = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const origin = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  React.useEffect(() => {
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
            aria-label="Open AI Assistant"
            onClick={onClick}
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            className="fixed bottom-5 right-5 z-[60] shadow-lg rounded-full size-12 p-0"
            style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
          >
            <Bot className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">AI Assistant</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const AssistantWidget: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);

  // Keyboard shortcut: Ctrl/⌘ + K to open and focus input
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === 'k';
      if ((e.ctrlKey || e.metaKey) && isK) {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => textareaRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Context-aware suggestions (basic): use path to offer quick prompts
  React.useEffect(() => {
    try {
      const path = window.location.pathname;
      const qs: string[] = [];
      if (path.includes('/settings')) {
        qs.push('How do I configure statuses?');
        qs.push('Show me templates best practices');
        qs.push('Where can I manage teams?');
      } else if (path.includes('/tasks') || path === '/' || path.includes('/home')) {
        qs.push('Find my urgent tasks this week');
        qs.push('How to change a task status?');
        qs.push('What does SLA mean here?');
      } else {
        qs.push('What can you do?');
        qs.push('Take me to settings');
        qs.push('Keyboard shortcuts');
      }
      setSuggestions(qs);
    } catch {}
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    setMessages((m) => [...m, { role: 'user', content: value }]);
    setInput('');
    setSubmitting(true);
    try {
      // Placeholder: echo response for now. Wire to backend later.
      await new Promise((r) => setTimeout(r, 200));
      setMessages((m) => [...m, { role: 'assistant', content: 'Got it! This is a placeholder response.' }]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <FloatingButton onClick={() => setOpen(true)} />
      <Dialog modal open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl p-0">
          <div className="p-6 pb-3">
            <DialogHeader>
              <DialogTitle>AI Assistant</DialogTitle>
              <DialogDescription>
                Ask about features, find settings, or get help with tasks.
              </DialogDescription>
            </DialogHeader>
          </div>

          {suggestions.length > 0 && (
            <div className="px-6 pb-2 flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInput(s)}
                  className="text-xs px-2.5 py-1 rounded-full border bg-accent/40 hover:bg-accent transition"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="px-6 max-h-[50vh] overflow-auto space-y-3">
            {messages.length === 0 ? (
              <div className="text-sm text-muted-foreground">Type a question to get started.</div>
            ) : (
              messages.map((m, idx) => (
                <div key={idx} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                  <div className={`inline-block rounded-md px-3 py-2 text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'}`}>
                    {m.content}
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-6 pt-3 flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              ref={textareaRef}
              className="flex-1 min-h-[44px] max-h-[120px] resize-y rounded-md border bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" disabled={submitting || input.trim().length === 0}>
              Send
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AssistantWidget;


