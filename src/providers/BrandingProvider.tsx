import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { convert, lighten, darken, mix, luminance } from 'colorizr';
import {
  BRANDING_STORAGE_KEY,
  BrandingAssets,
  BrandingConfig,
  BrandingToggles,
  DEFAULT_BRANDING_ASSETS,
  DEFAULT_BRANDING_CONFIG,
  DEFAULT_BRANDING_TOGGLES,
} from '@/config/branding';

type BrandingState = {
  config: BrandingConfig;
  assets: BrandingAssets;
  toggles: BrandingToggles;
};

type BrandingContextValue = BrandingState & {
  saveBranding: (nextState: Partial<BrandingState>) => void;
};

const LEGACY_DARK_SIDEBAR = '#08111f';
const LEGACY_LIGHT_BACKGROUND = '#f4fffb';
const LEGACY_NEUTRAL = '#d7f5ef';

const defaultState: BrandingState = {
  config: DEFAULT_BRANDING_CONFIG,
  assets: DEFAULT_BRANDING_ASSETS,
  toggles: DEFAULT_BRANDING_TOGGLES,
};

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const normalizeHex = (hex: string): string | null => {
  if (!HEX_COLOR_REGEX.test(hex)) return null;
  let normalized = hex.replace('#', '').toLowerCase();
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((char) => char + char)
      .join('');
  }
  return normalized;
};

const isLegacyColor = (value?: string, legacy?: string) => {
  if (!value || !legacy) return false;
  const normalizedValue = normalizeHex(value);
  const normalizedLegacy = normalizeHex(legacy);
  return Boolean(normalizedValue && normalizedLegacy && normalizedValue === normalizedLegacy);
};

const hexToRgb = (hex: string): [number, number, number] | null => {
  try {
    // Use colorizr to convert hex to rgb
    const rgbString = convert(hex, 'rgb');
    // rgbString is like "rgb(255 0 68)" - extract numbers
    const match = rgbString.match(/rgb\((\d+)\s+(\d+)\s+(\d+)\)/);
    if (match) {
      return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
    }
    return null;
  } catch {
    // Fallback to manual parsing if colorizr fails
    const normalized = normalizeHex(hex);
    if (!normalized) return null;
    const bigint = Number.parseInt(normalized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return [r, g, b];
  }
};

const rgbToHex = (r: number, g: number, b: number) => {
  try {
    // Use colorizr to convert rgb to hex
    return convert(`rgb(${r} ${g} ${b})`, 'hex');
  } catch {
    // Fallback to manual conversion if colorizr fails
    const toHex = (value: number) => {
      const clamped = Math.max(0, Math.min(255, Math.round(value)));
      return clamped.toString(16).padStart(2, '0');
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
};

const mixColors = (source: string, target: string, amount: number): string => {
  try {
    // Use colorizr's mix function which handles any color format (hex, oklch, rgb, hsl, etc.)
    // Amount is 0-1, colorizr expects percentage 0-100
    return mix(source, target, amount * 100);
  } catch {
    // Fallback: try converting both to hex first, then use colorizr mix
    try {
      const sourceHex = convert(source, 'hex');
      const targetHex = convert(target, 'hex');
      return mix(sourceHex, targetHex, amount * 100);
    } catch {
      // Final fallback to manual hex-based mixing
      const src = hexToRgb(source);
      const tgt = hexToRgb(target);
      if (!src || !tgt) return source;
      const mixChannel = (channel: number) => src[channel] + (tgt[channel] - src[channel]) * amount;
      return rgbToHex(mixChannel(0), mixChannel(1), mixChannel(2));
    }
  }
};

const isGradient = (color: string | undefined): boolean => {
  return !!(color && color.trim().startsWith('linear-gradient'));
};

/**
 * Extracts a solid color from a gradient by parsing the first color stop.
 * Used for primary/accent colors which should always be solid.
 */
const extractSolidColorFromGradient = (gradient: string, fallback: string): string => {
  if (!isGradient(gradient)) {
    return fallback;
  }
  
  try {
    const match = gradient.match(/linear-gradient\([^,]+,\s*([^,%)\s]+(?:\s+\d+%)?)/);
    if (match && match[1]) {
      let firstColor = match[1].trim().replace(/\s+\d+%$/, '').trim();
      
      if (isGradient(firstColor)) {
        return fallback;
      }
      
      // Use colorizr to convert any color format to hex
      try {
        const hex = convert(firstColor, 'hex');
        // Ensure it's properly formatted as hex
        return hex.startsWith('#') ? hex : `#${hex}`;
      } catch {
        // If colorizr can't convert it, try to use as-is if it looks valid
        if (firstColor.startsWith('oklch(') || firstColor.startsWith('rgb(') || firstColor.startsWith('hsl(') || firstColor.startsWith('#')) {
          return firstColor;
        }
        return fallback;
      }
    }
  } catch {
    // If parsing fails, return fallback
  }
  
  return fallback;
};

const ensureHexColor = (color: string, fallback: string, allowGradients: boolean = false): string => {
  // For primary/accent colors, always extract solid color from gradients
  if (isGradient(color)) {
    if (allowGradients) {
      return color; // Allow gradients for backgrounds
    }
    return extractSolidColorFromGradient(color, fallback);
  }
  
  // Use colorizr to convert any color format to hex
  try {
    // Try to convert using colorizr (handles hex, oklch, rgb, hsl, etc.)
    const hex = convert(color, 'hex');
    // Ensure it's properly formatted as hex
    return hex.startsWith('#') ? hex : `#${hex}`;
  } catch {
    // If colorizr fails, check if it's already a valid hex
    const normalized = normalizeHex(color);
    if (normalized) {
      return `#${normalized}`;
    }
    
    // If color is invalid, try fallback
    if (isGradient(fallback)) {
      if (allowGradients) {
        return fallback;
      }
      return extractSolidColorFromGradient(fallback, fallback);
    }
    
    // Try to convert fallback using colorizr
    try {
      const fallbackHex = convert(fallback, 'hex');
      return fallbackHex.startsWith('#') ? fallbackHex : `#${fallbackHex}`;
    } catch {
      // Final fallback: use fallback as-is if it looks like a valid color format
      if (fallback && (fallback.startsWith('oklch(') || fallback.startsWith('rgb(') || fallback.startsWith('hsl(') || fallback.startsWith('#'))) {
        return fallback;
      }
      const fallbackNormalized = normalizeHex(fallback);
      return fallbackNormalized ? `#${fallbackNormalized}` : fallback;
    }
  }
};

const getAccessibleTextColor = (background: string, fallback: string): string => {
  // If it's a gradient, we can't determine text color from it - use fallback
  if (isGradient(background)) {
    return fallback;
  }
  
  try {
    // Use colorizr's luminance function which handles any color format
    const lum = luminance(background);
    // luminance returns 0-1, use 0.5 as threshold
    return lum > 0.5 ? '#0f172a' : '#f8fafc';
  } catch {
    // Fallback: try to extract lightness from OKLCH format
    if (background.startsWith('oklch(')) {
      const match = background.match(/oklch\(([\d.]+)/);
      if (match) {
        const lightness = parseFloat(match[1]);
        return lightness > 0.5 ? '#0f172a' : '#f8fafc';
      }
    }
    
    // Final fallback: try converting to hex and using manual calculation
    try {
      const hex = convert(background, 'hex');
      const rgb = hexToRgb(hex);
      if (rgb) {
        // Manual luminance calculation as last resort
        const srgb = [rgb[0], rgb[1], rgb[2]].map((value) => {
          const channel = value / 255;
          return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
        });
        const manualLum = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
        return manualLum > 0.5 ? '#0f172a' : '#f8fafc';
      }
    } catch {
      // If all else fails, return fallback
    }
    
    return fallback;
  }
};

const rgba = (color: string, alpha: number): string => {
  try {
    // Convert any color format to RGB using colorizr, then add alpha
    const rgbString = convert(color, 'rgb');
    // rgbString is like "rgb(255 0 68)", convert to rgba
    return rgbString.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  } catch {
    // Fallback for edge cases
    return color;
  }
};

const computeSidebarAccentColor = (sidebarColor: string): string => {
  // If it's a gradient, we can't compute accent from it - return a neutral fallback
  if (isGradient(sidebarColor)) {
    return '#F1F3F5';
  }
  
  try {
    // Use colorizr's luminance function to check brightness
    const lum = luminance(sidebarColor);
    // For dark sidebars, lighten; for light sidebars, darken
    if (lum < 0.45) {
      return lighten(sidebarColor, 8); // lighten by 8%
    }
    return darken(sidebarColor, 5); // darken by 5%
  } catch {
    // Fallback: use mixColors with white/black
    try {
      const lum = luminance(sidebarColor);
      if (lum < 0.45) {
        return mixColors(sidebarColor, '#ffffff', 0.15);
      }
      return mixColors(sidebarColor, '#000000', 0.08);
    } catch {
      // Final fallback
      return '#F1F3F5';
    }
  }
};

const BRANDING_STYLE_ELEMENT_ID = 'branding-theme-overrides';

// Whitelist of allowed pattern names
const ALLOWED_PATTERNS = [
  'none',
  // Predefined safe patterns from theme presets
  'radial-gradient(circle at 12px 12px, rgba(0, 0, 0, 0.06) 2px, transparent 0), radial-gradient(circle at 4px 4px, rgba(255, 255, 255, 0.08) 2px, transparent 0)',
  'repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.08) 0 6px, transparent 6px 12px), radial-gradient(circle at 10px 10px, rgba(255, 255, 255, 0.08) 1.5px, transparent 0)',
  'radial-gradient(circle at 2px 2px, rgba(74, 144, 226, 0.08) 1px, transparent 0)',
  'linear-gradient(90deg, rgba(74, 144, 226, 0.03) 0%, transparent 50%, rgba(74, 144, 226, 0.03) 100%)',
] as const;

// Safe CSS gradient function names
const ALLOWED_GRADIENT_FUNCTIONS = [
  'radial-gradient',
  'linear-gradient',
  'repeating-linear-gradient',
  'repeating-radial-gradient',
] as const;

// Dangerous patterns that should never be allowed
const DANGEROUS_PATTERNS = [
  /url\(/i,
  /expression\(/i,
  /javascript:/i,
  /@import/i,
  /@charset/i,
  /<script/i,
  /<\/script>/i,
  /on\w+\s*=/i, // Event handlers like onclick=
  /import\s+/i,
  /from\s+['"]/i,
] as const;

/**
 * Validates a pattern string to prevent CSS injection.
 * Returns a safe pattern value or 'none' if invalid.
 */
const validatePattern = (pattern: string | undefined | null): string => {
  if (!pattern) return 'none';
  
  const trimmed = pattern.trim();
  if (!trimmed || trimmed === '') return 'none';
  
  // Check against whitelist first (fast path)
  if ((ALLOWED_PATTERNS as readonly string[]).includes(trimmed)) {
    return trimmed;
  }
  
  // Check for dangerous patterns
  for (const dangerousPattern of DANGEROUS_PATTERNS) {
    if (dangerousPattern.test(trimmed)) {
      console.warn(`[BrandingProvider] Rejected dangerous pattern: ${trimmed.substring(0, 50)}...`);
      return 'none';
    }
  }
  
  // Validate it's a safe CSS gradient function
  // Must start with an allowed gradient function
  const startsWithAllowedFunction = ALLOWED_GRADIENT_FUNCTIONS.some(func => 
    trimmed.toLowerCase().startsWith(func.toLowerCase() + '(')
  );
  
  if (!startsWithAllowedFunction) {
    console.warn(`[BrandingProvider] Pattern must start with an allowed gradient function: ${trimmed.substring(0, 50)}...`);
    return 'none';
  }
  
  // Additional validation: ensure it's a well-formed CSS gradient
  // Check for balanced parentheses
  let parenCount = 0;
  for (const char of trimmed) {
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
    if (parenCount < 0) {
      console.warn(`[BrandingProvider] Invalid pattern syntax (unbalanced parentheses): ${trimmed.substring(0, 50)}...`);
      return 'none';
    }
  }
  
  if (parenCount !== 0) {
    console.warn(`[BrandingProvider] Invalid pattern syntax (unbalanced parentheses): ${trimmed.substring(0, 50)}...`);
    return 'none';
  }
  
  // Check length limit to prevent extremely long patterns
  if (trimmed.length > 1000) {
    console.warn(`[BrandingProvider] Pattern too long (max 1000 chars): ${trimmed.length} chars`);
    return 'none';
  }
  
  return trimmed;
};

/**
 * Validates a pattern size string to ensure it's a safe CSS size value.
 * Returns a safe size value or the default if invalid.
 */
const validatePatternSize = (
  size: string | undefined | null,
  defaultValue: string
): string => {
  if (!size) return defaultValue;
  
  const trimmed = size.trim();
  if (!trimmed || trimmed === '') return defaultValue;
  
  // Pattern size should match: <number><unit> or <number><unit> <number><unit>
  // Allowed units: px, em, rem, %, vh, vw
  // Examples: "32px", "32px 32px", "24px 24px", "1em 1em", "50% 50%"
  const SIZE_PATTERN = /^(\d+(\.\d+)?(px|em|rem|%|vh|vw))(\s+(\d+(\.\d+)?(px|em|rem|%|vh|vw)))?$/i;
  
  if (!SIZE_PATTERN.test(trimmed)) {
    console.warn(`[BrandingProvider] Invalid pattern size format: ${trimmed}. Using default: ${defaultValue}`);
    return defaultValue;
  }
  
  // Extract numeric values and validate ranges
  const numericValues = trimmed.match(/\d+(\.\d+)?/g);
  if (numericValues) {
    for (const value of numericValues) {
      const num = parseFloat(value);
      // Reasonable limits: 0-1000px, 0-100em, 0-100rem, 0-100%
      if (isNaN(num) || num < 0 || num > 1000) {
        console.warn(`[BrandingProvider] Pattern size out of range: ${trimmed}. Using default: ${defaultValue}`);
        return defaultValue;
      }
    }
  }
  
  // Check length limit
  if (trimmed.length > 50) {
    console.warn(`[BrandingProvider] Pattern size too long: ${trimmed.length} chars. Using default: ${defaultValue}`);
    return defaultValue;
  }
  
  return trimmed;
};

const getBrandingStyleElement = () => {
  let styleEl = document.getElementById(BRANDING_STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = BRANDING_STYLE_ELEMENT_ID;
    document.head.appendChild(styleEl);
  }
  return styleEl;
};

const formatVariableBlock = (tokens: Record<string, string>) => {
  return Object.entries(tokens)
    .filter(([, value]) => Boolean(value))
    .map(([token, value]) => `  ${token}: ${value};`)
    .join('\n');
};

// Helper to convert any color format to CSS-compatible format (preserve gradients)
const convertToCssColor = (color: string, fallback: string): string => {
  // If it's a gradient, return as-is (gradients are already CSS-compatible)
  if (isGradient(color)) {
    return color;
  }
  
  // Use colorizr to convert to hex for CSS compatibility
  try {
    const hex = convert(color, 'hex');
    return hex.startsWith('#') ? hex : `#${hex}`;
  } catch {
    // Fallback to ensureHexColor which also uses colorizr internally
    return ensureHexColor(color, fallback, false);
  }
};

const applyBrandingToCSS = (config: BrandingConfig) => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  
  // Determine gradient from header background or create from primary/accent
  let gradient: string;
  if (config.headerBackgroundGradient) {
    gradient = config.headerBackgroundGradient;
  } else {
    // Fallback: create gradient from solid colors (convert to hex for CSS)
    const primaryCss = convertToCssColor(config.primaryColor, DEFAULT_BRANDING_CONFIG.primaryColor);
    const accentCss = convertToCssColor(config.accentColor, DEFAULT_BRANDING_CONFIG.accentColor);
    gradient = `linear-gradient(135deg, ${primaryCss}, ${accentCss})`;
  }

  const defaultPrimaryHex = ensureHexColor(DEFAULT_BRANDING_CONFIG.primaryColor, DEFAULT_BRANDING_CONFIG.primaryColor, false);
  const defaultAccentHex = ensureHexColor(DEFAULT_BRANDING_CONFIG.accentColor, DEFAULT_BRANDING_CONFIG.accentColor, false);
  const defaultBackgroundHex = ensureHexColor(DEFAULT_BRANDING_CONFIG.backgroundColor, DEFAULT_BRANDING_CONFIG.backgroundColor, true);
  const defaultSidebarHex = ensureHexColor(DEFAULT_BRANDING_CONFIG.sidebarColor, DEFAULT_BRANDING_CONFIG.sidebarColor, true);
  const defaultNavbarHex = ensureHexColor(DEFAULT_BRANDING_CONFIG.navbarColor || '#ffffff', '#ffffff', true);
  const defaultTextHex = ensureHexColor(DEFAULT_BRANDING_CONFIG.textColor, DEFAULT_BRANDING_CONFIG.textColor, false);
  const defaultNeutralHex = ensureHexColor(DEFAULT_BRANDING_CONFIG.neutralColor, DEFAULT_BRANDING_CONFIG.neutralColor, false);
  const surfacePattern = validatePattern(config.surfacePattern);
  const sidebarPattern = validatePattern(config.sidebarPattern);
  const surfacePatternSize = validatePatternSize(config.surfacePatternSize, DEFAULT_BRANDING_CONFIG.surfacePatternSize);
  const sidebarPatternSize = validatePatternSize(config.sidebarPatternSize, DEFAULT_BRANDING_CONFIG.sidebarPatternSize);

  // Convert colors to CSS-compatible format
  // Primary/accent colors: always solid (no gradients allowed)
  const primaryHex = ensureHexColor(config.primaryColor, defaultPrimaryHex, false);
  const accentHex = ensureHexColor(config.accentColor, defaultAccentHex, false);
  // Background colors: allow gradients
  const backgroundHex = ensureHexColor(config.backgroundColor, defaultBackgroundHex, true);
  const sidebarHex = ensureHexColor(config.sidebarColor, defaultSidebarHex, true);
  const navbarColor = config.navbarColor || defaultNavbarHex;
  const navbarHex = ensureHexColor(navbarColor, defaultNavbarHex, true);
  const textHex = ensureHexColor(config.textColor, defaultTextHex, false);
  const neutralHex = ensureHexColor(config.neutralColor, defaultNeutralHex, false);
  
  // Header background: use gradient if set, otherwise use navbar color
  // If gradient is set, use it for both navbar and header-background
  const headerBackground = config.headerBackgroundGradient || navbarHex;
  const navbarForCSS = config.headerBackgroundGradient || navbarHex;

  const isDefaultTheme =
    primaryHex === defaultPrimaryHex &&
    accentHex === defaultAccentHex &&
    backgroundHex === defaultBackgroundHex &&
    sidebarHex === defaultSidebarHex &&
    navbarHex === defaultNavbarHex &&
    textHex === defaultTextHex &&
    neutralHex === defaultNeutralHex &&
    surfacePattern === DEFAULT_BRANDING_CONFIG.surfacePattern &&
    sidebarPattern === DEFAULT_BRANDING_CONFIG.sidebarPattern &&
    surfacePatternSize === DEFAULT_BRANDING_CONFIG.surfacePatternSize &&
    sidebarPatternSize === DEFAULT_BRANDING_CONFIG.sidebarPatternSize &&
    !config.headerBackgroundGradient;
  const sidebarTextColor = getAccessibleTextColor(config.sidebarColor, config.textColor);
  const sidebarTextSecondary = rgba(sidebarTextColor, 0.75);
  const sidebarTextTertiary = rgba(sidebarTextColor, 0.55);
  const sidebarAccent = computeSidebarAccentColor(config.sidebarColor);
  const sidebarAccentForeground = getAccessibleTextColor(sidebarAccent, sidebarTextColor);

  // Determine if sidebar is dark (for Night Ops theme which uses dark sidebar in light mode)
  // If sidebar is a gradient, default to light sidebar
  let isDarkSidebar = false;
  if (!isGradient(sidebarHex)) {
    try {
      // Use colorizr's luminance function
      const lum = luminance(sidebarHex);
      isDarkSidebar = lum < 0.3; // Luminance below 0.3 is considered dark
    } catch {
      // Fallback: try extracting lightness from OKLCH format
      if (sidebarHex.startsWith('oklch(')) {
        const match = sidebarHex.match(/oklch\(([\d.]+)/);
        if (match) {
          const lightness = parseFloat(match[1]);
          isDarkSidebar = lightness < 0.3;
        }
      }
    }
  }
  
  // For gradients, use a solid color for header (extract first color or use white)
  const sidebarHeaderColor = isGradient(sidebarHex) 
    ? '#ffffff' 
    : (isDarkSidebar ? sidebarHex : '#ffffff');
  const sidebarBorderColor = isGradient(sidebarHex)
    ? neutralHex
    : (isDarkSidebar ? 'rgba(255, 255, 255, 0.12)' : neutralHex);
  
  const lightThemeVariables: Record<string, string> = {
    '--primary': primaryHex,
    '--color-primary': primaryHex,
    '--sidebar-primary': primaryHex,
    '--sidebar-primary-hover': primaryHex,
    '--sidebar-primary-foreground': '#ffffff',
    '--accent': accentHex,
    '--color-accent': accentHex,
    '--background': backgroundHex,
    '--card': backgroundHex,
    '--popover': backgroundHex,
    '--foreground': textHex,
    '--card-foreground': textHex,
    '--popover-foreground': textHex,
    '--sidebar': sidebarHex,
    '--navbar': navbarForCSS,
    '--header-background': headerBackground,
    '--sidebar-header': sidebarHeaderColor,
    '--sidebar-foreground': sidebarTextColor,
    '--sidebar-text-primary': sidebarTextColor,
    '--sidebar-text-secondary': sidebarTextSecondary,
    '--sidebar-text-tertiary': sidebarTextTertiary,
    '--muted': neutralHex,
    '--muted-foreground': textHex,
    '--border': neutralHex,
    '--sidebar-border': sidebarBorderColor,
    '--sidebar-accent': sidebarAccent,
    '--sidebar-accent-foreground': sidebarAccentForeground,
    '--gradient-primary': gradient,
    '--gradient-secondary': gradient,
    '--gradient-accent': gradient,
    '--surface-pattern': surfacePattern,
    '--surface-pattern-size': surfacePatternSize,
    '--sidebar-pattern': sidebarPattern,
    '--sidebar-pattern-size': sidebarPatternSize,
  };

  // Use explicit dark mode colors if provided, otherwise generate
  // Primary/accent: always solid (no gradients)
  const darkPrimaryHex = config.darkPrimaryColor 
    ? ensureHexColor(config.darkPrimaryColor, primaryHex, false) 
    : mixColors(primaryHex, '#ffffff', 0.08);
  const darkAccentHex = config.darkAccentColor 
    ? ensureHexColor(config.darkAccentColor, accentHex, false) 
    : mixColors(accentHex, '#ffffff', 0.06);
  // Backgrounds: allow gradients
  const darkBackgroundHex = config.darkBackgroundColor 
    ? ensureHexColor(config.darkBackgroundColor, '#0F0F0F', true) 
    : (isGradient(backgroundHex) ? backgroundHex : mixColors('#0F0F0F', backgroundHex, 0.18));
  const darkSidebarHex = config.darkSidebarColor 
    ? ensureHexColor(config.darkSidebarColor, sidebarHex, true) 
    : (isGradient(sidebarHex) ? sidebarHex : mixColors('#0a0a0a', sidebarHex, 0.2));
  // Dark mode navbar: use gradient if set, otherwise use darkNavbarColor or fallback to light navbar, NOT sidebar
  const darkNavbarColor = config.darkNavbarColor || navbarColor;
  const darkNavbarHex = ensureHexColor(darkNavbarColor, '#0F0F0F', true);
  const darkTextHex = config.darkTextColor ? ensureHexColor(config.darkTextColor, '#f8fafc', false) : '#f8fafc';
  const darkNeutralHex = config.darkNeutralColor 
    ? ensureHexColor(config.darkNeutralColor, neutralHex, false) 
    : mixColors('#1F1F1F', neutralHex, 0.25);
  
  // Dark mode header background: use gradient if set, otherwise use navbar color
  // If gradient is set, use it for both navbar and header-background
  const darkHeaderBackground = config.darkHeaderBackgroundGradient || darkNavbarHex;
  const darkNavbarForCSS = config.darkHeaderBackgroundGradient || darkNavbarHex;
  
  const darkBgSecondary = mixColors('#1A1A1A', darkBackgroundHex, 0.22);
  const darkBgHover = mixColors('#222222', darkBackgroundHex, 0.25);
  const darkBgElevated = mixColors('#181818', darkBackgroundHex, 0.2);
  const darkSidebarText = getAccessibleTextColor(darkSidebarHex, darkTextHex);
  const darkSidebarTextSecondary = rgba(darkSidebarText, 0.75);
  const darkSidebarTextTertiary = rgba(darkSidebarText, 0.55);
  const darkSidebarAccent = mixColors(darkSidebarHex, '#ffffff', 0.08);
  const darkSidebarAccentForeground = getAccessibleTextColor(darkSidebarAccent, darkSidebarText);
  const darkPrimaryHover = mixColors(darkPrimaryHex, '#ffffff', 0.06);
  const textSecondary = rgba(darkTextHex, 0.7);
  const textTertiary = rgba(darkTextHex, 0.5);
  const darkBorder = mixColors('#2A2A2A', darkNeutralHex, 0.3);
  const darkBorderMedium = mixColors('#374151', darkNeutralHex, 0.35);

  const darkThemeVariables: Record<string, string> = {
    '--primary': darkPrimaryHex,
    '--color-primary': darkPrimaryHex,
    '--sidebar-primary': darkPrimaryHex,
    '--sidebar-primary-hover': darkPrimaryHover,
    '--sidebar-primary-foreground': '#ffffff',
    '--accent': darkAccentHex,
    '--color-accent': darkAccentHex,
    '--background': darkBackgroundHex,
    '--card': darkBgSecondary,
    '--popover': darkBgSecondary,
    '--foreground': darkTextHex,
    '--card-foreground': darkTextHex,
    '--popover-foreground': darkTextHex,
    '--muted': darkNeutralHex,
    '--muted-foreground': textSecondary,
    '--border': darkBorder,
    '--sidebar-border': darkBorderMedium,
    '--sidebar': darkSidebarHex,
    '--navbar': darkNavbarForCSS,
    '--header-background': darkHeaderBackground,
    '--sidebar-header': darkSidebarHex,
    '--sidebar-foreground': darkSidebarText,
    '--sidebar-text-primary': darkSidebarText,
    '--sidebar-text-secondary': darkSidebarTextSecondary,
    '--sidebar-text-tertiary': darkSidebarTextTertiary,
    '--sidebar-accent': darkSidebarAccent,
    '--sidebar-accent-foreground': darkSidebarAccentForeground,
    '--sidebar-selected-bg': mixColors(darkSidebarHex, '#ffffff', 0.04),
    '--gradient-primary': darkHeaderBackground,
    '--gradient-secondary': darkHeaderBackground,
    '--gradient-accent': darkHeaderBackground,
    '--ring': mixColors(darkPrimaryHex, '#ffffff', 0.25),
    '--surface-pattern': surfacePattern,
    '--surface-pattern-size': surfacePatternSize,
    '--sidebar-pattern': sidebarPattern,
    '--sidebar-pattern-size': sidebarPatternSize,
    '--bg-primary': darkBackgroundHex,
    '--bg-secondary': darkBgSecondary,
    '--bg-hover': darkBgHover,
    '--bg-elevated': darkBgElevated,
    '--text-primary': darkTextHex,
    '--text-secondary': textSecondary,
    '--text-tertiary': textTertiary,
    '--border-subtle': darkBorder,
    '--border-medium': darkBorderMedium,
  };

  const tokensToClear = new Set([
    ...Object.keys(lightThemeVariables),
    ...Object.keys(darkThemeVariables),
  ]);

  tokensToClear.forEach((token) => {
    root.style.removeProperty(token);
  });

  const styleElement = getBrandingStyleElement();
  const sections = [
    `:root:not(.dark) {`,
    formatVariableBlock(lightThemeVariables),
    `}`,
    `.dark {`,
    formatVariableBlock(darkThemeVariables),
    `}`
  ];

  styleElement.textContent = sections.filter(Boolean).join('\n');
};

const persistState = (state: BrandingState) => {
  try {
    localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore write errors
  }
};

const loadBrandingFromStorage = (): BrandingState => {
  if (typeof window === 'undefined') return defaultState;
  try {
    const raw = localStorage.getItem(BRANDING_STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<BrandingState>;
    const merged: BrandingState = {
      config: { ...DEFAULT_BRANDING_CONFIG, ...(parsed.config ?? {}) },
      assets: { ...DEFAULT_BRANDING_ASSETS, ...(parsed.assets ?? {}) },
      toggles: { ...DEFAULT_BRANDING_TOGGLES, ...(parsed.toggles ?? {}) },
    };

    let persistNeeded = false;
    if (merged.config.sidebarColor === LEGACY_DARK_SIDEBAR) {
      merged.config.sidebarColor = DEFAULT_BRANDING_CONFIG.sidebarColor;
      persistNeeded = true;
    }

    if (isLegacyColor(merged.config.backgroundColor, LEGACY_LIGHT_BACKGROUND)) {
      merged.config.backgroundColor = DEFAULT_BRANDING_CONFIG.backgroundColor;
      persistNeeded = true;
    }

    if (isLegacyColor(merged.config.neutralColor, LEGACY_NEUTRAL)) {
      merged.config.neutralColor = DEFAULT_BRANDING_CONFIG.neutralColor;
      persistNeeded = true;
    }

    // Validate and sanitize pattern values to prevent CSS injection
    const validatedSurfacePattern = validatePattern(merged.config.surfacePattern);
    const validatedSidebarPattern = validatePattern(merged.config.sidebarPattern);
    const validatedSurfacePatternSize = validatePatternSize(
      merged.config.surfacePatternSize,
      DEFAULT_BRANDING_CONFIG.surfacePatternSize
    );
    const validatedSidebarPatternSize = validatePatternSize(
      merged.config.sidebarPatternSize,
      DEFAULT_BRANDING_CONFIG.sidebarPatternSize
    );

    if (
      merged.config.surfacePattern !== validatedSurfacePattern ||
      merged.config.sidebarPattern !== validatedSidebarPattern ||
      merged.config.surfacePatternSize !== validatedSurfacePatternSize ||
      merged.config.sidebarPatternSize !== validatedSidebarPatternSize
    ) {
      merged.config.surfacePattern = validatedSurfacePattern;
      merged.config.sidebarPattern = validatedSidebarPattern;
      merged.config.surfacePatternSize = validatedSurfacePatternSize;
      merged.config.sidebarPatternSize = validatedSidebarPatternSize;
      persistNeeded = true;
    }

    if (persistNeeded) {
      persistState(merged);
    }

    return merged;
  } catch {
    return defaultState;
  }
};

export const BrandingProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<BrandingState>(() => loadBrandingFromStorage());

  useEffect(() => {
    applyBrandingToCSS(state.config);
  }, [state.config]);

  const saveBranding = useCallback((nextState: Partial<BrandingState>) => {
    setState((prev) => {
      const merged: BrandingState = {
        config: nextState.config ? { ...prev.config, ...nextState.config } : prev.config,
        assets: nextState.assets ? { ...prev.assets, ...nextState.assets } : prev.assets,
        toggles: nextState.toggles ? { ...prev.toggles, ...nextState.toggles } : prev.toggles,
      };
      persistState(merged);
      applyBrandingToCSS(merged.config);
      return merged;
    });
  }, []);

  const value = useMemo<BrandingContextValue>(
    () => ({
      ...state,
      saveBranding,
    }),
    [state, saveBranding],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};
