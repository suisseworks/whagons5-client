import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPalette } from "@fortawesome/free-solid-svg-icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { BrandingConfig } from "@/config/branding";
import { ColorPickerField } from "./ColorPickerField";
import { ThemePreview } from "./ThemePreview";

type CustomDesignerTabProps = {
  brand: BrandingConfig;
  setBrand: React.Dispatch<React.SetStateAction<BrandingConfig>>;
  previewGradientValue: string;
  darkPreviewGradientValue: string;
  markAsCustom: () => void;
  handleBrandFieldChange: (field: keyof BrandingConfig) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSaveBranding: () => void;
  handleResetBranding: () => void;
  t: (key: string, fallback?: string) => string;
};

export const CustomDesignerTab = ({
  brand,
  setBrand,
  previewGradientValue,
  darkPreviewGradientValue,
  markAsCustom,
  handleBrandFieldChange,
  handleSaveBranding,
  handleResetBranding,
  t,
}: CustomDesignerTabProps) => {
  return (
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
                    markAsCustom();
                  }}
                  allowGradients={false}
                />
                <ColorPickerField
                  id="accentColor"
                  label="Accent"
                  value={brand.accentColor}
                  onChange={(value) => {
                    setBrand((prev) => ({ ...prev, accentColor: value }));
                    markAsCustom();
                  }}
                  allowGradients={false}
                />
                <ColorPickerField
                  id="textColor"
                  label="Text"
                  value={brand.textColor}
                  onChange={(value) => {
                    setBrand((prev) => ({ ...prev, textColor: value }));
                    markAsCustom();
                  }}
                  allowGradients={false}
                />
                <ColorPickerField
                  id="neutralColor"
                  label="Neutral"
                  value={brand.neutralColor}
                  onChange={(value) => {
                    setBrand((prev) => ({ ...prev, neutralColor: value }));
                    markAsCustom();
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
                    markAsCustom();
                  }}
                />
                <ColorPickerField
                  id="sidebarColor"
                  label="Sidebar"
                  value={brand.sidebarColor}
                  onChange={(value) => {
                    setBrand((prev) => ({ ...prev, sidebarColor: value }));
                    markAsCustom();
                  }}
                />
                <ColorPickerField
                  id="headerBackgroundGradient"
                  label="Navbar/Header"
                  value={brand.headerBackgroundGradient || brand.navbarColor || '#ffffff'}
                  onChange={(value) => {
                    setBrand((prev) => {
                      const isGradient = value && value.startsWith('linear-gradient');
                      return {
                        ...prev,
                        headerBackgroundGradient: isGradient ? value : undefined,
                        navbarColor: isGradient ? '#ffffff' : value
                      };
                    });
                    markAsCustom();
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <ThemePreview
          brand={brand}
          previewGradient={previewGradientValue}
          mode="light"
          title={t("settings.global.branding.designer.lightPreview", "Light Mode Preview")}
        />
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
                    markAsCustom();
                  }}
                  allowGradients={false}
                />
                <ColorPickerField
                  id="darkAccentColor"
                  label="Accent"
                  value={brand.darkAccentColor || brand.accentColor}
                  onChange={(value) => {
                    setBrand((prev) => ({ ...prev, darkAccentColor: value }));
                    markAsCustom();
                  }}
                  allowGradients={false}
                />
                <ColorPickerField
                  id="darkTextColor"
                  label="Text"
                  value={brand.darkTextColor || '#f8fafc'}
                  onChange={(value) => {
                    setBrand((prev) => ({ ...prev, darkTextColor: value }));
                    markAsCustom();
                  }}
                  allowGradients={false}
                />
                <ColorPickerField
                  id="darkNeutralColor"
                  label="Neutral"
                  value={brand.darkNeutralColor || '#1F1F1F'}
                  onChange={(value) => {
                    setBrand((prev) => ({ ...prev, darkNeutralColor: value }));
                    markAsCustom();
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
                    markAsCustom();
                  }}
                />
                <ColorPickerField
                  id="darkSidebarColor"
                  label="Sidebar"
                  value={brand.darkSidebarColor || '#0a0a0a'}
                  onChange={(value) => {
                    setBrand((prev) => ({ ...prev, darkSidebarColor: value }));
                    markAsCustom();
                  }}
                />
                <ColorPickerField
                  id="darkHeaderBackgroundGradient"
                  label="Navbar/Header"
                  value={brand.darkHeaderBackgroundGradient || brand.darkNavbarColor || '#0F0F0F'}
                  onChange={(value) => {
                    setBrand((prev) => {
                      const isGradient = value && value.startsWith('linear-gradient');
                      return {
                        ...prev,
                        darkHeaderBackgroundGradient: isGradient ? value : undefined,
                        darkNavbarColor: isGradient ? undefined : value
                      };
                    });
                    markAsCustom();
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <ThemePreview
          brand={brand}
          previewGradient={darkPreviewGradientValue}
          mode="dark"
          title={t("settings.global.branding.designer.darkPreview", "Dark Mode Preview")}
        />
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
  );
};
