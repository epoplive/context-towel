import type { ThemeTokens } from '@context-towel/card-library'

import type { MarkdownUiColors } from './types'

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim()
  if (!raw.startsWith('#')) return null
  const value = raw.slice(1)
  if (value.length === 3) {
    const r = parseInt(value[0] + value[0], 16)
    const g = parseInt(value[1] + value[1], 16)
    const b = parseInt(value[2] + value[2], 16)
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
    return { r, g, b }
  }
  if (value.length === 6) {
    const r = parseInt(value.slice(0, 2), 16)
    const g = parseInt(value.slice(2, 4), 16)
    const b = parseInt(value.slice(4, 6), 16)
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
    return { r, g, b }
  }
  return null
}

function guessIsDarkFromBg(bgPrimary: string): boolean | null {
  const rgb = parseHexColor(bgPrimary)
  if (!rgb) return null
  // Relative luminance approximation (sRGB) to decide if background is dark.
  const lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
  return lum < 0.5
}

export function resolveIsDark(explicit: boolean | undefined, theme: ThemeTokens): boolean {
  if (typeof explicit === 'boolean') return explicit
  return guessIsDarkFromBg(theme.bgPrimary) ?? true
}

export function deriveUiColors(
  theme: ThemeTokens,
  isDark: boolean,
  override?: Partial<MarkdownUiColors>,
): MarkdownUiColors {
  const base: MarkdownUiColors = {
    bgPrimary: theme.bgPrimary,
    bgSecondary: theme.bgSecondary,
    bgTertiary: theme.bgTertiary,
    bgOverlay: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.35)',
    borderPrimary: theme.borderPrimary,
    borderSecondary: theme.borderSecondary,
    textPrimary: theme.textPrimary,
    textSecondary: theme.textSecondary,
    textMuted: theme.textMuted,
    textInverse: theme.textInverse,
    accent: theme.accent,
    success: theme.success,
    warning: theme.warning,
    error: theme.error,
    info: theme.info,
    buttonBg: theme.bgSecondary,
  }
  return override ? { ...base, ...override } : base
}

export function buildMarkdownCssVars(theme: ThemeTokens, colors: MarkdownUiColors): Record<string, string> {
  // Keep CSS variable names compatible with LG's existing markdown.css.
  const accentMuted = `color-mix(in srgb, ${theme.accent} 15%, transparent)`
  const successMuted = `color-mix(in srgb, ${theme.success} 15%, transparent)`
  const infoMuted = `color-mix(in srgb, ${theme.info} 15%, transparent)`

  return {
    '--color-font-sans': theme.fontSans,
    '--color-font-mono': theme.fontMono,
    // LG-style token variables used by markdown.css
    '--color-bg-primary': theme.bgPrimary,
    '--color-bg-secondary': theme.bgSecondary,
    '--color-bg-tertiary': theme.bgTertiary,
    '--color-bg-overlay': colors.bgOverlay,
    '--color-border-primary': theme.borderPrimary,
    '--color-border-secondary': theme.borderSecondary,
    '--color-text-primary': theme.textPrimary,
    '--color-text-secondary': theme.textSecondary,
    '--color-text-muted': theme.textMuted,
    '--color-text-inverse': theme.textInverse,
    '--color-accent': theme.accent,
    '--color-accent-muted': accentMuted,
    '--color-success': theme.success,
    '--color-success-muted': successMuted,
    '--color-warning': theme.warning,
    '--color-error': theme.error,
    '--color-info': theme.info,
    '--color-info-muted': infoMuted,

    // Legacy renderer inline styles still reference these variables in a few places.
    '--md-bg-secondary': theme.bgSecondary,
    '--md-text-primary': theme.textPrimary,
    '--md-text-secondary': theme.textSecondary,
    '--md-text-muted': theme.textMuted,
    '--md-border-primary': theme.borderPrimary,
    '--md-accent': theme.accent,
    '--md-error': theme.error,
    '--md-success': theme.success,
    '--md-warning': theme.warning,
  }
}
