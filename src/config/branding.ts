export type BrandingConfig = {
  organizationName: string;
  productLabel: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string; // Body background
  sidebarColor: string; // Sidebar background
  navbarColor: string; // Navbar/header background (can be gradient)
  textColor: string;
  neutralColor: string;
  headerBackgroundGradient?: string; // Header background gradient (optional, overrides navbarColor if set)
  surfacePattern: string;
  sidebarPattern: string;
  surfacePatternSize: string;
  sidebarPatternSize: string;
  notes: string;
  // Dark mode specific colors
  darkPrimaryColor?: string;
  darkAccentColor?: string;
  darkBackgroundColor?: string;
  darkSidebarColor?: string;
  darkNavbarColor?: string;
  darkTextColor?: string;
  darkNeutralColor?: string;
  darkHeaderBackgroundGradient?: string;
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
  primaryColor: 'oklch(0.59 0.13 175)',
  accentColor: 'oklch(0.55 0.22 264)',
  backgroundColor: 'oklch(1 0 0)', // Body background
  sidebarColor: '#FAFBFC', // Sidebar background
  navbarColor: '#ffffff', // Navbar/header background
  textColor: 'oklch(0.20 0.02 250)',
  neutralColor: 'oklch(0.90 0.01 200)',
  headerBackgroundGradient: undefined, // Optional header gradient
  surfacePattern: 'none',
  sidebarPattern: 'none',
  surfacePatternSize: '32px 32px',
  sidebarPatternSize: '24px 24px',
  notes: '',
  // Dark mode defaults
  darkPrimaryColor: 'oklch(0.70 0.13 175)',
  darkAccentColor: 'oklch(0.65 0.11 175)',
  darkBackgroundColor: 'oklch(0.15 0 0)',
  darkSidebarColor: 'oklch(0.10 0 0)',
  darkNavbarColor: 'oklch(0.12 0 0)',
  darkTextColor: 'oklch(0.95 0 0)',
  darkNeutralColor: 'oklch(0.25 0 0)',
  darkHeaderBackgroundGradient: undefined,
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
