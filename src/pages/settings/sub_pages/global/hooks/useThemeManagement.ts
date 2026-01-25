import { useCallback } from 'react';
import { ThemePreset } from '../types';
import { BrandingConfig, BrandingAssets, BrandingToggles, DEFAULT_BRANDING_CONFIG } from '@/config/branding';
import { getSidebarColorForTheme, getNavbarColorForTheme } from '../utils/themeHelpers';

export const useThemeManagement = (
  brand: BrandingConfig,
  assets: BrandingAssets,
  toggles: BrandingToggles,
  setBrand: (config: BrandingConfig) => void,
  setSelectedTheme: (id: string) => void,
  saveBranding: (data: { config: BrandingConfig; assets: BrandingAssets; toggles: BrandingToggles }) => void
) => {
  const handleThemeApply = useCallback((theme: ThemePreset) => {
    const lightPalette = theme.light.palette;
    const darkPalette = theme.dark.palette;
    
    // Get sidebar and navbar colors (navbar matches sidebar)
    const lightSidebarColor = getSidebarColorForTheme(theme, 'light');
    const lightNavbarColor = getNavbarColorForTheme(theme, 'light');
    
    // For dark mode, always use the palette values directly
    // All presets now have explicit sidebar and navbar values that match
    const darkSidebarColor = darkPalette.sidebar || getSidebarColorForTheme(theme, 'dark');
    // Ensure navbar always matches sidebar in dark mode
    const darkNavbarColor = darkPalette.navbar || darkSidebarColor;
    
    const newConfig: BrandingConfig = {
      ...brand,
      // Light mode colors
      primaryColor: lightPalette.primary,
      accentColor: lightPalette.accent,
      backgroundColor: lightPalette.background,
      sidebarColor: lightSidebarColor,
      navbarColor: lightNavbarColor,
      textColor: lightPalette.text,
      neutralColor: lightPalette.neutral,
      gradientAccent: theme.light.gradient,
      // Clear header gradients - use solid colors from presets
      headerBackgroundGradient: undefined,
      // Dark mode colors - explicitly set all values
      darkPrimaryColor: darkPalette.primary,
      darkAccentColor: darkPalette.accent,
      darkBackgroundColor: darkPalette.background,
      darkSidebarColor: darkSidebarColor,
      darkNavbarColor: darkNavbarColor, // Always set to match sidebar
      darkTextColor: darkPalette.text,
      darkNeutralColor: darkPalette.neutral,
      darkGradientAccent: theme.dark.gradient,
      // Clear dark header gradients - use solid colors from presets
      darkHeaderBackgroundGradient: undefined,
      // Patterns
      surfacePattern: theme.patterns?.surface ?? DEFAULT_BRANDING_CONFIG.surfacePattern,
      sidebarPattern: theme.patterns?.sidebar ?? DEFAULT_BRANDING_CONFIG.sidebarPattern,
      surfacePatternSize: theme.patterns?.surfaceSize ?? DEFAULT_BRANDING_CONFIG.surfacePatternSize,
      sidebarPatternSize: theme.patterns?.sidebarSize ?? DEFAULT_BRANDING_CONFIG.sidebarPatternSize
    };
    
    // Update local state
    setBrand(newConfig);
    
    // Apply theme immediately without confirmation
    saveBranding({
      config: newConfig,
      assets: { ...assets },
      toggles: { ...toggles }
    });
  }, [brand, assets, toggles, setBrand, saveBranding]);

  return { handleThemeApply };
};
