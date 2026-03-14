// Design system compat — barrel export

export type { ColorTokens, SpacingTokens, TypographyTokens, ShadowTokens, RadiusTokens, Theme, ThemeContextValue } from './types'
export { darkColors, lightColors, defaultSpacing, defaultTypography, defaultShadows, defaultRadius, darkTheme, lightTheme } from './tokens'
export { ThemeProvider, useTheme, useColors, useIsDark } from './ThemeProvider'
export { useMermaidTheme } from './useMermaidTheme'
export { ButtonGroup, ButtonGroupItem, Select, Icon, Editor } from './components'

// Icon aliases — LG uses lowercase names, lucide-react uses PascalCase
import { X, ChevronDown, ChevronRight } from 'lucide-react'
export const icons = {
  close: X,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
} as const
