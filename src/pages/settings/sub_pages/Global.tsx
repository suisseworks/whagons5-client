import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGlobe,
  faPalette,
  faMagicWandSparkles,
  faImage
} from "@fortawesome/free-solid-svg-icons";
import { convert, luminance } from "colorizr";

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
        sidebar: SIDEBAR_LIGHT
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
        sidebar: "oklch(0.10 0.01 180)"
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
        sidebar: SIDEBAR_LIGHT
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
        sidebar: "oklch(0.11 0.01 35)"
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
        sidebar: SIDEBAR_LIGHT
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
        sidebar: "oklch(0.09 0.02 280)"
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
        sidebar: SIDEBAR_LIGHT
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
        sidebar: "oklch(0.10 0.01 140)"
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
        sidebar: SIDEBAR_DARK
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
        sidebar: "oklch(0.05 0 0)"
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
        sidebar: "oklch(0.22 0.06 310)"
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
        sidebar: "oklch(0.12 0.03 310)"
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
        sidebar: "oklch(0.96 0.01 60)"
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
        sidebar: "oklch(0.12 0.01 45)"
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
        sidebar: "oklch(0.95 0.01 250)"
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
        sidebar: "oklch(0.05 0 0)"
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
  if (theme.sidebarTone === 'dark') return SIDEBAR_DARK;
  if (theme.sidebarTone === 'light') return SIDEBAR_LIGHT;
  return palette.sidebar ?? SIDEBAR_LIGHT;
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

  const previewGradient = useMemo(
    () => brand.gradientAccent || `linear-gradient(130deg, ${brand.primaryColor}, ${brand.accentColor})`,
    [brand.gradientAccent, brand.primaryColor, brand.accentColor]
  );

  // Helper to convert any color format to hex for color inputs using colorizr
  const oklchToHex = useCallback((color: string): string => {
    // If it's already hex, return it
    if (color && color.startsWith('#')) {
      return color;
    }
    
    try {
      // Use colorizr to convert any CSS color format to hex
      const hexColor = convert(color, 'hex');
      return hexColor;
    } catch (e) {
      console.warn('Failed to convert color to hex using colorizr:', color, e);
      // Fallback - try canvas method
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.fillStyle = color;
          const computedColor = ctx.fillStyle;
          
          if (computedColor.startsWith('#')) {
            return computedColor;
          }
          
          const match = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (match) {
            const r = parseInt(match[1]).toString(16).padStart(2, '0');
            const g = parseInt(match[2]).toString(16).padStart(2, '0');
            const b = parseInt(match[3]).toString(16).padStart(2, '0');
            return `#${r}${g}${b}`;
          }
        }
      } catch (err) {
        console.warn('Canvas fallback also failed:', err);
      }
    }
    
    // Ultimate fallback
    return '#666666';
  }, []);

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

  const handleColorChange =
    (field: keyof BrandingConfig) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const { value } = event.target;
        setBrand((prev) => ({ ...prev, [field]: value }));
        setSelectedTheme(CUSTOM_THEME_ID);
      };

  const handleThemeApply = (theme: ThemePreset) => {
    setSelectedTheme(theme.id);
    const lightPalette = theme.light.palette;
    const darkPalette = theme.dark.palette;
    
    const newConfig = {
      ...brand,
      // Light mode colors
      primaryColor: lightPalette.primary,
      accentColor: lightPalette.accent,
      backgroundColor: lightPalette.background,
      sidebarColor: getSidebarColorForTheme(theme, 'light'),
      textColor: lightPalette.text,
      neutralColor: lightPalette.neutral,
      gradientAccent: theme.light.gradient,
      // Dark mode colors
      darkPrimaryColor: darkPalette.primary,
      darkAccentColor: darkPalette.accent,
      darkBackgroundColor: darkPalette.background,
      darkSidebarColor: darkPalette.sidebar ?? getSidebarColorForTheme(theme, 'dark'),
      darkTextColor: darkPalette.text,
      darkNeutralColor: darkPalette.neutral,
      darkGradientAccent: theme.dark.gradient,
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
            <CardHeader>
              <CardTitle>{t("settings.global.defaults.cardTitle", "Platform defaults")}</CardTitle>
              <CardDescription>
                {t(
                  "settings.global.defaults.cardDescription",
                  "Manage workspace-wide toggles, automations, and baseline behavior. This module is in progress."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-sm text-muted-foreground space-y-3">
                <p>
                  {t(
                    "settings.global.defaults.body1",
                    "Soon you will be able to define cascading defaults (locale, time zone, automation policies, SLA templates, etc.) that every workspace inherits."
                  )}
                </p>
                <p>
                  {t("settings.global.defaults.trackingPrefix", "Tracking item:")}
                  {" "}
                  <Badge variant="secondary">GLOBAL-42</Badge>.{" "}
                  {t(
                    "settings.global.defaults.trackingSuffix",
                    "Ping the platform team if you need early access."
                  )}
                </p>
              </div>

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
                <p className="text-xs text-muted-foreground">
                  {t(
                    "settings.global.defaults.languageHelper",
                    "This language will be suggested across new workspaces until localization rules are wired to the API."
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
              <div className="grid gap-6 lg:grid-cols-2">
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

                    <Separator />

                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-semibold">Light Mode Colors</Label>
                        <div className="grid gap-3 grid-cols-3 mt-2">
                          <div className="space-y-2">
                            <Label htmlFor="primaryColor" className="text-xs">Primary</Label>
                            <Input
                              id="primaryColor"
                              type="color"
                              value={oklchToHex(brand.primaryColor)}
                              onChange={handleColorChange("primaryColor")}
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="accentColor" className="text-xs">Accent</Label>
                            <Input
                              id="accentColor"
                              type="color"
                              value={oklchToHex(brand.accentColor)}
                              onChange={handleColorChange("accentColor")}
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="backgroundColor" className="text-xs">Background</Label>
                            <Input
                              id="backgroundColor"
                              type="color"
                              value={oklchToHex(brand.backgroundColor)}
                              onChange={handleColorChange("backgroundColor")}
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="sidebarColor" className="text-xs">Sidebar</Label>
                            <Input
                              id="sidebarColor"
                              type="color"
                              value={oklchToHex(brand.sidebarColor)}
                              onChange={handleColorChange("sidebarColor")}
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="textColor" className="text-xs">Text</Label>
                            <Input
                              id="textColor"
                              type="color"
                              value={oklchToHex(brand.textColor)}
                              onChange={handleColorChange("textColor")}
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="neutralColor" className="text-xs">Neutral</Label>
                            <Input
                              id="neutralColor"
                              type="color"
                              value={oklchToHex(brand.neutralColor)}
                              onChange={handleColorChange("neutralColor")}
                              className="h-10"
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <Label className="text-sm font-semibold">Dark Mode Colors</Label>
                        <div className="grid gap-3 grid-cols-3 mt-2">
                          <div className="space-y-2">
                            <Label htmlFor="darkPrimaryColor" className="text-xs">Primary</Label>
                            <Input
                              id="darkPrimaryColor"
                              type="color"
                              value={oklchToHex(brand.darkPrimaryColor || brand.primaryColor)}
                              onChange={handleColorChange("darkPrimaryColor")}
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="darkAccentColor" className="text-xs">Accent</Label>
                            <Input
                              id="darkAccentColor"
                              type="color"
                              value={oklchToHex(brand.darkAccentColor || brand.accentColor)}
                              onChange={handleColorChange("darkAccentColor")}
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="darkBackgroundColor" className="text-xs">Background</Label>
                            <Input
                              id="darkBackgroundColor"
                              type="color"
                              value={oklchToHex(brand.darkBackgroundColor || '#0F0F0F')}
                              onChange={handleColorChange("darkBackgroundColor")}
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="darkSidebarColor" className="text-xs">Sidebar</Label>
                            <Input
                              id="darkSidebarColor"
                              type="color"
                              value={oklchToHex(brand.darkSidebarColor || '#0a0a0a')}
                              onChange={handleColorChange("darkSidebarColor")}
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="darkTextColor" className="text-xs">Text</Label>
                            <Input
                              id="darkTextColor"
                              type="color"
                              value={oklchToHex(brand.darkTextColor || '#f8fafc')}
                              onChange={handleColorChange("darkTextColor")}
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="darkNeutralColor" className="text-xs">Neutral</Label>
                            <Input
                              id="darkNeutralColor"
                              type="color"
                              value={oklchToHex(brand.darkNeutralColor || '#1F1F1F')}
                              onChange={handleColorChange("darkNeutralColor")}
                              className="h-10"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={handleResetBranding}>
                        {t("settings.global.branding.designer.brandBasics.reset", "Reset")}
                      </Button>
                      <Button size="sm" onClick={handleSaveBranding}>
                        {t("settings.global.branding.designer.brandBasics.save", "Save")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FontAwesomeIcon icon={faMagicWandSparkles} className="text-primary" />
                        Light Mode Preview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg border overflow-hidden">
                        <div
                          className="p-3 text-white"
                          style={{
                            backgroundImage: previewGradient,
                            backgroundSize: "cover"
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <WhagonsCheck width={80} height={18} color="#ffffff" />
                          </div>
                          <p className="mt-1 text-xs opacity-90">{brand.organizationName}</p>
                        </div>

                        <div
                          className="p-3 space-y-2"
                          style={{
                            backgroundColor: brand.backgroundColor,
                            color: brand.textColor
                          }}
                        >
                          <div className="flex gap-2">
                            <button
                              className="px-2 py-1 rounded text-xs font-medium"
                              style={{ backgroundColor: brand.primaryColor, color: "#ffffff" }}
                            >
                              Primary
                            </button>
                            <button
                              className="px-2 py-1 rounded text-xs font-medium"
                              style={{ backgroundColor: brand.accentColor, color: "#ffffff" }}
                            >
                              Accent
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <div
                              className="flex-1 rounded p-1.5 text-[10px]"
                              style={{ backgroundColor: brand.neutralColor, color: getContrastingTextColor(brand.neutralColor) }}
                            >
                              Neutral
                            </div>
                            <div
                              className="flex-1 rounded p-1.5 text-[10px]"
                              style={{ backgroundColor: brand.sidebarColor, color: getContrastingTextColor(brand.sidebarColor) }}
                            >
                              Sidebar
                            </div>
                          </div>
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
                        <div
                          className="p-3 text-white"
                          style={{
                            backgroundImage: brand.darkGradientAccent || previewGradient,
                            backgroundSize: "cover"
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <WhagonsCheck width={80} height={18} color="#ffffff" />
                          </div>
                          <p className="mt-1 text-xs opacity-90">{brand.organizationName}</p>
                        </div>

                        <div
                          className="p-3 space-y-2"
                          style={{
                            backgroundColor: brand.darkBackgroundColor || '#0F0F0F',
                            color: brand.darkTextColor || '#f8fafc'
                          }}
                        >
                          <div className="flex gap-2">
                            <button
                              className="px-2 py-1 rounded text-xs font-medium"
                              style={{ backgroundColor: brand.darkPrimaryColor || brand.primaryColor, color: "#ffffff" }}
                            >
                              Primary
                            </button>
                            <button
                              className="px-2 py-1 rounded text-xs font-medium"
                              style={{ backgroundColor: brand.darkAccentColor || brand.accentColor, color: "#ffffff" }}
                            >
                              Accent
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <div
                              className="flex-1 rounded p-1.5 text-[10px]"
                              style={{ backgroundColor: brand.darkNeutralColor || '#1F1F1F', color: '#f8fafc' }}
                            >
                              Neutral
                            </div>
                            <div
                              className="flex-1 rounded p-1.5 text-[10px]"
                              style={{ backgroundColor: brand.darkSidebarColor || '#0a0a0a', color: getContrastingTextColor(brand.darkSidebarColor || '#0a0a0a') }}
                            >
                              Sidebar
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
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
