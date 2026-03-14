import { useMemo } from 'react'

import { useTheme } from '../../compat/design-system'

// Hook to get colors palette from theme
export function useFlowColors() {
  const { colors } = useTheme()
  return useMemo(() => ({
    folder: colors.graphFolder,
    core: colors.graphCore,
    research: colors.graphResearch,
    skill: colors.graphSkill,
    spike: colors.graphSpike,
    other: colors.textSecondary,
    bg: colors.bgSecondary,
    bgDark: colors.bgPrimary,
    border: colors.borderPrimary,
    text: colors.textPrimary,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    accent: colors.accent,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
  }), [colors])
}

// Helper to get cardScale from node data with default.
// Snaps to quarter-pixel increments (0.25) to avoid subpixel blurriness.
export const getCardScale = (data: any): number => {
  const raw = typeof data?.cardScale === 'number' ? data.cardScale : 1.0
  const snapped = Math.round(raw * 4) / 4
  return Math.abs(snapped - 1) < 0.01 ? 1 : snapped
}

