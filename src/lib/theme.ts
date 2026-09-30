export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export const THEME_KEY = 'preptrack-theme';
export const resolveTheme = (mode: ThemeMode, systemDark: boolean): ResolvedTheme => mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

export const ACCENT_COLORS = [
  { name: 'Blue', light: '#3459c7', dark: '#9bb4ff' }, { name: 'Violet', light: '#7042b8', dark: '#c8a8ff' },
  { name: 'Teal', light: '#087b72', dark: '#77d8cb' }, { name: 'Rose', light: '#b33f5e', dark: '#ff9ab2' },
  { name: 'Amber', light: '#956100', dark: '#f5c86e' }, { name: 'Indigo', light: '#4d55b5', dark: '#aeb2ff' },
  { name: 'Green', light: '#37734a', dark: '#9bd4a7' }, { name: 'Coral', light: '#b75035', dark: '#ffab91' },
] as const;
