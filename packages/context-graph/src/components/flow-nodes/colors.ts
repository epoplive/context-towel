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

// Helper to get cardScale from node data with default
export const getCardScale = (data: any): number => {
  const raw = typeof data?.cardScale === 'number' ? data.cardScale : 1.0
  const rounded = Math.round(raw * 100) / 100
  return Math.abs(rounded - 1) < 0.01 ? 1 : rounded
}

