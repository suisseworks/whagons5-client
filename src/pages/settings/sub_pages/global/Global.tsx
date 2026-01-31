import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGlobe, faImage } from "@fortawesome/free-solid-svg-icons";

import SettingsLayout from "@/pages/settings/components/SettingsLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/animated/Tabs";
import { BrandingConfig } from "@/config/branding";
import { useBranding } from "@/providers/BrandingProvider";
import { useLanguage } from "@/providers/LanguageProvider";
import { getCelebrationType, setCelebrationType, type CelebrationType } from "@/utils/confetti";
import { getFontStyle, setFontStyle, initFontStyle, type FontStyle } from "@/utils/fontStyle";

import { DefaultsTab } from "./components/DefaultsTab";
import { PresetThemesGrid } from "./components/PresetThemesGrid";
import { CustomDesignerTab } from "./components/CustomDesignerTab";
import { useBrandingState } from "./hooks/useBrandingState";
import { useThemeManagement } from "./hooks/useThemeManagement";
import { CUSTOM_THEME_ID, TOGGLE_CONFIG, ASSET_CONFIG, MOTIVATIONAL_QUOTES, HERO_IMAGES } from "./utils/constants";
import { previewGradient, darkPreviewGradient } from "./utils/colorHelpers";

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
  
  // Random hero image and quote on mount
  const [heroImage, _setHeroImage] = useState(() => 
    HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)]
  );
  const [motivationalQuote, _setMotivationalQuote] = useState(() =>
    MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
  );

  // Initialize font style on mount
  useEffect(() => {
    initFontStyle();
  }, []);

  const {
    brand,
    setBrand,
    assets,
    setAssets,
    toggles,
    setToggles,
    selectedTheme,
    setSelectedTheme,
    hasPendingChanges,
    resetToActive,
    markAsCustom,
  } = useBrandingState(activeBrand, activeAssets, activeToggles);

  const { handleThemeApply } = useThemeManagement(
    brand,
    assets,
    toggles,
    setBrand,
    setSelectedTheme,
    saveBranding
  );

  const previewGradientValue = useMemo(() => previewGradient(brand), [brand]);
  const darkPreviewGradientValue = useMemo(() => darkPreviewGradient(brand), [brand]);

  const handleBrandFieldChange =
    (field: keyof BrandingConfig) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { value } = event.target;
        setBrand((prev) => ({ ...prev, [field]: value }));
        markAsCustom();
      };

  const handleAssetUpload =
    (key: keyof typeof assets) =>
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

  const handleAssetReset = (key: keyof typeof assets) => {
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
    resetToActive();
  };

  const handleResetBranding = () => {
    resetToActive();
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
      <div className="max-w-5xl mx-auto w-full">
        <Tabs defaultValue="defaults" className="space-y-6 pb-12">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border pb-6 pt-4 mb-6">
          <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground max-w-2xl">
              {t(
                "settings.global.intro",
                "Configure how your org looks and behaves at a global level. Switch tabs to access different modules."
              )}
            </p>
            <div className="flex gap-2 border-b border-border -mb-6">
              <TabsList className="inline-flex h-auto items-center justify-start rounded-none bg-transparent p-0 text-muted-foreground border-0 w-auto">
                <TabsTrigger 
                  value="defaults"
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent hover:text-foreground hover:border-muted-foreground/50"
                >
                  {t("settings.global.tabs.defaults", "Platform Defaults")}
                </TabsTrigger>
                <TabsTrigger 
                  value="branding"
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent hover:text-foreground hover:border-muted-foreground/50"
                >
                  {t("settings.global.tabs.branding", "Branding & Identity")}
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
        </div>

        <TabsContent value="defaults">
          <DefaultsTab
            language={language}
            setLanguage={setLanguage}
            fontStyle={fontStyle}
            setFontStyle={setFontStyle}
            setFontStyleState={setFontStyleState}
            celebrationType={celebrationType}
            setCelebrationType={setCelebrationType}
            setCelebrationTypeState={setCelebrationTypeState}
            heroImage={heroImage}
            motivationalQuote={motivationalQuote}
            t={t}
          />
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
          <Tabs defaultValue="presets" className="space-y-6">
            <div className="flex flex-col gap-6">
              <p className="text-sm text-muted-foreground max-w-2xl">
                {t(
                  "settings.global.branding.tabs.helper",
                  "Choose a preset theme or create a custom design with your brand colors."
                )}
              </p>
              <div className="flex gap-2 border-b border-border -mb-6">
                <TabsList className="inline-flex h-auto items-center justify-start rounded-none bg-transparent p-0 text-muted-foreground border-0 w-auto">
                  <TabsTrigger 
                    value="presets"
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent hover:text-foreground hover:border-muted-foreground/50"
                  >
                    {t("settings.global.branding.tabs.presets", "Preset Themes")}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="custom"
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent hover:text-foreground hover:border-muted-foreground/50"
                  >
                    {t("settings.global.branding.tabs.custom", "Custom Designer")}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="assets"
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent hover:text-foreground hover:border-muted-foreground/50"
                  >
                    {t("settings.global.branding.tabs.assets", "Logos & Icons")}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="rollout"
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent hover:text-foreground hover:border-muted-foreground/50"
                  >
                    {t("settings.global.branding.tabs.rollout", "Rollout Controls")}
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <TabsContent value="presets" className="space-y-6">
              <PresetThemesGrid
                selectedTheme={selectedTheme}
                onThemeSelect={handleThemeApply}
                t={t}
              />
            </TabsContent>

            <TabsContent value="custom" className="space-y-6">
              <CustomDesignerTab
                brand={brand}
                setBrand={setBrand}
                previewGradientValue={previewGradientValue}
                darkPreviewGradientValue={darkPreviewGradientValue}
                markAsCustom={markAsCustom}
                handleBrandFieldChange={handleBrandFieldChange}
                handleSaveBranding={handleSaveBranding}
                handleResetBranding={handleResetBranding}
                t={t}
              />
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
      </div>

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
