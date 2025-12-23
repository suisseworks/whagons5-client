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
    neutralHex === defaultNeutralHex;
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
