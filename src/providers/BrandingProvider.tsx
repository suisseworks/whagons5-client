import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const bigint = Number.parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
};

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (value: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(value)));
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mixColors = (source: string, target: string, amount: number): string => {
  const src = hexToRgb(source);
  const tgt = hexToRgb(target);
  if (!src || !tgt) return source;
  const mixChannel = (channel: number) => src[channel] + (tgt[channel] - src[channel]) * amount;
  return rgbToHex(mixChannel(0), mixChannel(1), mixChannel(2));
};

const ensureHexColor = (color: string, fallback: string): string => {
  const normalized = normalizeHex(color);
  if (normalized) {
    return `#${normalized}`;
  }
  const fallbackNormalized = normalizeHex(fallback);
  return fallbackNormalized ? `#${fallbackNormalized}` : fallback;
};

const getLuminance = (r: number, g: number, b: number) => {
  const srgb = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
};

const getAccessibleTextColor = (background: string, fallback: string): string => {
  const rgb = hexToRgb(background.trim());
  if (!rgb) return fallback;
  const luminance = getLuminance(rgb[0], rgb[1], rgb[2]);
  return luminance > 0.5 ? '#0f172a' : '#f8fafc';
};

const rgba = (hexColor: string, alpha: number): string => {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return hexColor;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
};

const computeSidebarAccentColor = (sidebarColor: string): string => {
  const rgb = hexToRgb(sidebarColor);
  if (!rgb) return '#F1F3F5';
  const luminance = getLuminance(rgb[0], rgb[1], rgb[2]);
  if (luminance < 0.45) {
    return mixColors(sidebarColor, '#ffffff', 0.15);
  }
  return mixColors(sidebarColor, '#000000', 0.08);
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

const applyBrandingToCSS = (config: BrandingConfig) => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const gradient = config.gradientAccent || `linear-gradient(135deg, ${config.primaryColor}, ${config.accentColor})`;

  const defaultPrimaryHex = ensureHexColor(DEFAULT_BRANDING_CONFIG.primaryColor, DEFAULT_BRANDING_CONFIG.primaryColor);
  const defaultAccentHex = ensureHexColor(DEFAULT_BRANDING_CONFIG.accentColor, DEFAULT_BRANDING_CONFIG.accentColor);
  const defaultBackgroundHex = ensureHexColor(DEFAULT_BRANDING_CONFIG.backgroundColor, DEFAULT_BRANDING_CONFIG.backgroundColor);
  const defaultSidebarHex = ensureHexColor(DEFAULT_BRANDING_CONFIG.sidebarColor, DEFAULT_BRANDING_CONFIG.sidebarColor);
  const defaultTextHex = ensureHexColor(DEFAULT_BRANDING_CONFIG.textColor, DEFAULT_BRANDING_CONFIG.textColor);
  const defaultNeutralHex = ensureHexColor(DEFAULT_BRANDING_CONFIG.neutralColor, DEFAULT_BRANDING_CONFIG.neutralColor);
  const surfacePattern = validatePattern(config.surfacePattern);
  const sidebarPattern = validatePattern(config.sidebarPattern);
  const surfacePatternSize = validatePatternSize(config.surfacePatternSize, DEFAULT_BRANDING_CONFIG.surfacePatternSize);
  const sidebarPatternSize = validatePatternSize(config.sidebarPatternSize, DEFAULT_BRANDING_CONFIG.sidebarPatternSize);

  const primaryHex = ensureHexColor(config.primaryColor, defaultPrimaryHex);
  const accentHex = ensureHexColor(config.accentColor, defaultAccentHex);
  const backgroundHex = ensureHexColor(config.backgroundColor, defaultBackgroundHex);
  const sidebarHex = ensureHexColor(config.sidebarColor, defaultSidebarHex);
  const textHex = ensureHexColor(config.textColor, defaultTextHex);
  const neutralHex = ensureHexColor(config.neutralColor, defaultNeutralHex);

  const isDefaultTheme =
    primaryHex === defaultPrimaryHex &&
    accentHex === defaultAccentHex &&
    backgroundHex === defaultBackgroundHex &&
    sidebarHex === defaultSidebarHex &&
    textHex === defaultTextHex &&
    neutralHex === defaultNeutralHex &&
    surfacePattern === DEFAULT_BRANDING_CONFIG.surfacePattern &&
    sidebarPattern === DEFAULT_BRANDING_CONFIG.sidebarPattern &&
    surfacePatternSize === DEFAULT_BRANDING_CONFIG.surfacePatternSize &&
    sidebarPatternSize === DEFAULT_BRANDING_CONFIG.sidebarPatternSize &&
    (config.gradientAccent || '') === (DEFAULT_BRANDING_CONFIG.gradientAccent || '');
  const sidebarTextColor = getAccessibleTextColor(config.sidebarColor, config.textColor);
  const sidebarTextSecondary = rgba(sidebarTextColor, 0.75);
  const sidebarTextTertiary = rgba(sidebarTextColor, 0.55);
  const sidebarAccent = computeSidebarAccentColor(config.sidebarColor);
  const sidebarAccentForeground = getAccessibleTextColor(sidebarAccent, sidebarTextColor);

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
    '--sidebar-foreground': sidebarTextColor,
    '--sidebar-text-primary': sidebarTextColor,
    '--sidebar-text-secondary': sidebarTextSecondary,
    '--sidebar-text-tertiary': sidebarTextTertiary,
    '--muted': neutralHex,
    '--muted-foreground': textHex,
    '--border': neutralHex,
    '--sidebar-border': neutralHex,
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

  const darkBgPrimary = mixColors('#0F0F0F', backgroundHex, 0.18);
  const darkBgSecondary = mixColors('#1A1A1A', backgroundHex, 0.22);
  const darkBgHover = mixColors('#222222', backgroundHex, 0.25);
  const darkBgElevated = mixColors('#181818', backgroundHex, 0.2);
  const darkSidebar = mixColors('#0a0a0a', sidebarHex, 0.2);
  const darkSidebarText = getAccessibleTextColor(darkSidebar, '#f3f4f6');
  const darkSidebarTextSecondary = rgba(darkSidebarText, 0.75);
  const darkSidebarTextTertiary = rgba(darkSidebarText, 0.55);
  const darkSidebarAccent = mixColors(darkSidebar, '#ffffff', 0.08);
  const darkSidebarAccentForeground = getAccessibleTextColor(darkSidebarAccent, darkSidebarText);
  const darkPrimary = mixColors(primaryHex, '#ffffff', 0.08);
  const darkPrimaryHover = mixColors(darkPrimary, '#ffffff', 0.06);
  const darkAccent = mixColors(accentHex, '#ffffff', 0.06);
  const darkNeutral = mixColors('#1F1F1F', neutralHex, 0.25);
  const textPrimary = '#f8fafc';
  const textSecondary = rgba(textPrimary, 0.7);
  const textTertiary = rgba(textPrimary, 0.5);
  const darkBorder = mixColors('#2A2A2A', neutralHex, 0.3);
  const darkBorderMedium = mixColors('#374151', neutralHex, 0.35);

  const darkThemeVariables: Record<string, string> = {
    '--primary': darkPrimary,
    '--color-primary': darkPrimary,
    '--sidebar-primary': darkPrimary,
    '--sidebar-primary-hover': darkPrimaryHover,
    '--sidebar-primary-foreground': '#ffffff',
    '--accent': darkAccent,
    '--color-accent': darkAccent,
    '--background': darkBgPrimary,
    '--card': darkBgSecondary,
    '--popover': darkBgSecondary,
    '--foreground': textPrimary,
    '--card-foreground': textPrimary,
    '--popover-foreground': textPrimary,
    '--muted': darkNeutral,
    '--muted-foreground': textSecondary,
    '--border': darkBorder,
    '--sidebar-border': darkBorderMedium,
    '--sidebar': darkSidebar,
    '--sidebar-foreground': darkSidebarText,
    '--sidebar-text-primary': darkSidebarText,
    '--sidebar-text-secondary': darkSidebarTextSecondary,
    '--sidebar-text-tertiary': darkSidebarTextTertiary,
    '--sidebar-accent': darkSidebarAccent,
    '--sidebar-accent-foreground': darkSidebarAccentForeground,
    '--sidebar-selected-bg': mixColors(darkSidebar, '#ffffff', 0.04),
    '--gradient-primary': gradient,
    '--gradient-secondary': gradient,
    '--gradient-accent': gradient,
    '--ring': mixColors(darkPrimary, '#ffffff', 0.25),
    '--surface-pattern': surfacePattern,
    '--surface-pattern-size': surfacePatternSize,
    '--sidebar-pattern': sidebarPattern,
    '--sidebar-pattern-size': sidebarPatternSize,
    '--bg-primary': darkBgPrimary,
    '--bg-secondary': darkBgSecondary,
    '--bg-hover': darkBgHover,
    '--bg-elevated': darkBgElevated,
    '--text-primary': textPrimary,
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
  ];

  if (!isDefaultTheme) {
    sections.push(
      `.dark {`,
      formatVariableBlock(darkThemeVariables),
      `}`
    );
  }

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
