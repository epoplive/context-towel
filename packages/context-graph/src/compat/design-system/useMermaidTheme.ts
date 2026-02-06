// Mermaid theme hook — generates mermaid config from current theme tokens

import { useMemo } from 'react'
import { useTheme } from './ThemeProvider'

export function useMermaidTheme() {
  const { colors, isDark } = useTheme()
  return useMemo(() => ({
    theme: isDark ? 'dark' : 'default',
    themeVariables: {
      primaryColor: colors.accent,
      primaryTextColor: colors.textPrimary,
      primaryBorderColor: colors.borderPrimary,
      lineColor: colors.graphEdge,
      secondaryColor: colors.bgTertiary,
      tertiaryColor: colors.bgElevated,
      background: colors.bgPrimary,
      mainBkg: colors.bgSecondary,
      nodeBorder: colors.borderPrimary,
      clusterBkg: colors.bgTertiary,
      titleColor: colors.textPrimary,
      edgeLabelBackground: colors.bgSecondary,
    },
  }), [colors, isDark])
}
