import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGlobe,
  faPalette,
  faMagicWandSparkles,
  faImage
} from "@fortawesome/free-solid-svg-icons";
import { convert, luminance } from "colorizr";
import Color from "color";

import SettingsLayout from "../components/SettingsLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerAlpha,
  ColorPickerFormat,
  ColorPickerEyeDropper,
  ColorPickerOutput,
} from "@/components/ui/shadcn-io/color-picker";
import { cn } from "@/lib/utils";
import WhagonsCheck from "@/assets/WhagonsCheck";
import {
  BrandingAssets,
  BrandingConfig,
  BrandingToggles,
  DEFAULT_BRANDING_CONFIG,
} from "@/config/branding";
import { LANGUAGE_OPTIONS } from "@/config/languages";
import { useBranding } from "@/providers/BrandingProvider";
import { useLanguage } from "@/providers/LanguageProvider";
import { getCelebrationType, setCelebrationType, type CelebrationType } from "@/utils/confetti";
import { getFontStyle, setFontStyle, initFontStyle, type FontStyle } from "@/utils/fontStyle";

const SIDEBAR_LIGHT = '#FAFBFC';
const SIDEBAR_DARK = '#08111f';

type ThemePreset = {
  id: string;
  label: string;
  description: string;
  light: {
    gradient: string;
    palette: {
      primary: string;
      accent: string;
      background: string;
      text: string;
      neutral: string;
      sidebar?: string;
      navbar?: string;
    };
  };
  dark: {
    gradient: string;
    palette: {
      primary: string;
      accent: string;
      background: string;
      text: string;
      neutral: string;
      sidebar?: string;
      navbar?: string;
    };
  };
  badge?: string;
  sidebarTone?: 'light' | 'dark';
  patterns?: {
    surface?: string;
    sidebar?: string;
    surfaceSize?: string;
    sidebarSize?: string;
  };
};

const RETRO_SURFACE_PATTERN =
  "radial-gradient(circle at 12px 12px, rgba(0, 0, 0, 0.06) 2px, transparent 0), radial-gradient(circle at 4px 4px, rgba(255, 255, 255, 0.08) 2px, transparent 0)";
const RETRO_SIDEBAR_PATTERN =
  "repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.08) 0 6px, transparent 6px 12px), radial-gradient(circle at 10px 10px, rgba(255, 255, 255, 0.08) 1.5px, transparent 0)";

const PRESET_THEMES: ThemePreset[] = [
  {
    id: "jade-ops",
    label: "Jade Ops",
    description: "Vibrant teal primary with electric indigo highlights",
    light: {
      gradient: "linear-gradient(130deg, oklch(0.72 0.12 175) 0%, oklch(0.55 0.22 264) 100%)",
      palette: {
        primary: "oklch(0.72 0.12 175)",
        accent: "oklch(0.55 0.22 264)",
        background: "oklch(0.99 0.01 175)",
        text: "oklch(0.20 0.02 250)",
        neutral: "oklch(0.94 0.03 175)",
        sidebar: SIDEBAR_LIGHT,
        navbar: SIDEBAR_LIGHT
      }
    },
    dark: {
      gradient: "linear-gradient(130deg, oklch(0.75 0.15 175) 0%, oklch(0.68 0.26 250) 100%)",
      palette: {
        primary: "oklch(0.75 0.15 175)",
        accent: "oklch(0.68 0.26 250)",
        background: "oklch(0.12 0.01 180)",
        text: "oklch(0.96 0.01 175)",
        neutral: "oklch(0.22 0.02 180)",
        sidebar: "oklch(0.10 0.01 180)",
        navbar: "oklch(0.10 0.01 180)"
      }
    },
    sidebarTone: "light"
  },
  {
    id: "ember",
    label: "Ember Sunrise",
    description: "Warm amber gradients with charcoal typography",
    light: {
      gradient: "linear-gradient(130deg, oklch(0.70 0.19 40) 0%, oklch(0.62 0.25 25) 100%)",
      palette: {
        primary: "oklch(0.70 0.19 40)",
        accent: "oklch(0.62 0.25 25)",
        background: "oklch(0.99 0.01 40)",
        text: "oklch(0.30 0.02 250)",
        neutral: "oklch(0.94 0.05 40)",
        sidebar: SIDEBAR_LIGHT,
        navbar: SIDEBAR_LIGHT
      }
    },
    dark: {
      gradient: "linear-gradient(130deg, oklch(0.72 0.22 45) 0%, oklch(0.65 0.28 20) 100%)",
      palette: {
        primary: "oklch(0.72 0.22 45)",
        accent: "oklch(0.65 0.28 20)",
        background: "oklch(0.13 0.01 30)",
        text: "oklch(0.97 0.01 50)",
        neutral: "oklch(0.20 0.02 35)",
        sidebar: "oklch(0.11 0.01 35)",
        navbar: "oklch(0.11 0.01 35)"
      }
    },
    badge: "Popular",
    sidebarTone: "light"
  },
  {
    id: "midnight",
    label: "Midnight Violet",
    description: "Moody violet base with neon teal accent",
    light: {
      gradient: "linear-gradient(130deg, oklch(0.57 0.25 290) 0%, oklch(0.67 0.17 230) 100%)",
      palette: {
        primary: "oklch(0.57 0.25 290)",
        accent: "oklch(0.67 0.17 230)",
        background: "oklch(0.98 0.02 290)",
        text: "oklch(0.20 0.02 250)",
        neutral: "oklch(0.92 0.06 290)",
        sidebar: SIDEBAR_LIGHT,
        navbar: SIDEBAR_LIGHT
      }
    },
    dark: {
      gradient: "linear-gradient(130deg, oklch(0.70 0.28 285) 0%, oklch(0.75 0.20 215) 100%)",
      palette: {
        primary: "oklch(0.70 0.28 285)",
        accent: "oklch(0.75 0.20 215)",
        background: "oklch(0.11 0.02 280)",
        text: "oklch(0.95 0.02 290)",
        neutral: "oklch(0.18 0.04 285)",
        sidebar: "oklch(0.09 0.02 280)",
        navbar: "oklch(0.09 0.02 280)"
      }
    },
    sidebarTone: "light"
  },
  {
    id: "sandstone",
    label: "Sandstone Calm",
    description: "Soft neutrals with deep emerald accents",
    light: {
      gradient: "linear-gradient(130deg, oklch(0.88 0.14 95) 0%, oklch(0.60 0.15 155) 100%)",
      palette: {
        primary: "oklch(0.60 0.15 155)",
        accent: "oklch(0.70 0.19 40)",
        background: "oklch(0.99 0.01 95)",
        text: "oklch(0.25 0.01 40)",
        neutral: "oklch(0.94 0.04 85)",
        sidebar: SIDEBAR_LIGHT,
        navbar: SIDEBAR_LIGHT
      }
    },
    dark: {
      gradient: "linear-gradient(130deg, oklch(0.82 0.12 110) 0%, oklch(0.68 0.20 150) 100%)",
      palette: {
        primary: "oklch(0.68 0.20 150)",
        accent: "oklch(0.78 0.16 60)",
        background: "oklch(0.13 0.01 140)",
        text: "oklch(0.96 0.01 100)",
        neutral: "oklch(0.19 0.02 145)",
        sidebar: "oklch(0.10 0.01 140)",
        navbar: "oklch(0.10 0.01 140)"
      }
    },
    badge: "New",
    sidebarTone: "light"
  },
  {
    id: "night-ops",
    label: "Night Ops",
    description: "Teal gradients with a dark command-center sidebar.",
    light: {
      gradient: "linear-gradient(130deg, oklch(0.72 0.12 175) 0%, oklch(0.55 0.22 264) 100%)",
      palette: {
        primary: "oklch(0.72 0.12 175)",
        accent: "oklch(0.78 0.15 210)",
        background: "oklch(0.99 0.01 175)",
        text: "oklch(0.20 0.02 250)",
        neutral: "oklch(0.94 0.03 175)",
        sidebar: SIDEBAR_DARK,
        navbar: SIDEBAR_DARK
      }
    },
    dark: {
      gradient: "linear-gradient(130deg, oklch(0.80 0.16 180) 0%, oklch(0.75 0.18 200) 100%)",
      palette: {
        primary: "oklch(0.80 0.16 180)",
        accent: "oklch(0.75 0.18 200)",
        background: "oklch(0.08 0.01 190)",
        text: "oklch(0.94 0.01 180)",
        neutral: "oklch(0.15 0.01 190)",
        sidebar: "oklch(0.05 0 0)",
        navbar: "oklch(0.05 0 0)"
      }
    },
    badge: "Dark sidebar",
    sidebarTone: "dark"
  },
  {
    id: "retro-grid",
    label: "Retro Grid",
    description: "80s neon palette with subtle pixel patterns on menus.",
    light: {
      gradient: "linear-gradient(130deg, oklch(0.75 0.18 350) 0%, oklch(0.57 0.25 290) 45%, oklch(0.78 0.15 210) 100%)",
      palette: {
        primary: "oklch(0.72 0.20 30)",
        accent: "oklch(0.78 0.15 210)",
        background: "oklch(0.98 0.02 60)",
        text: "oklch(0.22 0.04 310)",
        neutral: "oklch(0.92 0.03 60)",
        sidebar: "oklch(0.22 0.06 310)",
        navbar: "oklch(0.22 0.06 310)"
      }
    },
    dark: {
      gradient: "linear-gradient(130deg, oklch(0.75 0.24 335) 0%, oklch(0.68 0.28 295) 45%, oklch(0.78 0.20 200) 100%)",
      palette: {
        primary: "oklch(0.75 0.24 335)",
        accent: "oklch(0.78 0.20 200)",
        background: "oklch(0.10 0.03 310)",
        text: "oklch(0.95 0.02 330)",
        neutral: "oklch(0.17 0.04 315)",
        sidebar: "oklch(0.12 0.03 310)",
        navbar: "oklch(0.12 0.03 310)"
      }
    },
    badge: "Retro",
    sidebarTone: "dark",
    patterns: {
      surface: RETRO_SURFACE_PATTERN,
      sidebar: RETRO_SIDEBAR_PATTERN,
      surfaceSize: "30px 30px",
      sidebarSize: "18px 18px"
    }
  },
  {
    id: "hipster-vibes",
    label: "Hipster Vibes",
    description: "Muted earthy tones with vintage mustard and dusty rose accents",
    light: {
      gradient: "linear-gradient(130deg, oklch(0.73 0.08 65) 0%, oklch(0.65 0.10 35) 50%, oklch(0.72 0.05 130) 100%)",
      palette: {
        primary: "oklch(0.73 0.08 65)",
        accent: "oklch(0.65 0.10 35)",
        background: "oklch(0.98 0.01 65)",
        text: "oklch(0.32 0.02 50)",
        neutral: "oklch(0.90 0.03 60)",
        sidebar: "oklch(0.96 0.01 60)",
        navbar: "oklch(0.96 0.01 60)"
      }
    },
    dark: {
      gradient: "linear-gradient(130deg, oklch(0.70 0.12 70) 0%, oklch(0.62 0.15 25) 50%, oklch(0.65 0.09 120) 100%)",
      palette: {
        primary: "oklch(0.70 0.12 70)",
        accent: "oklch(0.62 0.15 25)",
        background: "oklch(0.14 0.01 45)",
        text: "oklch(0.94 0.02 65)",
        neutral: "oklch(0.21 0.02 50)",
        sidebar: "oklch(0.12 0.01 45)",
        navbar: "oklch(0.12 0.01 45)"
      }
    },
    badge: "Hipster",
    sidebarTone: "light"
  },
  {
    id: "star-wars",
    label: "Star Wars",
    description: "Deep space theme with Rebel Alliance blue and iconic yellow accents",
    light: {
      gradient: "linear-gradient(130deg, oklch(0.63 0.15 250) 0%, oklch(0.92 0.18 95) 100%)",
      palette: {
        primary: "oklch(0.63 0.15 250)",
        accent: "oklch(0.92 0.18 95)",
        background: "oklch(0.98 0.01 250)",
        text: "oklch(0.20 0 0)",
        neutral: "oklch(0.90 0.02 250)",
        sidebar: "oklch(0.95 0.01 250)",
        navbar: "oklch(0.95 0.01 250)"
      }
    },
    dark: {
      gradient: "linear-gradient(130deg, oklch(0.10 0 0) 0%, oklch(0.58 0.20 245) 50%, oklch(0.88 0.22 90) 100%)",
      palette: {
        primary: "oklch(0.58 0.20 245)",
        accent: "oklch(0.88 0.22 90)",
        background: "oklch(0.08 0 0)",
        text: "oklch(0.91 0.01 0)",
        neutral: "oklch(0.14 0 0)",
        sidebar: "oklch(0.05 0 0)",
        navbar: "oklch(0.05 0 0)"
      }
    },
    badge: "Star Wars",
    sidebarTone: "dark",
    patterns: {
      surface: "radial-gradient(circle at 2px 2px, rgba(74, 144, 226, 0.08) 1px, transparent 0)",
      sidebar: "linear-gradient(90deg, rgba(74, 144, 226, 0.03) 0%, transparent 50%, rgba(74, 144, 226, 0.03) 100%)",
      surfaceSize: "40px 40px",
      sidebarSize: "20px 20px"
    }
  }
];

const CUSTOM_THEME_ID = "custom";

const getSidebarColorForTheme = (theme: ThemePreset, mode: 'light' | 'dark' = 'light') => {
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

const getNavbarColorForTheme = (theme: ThemePreset, mode: 'light' | 'dark' = 'light') => {
  // Navbar should always match sidebar
  return getSidebarColorForTheme(theme, mode);
};

const getPresetIdForConfig = (config: BrandingConfig) => {
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

// ColorPickerField component for compact color selection with optional gradient support
type ColorPickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  allowGradients?: boolean; // If false, only solid colors are allowed
};

const ColorPickerField = ({ label, value, onChange, id, allowGradients = true }: ColorPickerFieldProps) => {
  const [open, setOpen] = useState(false);
  const isInternalUpdateRef = useRef(false);
  
  // Detect if value is a gradient
  const isGradient = useMemo(() => {
    return allowGradients && value && value.startsWith('linear-gradient');
  }, [value, allowGradients]);

  // Parse gradient string to extract colors and angle
  const parseGradient = useCallback((gradientStr: string | undefined) => {
    if (!gradientStr || !gradientStr.startsWith('linear-gradient')) {
      return null;
    }
    
    // Match linear-gradient(angle, color1, color2)
    const match = gradientStr.match(/linear-gradient\((\d+)deg,\s*(.+?),\s*(.+?)\)/);
    if (match) {
      return {
        angle: parseInt(match[1], 10),
        startColor: match[2].trim(),
        endColor: match[3].trim()
      };
    }
    
    return null;
  }, []);

  // Get solid color value (extract from gradient or use value directly)
  const solidColorValue = useMemo(() => {
    if (isGradient) {
      const parsed = parseGradient(value);
      return parsed?.startColor || '#000000';
    }
    return value || '#000000';
  }, [value, isGradient, parseGradient]);

  // Convert OKLCH or hex to hex using colorizr, then to Color object for ColorPicker
  const colorValue = useMemo(() => {
    try {
      const inputValue = solidColorValue;
      let hexValue: string;
      
      // If it's already hex, use it directly
      if (inputValue.startsWith('#')) {
        hexValue = inputValue;
      } else {
        // Convert from OKLCH (or other format) to hex using colorizr
        try {
          hexValue = convert(inputValue, 'hex');
        } catch {
          // Fallback to default if conversion fails
          hexValue = '#000000';
        }
      }
      
      // Convert hex to Color object for ColorPicker component
      return Color(hexValue);
    } catch {
      return Color('#000000');
    }
  }, [solidColorValue]);

  // Get hex value for display using colorizr
  const displayHex = useMemo(() => {
    try {
      const inputValue = solidColorValue;
      if (inputValue.startsWith('#')) {
        return inputValue;
      }
      // Convert from OKLCH to hex using colorizr
      try {
        return convert(inputValue, 'hex');
      } catch {
        return '#000000';
      }
    } catch {
      return '#000000';
    }
  }, [solidColorValue]);

  // Gradient state
  const gradientData = useMemo(() => {
    if (isGradient) {
      const parsed = parseGradient(value);
      if (parsed) {
        return parsed;
      }
    }
    return {
      startColor: solidColorValue,
      endColor: solidColorValue,
      angle: 130
    };
  }, [value, isGradient, solidColorValue, parseGradient]);

  const [startColor, setStartColor] = useState(gradientData.startColor);
  const [endColor, setEndColor] = useState(gradientData.endColor);
  const [angle, setAngle] = useState(gradientData.angle);
  const [mode, setMode] = useState<'solid' | 'gradient'>(
    allowGradients && isGradient ? 'gradient' : 'solid'
  );

  // Update local state when value prop changes (but not if it's our own update)
  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    
    if (allowGradients && isGradient) {
      const parsed = parseGradient(value);
      if (parsed) {
        setStartColor(parsed.startColor);
        setEndColor(parsed.endColor);
        setAngle(parsed.angle);
        setMode('gradient');
      }
    } else {
      setMode('solid');
      // If gradients not allowed but value is gradient, extract solid color
      if (!allowGradients && value && value.startsWith('linear-gradient')) {
        const parsed = parseGradient(value);
        if (parsed) {
          handleColorChange(Color(parsed.startColor));
        }
      }
    }
  }, [value, isGradient, parseGradient, allowGradients]);

  // Convert Color object back to OKLCH format using colorizr (brand config uses OKLCH)
  const handleColorChange = useCallback((color: Parameters<typeof Color.rgb>[0]) => {
    try {
      // ColorPicker actually passes a Color object (despite the type signature)
      // Handle both Color object and other formats
      let hex: string;
      
      if (typeof color === 'object' && color !== null && 'hex' in color) {
        // It's a Color object
        hex = (color as ReturnType<typeof Color>).hex();
      } else {
        // It's a string or array, convert to Color then hex
        const colorObj = Color(color);
        hex = colorObj.hex();
      }
      
      // Convert hex to OKLCH using colorizr to match brand config format
      try {
        const oklch = convert(hex, 'oklch');
        onChange(oklch);
      } catch (e) {
        // Fallback to hex if conversion fails
        console.warn('Failed to convert hex to OKLCH using colorizr:', hex, e);
        onChange(hex);
      }
    } catch (e) {
      console.warn('Failed to process color change:', e);
      onChange('#000000');
    }
  }, [onChange]);

  // Handle gradient color changes - use refs to avoid stale closures during drag
  const startColorRef = useRef(startColor);
  const endColorRef = useRef(endColor);
  const angleRef = useRef(angle);
  
  useEffect(() => {
    startColorRef.current = startColor;
    endColorRef.current = endColor;
    angleRef.current = angle;
  }, [startColor, endColor, angle]);

  // Helper to convert color to CSS-compatible format (hex or rgb)
  const getCssColor = useCallback((color: string): string => {
    try {
      // If it's already hex, use it
      if (color.startsWith('#')) {
        return color;
      }
      // Convert OKLCH to hex for CSS compatibility
      try {
        return convert(color, 'hex');
      } catch {
        // If conversion fails, try to use as-is (might be rgb or other format)
        return color;
      }
    } catch {
      return '#000000';
    }
  }, []);

  const handleGradientColorChange = useCallback((color: Parameters<typeof Color.rgb>[0], which: 'start' | 'end') => {
    try {
      let hex: string;
      
      if (typeof color === 'object' && color !== null && 'hex' in color) {
        hex = (color as ReturnType<typeof Color>).hex();
      } else {
        hex = Color(color).hex();
      }
      
      try {
        const oklch = convert(hex, 'oklch');
        // Store OKLCH for internal state, convert to CSS-compatible format for gradient
        const cssNewColor = getCssColor(oklch);
        
        if (which === 'start') {
          const newStartColor = oklch;
          setStartColor(newStartColor);
          startColorRef.current = newStartColor;
          const cssEndColor = getCssColor(endColorRef.current);
          isInternalUpdateRef.current = true;
          // Use CSS-compatible colors in gradient string: start, end
          const gradientStr = `linear-gradient(${angleRef.current}deg, ${cssNewColor}, ${cssEndColor})`;
          onChange(gradientStr);
        } else {
          const newEndColor = oklch;
          setEndColor(newEndColor);
          endColorRef.current = newEndColor;
          const cssStartColor = getCssColor(startColorRef.current);
          isInternalUpdateRef.current = true;
          // Use CSS-compatible colors in gradient string: start, end
          const gradientStr = `linear-gradient(${angleRef.current}deg, ${cssStartColor}, ${cssNewColor})`;
          onChange(gradientStr);
        }
      } catch {
        // Fallback to hex
        const cssNewColor = hex;
        
        if (which === 'start') {
          const newStartColor = hex;
          setStartColor(newStartColor);
          startColorRef.current = newStartColor;
          const cssEndColor = getCssColor(endColorRef.current);
          isInternalUpdateRef.current = true;
          const gradientStr = `linear-gradient(${angleRef.current}deg, ${cssNewColor}, ${cssEndColor})`;
          onChange(gradientStr);
        } else {
          const newEndColor = hex;
          setEndColor(newEndColor);
          endColorRef.current = newEndColor;
          const cssStartColor = getCssColor(startColorRef.current);
          isInternalUpdateRef.current = true;
          const gradientStr = `linear-gradient(${angleRef.current}deg, ${cssStartColor}, ${cssNewColor})`;
          onChange(gradientStr);
        }
      }
    } catch (e) {
      console.warn('Failed to process gradient color change:', e);
    }
  }, [onChange, getCssColor]);

  // Handle angle change
  const handleAngleChange = useCallback((newAngle: number) => {
    setAngle(newAngle);
    angleRef.current = newAngle;
    isInternalUpdateRef.current = true;
    // Convert colors to CSS-compatible format
    const cssStartColor = getCssColor(startColorRef.current);
    const cssEndColor = getCssColor(endColorRef.current);
    const gradientStr = `linear-gradient(${newAngle}deg, ${cssStartColor}, ${cssEndColor})`;
    onChange(gradientStr);
  }, [onChange, getCssColor]);

  // Get hex for gradient colors
  const getGradientHex = useCallback((color: string): string => {
    try {
      if (color.startsWith('#')) {
        return color;
      }
      return convert(color, 'hex');
    } catch {
      return '#000000';
    }
  }, []);

  const startHex = useMemo(() => getGradientHex(startColor), [startColor, getGradientHex]);
  const endHex = useMemo(() => getGradientHex(endColor), [endColor, getGradientHex]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            className={cn(
              "w-full h-10 justify-start text-left font-normal p-0 overflow-hidden",
              "hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {mode === 'gradient' ? (
              <div
                className="w-full h-full flex items-center justify-between px-3"
                style={{
                  background: value || `linear-gradient(130deg, ${getCssColor(startColor)}, ${getCssColor(endColor)})`
                }}
              >
                <span className="text-xs text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  Gradient {angle}°
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 w-full px-3">
                <div
                  className="h-5 w-5 rounded border border-border"
                  style={{ backgroundColor: displayHex }}
                />
                <span className="text-xs text-muted-foreground truncate">
                  {displayHex}
                </span>
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-4" 
          align="start"
          onInteractOutside={(e) => {
            // Prevent popover from closing when interacting with color picker
            const target = e.target as HTMLElement;
            if (target.closest('[role="slider"]') || 
                target.closest('.cursor-crosshair') ||
                target.closest('[class*="ColorPicker"]')) {
              e.preventDefault();
            }
          }}
        >
          <div className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={mode === 'solid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setMode('solid');
                  // Convert gradient to solid color (use start color)
                  if (isGradient) {
                    onChange(startColor);
                  }
                }}
                className="flex-1"
              >
                Solid
              </Button>
              <Button
                type="button"
                variant={mode === 'gradient' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setMode('gradient');
                  // Convert solid color to gradient
                  if (!isGradient) {
                    const currentColor = value || '#000000';
                    // Convert to OKLCH for storage, but use hex for gradient
                    let cssColor = currentColor;
                    try {
                      if (!currentColor.startsWith('#')) {
                        cssColor = convert(currentColor, 'hex');
                      }
                      const oklch = convert(cssColor, 'oklch');
                      setStartColor(oklch);
                      setEndColor(oklch);
                      startColorRef.current = oklch;
                      endColorRef.current = oklch;
                    } catch {
                      setStartColor(currentColor);
                      setEndColor(currentColor);
                      startColorRef.current = currentColor;
                      endColorRef.current = currentColor;
                    }
                    setAngle(130);
                    angleRef.current = 130;
                    isInternalUpdateRef.current = true;
                    // Use hex for gradient string
                    const gradientStr = `linear-gradient(130deg, ${cssColor}, ${cssColor})`;
                    onChange(gradientStr);
                  }
                }}
                className="flex-1"
              >
                Gradient
              </Button>
            </div>

            {(!allowGradients || mode === 'solid') ? (
              <div style={{ pointerEvents: 'auto', touchAction: 'none', userSelect: 'none' }}>
                <ColorPicker
                  value={colorValue}
                  onChange={handleColorChange}
                  className="w-[240px]"
                >
                  <div className="space-y-3" style={{ touchAction: 'none', userSelect: 'none' }}>
                    <ColorPickerSelection 
                      className="h-[150px] rounded-md cursor-crosshair"
                    />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ColorPickerHue className="flex-1" />
                      <ColorPickerEyeDropper />
                    </div>
                    <ColorPickerAlpha />
                    <div className="flex items-center gap-2">
                      <ColorPickerFormat className="flex-1" />
                      <ColorPickerOutput />
                    </div>
                    </div>
                  </div>
                </ColorPicker>
              </div>
            ) : (
              <div className="space-y-4 w-[280px]">
                {/* Gradient Preview */}
                <div
                  className="h-20 rounded-md border"
                  style={{
                    background: `linear-gradient(${angle}deg, ${getCssColor(startColor)}, ${getCssColor(endColor)})`
                  }}
                />
                
                {/* Start Color */}
                <div className="space-y-2">
                  <Label className="text-xs">Start Color</Label>
                  <div style={{ pointerEvents: 'auto', touchAction: 'none', userSelect: 'none' }}>
                    <ColorPicker
                      defaultValue={startHex}
                      onChange={(color) => handleGradientColorChange(color, 'start')}
                      className="w-full"
                    >
                      <div className="space-y-2" style={{ touchAction: 'none', userSelect: 'none' }}>
                        <ColorPickerSelection 
                      className="h-[100px] rounded-md cursor-crosshair"
                        />
                        <div className="flex items-center gap-2">
                          <ColorPickerHue className="flex-1" />
                          <ColorPickerEyeDropper />
                        </div>
                      </div>
                    </ColorPicker>
                  </div>
                </div>

                {/* End Color */}
                <div className="space-y-2">
                  <Label className="text-xs">End Color</Label>
                  <div style={{ pointerEvents: 'auto', touchAction: 'none', userSelect: 'none' }}>
                    <ColorPicker
                      defaultValue={endHex}
                      onChange={(color) => handleGradientColorChange(color, 'end')}
                      className="w-full"
                    >
                      <div className="space-y-2" style={{ touchAction: 'none', userSelect: 'none' }}>
                        <ColorPickerSelection 
                      className="h-[100px] rounded-md cursor-crosshair"
                        />
                        <div className="flex items-center gap-2">
                          <ColorPickerHue className="flex-1" />
                          <ColorPickerEyeDropper />
                        </div>
                      </div>
                    </ColorPicker>
                  </div>
                </div>

                {/* Angle Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Angle</Label>
                    <span className="text-xs text-muted-foreground">{angle}°</span>
                  </div>
                  <Slider
                    value={[angle]}
                    onValueChange={([newAngle]) => handleAngleChange(newAngle)}
                    min={0}
                    max={360}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

const TOGGLE_CONFIG: Array<{
  key: keyof BrandingToggles;
  labelKey: string;
  descriptionKey: string;
  fallbackLabel: string;
  fallbackDescription: string;
  badgeKey?: string;
  fallbackBadge?: string;
}> = [
  {
    key: "applyLoginBranding" as const,
    labelKey: "settings.global.branding.rollout.applyLoginBranding.label",
    descriptionKey: "settings.global.branding.rollout.applyLoginBranding.description",
    fallbackLabel: "Apply branding to auth and onboarding screens",
    fallbackDescription: "Splash, magic-link, and invitation flows reuse this palette."
  },
  {
    key: "allowCustomThemes" as const,
    labelKey: "settings.global.branding.rollout.allowCustomThemes.label",
    descriptionKey: "settings.global.branding.rollout.allowCustomThemes.description",
    badgeKey: "settings.global.branding.rollout.allowCustomThemes.badge",
    fallbackLabel: "Allow members to pick personal accents",
    fallbackDescription: "Great for power users who prefer higher contrast.",
    fallbackBadge: "Beta"
  },
  {
    key: "lockDarkMode" as const,
    labelKey: "settings.global.branding.rollout.lockDarkMode.label",
    descriptionKey: "settings.global.branding.rollout.lockDarkMode.description",
    fallbackLabel: "Force dark mode for entire tenant",
    fallbackDescription: "Ideal for control rooms and 24/7 NOC displays."
  }
];

const ASSET_CONFIG: Array<{
  key: keyof BrandingAssets;
  labelKey: string;
  helperKey: string;
  fallbackLabel: string;
  fallbackHelper: string;
}> = [
  {
    key: "logoLight",
    labelKey: "settings.global.branding.assets.logoLight.label",
    helperKey: "settings.global.branding.assets.logoLight.helper",
    fallbackLabel: "Logo (light surfaces)",
    fallbackHelper: "SVG or transparent PNG · 600x160"
  },
  {
    key: "logoDark",
    labelKey: "settings.global.branding.assets.logoDark.label",
    helperKey: "settings.global.branding.assets.logoDark.helper",
    fallbackLabel: "Logo (dark surfaces)",
    fallbackHelper: "SVG or PNG · 600x160"
  },
  {
    key: "favicon",
    labelKey: "settings.global.branding.assets.favicon.label",
    helperKey: "settings.global.branding.assets.favicon.helper",
    fallbackLabel: "Favicon",
    fallbackHelper: "32x32 PNG / ICO"
  }
];

function Global() {
  const {
    config: activeBrand,
    assets: activeAssets,
    toggles: activeToggles,
    saveBranding
  } = useBranding();
  const { language, setLanguage, t } = useLanguage();
  const [celebrationType, setCelebrationTypeState] = useState<CelebrationType>(() => getCelebrationType());
  const [fontStyle, setFontStyleState] = useState<FontStyle>(() => getFontStyle());

  // Initialize font style on mount
  useEffect(() => {
    initFontStyle();
  }, []);

  const [brand, setBrand] = useState<BrandingConfig>(() => ({ ...activeBrand }));
  const [assets, setAssets] = useState<BrandingAssets>(() => ({ ...activeAssets }));
  const [toggles, setToggles] = useState<BrandingToggles>(() => ({ ...activeToggles }));
  const [selectedTheme, setSelectedTheme] = useState<string>(() =>
    getPresetIdForConfig(activeBrand)
  );
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  useEffect(() => {
    setBrand(activeBrand);
  }, [activeBrand]);

  useEffect(() => {
    setAssets(activeAssets);
  }, [activeAssets]);

  useEffect(() => {
    setToggles(activeToggles);
  }, [activeToggles]);

  useEffect(() => {
    setSelectedTheme(getPresetIdForConfig(activeBrand));
  }, [activeBrand]);

  useEffect(() => {
    const brandingChanged = JSON.stringify(brand) !== JSON.stringify(activeBrand);
    const assetsChanged = JSON.stringify(assets) !== JSON.stringify(activeAssets);
    const togglesChanged = JSON.stringify(toggles) !== JSON.stringify(activeToggles);
    setHasPendingChanges(brandingChanged || assetsChanged || togglesChanged);
  }, [brand, assets, toggles, activeBrand, activeAssets, activeToggles]);

  // Helper to check if a color value is a gradient
  const isGradientValue = useCallback((color: string | undefined): boolean => {
    return !!(color && color.startsWith('linear-gradient'));
  }, []);

  // Helper to get CSS-compatible color or gradient
  const getCssColorOrGradient = useCallback((color: string | undefined, fallback: string): string => {
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
  }, [isGradientValue]);

  const previewGradient = useMemo(() => {
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
  }, [brand.headerBackgroundGradient, brand.navbarColor, brand.primaryColor, brand.accentColor, getCssColorOrGradient, isGradientValue]);

  const darkPreviewGradient = useMemo(() => {
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
  }, [brand.darkHeaderBackgroundGradient, brand.darkNavbarColor, brand.darkPrimaryColor, brand.darkAccentColor, brand.primaryColor, brand.accentColor, getCssColorOrGradient, isGradientValue]);


  // Helper to get contrasting text color based on background luminance
  const getContrastingTextColor = useCallback((bgColor: string): string => {
    try {
      const lum = luminance(bgColor);
      // luminance returns 0-1, use 0.5 as threshold
      return lum > 0.5 ? '#0f172a' : '#ffffff';
    } catch {
      // Fallback to white for dark backgrounds (assume dark if we can't compute)
      return '#ffffff';
    }
  }, []);

  const handleBrandFieldChange =
    (field: keyof BrandingConfig) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { value } = event.target;
        setBrand((prev) => ({ ...prev, [field]: value }));
        setSelectedTheme(CUSTOM_THEME_ID);
      };

  const handleThemeApply = (theme: ThemePreset) => {
    setSelectedTheme(theme.id);
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
    
    const newConfig = {
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
  };

  const handleAssetUpload =
    (key: keyof BrandingAssets) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          const result = typeof loadEvent.target?.result === "string" ? loadEvent.target.result : null;
          setAssets((prev) => ({ ...prev, [key]: result }));
        };
        reader.readAsDataURL(file);
      };

  const handleAssetReset = (key: keyof BrandingAssets) => {
    setAssets((prev) => ({ ...prev, [key]: null }));
  };

  const handleSaveBranding = () => {
    saveBranding({
      config: { ...brand },
      assets: { ...assets },
      toggles: { ...toggles }
    });
  };

  const handleDiscardChanges = () => {
    setBrand(activeBrand);
    setAssets(activeAssets);
    setToggles(activeToggles);
    setSelectedTheme(getPresetIdForConfig(activeBrand));
  };

  const handleResetBranding = () => {
    // Always reset to the last saved state
    setBrand(activeBrand);
    setAssets(activeAssets);
    setToggles(activeToggles);
    setSelectedTheme(getPresetIdForConfig(activeBrand));
  };


  return (
    <SettingsLayout
      title={t("settings.global.title", "Global Settings")}
      description={t(
        "settings.global.subtitle",
        "Organization-wide defaults, branding, and platform identity"
      )}
      icon={faGlobe}
      iconColor="#0ea5e9"
      wrapChildrenFullHeight={false}
    >
      <Tabs defaultValue="defaults" className="space-y-6 pb-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t(
                "settings.global.intro",
                "Configure how your org looks and behaves at a global level. Switch tabs to access different modules."
              )}
            </p>
          </div>
          <TabsList className="w-full justify-start overflow-x-auto lg:w-auto">
            <TabsTrigger value="defaults">
              {t("settings.global.tabs.defaults", "Platform Defaults")}
            </TabsTrigger>
            <TabsTrigger value="branding">
              {t("settings.global.tabs.branding", "Branding & Identity")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="defaults">
          <Card>
            <div className="h-48 relative overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1645736315000-6f788915923b?auto=format&fit=crop&w=1920&q=80"
                alt="Warehouse operations"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/60"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <FontAwesomeIcon icon={faGlobe} className="text-5xl mb-2 opacity-90" />
                  <h3 className="text-xl font-semibold">
                    {t("settings.global.defaults.cardTitle", "Platform defaults")}
                  </h3>
                </div>
              </div>
            </div>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="preferredLanguage">
                  {t("settings.global.defaults.languageLabel", "Preferred language")}
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="preferredLanguage" className="w-full sm:w-[280px]">
                    <SelectValue
                      placeholder={t(
                        "settings.global.defaults.languagePlaceholder",
                        "Select language"
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="fontStyle">
                  {t("settings.global.defaults.fontStyleLabel", "Font Style")}
                </Label>
                <Select 
                  value={fontStyle}
                  onValueChange={(value: FontStyle) => {
                    setFontStyle(value);
                    setFontStyleState(value);
                  }}
                >
                  <SelectTrigger id="fontStyle" className="w-full sm:w-[280px]">
                    <SelectValue
                      placeholder={t(
                        "settings.global.defaults.fontStylePlaceholder",
                        "Select font style"
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">
                      {t("settings.global.defaults.fontStyle.system", "System Default")}
                    </SelectItem>
                    <SelectItem value="inter">
                      {t("settings.global.defaults.fontStyle.inter", "Inter")}
                    </SelectItem>
                    <SelectItem value="roboto">
                      {t("settings.global.defaults.fontStyle.roboto", "Roboto")}
                    </SelectItem>
                    <SelectItem value="montserrat">
                      {t("settings.global.defaults.fontStyle.montserrat", "Montserrat")}
                    </SelectItem>
                    <SelectItem value="georgia">
                      {t("settings.global.defaults.fontStyle.georgia", "Georgia")}
                    </SelectItem>
                    <SelectItem value="playfair">
                      {t("settings.global.defaults.fontStyle.playfair", "Playfair Display")}
                    </SelectItem>
                    <SelectItem value="poppins">
                      {t("settings.global.defaults.fontStyle.poppins", "Poppins")}
                    </SelectItem>
                    <SelectItem value="raleway">
                      {t("settings.global.defaults.fontStyle.raleway", "Raleway")}
                    </SelectItem>
                    <SelectItem value="bebas">
                      {t("settings.global.defaults.fontStyle.bebas", "Bebas Neue")}
                    </SelectItem>
                    <SelectItem value="oswald">
                      {t("settings.global.defaults.fontStyle.oswald", "Oswald")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "settings.global.defaults.fontStyleDescription",
                    "Choose the font style used throughout the application"
                  )}
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="celebrationType">
                  {t("settings.global.defaults.celebrationLabel", "Task Completion Celebration")}
                </Label>
                <Select 
                  value={celebrationType}
                  onValueChange={(value: CelebrationType) => {
                    setCelebrationType(value);
                    setCelebrationTypeState(value);
                  }}
                >
                  <SelectTrigger id="celebrationType" className="w-full sm:w-[280px]">
                    <SelectValue
                      placeholder={t(
                        "settings.global.defaults.celebrationPlaceholder",
                        "Select celebration type"
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confetti">
                      {t("settings.global.defaults.celebration.confetti", "Confetti")}
                    </SelectItem>
                    <SelectItem value="fireworks">
                      {t("settings.global.defaults.celebration.fireworks", "Fireworks")}
                    </SelectItem>
                    <SelectItem value="hearts">
                      {t("settings.global.defaults.celebration.hearts", "Hearts")}
                    </SelectItem>
                    <SelectItem value="balloons">
                      {t("settings.global.defaults.celebration.balloons", "Balloons")}
                    </SelectItem>
                    <SelectItem value="sparkles">
                      {t("settings.global.defaults.celebration.sparkles", "Sparkles")}
                    </SelectItem>
                    <SelectItem value="ribbons">
                      {t("settings.global.defaults.celebration.ribbons", "Ribbons")}
                    </SelectItem>
                    <SelectItem value="none">
                      {t("settings.global.defaults.celebration.none", "None")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "settings.global.defaults.celebrationDescription",
                    "Choose the animation that plays when a task is completed"
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
          <Tabs defaultValue="presets" className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "settings.global.branding.tabs.helper",
                    "Choose a preset theme or create a custom design with your brand colors."
                  )}
                </p>
              </div>
              <TabsList className="w-full justify-start overflow-x-auto lg:w-auto">
                <TabsTrigger value="presets">
                  {t("settings.global.branding.tabs.presets", "Preset Themes")}
                </TabsTrigger>
                <TabsTrigger value="custom">
                  {t("settings.global.branding.tabs.custom", "Custom Designer")}
                </TabsTrigger>
                <TabsTrigger value="assets">
                  {t("settings.global.branding.tabs.assets", "Logos & Icons")}
                </TabsTrigger>
                <TabsTrigger value="rollout">
                  {t("settings.global.branding.tabs.rollout", "Rollout Controls")}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="presets" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FontAwesomeIcon icon={faMagicWandSparkles} className="text-primary" />
                        {t("settings.global.branding.presets.title", "Preset Themes")}
                      </CardTitle>
                      <CardDescription>
                        {t(
                          "settings.global.branding.presets.description",
                          "Apply curated palettes instantly. Themes include both light and dark mode variants."
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {PRESET_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => handleThemeApply(theme)}
                        className={cn(
                          "rounded-xl border p-3 text-left transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selectedTheme === theme.id ? "border-primary shadow-lg" : "border-muted"
                        )}
                      >
                        <div className="h-20 rounded-lg mb-3 flex overflow-hidden">
                          <div
                            className="flex-1 rounded-l-lg flex items-center justify-center text-[10px] font-medium text-white/80"
                            style={{ background: theme.light.gradient }}
                          >
                            Light
                          </div>
                          <div
                            className="flex-1 rounded-r-lg flex items-center justify-center text-[10px] font-medium text-white/80"
                            style={{ background: theme.dark.gradient }}
                          >
                            Dark
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm">
                              {t(`settings.global.branding.presets.${theme.id}.label`, theme.label)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t(`settings.global.branding.presets.${theme.id}.description`, theme.description)}
                            </p>
                          </div>
                          {theme.badge && (
                            <Badge variant="secondary" className="text-[10px]">
                              {t(`settings.global.branding.presets.${theme.id}.badge`, theme.badge)}
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="custom" className="space-y-6">
              <div className="space-y-6">
                {/* Brand Basics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FontAwesomeIcon icon={faPalette} className="text-primary" />
                      {t("settings.global.branding.designer.brandBasics.title", "Custom Brand Design")}
                    </CardTitle>
                    <CardDescription>
                      {t(
                        "settings.global.branding.designer.brandBasics.description",
                        "Customize your organization's colors and identity."
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="organizationName">
                          {t("settings.global.branding.designer.brandBasics.organizationLabel", "Organization")}
                        </Label>
                        <Input
                          id="organizationName"
                          value={brand.organizationName}
                          onChange={handleBrandFieldChange("organizationName")}
                          placeholder="Acme Corp"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="productLabel">
                          {t("settings.global.branding.designer.brandBasics.productLabel", "Product Label")}
                        </Label>
                        <Input
                          id="productLabel"
                          value={brand.productLabel}
                          onChange={handleBrandFieldChange("productLabel")}
                          placeholder="Ops OS"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tagline">
                        {t("settings.global.branding.designer.brandBasics.taglineLabel", "Tagline")}
                      </Label>
                      <Input
                        id="tagline"
                        value={brand.tagline}
                        onChange={handleBrandFieldChange("tagline")}
                        placeholder="Your mission statement"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Light Mode Section */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FontAwesomeIcon icon={faPalette} className="text-primary" />
                        Light Mode Colors
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-semibold">Light Mode Colors</Label>
                        <div className="grid gap-3 grid-cols-3 mt-2">
                          <ColorPickerField
                            id="primaryColor"
                            label="Primary"
                            value={brand.primaryColor}
                            onChange={(value) => {
                              setBrand((prev) => ({ ...prev, primaryColor: value }));
                              setSelectedTheme(CUSTOM_THEME_ID);
                            }}
                            allowGradients={false}
                          />
                          <ColorPickerField
                            id="accentColor"
                            label="Accent"
                            value={brand.accentColor}
                            onChange={(value) => {
                              setBrand((prev) => ({ ...prev, accentColor: value }));
                              setSelectedTheme(CUSTOM_THEME_ID);
                            }}
                            allowGradients={false}
                          />
                          <ColorPickerField
                            id="textColor"
                            label="Text"
                            value={brand.textColor}
                            onChange={(value) => {
                              setBrand((prev) => ({ ...prev, textColor: value }));
                              setSelectedTheme(CUSTOM_THEME_ID);
                            }}
                            allowGradients={false}
                          />
                          <ColorPickerField
                            id="neutralColor"
                            label="Neutral"
                            value={brand.neutralColor}
                            onChange={(value) => {
                              setBrand((prev) => ({ ...prev, neutralColor: value }));
                              setSelectedTheme(CUSTOM_THEME_ID);
                            }}
                            allowGradients={false}
                          />
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <Label className="text-sm font-semibold">Background Colors</Label>
                        <div className="grid gap-3 grid-cols-3 mt-2">
                          <ColorPickerField
                            id="backgroundColor"
                            label="Body"
                            value={brand.backgroundColor}
                            onChange={(value) => {
                              setBrand((prev) => ({ ...prev, backgroundColor: value }));
                              setSelectedTheme(CUSTOM_THEME_ID);
                            }}
                          />
                          <ColorPickerField
                            id="sidebarColor"
                            label="Sidebar"
                            value={brand.sidebarColor}
                            onChange={(value) => {
                              setBrand((prev) => ({ ...prev, sidebarColor: value }));
                              setSelectedTheme(CUSTOM_THEME_ID);
                            }}
                          />
                          <ColorPickerField
                            id="headerBackgroundGradient"
                            label="Navbar/Header"
                            value={brand.headerBackgroundGradient || brand.navbarColor || '#ffffff'}
                            onChange={(value) => {
                              setBrand((prev) => {
                                // If it's a gradient, set headerBackgroundGradient and use fallback for navbarColor
                                // If it's a solid color, set navbarColor and clear headerBackgroundGradient
                                const isGradient = value && value.startsWith('linear-gradient');
                                return {
                                  ...prev,
                                  headerBackgroundGradient: isGradient ? value : undefined,
                                  navbarColor: isGradient ? '#ffffff' : value
                                };
                              });
                              setSelectedTheme(CUSTOM_THEME_ID);
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FontAwesomeIcon icon={faMagicWandSparkles} className="text-primary" />
                        Light Mode Preview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg border overflow-hidden">
                        {/* Navbar/Header */}
                        <div
                          className="p-2 text-white border-b"
                          style={{
                            ...(isGradientValue(previewGradient)
                              ? { backgroundImage: previewGradient, backgroundSize: "cover" }
                              : { backgroundColor: previewGradient })
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <WhagonsCheck width={60} height={14} color="#ffffff" />
                            <span className="text-[10px] opacity-90">{brand.organizationName}</span>
                          </div>
                        </div>

                        {/* Main Layout: Sidebar + Body */}
                        <div className="flex">
                          {/* Sidebar */}
                          <div
                            className="w-16 p-2 border-r min-h-[120px]"
                            style={{
                              ...(isGradientValue(brand.sidebarColor)
                                ? { backgroundImage: getCssColorOrGradient(brand.sidebarColor, '#FAFBFC') }
                                : { backgroundColor: getCssColorOrGradient(brand.sidebarColor, '#FAFBFC') }),
                              color: getContrastingTextColor(getCssColorOrGradient(brand.sidebarColor, '#FAFBFC'))
                            }}
                          >
                            <div className="text-[8px] font-medium mb-1">Sidebar</div>
                            <div className="space-y-1">
                              <div className="h-1 rounded bg-current opacity-20"></div>
                              <div className="h-1 rounded bg-current opacity-30"></div>
                              <div className="h-1 rounded bg-current opacity-20"></div>
                            </div>
                          </div>

                          {/* Body Content */}
                          <div
                            className="flex-1 p-2 space-y-2"
                            style={{
                              ...(isGradientValue(brand.backgroundColor) 
                                ? { backgroundImage: getCssColorOrGradient(brand.backgroundColor, '#ffffff') }
                                : { backgroundColor: getCssColorOrGradient(brand.backgroundColor, '#ffffff') }),
                              color: getCssColorOrGradient(brand.textColor, '#000000')
                            }}
                          >
                            <div className="flex gap-1.5">
                              <button
                                className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                                style={{
                                  ...(isGradientValue(brand.primaryColor)
                                    ? { backgroundImage: getCssColorOrGradient(brand.primaryColor, '#000000') }
                                    : { backgroundColor: getCssColorOrGradient(brand.primaryColor, '#000000') }),
                                  color: "#ffffff"
                                }}
                              >
                                Primary
                              </button>
                              <button
                                className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                                style={{
                                  ...(isGradientValue(brand.accentColor)
                                    ? { backgroundImage: getCssColorOrGradient(brand.accentColor, '#000000') }
                                    : { backgroundColor: getCssColorOrGradient(brand.accentColor, '#000000') }),
                                  color: "#ffffff"
                                }}
                              >
                                Accent
                              </button>
                            </div>
                            <div
                              className="rounded p-1 text-[9px]"
                              style={{
                                ...(isGradientValue(brand.neutralColor)
                                  ? { backgroundImage: getCssColorOrGradient(brand.neutralColor, '#f0f0f0') }
                                  : { backgroundColor: getCssColorOrGradient(brand.neutralColor, '#f0f0f0') }),
                                color: getContrastingTextColor(getCssColorOrGradient(brand.neutralColor, '#f0f0f0'))
                              }}
                            >
                              Neutral surface
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Dark Mode Section */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FontAwesomeIcon icon={faPalette} className="text-primary" />
                        Dark Mode Colors
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-semibold">Dark Mode Colors</Label>
                        <div className="grid gap-3 grid-cols-3 mt-2">
                          <ColorPickerField
                            id="darkPrimaryColor"
                            label="Primary"
                            value={brand.darkPrimaryColor || brand.primaryColor}
                            onChange={(value) => {
                              setBrand((prev) => ({ ...prev, darkPrimaryColor: value }));
                              setSelectedTheme(CUSTOM_THEME_ID);
                            }}
                            allowGradients={false}
                          />
                          <ColorPickerField
                            id="darkAccentColor"
                            label="Accent"
                            value={brand.darkAccentColor || brand.accentColor}
                            onChange={(value) => {
                              setBrand((prev) => ({ ...prev, darkAccentColor: value }));
                              setSelectedTheme(CUSTOM_THEME_ID);
                            }}
                            allowGradients={false}
                          />
                          <ColorPickerField
                            id="darkTextColor"
                            label="Text"
                            value={brand.darkTextColor || '#f8fafc'}
                            onChange={(value) => {
                              setBrand((prev) => ({ ...prev, darkTextColor: value }));
                              setSelectedTheme(CUSTOM_THEME_ID);
                            }}
                            allowGradients={false}
                          />
                          <ColorPickerField
                            id="darkNeutralColor"
                            label="Neutral"
                            value={brand.darkNeutralColor || '#1F1F1F'}
                            onChange={(value) => {
                              setBrand((prev) => ({ ...prev, darkNeutralColor: value }));
                              setSelectedTheme(CUSTOM_THEME_ID);
                            }}
                            allowGradients={false}
                          />
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <Label className="text-sm font-semibold">Background Colors</Label>
                        <div className="grid gap-3 grid-cols-3 mt-2">
                          <ColorPickerField
                            id="darkBackgroundColor"
                            label="Body"
                            value={brand.darkBackgroundColor || '#0F0F0F'}
                            onChange={(value) => {
                              setBrand((prev) => ({ ...prev, darkBackgroundColor: value }));
                              setSelectedTheme(CUSTOM_THEME_ID);
                            }}
                          />
                          <ColorPickerField
                            id="darkSidebarColor"
                            label="Sidebar"
                            value={brand.darkSidebarColor || '#0a0a0a'}
                            onChange={(value) => {
                              setBrand((prev) => ({ ...prev, darkSidebarColor: value }));
                              setSelectedTheme(CUSTOM_THEME_ID);
                            }}
                          />
                          <ColorPickerField
                            id="darkHeaderBackgroundGradient"
                            label="Navbar/Header"
                            value={brand.darkHeaderBackgroundGradient || brand.darkNavbarColor || '#0F0F0F'}
                            onChange={(value) => {
                              setBrand((prev) => {
                                // If it's a gradient, set darkHeaderBackgroundGradient and clear darkNavbarColor
                                // If it's a solid color, set darkNavbarColor and clear darkHeaderBackgroundGradient
                                const isGradient = value && value.startsWith('linear-gradient');
                                return {
                                  ...prev,
                                  darkHeaderBackgroundGradient: isGradient ? value : undefined,
                                  darkNavbarColor: isGradient ? undefined : value
                                };
                              });
                              setSelectedTheme(CUSTOM_THEME_ID);
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FontAwesomeIcon icon={faMagicWandSparkles} className="text-primary" />
                        Dark Mode Preview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg border overflow-hidden">
                        {/* Navbar/Header */}
                        <div
                          className="p-2 text-white border-b"
                          style={{
                            ...(isGradientValue(darkPreviewGradient)
                              ? { backgroundImage: darkPreviewGradient, backgroundSize: "cover" }
                              : { backgroundColor: darkPreviewGradient })
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <WhagonsCheck width={60} height={14} color="#ffffff" />
                            <span className="text-[10px] opacity-90">{brand.organizationName}</span>
                          </div>
                        </div>

                        {/* Main Layout: Sidebar + Body */}
                        <div className="flex">
                          {/* Sidebar */}
                          <div
                            className="w-16 p-2 border-r min-h-[120px]"
                            style={{
                              ...(isGradientValue(brand.darkSidebarColor)
                                ? { backgroundImage: getCssColorOrGradient(brand.darkSidebarColor, '#0a0a0a') }
                                : { backgroundColor: getCssColorOrGradient(brand.darkSidebarColor || '#0a0a0a', '#0a0a0a') }),
                              color: getContrastingTextColor(getCssColorOrGradient(brand.darkSidebarColor || '#0a0a0a', '#0a0a0a'))
                            }}
                          >
                            <div className="text-[8px] font-medium mb-1">Sidebar</div>
                            <div className="space-y-1">
                              <div className="h-1 rounded bg-current opacity-20"></div>
                              <div className="h-1 rounded bg-current opacity-30"></div>
                              <div className="h-1 rounded bg-current opacity-20"></div>
                            </div>
                          </div>

                          {/* Body Content */}
                          <div
                            className="flex-1 p-2 space-y-2"
                            style={{
                              ...(isGradientValue(brand.darkBackgroundColor)
                                ? { backgroundImage: getCssColorOrGradient(brand.darkBackgroundColor, '#0F0F0F') }
                                : { backgroundColor: getCssColorOrGradient(brand.darkBackgroundColor || '#0F0F0F', '#0F0F0F') }),
                              color: getCssColorOrGradient(brand.darkTextColor || '#f8fafc', '#f8fafc')
                            }}
                          >
                            <div className="flex gap-1.5">
                              <button
                                className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                                style={{
                                  ...(isGradientValue(brand.darkPrimaryColor || brand.primaryColor)
                                    ? { backgroundImage: getCssColorOrGradient(brand.darkPrimaryColor || brand.primaryColor, '#000000') }
                                    : { backgroundColor: getCssColorOrGradient(brand.darkPrimaryColor || brand.primaryColor, '#000000') }),
                                  color: "#ffffff"
                                }}
                              >
                                Primary
                              </button>
                              <button
                                className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                                style={{
                                  ...(isGradientValue(brand.darkAccentColor || brand.accentColor)
                                    ? { backgroundImage: getCssColorOrGradient(brand.darkAccentColor || brand.accentColor, '#000000') }
                                    : { backgroundColor: getCssColorOrGradient(brand.darkAccentColor || brand.accentColor, '#000000') }),
                                  color: "#ffffff"
                                }}
                              >
                                Accent
                              </button>
                            </div>
                            <div
                              className="rounded p-1 text-[9px]"
                              style={{
                                ...(isGradientValue(brand.darkNeutralColor)
                                  ? { backgroundImage: getCssColorOrGradient(brand.darkNeutralColor, '#1F1F1F') }
                                  : { backgroundColor: getCssColorOrGradient(brand.darkNeutralColor || '#1F1F1F', '#1F1F1F') }),
                                color: '#f8fafc'
                              }}
                            >
                              Neutral surface
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Action Buttons */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={handleResetBranding}>
                        {t("settings.global.branding.designer.brandBasics.reset", "Reset")}
                      </Button>
                      <Button size="sm" onClick={handleSaveBranding}>
                        {t("settings.global.branding.designer.brandBasics.save", "Save")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="assets" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FontAwesomeIcon icon={faImage} className="text-muted-foreground" />
                      {t("settings.global.branding.assets.title", "Asset library")}
                    </CardTitle>
                    <CardDescription>
                      {t(
                        "settings.global.branding.assets.description",
                        "Manage logos, favicons, and other brand imagery."
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {ASSET_CONFIG.map((asset) => (
                      <div key={asset.key} className="flex flex-col gap-2 border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">
                              {t(asset.labelKey, asset.fallbackLabel)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t(asset.helperKey, asset.fallbackHelper)}
                            </p>
                          </div>
                          {assets[asset.key] && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAssetReset(asset.key)}
                            >
                              {t("settings.global.branding.assets.remove", "Remove")}
                            </Button>
                          )}
                        </div>
                        {assets[asset.key] ? (
                          <div className="rounded-md border bg-muted/30 p-3 flex items-center justify-center">
                            <img
                              src={assets[asset.key] as string}
                              alt={`${t(asset.labelKey, asset.fallbackLabel)} preview`}
                              className="max-h-16 object-contain"
                            />
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
                            {t("settings.global.branding.assets.empty", "No file uploaded yet.")}
                          </div>
                        )}
                        <Input type="file" accept="image/*" onChange={handleAssetUpload(asset.key)} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="rollout" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {t("settings.global.branding.rollout.title", "Rollout options")}
                    </CardTitle>
                    <CardDescription>
                      {t(
                        "settings.global.branding.rollout.description",
                        "Control how and where branding is enforced."
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {TOGGLE_CONFIG.map((toggle) => (
                      <div key={toggle.key} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">
                              {t(toggle.labelKey, toggle.fallbackLabel)}
                            </p>
                            {toggle.badgeKey && (
                              <Badge variant="outline" className="text-[10px]">
                                {t(toggle.badgeKey, toggle.fallbackBadge ?? "")}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t(toggle.descriptionKey, toggle.fallbackDescription)}
                          </p>
                        </div>
                        <Switch
                          checked={toggles[toggle.key]}
                          onCheckedChange={(checked) =>
                            setToggles((prev) => ({
                              ...prev,
                              [toggle.key]: checked
                            }))
                          }
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
        </TabsContent>

      </Tabs>

      {hasPendingChanges && (
        <div className="fixed bottom-6 right-6 z-50 max-w-xl">
          <div className="bg-background/95 border border-border shadow-2xl rounded-2xl px-5 py-4 flex flex-wrap gap-3 items-center backdrop-blur-sm">
            <div>
              <p className="text-sm font-semibold">
                {t("settings.global.branding.banner.title", "Unsaved branding changes")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(
                  "settings.global.branding.banner.description",
                  "Apply to propagate the new palette across the workspace."
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" size="sm" onClick={handleDiscardChanges}>
                {t("settings.global.branding.banner.discard", "Discard")}
              </Button>
              <Button size="sm" onClick={handleSaveBranding}>
                {t("settings.global.branding.banner.apply", "Apply changes")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}

export default Global;
