// Local types for this Settings subpage.
// Keep this file UI-focused (forms, derived view models, etc.).

export type ThemePreset = {
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
      navbar?: string;
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
      navbar?: string;
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

export type ColorPickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  allowGradients?: boolean; // If false, only solid colors are allowed
};
