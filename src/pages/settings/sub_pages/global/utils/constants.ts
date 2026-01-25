import { ThemePreset } from '../types';
import { BrandingAssets, BrandingToggles, DEFAULT_BRANDING_CONFIG } from '@/config/branding';

export const SIDEBAR_LIGHT = '#FAFBFC';
export const SIDEBAR_DARK = '#08111f';

export const RETRO_SURFACE_PATTERN =
  "radial-gradient(circle at 12px 12px, rgba(0, 0, 0, 0.06) 2px, transparent 0), radial-gradient(circle at 4px 4px, rgba(255, 255, 255, 0.08) 2px, transparent 0)";
export const RETRO_SIDEBAR_PATTERN =
  "repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.08) 0 6px, transparent 6px 12px), radial-gradient(circle at 10px 10px, rgba(255, 255, 255, 0.08) 1.5px, transparent 0)";

export const PRESET_THEMES: ThemePreset[] = [
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

export const CUSTOM_THEME_ID = "custom";

export const TOGGLE_CONFIG: Array<{
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

export const ASSET_CONFIG: Array<{
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

// Motivational quotes array
export const MOTIVATIONAL_QUOTES = [
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "The only way to do great work is to love what you do.",
  "Innovation distinguishes between a leader and a follower.",
  "The future belongs to those who believe in the beauty of their dreams.",
  "Excellence is not a skill, it's an attitude.",
  "Don't watch the clock; do what it does. Keep going.",
  "The only limit to our realization of tomorrow will be our doubts of today.",
  "Success usually comes to those who are too busy to be looking for it.",
  "The way to get started is to quit talking and begin doing.",
  "Innovation is the ability to see change as an opportunity, not a threat.",
  "Your limitation—it's only your imagination.",
  "Great things never come from comfort zones.",
  "Dream it. Wish it. Do it.",
  "Success doesn't just find you. You have to go out and get it.",
  "The harder you work for something, the greater you'll feel when you achieve it.",
];

// Random hero images from Unsplash
export const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1645736315000-6f788915923b?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1920&q=80",
];
