import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGlobe } from "@fortawesome/free-solid-svg-icons";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGE_OPTIONS } from "@/config/languages";
import { celebrateTaskCompletion, type CelebrationType } from "@/utils/confetti";
import { setFontStyle, type FontStyle } from "@/utils/fontStyle";
import { MOTIVATIONAL_QUOTES, HERO_IMAGES } from "../utils/constants";

type DefaultsTabProps = {
  language: string;
  setLanguage: (lang: string) => void;
  fontStyle: FontStyle;
  setFontStyle: (style: FontStyle) => void;
  setFontStyleState: (style: FontStyle) => void;
  celebrationType: CelebrationType;
  setCelebrationType: (type: CelebrationType) => void;
  setCelebrationTypeState: (type: CelebrationType) => void;
  heroImage: string;
  motivationalQuote: string;
  t: (key: string, fallback?: string) => string;
};

export const DefaultsTab = ({
  language,
  setLanguage,
  fontStyle,
  setFontStyle,
  setFontStyleState,
  celebrationType,
  setCelebrationType,
  setCelebrationTypeState,
  heroImage,
  motivationalQuote,
  t,
}: DefaultsTabProps) => {
  return (
    <Card>
      <div className="h-64 relative overflow-hidden rounded-t-lg">
        <img 
          src={heroImage}
          alt="Inspirational workspace"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/70"></div>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
          <FontAwesomeIcon icon={faGlobe} className="text-4xl mb-3 text-white opacity-90" />
          <h3 className="text-2xl font-bold text-white mb-3 drop-shadow-lg">
            {t("settings.global.defaults.cardTitle", "Platform defaults")}
          </h3>
          <p className="text-sm md:text-base text-white/95 text-center max-w-2xl leading-relaxed drop-shadow-md italic">
            "{motivationalQuote}"
          </p>
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
              // Preview the selected celebration immediately
              if (value !== 'none') {
                celebrateTaskCompletion(value);
              }
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
  );
};
