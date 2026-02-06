import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { defaultTheme, type ThemeTokens } from './blocks/types'

const ThemeContext = createContext<ThemeTokens>(defaultTheme)

/** Access current theme tokens */
export function useCardTheme(): ThemeTokens {
  return useContext(ThemeContext)
}

/** CSS custom property mapping from theme tokens */
function themeToCssVars(theme: ThemeTokens): Record<string, string> {
  return {
    '--card-bg-primary': theme.bgPrimary,
    '--card-bg-secondary': theme.bgSecondary,
    '--card-bg-tertiary': theme.bgTertiary,
    '--card-border-primary': theme.borderPrimary,
    '--card-border-secondary': theme.borderSecondary,
    '--card-text-primary': theme.textPrimary,
    '--card-text-secondary': theme.textSecondary,
    '--card-text-muted': theme.textMuted,
    '--card-text-inverse': theme.textInverse,
    '--card-accent': theme.accent,
    '--card-success': theme.success,
    '--card-warning': theme.warning,
    '--card-error': theme.error,
    '--card-info': theme.info,
    '--card-font-mono': theme.fontMono,
    '--card-font-sans': theme.fontSans,
    '--card-radius': theme.radius,
  }
}

export interface CardThemeProviderProps {
  theme?: Partial<ThemeTokens>
  children: ReactNode
}

/**
 * Provides theme tokens to all card components.
 * Injects CSS custom properties on a wrapper div.
 * Host can override any token.
 */
export function CardThemeProvider({ theme, children }: CardThemeProviderProps) {
  const merged = useMemo<ThemeTokens>(() => {
    if (!theme) return defaultTheme
    return { ...defaultTheme, ...theme }
  }, [theme])

  const cssVars = useMemo(() => themeToCssVars(merged), [merged])

  return (
    <ThemeContext.Provider value={merged}>
      <div style={cssVars as React.CSSProperties}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
