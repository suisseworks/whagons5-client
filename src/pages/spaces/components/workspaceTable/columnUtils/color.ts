// Small pure helpers for column renderers

import { readableColor } from 'colorizr';

const DEFAULT_DARK_TEXT = '#1a1a1a';
const DEFAULT_LIGHT_TEXT = '#ffffff';

const parseRgb = (input: string): { r: number; g: number; b: number } | null => {
  const value = input.trim();
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    const normalized = hex.length === 3
      ? hex.split('').map((c) => c + c).join('')
      : hex;
    if (normalized.length !== 6) return null;
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return { r, g, b };
  }

  const rgbMatch = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return { r, g, b };
  }

  return null;
};

const relativeLuminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

// Calculate text color based on background color using luminance; fallback to colorizr
export function getContrastTextColor(backgroundColor: string): string {
  if (!backgroundColor) return DEFAULT_DARK_TEXT;
  try {
    const rgb = parseRgb(backgroundColor);
    if (rgb) {
      const lum = relativeLuminance(rgb);
      return lum > 0.55 ? DEFAULT_DARK_TEXT : DEFAULT_LIGHT_TEXT;
    }
    return readableColor(backgroundColor);
  } catch {
    return DEFAULT_DARK_TEXT;
  }
}

