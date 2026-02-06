// Theme context provider — standalone replacement for LG's ThemeProvider

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Theme, ThemeContextValue } from './types'
import { darkTheme, darkColors, defaultSpacing, defaultTypography, defaultShadows, defaultRadius } from './tokens'

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ theme, children }: { theme?: Theme; children: ReactNode }) {
  const activeTheme = theme ?? darkTheme
  const value = useMemo<ThemeContextValue>(() => ({
    theme: activeTheme,
    colors: activeTheme.colors,
    spacing: activeTheme.spacing,
    typography: activeTheme.typography,
    shadows: activeTheme.shadows,
    radius: activeTheme.radius,
    isDark: activeTheme.isDark,
    setTheme: () => {},
    setPreference: () => {},
    preference: activeTheme.id,
  }), [activeTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/** Same API as LG's useTheme — falls back to dark theme if no provider */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    return {
      theme: darkTheme,
      colors: darkColors,
      spacing: defaultSpacing,
      typography: defaultTypography,
      shadows: defaultShadows,
      radius: defaultRadius,
      isDark: true,
      setTheme: () => {},
      setPreference: () => {},
      preference: 'dark',
    }
  }
  return ctx
}

export function useColors() {
  return useTheme().colors
}

export function useIsDark() {
  return useTheme().isDark
}
