// Design system token types — same shape as LG's design system

export interface ColorTokens {
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  bgElevated: string
  bgOverlay: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  textInverse: string
  borderPrimary: string
  borderSecondary: string
  borderFocus: string
  accent: string
  accentHover: string
  accentMuted: string
  success: string
  successMuted: string
  warning: string
  warningMuted: string
  error: string
  errorMuted: string
  info: string
  infoMuted: string
  buttonBg: string
  buttonBgHover: string
  buttonBgActive: string
  inputBg: string
  inputBorder: string
  inputBorderFocus: string
  graphFolder: string
  graphCore: string
  graphResearch: string
  graphSkill: string
  graphSpike: string
  graphEdge: string
  graphEdgeHighlight: string
}

export interface SpacingTokens {
  xs: number; sm: number; md: number; lg: number; xl: number; xxl: number; xxxl: number
}

export interface TypographyTokens {
  fontFamily: { sans: string; mono: string }
  fontSize: { xs: string; sm: string; base: string; md: string; lg: string; xl: string; xxl: string; xxxl: string }
  fontWeight: { normal: number; medium: number; semibold: number; bold: number }
  lineHeight: { tight: number; normal: number; relaxed: number }
}

export interface ShadowTokens {
  sm: string; md: string; lg: string; xl: string; overlay: string; modal: string
}

export interface RadiusTokens {
  sm: string; md: string; lg: string; xl: string; full: string
}

export interface Theme {
  id: string
  name: string
  isDark: boolean
  colors: ColorTokens
  spacing: SpacingTokens
  typography: TypographyTokens
  shadows: ShadowTokens
  radius: RadiusTokens
}

export interface ThemeContextValue {
  theme: Theme
  colors: ColorTokens
  spacing: SpacingTokens
  typography: TypographyTokens
  shadows: ShadowTokens
  radius: RadiusTokens
  isDark: boolean
  setTheme: (themeId: string) => void
  setPreference: (pref: string) => void
  preference: string
}
