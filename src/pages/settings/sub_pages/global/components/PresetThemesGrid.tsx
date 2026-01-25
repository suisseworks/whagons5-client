import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagicWandSparkles } from "@fortawesome/free-solid-svg-icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ThemePreset } from "../types";
import { PRESET_THEMES } from "../utils/constants";

type PresetThemesGridProps = {
  selectedTheme: string;
  onThemeSelect: (theme: ThemePreset) => void;
  t: (key: string, fallback?: string) => string;
};

export const PresetThemesGrid = ({ selectedTheme, onThemeSelect, t }: PresetThemesGridProps) => {
  return (
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
              onClick={() => onThemeSelect(theme)}
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
  );
};
