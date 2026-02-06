// Default token values — matches LG's dark theme

import type { ColorTokens, SpacingTokens, TypographyTokens, ShadowTokens, RadiusTokens, Theme } from './types'

export const darkColors: ColorTokens = {
  bgPrimary: '#1e1e1e',
  bgSecondary: '#252526',
  bgTertiary: '#2d2d2d',
  bgElevated: '#333333',
  bgOverlay: 'rgba(0, 0, 0, 0.6)',
  textPrimary: '#d4d4d4',
  textSecondary: '#a0a0a0',
  textMuted: '#666666',
  textInverse: '#1e1e1e',
  borderPrimary: '#3c3c3c',
  borderSecondary: '#4a4a4a',
  borderFocus: '#4fc3f7',
  accent: '#4fc3f7',
  accentHover: '#29b6f6',
  accentMuted: 'rgba(79, 195, 247, 0.2)',
  success: '#4caf50',
  successMuted: 'rgba(76, 175, 80, 0.2)',
  warning: '#ff9800',
  warningMuted: 'rgba(255, 152, 0, 0.2)',
  error: '#f44336',
  errorMuted: 'rgba(244, 67, 54, 0.2)',
  info: '#2196f3',
  infoMuted: 'rgba(33, 150, 243, 0.2)',
  buttonBg: '#3c3c3c',
  buttonBgHover: '#4a4a4a',
  buttonBgActive: '#555555',
  inputBg: '#1e1e1e',
  inputBorder: '#3c3c3c',
  inputBorderFocus: '#4fc3f7',
  graphFolder: '#ffa726',
  graphCore: '#ff9100',
  graphResearch: '#ce93d8',
  graphSkill: '#4dd0e1',
  graphSpike: '#e57373',
  graphEdge: '#666666',
  graphEdgeHighlight: '#4fc3f7',
}

export const defaultSpacing: SpacingTokens = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
}

export const defaultTypography: TypographyTokens = {
  fontFamily: {
    sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
  },
  fontSize: { xs: '10px', sm: '11px', base: '12px', md: '13px', lg: '14px', xl: '16px', xxl: '18px', xxxl: '24px' },
  fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.7 },
}

export const defaultShadows: ShadowTokens = {
  sm: '0 1px 2px rgba(0,0,0,0.3)',
  md: '0 2px 4px rgba(0,0,0,0.3)',
  lg: '0 4px 8px rgba(0,0,0,0.3)',
  xl: '0 8px 16px rgba(0,0,0,0.3)',
  overlay: '0 4px 12px rgba(0,0,0,0.5)',
  modal: '0 8px 24px rgba(0,0,0,0.5)',
}

export const defaultRadius: RadiusTokens = {
  sm: '4px', md: '6px', lg: '8px', xl: '12px', full: '9999px',
}

export const darkTheme: Theme = {
  id: 'dark',
  name: 'Dark',
  isDark: true,
  colors: darkColors,
  spacing: defaultSpacing,
  typography: defaultTypography,
  shadows: defaultShadows,
  radius: defaultRadius,
}
