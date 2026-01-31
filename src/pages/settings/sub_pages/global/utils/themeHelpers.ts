import { ThemePreset } from '../types';
import { BrandingConfig, DEFAULT_BRANDING_CONFIG } from '@/config/branding';
import { SIDEBAR_LIGHT, SIDEBAR_DARK, CUSTOM_THEME_ID, PRESET_THEMES } from './constants';
import { convert } from 'colorizr';

export const getSidebarColorForTheme = (theme: ThemePreset, mode: 'light' | 'dark' = 'light') => {
  const palette = mode === 'dark' ? theme.dark.palette : theme.light.palette;
  
  // For dark mode, always use the dark palette's sidebar value
  if (mode === 'dark') {
    return palette.sidebar ?? SIDEBAR_DARK;
  }
  
  // For light mode, check sidebarTone first, then fall back to palette
  if (theme.sidebarTone === 'dark') return SIDEBAR_DARK;
  if (theme.sidebarTone === 'light') return SIDEBAR_LIGHT;
  return palette.sidebar ?? SIDEBAR_LIGHT;
};

export const getNavbarColorForTheme = (theme: ThemePreset, mode: 'light' | 'dark' = 'light') => {
  // Navbar should always match sidebar
  return getSidebarColorForTheme(theme, mode);
};

export const getPresetIdForConfig = (config: BrandingConfig) => {
  const preset = PRESET_THEMES.find((theme) => {
    const palette = theme.light.palette;
    return (
      palette.primary === config.primaryColor &&
      palette.accent === config.accentColor &&
      palette.background === config.backgroundColor &&
      getSidebarColorForTheme(theme, 'light') === config.sidebarColor &&
      palette.text === config.textColor &&
      palette.neutral === config.neutralColor &&
      (theme.patterns?.surface ?? DEFAULT_BRANDING_CONFIG.surfacePattern) ===
        (config.surfacePattern ?? DEFAULT_BRANDING_CONFIG.surfacePattern) &&
      (theme.patterns?.sidebar ?? DEFAULT_BRANDING_CONFIG.sidebarPattern) ===
        (config.sidebarPattern ?? DEFAULT_BRANDING_CONFIG.sidebarPattern) &&
      (theme.patterns?.surfaceSize ?? DEFAULT_BRANDING_CONFIG.surfacePatternSize) ===
        (config.surfacePatternSize ?? DEFAULT_BRANDING_CONFIG.surfacePatternSize) &&
      (theme.patterns?.sidebarSize ?? DEFAULT_BRANDING_CONFIG.sidebarPatternSize) ===
        (config.sidebarPatternSize ?? DEFAULT_BRANDING_CONFIG.sidebarPatternSize)
    );
  });
  return preset?.id ?? CUSTOM_THEME_ID;
};
