export type ThemeId = 'default' | 'cyberpunk' | 'emerald' | 'violet' | 'sunset';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceLight: string;
  card: string;
  primary: string;
  secondary: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  danger: string;
  success: string;
}

export interface ThemeTokens {
  id: ThemeId;
  name: string;
  colors: ThemeColors;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
}
