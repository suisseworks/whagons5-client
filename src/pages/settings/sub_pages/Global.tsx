import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGlobe,
  faPalette,
  faSwatchbook,
  faMagicWandSparkles,
  faImage
} from "@fortawesome/free-solid-svg-icons";

import SettingsLayout from "../components/SettingsLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DEFAULT_BRANDING_ASSETS,
  DEFAULT_BRANDING_CONFIG,
  DEFAULT_BRANDING_TOGGLES,
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
  gradient: string;
  palette: {
    primary: string;
    accent: string;
    background: string;
    text: string;
    neutral: string;
    sidebar?: string;
  };
  badge?: string;
  sidebarTone?: 'light' | 'dark';
};

const PRESET_THEMES: ThemePreset[] = [
  {
    id: "jade-ops",
    label: "Jade Ops",
    description: "Vibrant teal primary with electric indigo highlights",
    gradient: "linear-gradient(130deg, #0fb5a9 0%, #2563eb 100%)",
    palette: {
      primary: "#0fb5a9",
      accent: "#2563eb",
      background: "#f4fffb",
      text: "#0f172a",
      neutral: "#d7f5ef"
    },
    badge: "Default",
    sidebarTone: "light"
  },
  {
    id: "ember",
    label: "Ember Sunrise",
    description: "Warm amber gradients with charcoal typography",
    gradient: "linear-gradient(130deg, #f97316 0%, #ef4444 100%)",
    palette: {
      primary: "#f97316",
      accent: "#ef4444",
      background: "#fff8f3",
      text: "#1f2937",
      neutral: "#ffe4d5"
    },
    badge: "Popular",
    sidebarTone: "light"
  },
  {
    id: "midnight",
    label: "Midnight Violet",
    description: "Moody violet base with neon teal accent",
    gradient: "linear-gradient(130deg, #7c3aed 0%, #0ea5e9 100%)",
    palette: {
      primary: "#7c3aed",
      accent: "#0ea5e9",
      background: "#f5f3ff",
      text: "#101828",
      neutral: "#e5d9ff"
    },
    sidebarTone: "light"
  },
  {
    id: "sandstone",
    label: "Sandstone Calm",
    description: "Soft neutrals with deep emerald accents",
    gradient: "linear-gradient(130deg, #fcd34d 0%, #0f9d58 100%)",
    palette: {
      primary: "#0f9d58",
      accent: "#f97316",
      background: "#fffef7",
      text: "#1c1917",
      neutral: "#f6edd3"
    },
    badge: "New",
    sidebarTone: "light"
  },
  {
    id: "night-ops",
    label: "Night Ops",
    description: "Teal gradients with a dark command-center sidebar.",
    gradient: "linear-gradient(130deg, #0f172a 0%, #2563eb 100%)",
    palette: {
      primary: "#0fb5a9",
      accent: "#22d3ee",
      background: "#f4fffb",
      text: "#0f172a",
      neutral: "#d7f5ef",
      sidebar: SIDEBAR_DARK
    },
    badge: "Dark sidebar",
    sidebarTone: "dark"
  }
];

const CUSTOM_THEME_ID = "custom";

const getSidebarColorForTheme = (theme: ThemePreset) => {
  if (theme.sidebarTone === 'dark') return SIDEBAR_DARK;
  if (theme.sidebarTone === 'light') return SIDEBAR_LIGHT;
  return theme.palette.sidebar ?? SIDEBAR_LIGHT;
};

const getPresetIdForConfig = (config: BrandingConfig) => {
  const preset = PRESET_THEMES.find(
    (theme) =>
      theme.palette.primary === config.primaryColor &&
      theme.palette.accent === config.accentColor &&
      theme.palette.background === config.backgroundColor &&
      getSidebarColorForTheme(theme) === config.sidebarColor &&
      theme.palette.text === config.textColor &&
      theme.palette.neutral === config.neutralColor
  );
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

  const brandTokens = useMemo(
    () => [
      { labelKey: "settings.global.branding.tokens.primary", fallbackLabel: "Primary", token: "--brand-primary", value: brand.primaryColor },
      { labelKey: "settings.global.branding.tokens.accent", fallbackLabel: "Accent", token: "--brand-accent", value: brand.accentColor },
      { labelKey: "settings.global.branding.tokens.background", fallbackLabel: "Background", token: "--brand-background", value: brand.backgroundColor },
      { labelKey: "settings.global.branding.tokens.neutral", fallbackLabel: "Neutral", token: "--brand-neutral", value: brand.neutralColor },
      { labelKey: "settings.global.branding.tokens.sidebar", fallbackLabel: "Sidebar", token: "--brand-sidebar", value: brand.sidebarColor },
      { labelKey: "settings.global.branding.tokens.foreground", fallbackLabel: "Foreground", token: "--brand-foreground", value: brand.textColor }
    ],
    [brand]
  );

  const previewGradient = useMemo(
    () => brand.gradientAccent || `linear-gradient(130deg, ${brand.primaryColor}, ${brand.accentColor})`,
    [brand.gradientAccent, brand.primaryColor, brand.accentColor]
  );

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
    setBrand((prev) => ({
      ...prev,
      primaryColor: theme.palette.primary,
      accentColor: theme.palette.accent,
      backgroundColor: theme.palette.background,
      sidebarColor: getSidebarColorForTheme(theme),
      textColor: theme.palette.text,
      neutralColor: theme.palette.neutral,
      gradientAccent: theme.gradient
    }));
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
    const config = { ...DEFAULT_BRANDING_CONFIG };
    const resetAssets = { ...DEFAULT_BRANDING_ASSETS };
    const resetToggles = { ...DEFAULT_BRANDING_TOGGLES };
    setBrand(config);
    setAssets(resetAssets);
    setToggles(resetToggles);
    setSelectedTheme(getPresetIdForConfig(config));
    saveBranding({
      config,
      assets: resetAssets,
      toggles: resetToggles
    });
  };

  const scrollToDesigner = () => {
    if (typeof window === "undefined") return;
    document.getElementById("branding-designer")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-primary/30 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FontAwesomeIcon icon={faPalette} className="text-primary" />
                    {t("settings.global.branding.hero.cardTitle", "Branding & Identity")}
                  </CardTitle>
                  <CardDescription>
                    {t(
                      "settings.global.branding.hero.cardDescription",
                      "Customize logos, color tokens, and gradients that propagate throughout the workspace, auth screens, and outbound emails."
                    )}
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  {t("settings.global.branding.hero.badge", "New")}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button onClick={scrollToDesigner}>
                  {t("settings.global.branding.hero.openDesigner", "Open designer")}
                </Button>
                <Button variant="outline">
                  {t("settings.global.branding.hero.previewButton", "Preview login screen")}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FontAwesomeIcon icon={faSwatchbook} className="text-muted-foreground" />
                  {t("settings.global.branding.guidance.title", "Guidance")}
                </CardTitle>
                <CardDescription>
                  {t(
                    "settings.global.branding.guidance.description",
                    "Branding lives entirely in configuration—no redeploy required. Changes sync to every connected client within ~60 seconds."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>• {t("settings.global.branding.guidance.tip1", "Prefer accessible contrast ratios (4.5:1) for sidebar/background tokens.")}</p>
                <p>• {t("settings.global.branding.guidance.tip2", "Upload SVG logos whenever possible for crisp scaling.")}</p>
                <p>• {t("settings.global.branding.guidance.tip3", "Keep gradients subtle so content remains the hero.")}</p>
              </CardContent>
            </Card>
          </div>

          <div id="branding-designer" className="space-y-6">
            <Tabs defaultValue="designer" className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t(
                      "settings.global.branding.tabs.helper",
                      "Switch between the theme designer, asset uploads, and rollout controls to keep this surface tidy."
                    )}
                  </p>
                </div>
                <TabsList className="w-full justify-start overflow-x-auto lg:w-auto">
                  <TabsTrigger value="designer">
                    {t("settings.global.branding.tabs.designer", "Theme designer")}
                  </TabsTrigger>
                  <TabsTrigger value="assets">
                    {t("settings.global.branding.tabs.assets", "Logos & icons")}
                  </TabsTrigger>
                  <TabsTrigger value="rollout">
                    {t("settings.global.branding.tabs.rollout", "Rollout controls")}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="designer" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <FontAwesomeIcon icon={faPalette} className="text-primary" />
                          {t("settings.global.branding.designer.brandBasics.title", "Brand basics")}
                        </CardTitle>
                        <CardDescription>
                          {t(
                            "settings.global.branding.designer.brandBasics.description",
                            "Update names, messaging, and primary palette tokens."
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="organizationName">
                              {t("settings.global.branding.designer.brandBasics.organizationLabel", "Organization name")}
                            </Label>
                            <Input
                              id="organizationName"
                              value={brand.organizationName}
                              onChange={handleBrandFieldChange("organizationName")}
                              placeholder={t(
                                "settings.global.branding.designer.brandBasics.organizationPlaceholder",
                                "Acme Utilities"
                              )}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="productLabel">
                              {t("settings.global.branding.designer.brandBasics.productLabel", "Product surface label")}
                            </Label>
                            <Input
                              id="productLabel"
                              value={brand.productLabel}
                              onChange={handleBrandFieldChange("productLabel")}
                              placeholder={t(
                                "settings.global.branding.designer.brandBasics.productPlaceholder",
                                "Command Center"
                              )}
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
                            placeholder={t(
                              "settings.global.branding.designer.brandBasics.taglinePlaceholder",
                              "Share a short promise or mission."
                            )}
                          />
                        </div>

                        <Separator />

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="primaryColor">
                              {t("settings.global.branding.designer.brandBasics.primaryLabel", "Primary color")}
                            </Label>
                            <Input
                              id="primaryColor"
                              type="color"
                              value={brand.primaryColor}
                              onChange={handleColorChange("primaryColor")}
                            />
                            <p className="text-xs text-muted-foreground">
                              {t(
                                "settings.global.branding.designer.brandBasics.primaryHelper",
                                "Buttons, highlights, and main call-to-actions."
                              )}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="accentColor">
                              {t("settings.global.branding.designer.brandBasics.accentLabel", "Accent color")}
                            </Label>
                            <Input
                              id="accentColor"
                              type="color"
                              value={brand.accentColor}
                              onChange={handleColorChange("accentColor")}
                            />
                            <p className="text-xs text-muted-foreground">
                              {t(
                                "settings.global.branding.designer.brandBasics.accentHelper",
                                "Secondary emphasis, badges, and charts."
                              )}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="backgroundColor">
                              {t("settings.global.branding.designer.brandBasics.backgroundLabel", "Background")}
                            </Label>
                            <Input
                              id="backgroundColor"
                              type="color"
                              value={brand.backgroundColor}
                              onChange={handleColorChange("backgroundColor")}
                            />
                            <p className="text-xs text-muted-foreground">
                              {t(
                                "settings.global.branding.designer.brandBasics.backgroundHelper",
                                "High-level canvas for pages and cards."
                              )}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="sidebarColor">
                              {t("settings.global.branding.designer.brandBasics.sidebarLabel", "Sidebar")}
                            </Label>
                            <Input
                              id="sidebarColor"
                              type="color"
                              value={brand.sidebarColor}
                              onChange={handleColorChange("sidebarColor")}
                            />
                            <p className="text-xs text-muted-foreground">
                              {t(
                                "settings.global.branding.designer.brandBasics.sidebarHelper",
                                "Navigation rails, modals, and overlays."
                              )}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="textColor">
                              {t("settings.global.branding.designer.brandBasics.textLabel", "Foreground")}
                            </Label>
                            <Input
                              id="textColor"
                              type="color"
                              value={brand.textColor}
                              onChange={handleColorChange("textColor")}
                            />
                            <p className="text-xs text-muted-foreground">
                              {t(
                                "settings.global.branding.designer.brandBasics.textHelper",
                                "Main typography color."
                              )}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="neutralColor">
                              {t("settings.global.branding.designer.brandBasics.neutralLabel", "Neutral")}
                            </Label>
                            <Input
                              id="neutralColor"
                              type="color"
                              value={brand.neutralColor}
                              onChange={handleColorChange("neutralColor")}
                            />
                            <p className="text-xs text-muted-foreground">
                              {t(
                                "settings.global.branding.designer.brandBasics.neutralHelper",
                                "Surfaces, tables, and dividers."
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="notes">
                            {t("settings.global.branding.designer.brandBasics.notesLabel", "Launch notes")}
                          </Label>
                          <Textarea
                            id="notes"
                            value={brand.notes}
                            onChange={handleBrandFieldChange("notes")}
                            placeholder={t(
                              "settings.global.branding.designer.brandBasics.notesPlaceholder",
                              "Capture reasoning, accessibility checks, or internal review notes."
                            )}
                          />
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={handleResetBranding}>
                            {t("settings.global.branding.designer.brandBasics.reset", "Reset to default")}
                          </Button>
                          <Button size="sm" onClick={handleSaveBranding}>
                            {t("settings.global.branding.designer.brandBasics.save", "Save branding draft")}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              <FontAwesomeIcon icon={faMagicWandSparkles} className="text-primary" />
                              {t("settings.global.branding.designer.preview.title", "Live preview")}
                            </CardTitle>
                            <CardDescription>
                              {t(
                                "settings.global.branding.designer.preview.description",
                                "Real-time mock of the sidebar + hero surfaces."
                              )}
                            </CardDescription>
                          </div>
                          <Badge variant="outline">
                            {t("settings.global.branding.designer.preview.badge", "Preview")}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-xl border overflow-hidden shadow-sm">
                          <div
                            className="p-5 text-white"
                            style={{ background: previewGradient }}
                          >
                            <div className="flex items-center gap-3">
                              {assets.logoLight ? (
                                <img src={assets.logoLight} alt="Brand logo" className="h-10 object-contain" />
                              ) : (
                                <WhagonsCheck width={120} height={28} color="#ffffff" />
                              )}
                              <div>
                                <p className="text-xs uppercase tracking-wide opacity-80">
                                  {brand.organizationName}
                                </p>
                                <p className="font-semibold text-lg">{brand.productLabel}</p>
                              </div>
                            </div>
                            <p className="mt-4 text-sm text-white/80">{brand.tagline}</p>
                          </div>

                          <div
                            className="p-5 space-y-4"
                            style={{ backgroundColor: brand.backgroundColor, color: brand.textColor }}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">
                                  {t("settings.global.branding.designer.preview.primaryButton", "Primary button")}
                                </p>
                                <p className="text-xs text-muted-foreground" style={{ color: brand.textColor, opacity: 0.7 }}>
                                  {t("settings.global.branding.designer.preview.primaryHelper", "Uses --brand-primary")}
                                </p>
                              </div>
                              <button
                                className="px-4 py-2 rounded-md text-sm font-semibold shadow-sm"
                                style={{ backgroundColor: brand.primaryColor, color: "#ffffff" }}
                                onClick={handleSaveBranding}
                              >
                                {t("settings.global.branding.designer.preview.apply", "Apply changes")}
                              </button>
                            </div>

                            <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: brand.neutralColor, color: brand.textColor }}>
                              {t(
                                "settings.global.branding.designer.preview.neutralTile",
                                "Sample notification tile using neutral token."
                              )}
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div
                                className="rounded-lg p-3 text-sm text-white"
                                style={{ backgroundColor: brand.sidebarColor }}
                              >
                                {t("settings.global.branding.designer.preview.sidebarSample", "Sidebar sample")}
                              </div>
                              <div
                                className="rounded-lg p-3 text-sm text-white"
                                style={{ backgroundColor: brand.accentColor }}
                              >
                                {t("settings.global.branding.designer.preview.accentSample", "Accent CTA")}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <FontAwesomeIcon icon={faSwatchbook} className="text-muted-foreground" />
                          {t("settings.global.branding.designer.tokens.title", "Brand tokens")}
                        </CardTitle>
                        <CardDescription>
                          {t(
                            "settings.global.branding.designer.tokens.description",
                            "Map UI tokens to your brand kit."
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {brandTokens.map((token) => (
                          <div key={token.token} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-3">
                              <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: token.value }} />
                              <div>
                                <p className="font-medium">
                                  {t(token.labelKey, token.fallbackLabel)}
                                </p>
                                <p className="text-xs text-muted-foreground">{token.token}</p>
                              </div>
                            </div>
                            <code className="text-xs font-mono bg-muted/70 px-2 py-0.5 rounded">
                              {token.value}
                            </code>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FontAwesomeIcon icon={faPalette} className="text-primary" />
                      {t("settings.global.branding.designer.presets.title", "Preset themes")}
                    </CardTitle>
                    <CardDescription>
                      {t(
                        "settings.global.branding.designer.presets.description",
                        "Apply curated palettes as a starting point."
                      )}
                    </CardDescription>
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
                          <div
                            className="h-20 rounded-lg mb-3"
                            style={{ background: theme.gradient }}
                          />
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-sm">{theme.label}</p>
                              <p className="text-xs text-muted-foreground">{theme.description}</p>
                            </div>
                            {theme.badge && (
                              <Badge variant="secondary" className="text-[10px]">
                                {theme.badge}
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
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
          </div>
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
