// Mermaid theme hook — initializes mermaid with current theme and returns a
// key that changes on theme switch so consumers can re-render diagrams.

import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import type { MermaidConfig } from 'mermaid'
import { useTheme } from './ThemeProvider'

function buildConfig(colors: ReturnType<typeof useTheme>['colors'], _isDark: boolean): MermaidConfig {
  return {
    startOnLoad: false,
    // 'base' theme respects themeVariables fully — 'dark'/'default' override them
    theme: 'base',
    securityLevel: 'loose',
    flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
    sequence: { useMaxWidth: true, wrap: true },
    themeVariables: {
      primaryColor: colors.bgTertiary,
      primaryTextColor: colors.textPrimary,
      primaryBorderColor: colors.borderPrimary,
      lineColor: colors.graphEdge,
      secondaryColor: colors.bgSecondary,
      tertiaryColor: colors.bgElevated,
      background: colors.bgPrimary,
      mainBkg: colors.bgSecondary,
      nodeBorder: colors.borderPrimary,
      clusterBkg: colors.bgTertiary,
      titleColor: colors.textPrimary,
      edgeLabelBackground: colors.bgSecondary,
      nodeTextColor: colors.textPrimary,
      actorTextColor: colors.textPrimary,
      signalTextColor: colors.textPrimary,
      labelTextColor: colors.textPrimary,
      // Additional text color vars for edge labels / flowchart text
      secondaryTextColor: colors.textSecondary,
      tertiaryTextColor: colors.textSecondary,
      noteBkgColor: colors.bgTertiary,
      noteTextColor: colors.textPrimary,
      noteBorderColor: colors.borderPrimary,
    },
  }
}

export function useMermaidTheme(): string {
  const { colors, isDark } = useTheme()
  const [initKey, setInitKey] = useState('')
  const prevKeyRef = useRef('')

  useEffect(() => {
    const config = buildConfig(colors, isDark)
    const key = JSON.stringify({ theme: config.theme, themeVariables: config.themeVariables })
    if (key === prevKeyRef.current) return
    prevKeyRef.current = key
    mermaid.initialize(config)
    setInitKey(key)
  }, [colors, isDark])

  return initKey
}
