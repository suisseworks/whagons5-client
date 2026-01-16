import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useLanguage } from '@/providers/LanguageProvider';

import type { TaskDialogProps } from './taskDialog/types';

const TaskDialogContent = lazy(() => import('./taskDialog/TaskDialogContent'));

declare global {
  interface Window {
    __taskDialogClickTime?: number;
  }
}

const TASK_DIALOG_WIDTH_STORAGE_KEY = 'whagons_task_dialog_width';
const DEFAULT_WIDTH = 600;
const MIN_WIDTH = 400;

function isPerfEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('wh-debug-taskdialog-perf') === 'true';
  } catch {
    return false;
  }
}

// Lightweight shell that renders immediately.
// Heavy logic mounts lazily so the Sheet animation can start within a frame.
export default function TaskDialog({ open, onOpenChange, mode, workspaceId, task }: TaskDialogProps) {
  const { t } = useLanguage();
  const perfEnabled = isPerfEnabled();
  const [contentMounted, setContentMounted] = useState(false);
  const sheetContentRef = useRef<HTMLDivElement>(null);
  const clickTimeRef = useRef<number | undefined>(undefined);
  const prevOpenRef = useRef<boolean>(false);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        // If something inside the Sheet triggers open, mark a click time.
        window.__taskDialogClickTime = performance.now();
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  // Capture click time on open transition (ideally set by parent right before opening).
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    if (open && !wasOpen) {
      const candidate = window.__taskDialogClickTime;
      clickTimeRef.current = typeof candidate === 'number' ? candidate : performance.now();

      if (perfEnabled) {
        // eslint-disable-next-line no-console
        console.log('[PERF] TaskDialog: open requested', {
          clickTime: clickTimeRef.current,
          hasParentClickMark: typeof candidate === 'number',
        });
      }
    }

    if (!open) {
      clickTimeRef.current = undefined;
    }
  }, [open, perfEnabled]);

  // Mount heavy content after first paint so Sheet can animate immediately.
  useEffect(() => {
    if (!open) {
      setContentMounted(false);
      return;
    }
    const t = requestAnimationFrame(() => setContentMounted(true));
    return () => cancelAnimationFrame(t);
  }, [open]);

  // Perf: click -> animation start + first rAF after open.
  useEffect(() => {
    if (!open || !perfEnabled) return;
    const clickTime = clickTimeRef.current;
    if (clickTime == null) return;

    const el = sheetContentRef.current;

    const raf1 = requestAnimationFrame(() => {
      // eslint-disable-next-line no-console
      console.log(`[PERF] TaskDialog: click→rAF1 ${(performance.now() - clickTime).toFixed(2)}ms`);
      requestAnimationFrame(() => {
        // eslint-disable-next-line no-console
        console.log(`[PERF] TaskDialog: click→rAF2 ${(performance.now() - clickTime).toFixed(2)}ms`);
      });
    });

    let removeAnimStart: (() => void) | undefined;
    if (el) {
      const onAnimStart = () => {
        // eslint-disable-next-line no-console
        console.log(`[PERF] TaskDialog: click→animationstart ${(performance.now() - clickTime).toFixed(2)}ms`);
      };
      el.addEventListener('animationstart', onAnimStart, { once: true });
      removeAnimStart = () => el.removeEventListener('animationstart', onAnimStart);
    }

    return () => {
      cancelAnimationFrame(raf1);
      removeAnimStart?.();
    };
  }, [open, perfEnabled]);

  const [width] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_WIDTH;
    const saved = localStorage.getItem(TASK_DIALOG_WIDTH_STORAGE_KEY);
    const savedWidth = saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
    return Number.isFinite(savedWidth) ? savedWidth : DEFAULT_WIDTH;
  });

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        ref={sheetContentRef}
        side="right"
        style={{
          width: `${width}px`,
          maxWidth: `${width}px`,
          minWidth: `${MIN_WIDTH}px`,
          right: 0,
          top: 0,
          bottom: 0,
        }}
        className="p-0 m-0 top-0 gap-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 flex flex-col h-full bg-background"
      >
        {contentMounted ? (
          <Suspense
            fallback={
              <>
                <SheetHeader className="sr-only">
                  <SheetTitle>{mode === 'edit' ? t('task.editTask', 'Edit Task') : t('task.createNewTask', 'Create New Task')}</SheetTitle>
                  <SheetDescription>Loading task dialog</SheetDescription>
                </SheetHeader>
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-sm text-muted-foreground animate-pulse">Loading...</div>
                </div>
              </>
            }
          >
            <TaskDialogContent
              open={open}
              onOpenChange={onOpenChange}
              mode={mode}
              workspaceId={workspaceId}
              task={task}
              clickTime={clickTimeRef.current}
              perfEnabled={perfEnabled}
            />
          </Suspense>
        ) : (
          <>
            <SheetHeader className="sr-only">
              <SheetTitle>{mode === 'edit' ? 'Edit Task' : 'Create New Task'}</SheetTitle>
              <SheetDescription>Loading task dialog</SheetDescription>
            </SheetHeader>
            <div className="flex-1 flex items-center justify-center">
              <div className="text-sm text-muted-foreground animate-pulse">Loading...</div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
