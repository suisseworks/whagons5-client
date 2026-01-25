import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagicWandSparkles } from "@fortawesome/free-solid-svg-icons";
import WhagonsCheck from "@/assets/WhagonsCheck";
import { BrandingConfig } from "@/config/branding";
import { isGradientValue, getCssColorOrGradient, getContrastingTextColor } from "../utils/colorHelpers";

type ThemePreviewProps = {
  brand: BrandingConfig;
  previewGradient: string;
  mode: 'light' | 'dark';
  title: string;
};

export const ThemePreview = ({ brand, previewGradient, mode, title }: ThemePreviewProps) => {
  const isLight = mode === 'light';
  const sidebarColor = isLight ? brand.sidebarColor : (brand.darkSidebarColor || '#0a0a0a');
  const backgroundColor = isLight ? brand.backgroundColor : (brand.darkBackgroundColor || '#0F0F0F');
  const textColor = isLight ? brand.textColor : (brand.darkTextColor || '#f8fafc');
  const primaryColor = isLight ? brand.primaryColor : (brand.darkPrimaryColor || brand.primaryColor);
  const accentColor = isLight ? brand.accentColor : (brand.darkAccentColor || brand.accentColor);
  const neutralColor = isLight ? brand.neutralColor : (brand.darkNeutralColor || '#1F1F1F');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FontAwesomeIcon icon={faMagicWandSparkles} className="text-primary" />
          {title}
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
                ...(isGradientValue(sidebarColor)
                  ? { backgroundImage: getCssColorOrGradient(sidebarColor, isLight ? '#FAFBFC' : '#0a0a0a') }
                  : { backgroundColor: getCssColorOrGradient(sidebarColor, isLight ? '#FAFBFC' : '#0a0a0a') }),
                color: getContrastingTextColor(getCssColorOrGradient(sidebarColor, isLight ? '#FAFBFC' : '#0a0a0a'))
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
                ...(isGradientValue(backgroundColor) 
                  ? { backgroundImage: getCssColorOrGradient(backgroundColor, isLight ? '#ffffff' : '#0F0F0F') }
                  : { backgroundColor: getCssColorOrGradient(backgroundColor, isLight ? '#ffffff' : '#0F0F0F') }),
                color: getCssColorOrGradient(textColor, isLight ? '#000000' : '#f8fafc')
              }}
            >
              <div className="flex gap-1.5">
                <button
                  className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                  style={{
                    ...(isGradientValue(primaryColor)
                      ? { backgroundImage: getCssColorOrGradient(primaryColor, '#000000') }
                      : { backgroundColor: getCssColorOrGradient(primaryColor, '#000000') }),
                    color: "#ffffff"
                  }}
                >
                  Primary
                </button>
                <button
                  className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                  style={{
                    ...(isGradientValue(accentColor)
                      ? { backgroundImage: getCssColorOrGradient(accentColor, '#000000') }
                      : { backgroundColor: getCssColorOrGradient(accentColor, '#000000') }),
                    color: "#ffffff"
                  }}
                >
                  Accent
                </button>
              </div>
              <div
                className="rounded p-1 text-[9px]"
                style={{
                  ...(isGradientValue(neutralColor)
                    ? { backgroundImage: getCssColorOrGradient(neutralColor, isLight ? '#f0f0f0' : '#1F1F1F') }
                    : { backgroundColor: getCssColorOrGradient(neutralColor, isLight ? '#f0f0f0' : '#1F1F1F') }),
                  color: isLight 
                    ? getContrastingTextColor(getCssColorOrGradient(neutralColor, '#f0f0f0'))
                    : '#f8fafc'
                }}
              >
                Neutral surface
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
