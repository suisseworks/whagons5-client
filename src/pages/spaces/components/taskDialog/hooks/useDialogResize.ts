import { useState, useRef, useEffect, useCallback } from 'react';

const TASK_DIALOG_WIDTH_STORAGE_KEY = 'whagons_task_dialog_width';
const DEFAULT_WIDTH = 600;
const MIN_WIDTH = 400;
const MAX_WIDTH = 2000;

export function useDialogResize(open: boolean) {
  const [width, setWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(TASK_DIALOG_WIDTH_STORAGE_KEY);
      const savedWidth = saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
      const maxAllowedWidth = Math.min(MAX_WIDTH, window.innerWidth * 0.95);
      return Math.max(MIN_WIDTH, Math.min(maxAllowedWidth, savedWidth));
    }
    return DEFAULT_WIDTH;
  });

  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  const sheetContentRef = useRef<HTMLDivElement>(null);

  // Apply width to DOM element
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        if (sheetContentRef.current) {
          const element = sheetContentRef.current;
          element.style.width = `${width}px`;
          element.style.maxWidth = `${width}px`;
          element.style.minWidth = `${MIN_WIDTH}px`;
          element.style.right = '0px';
          element.style.top = '0px';
          element.style.bottom = '0px';
          element.style.zIndex = '50';
          element.style.position = 'fixed';
          element.style.opacity = '1';
          element.style.visibility = 'visible';
          element.style.display = 'flex';
        }
      });
    }
  }, [open, width]);

  // Save width to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && width !== DEFAULT_WIDTH) {
      localStorage.setItem(TASK_DIALOG_WIDTH_STORAGE_KEY, width.toString());
    }
  }, [width]);

  // Ensure width is within viewport bounds
  useEffect(() => {
    if (open && typeof window !== 'undefined') {
      const maxAllowedWidth = Math.min(MAX_WIDTH, window.innerWidth * 0.95);
      const minAllowedWidth = Math.max(MIN_WIDTH, window.innerWidth * 0.3);
      if (width > maxAllowedWidth) {
        setWidth(maxAllowedWidth);
      } else if (width < minAllowedWidth) {
        setWidth(minAllowedWidth);
      }
    }
  }, [open, width]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // Handle resize mouse move
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      e.preventDefault();
      const newWidth = window.innerWidth - e.clientX;
      const maxAllowedWidth = Math.min(MAX_WIDTH, window.innerWidth * 0.95);
      const clampedWidth = Math.max(MIN_WIDTH, Math.min(maxAllowedWidth, newWidth));
      setWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return {
    width,
    isResizing,
    resizeRef,
    sheetContentRef,
    handleResizeStart,
    MIN_WIDTH,
  };
}
