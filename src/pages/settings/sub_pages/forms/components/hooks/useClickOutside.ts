import { useEffect } from "react";

interface ClickOutsideHandler {
  isActive: boolean;
  onOutsideClick: () => void;
}

export function useClickOutside(handler: ClickOutsideHandler) {
  const { isActive, onOutsideClick } = handler;

  useEffect(() => {
    if (!isActive) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element;
      // Don't trigger if clicking on formatting toolbar, buttons, or editable content
      if (
        target.closest('.formatting-toolbar') || 
        target.closest('.formatting-button') || 
        target.closest('[contenteditable]') ||
        target.closest('button') ||
        target.closest('input') || 
        target.closest('textarea')
      ) {
        return;
      }
      onOutsideClick();
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isActive, onOutsideClick]);
}

