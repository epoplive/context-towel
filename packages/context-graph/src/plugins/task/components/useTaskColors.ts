import { useMemo } from 'react'
import { useTheme } from '../../../compat/design-system'

/**
 * Centralized theme -> task palette mapping.
 * Keep this in one place so task UI stays consistent across nodes/cards/boards.
 */
export function useTaskColors() {
  const { colors } = useTheme()
  return useMemo(
    () => ({
      bg: colors.bgSecondary,
      bgDark: colors.bgPrimary,
      border: colors.borderPrimary,
      text: colors.textPrimary,
      textPrimary: colors.textPrimary,
      textSecondary: colors.textSecondary,
      textMuted: colors.textMuted,
      success: colors.success,
      error: colors.error,
      info: colors.info,
      accent: colors.accent,
      textInverse: colors.textInverse,
    }),
    [colors]
  )
}

