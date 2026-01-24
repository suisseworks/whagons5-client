import { convert, luminance } from 'colorizr';
import { BrandingConfig } from '@/config/branding';

// Helper to check if a color value is a gradient
export const isGradientValue = (color: string | undefined): boolean => {
  return !!(color && color.startsWith('linear-gradient'));
};

// Helper to get CSS-compatible color or gradient
export const getCssColorOrGradient = (color: string | undefined, fallback: string): string => {
  if (!color) return fallback;
  if (isGradientValue(color)) {
    // It's already a gradient string, use it directly
    return color;
  }
  // Convert OKLCH to hex if needed
  try {
    if (color.startsWith('#')) {
      return color;
    }
    return convert(color, 'hex');
  } catch {
    return color;
  }
};

// Helper to get contrasting text color based on background luminance
export const getContrastingTextColor = (bgColor: string): string => {
  try {
    const lum = luminance(bgColor);
    // luminance returns 0-1, use 0.5 as threshold
    return lum > 0.5 ? '#0f172a' : '#ffffff';
  } catch {
    // Fallback to white for dark backgrounds (assume dark if we can't compute)
    return '#ffffff';
  }
};

export const previewGradient = (brand: BrandingConfig): string => {
  // Use headerBackgroundGradient if set, otherwise use navbarColor, otherwise create from primary/accent
  if (brand.headerBackgroundGradient) {
    return brand.headerBackgroundGradient;
  }
  if (brand.navbarColor) {
    // Check if navbarColor is a gradient
    if (isGradientValue(brand.navbarColor)) {
      return brand.navbarColor;
    }
    // Use solid navbarColor as background
    return getCssColorOrGradient(brand.navbarColor, '#ffffff');
  }
  // Fallback to gradient between primary and accent
  const primaryHex = getCssColorOrGradient(brand.primaryColor, '#000000');
  const accentHex = getCssColorOrGradient(brand.accentColor, '#000000');
  return `linear-gradient(130deg, ${primaryHex}, ${accentHex})`;
};

export const darkPreviewGradient = (brand: BrandingConfig): string => {
  // Use darkHeaderBackgroundGradient if set, otherwise use darkNavbarColor, otherwise create from dark primary/accent
  if (brand.darkHeaderBackgroundGradient) {
    return brand.darkHeaderBackgroundGradient;
  }
  if (brand.darkNavbarColor) {
    // Check if darkNavbarColor is a gradient
    if (isGradientValue(brand.darkNavbarColor)) {
      return brand.darkNavbarColor;
    }
    // Use solid darkNavbarColor as background
    return getCssColorOrGradient(brand.darkNavbarColor, '#0F0F0F');
  }
  // Fallback to gradient between dark primary and accent, or light colors
  const darkPrimaryHex = getCssColorOrGradient(brand.darkPrimaryColor || brand.primaryColor, '#000000');
  const darkAccentHex = getCssColorOrGradient(brand.darkAccentColor || brand.accentColor, '#000000');
  return `linear-gradient(130deg, ${darkPrimaryHex}, ${darkAccentHex})`;
};
