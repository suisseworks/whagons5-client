export type BrandingConfig = {
  organizationName: string;
  productLabel: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  sidebarColor: string;
  textColor: string;
  neutralColor: string;
  gradientAccent: string;
  notes: string;
};

export type BrandingAssets = {
  logoLight: string | null;
  logoDark: string | null;
  favicon: string | null;
};

export type BrandingToggles = {
  applyLoginBranding: boolean;
  allowCustomThemes: boolean;
  lockDarkMode: boolean;
};

export const BRANDING_STORAGE_KEY = 'whagons-branding-config';

export const DEFAULT_BRANDING_CONFIG: BrandingConfig = {
  organizationName: 'Whagons',
  productLabel: 'Ops OS',
  tagline: 'Orchestrate every frontline workflow in one branded console.',
  primaryColor: '#0fb5a9',
  accentColor: '#2563eb',
  backgroundColor: '#f4fffb',
  sidebarColor: '#FAFBFC',
  textColor: '#0f172a',
  neutralColor: '#d7f5ef',
  gradientAccent: 'linear-gradient(130deg, #0fb5a9 0%, #2563eb 100%)',
  notes: '',
};

export const DEFAULT_BRANDING_ASSETS: BrandingAssets = {
  logoLight: null,
  logoDark: null,
  favicon: null,
};

export const DEFAULT_BRANDING_TOGGLES: BrandingToggles = {
  applyLoginBranding: true,
  allowCustomThemes: false,
  lockDarkMode: false,
};
