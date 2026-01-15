// Small pure helpers for column renderers

import { readableColor } from 'colorizr';

// Calculate text color based on background color using colorizr
export function getContrastTextColor(backgroundColor: string): string {
  if (!backgroundColor) return '#1a1a1a';
  try {
    return readableColor(backgroundColor);
  } catch {
    return '#1a1a1a';
  }
}

