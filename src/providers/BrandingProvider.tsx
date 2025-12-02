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

const applyBrandingToCSS = (config: BrandingConfig) => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const gradient = config.gradientAccent || `linear-gradient(135deg, ${config.primaryColor}, ${config.accentColor})`;
  const sidebarTextColor = getAccessibleTextColor(config.sidebarColor, config.textColor);
  const sidebarTextSecondary = rgba(sidebarTextColor, 0.75);
  const sidebarTextTertiary = rgba(sidebarTextColor, 0.55);
  const sidebarAccent = computeSidebarAccentColor(config.sidebarColor);
  const sidebarAccentForeground = getAccessibleTextColor(sidebarAccent, sidebarTextColor);

  const tokenMap: Record<string, string> = {
    '--primary': config.primaryColor,
    '--color-primary': config.primaryColor,
    '--sidebar-primary': config.primaryColor,
    '--sidebar-primary-hover': config.primaryColor,
    '--accent': config.accentColor,
    '--color-accent': config.accentColor,
    '--background': config.backgroundColor,
    '--card': config.backgroundColor,
    '--popover': config.backgroundColor,
    '--foreground': config.textColor,
    '--card-foreground': config.textColor,
    '--popover-foreground': config.textColor,
    '--sidebar': config.sidebarColor,
    '--sidebar-foreground': sidebarTextColor,
    '--sidebar-text-primary': sidebarTextColor,
    '--sidebar-text-secondary': sidebarTextSecondary,
    '--sidebar-text-tertiary': sidebarTextTertiary,
    '--muted': config.neutralColor,
    '--muted-foreground': config.textColor,
    '--border': config.neutralColor,
    '--sidebar-border': config.neutralColor,
    '--sidebar-accent': sidebarAccent,
    '--sidebar-accent-foreground': sidebarAccentForeground,
    '--sidebar-primary-foreground': '#ffffff',
    '--gradient-primary': gradient,
    '--gradient-secondary': gradient,
    '--gradient-accent': gradient,
  };

  Object.entries(tokenMap).forEach(([token, value]) => {
    if (value) {
      root.style.setProperty(token, value);
    }
  });
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

    if (merged.config.sidebarColor === LEGACY_DARK_SIDEBAR) {
      merged.config.sidebarColor = DEFAULT_BRANDING_CONFIG.sidebarColor;
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
