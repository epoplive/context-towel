import { useEffect, useRef, useState } from 'react'
import type { ThemeTokens } from '@context-towel/card-library'

import type { MarkdownRendererProps, MermaidConfigProvider, MermaidInitializeOptions } from './types'

let _mermaidInitKey = ''

function mergeMermaidOptions(base: MermaidInitializeOptions, override?: MermaidInitializeOptions): MermaidInitializeOptions {
  if (!override) return base
  return {
    ...base,
    ...override,
    flowchart: { ...(base as any).flowchart, ...(override as any).flowchart },
    sequence: { ...(base as any).sequence, ...(override as any).sequence },
    themeVariables: { ...(base as any).themeVariables, ...(override as any).themeVariables },
  }
}

function defaultMermaidOptions(theme: ThemeTokens, _isDark: boolean): MermaidInitializeOptions {
  return {
    startOnLoad: false,
    // 'base' theme respects themeVariables fully — 'dark'/'default' override them
    theme: 'base',
    themeVariables: {
      primaryColor: theme.bgTertiary,
      primaryTextColor: theme.textPrimary,
      primaryBorderColor: theme.borderPrimary,
      lineColor: theme.borderSecondary,
      secondaryColor: theme.bgSecondary,
      tertiaryColor: theme.bgTertiary,
      background: theme.bgPrimary,
      mainBkg: theme.bgSecondary,
      nodeBorder: theme.borderPrimary,
      clusterBkg: theme.bgTertiary,
      titleColor: theme.textPrimary,
      edgeLabelBackground: theme.bgSecondary,
      fontFamily: theme.fontSans,
      nodeTextColor: theme.textPrimary,
      actorTextColor: theme.textPrimary,
      signalTextColor: theme.textPrimary,
      labelTextColor: theme.textPrimary,
      secondaryTextColor: theme.textSecondary,
      tertiaryTextColor: theme.textSecondary,
      noteBkgColor: theme.bgTertiary,
      noteTextColor: theme.textPrimary,
      noteBorderColor: theme.borderPrimary,
    },
    securityLevel: 'loose',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: false,
      curve: 'basis',
    },
    sequence: {
      useMaxWidth: true,
      wrap: true,
    },
  }
}

function mermaidKey(options: MermaidInitializeOptions): string {
  const theme = (options as any)?.theme ?? null
  const themeVariables = (options as any)?.themeVariables ?? null
  return JSON.stringify({ theme, themeVariables })
}

async function ensureMermaidInitialized(
  theme: ThemeTokens,
  isDark: boolean,
  config?: MermaidInitializeOptions | MermaidConfigProvider,
) {
  const base = defaultMermaidOptions(theme, isDark)
  const override = typeof config === 'function' ? config({ theme, isDark }) : config
  const options = mergeMermaidOptions(base, override)
  const nextKey = mermaidKey(options)
  if (_mermaidInitKey === nextKey) return
  _mermaidInitKey = nextKey

  const { getMermaid: getMermaidLazy } = await import('../lazy-deps')
  const mermaidModule = await getMermaidLazy()
  mermaidModule.initialize(options)
}

/**
 * Initializes mermaid with the current theme tokens and returns a stable key
 * that changes whenever the effective theme configuration changes. Pass this
 * key to any mermaid render component so it re-renders SVGs after a theme
 * switch.
 */
export function useMermaidThemeTokens(
  theme: ThemeTokens,
  isDark: boolean,
  config: MarkdownRendererProps['mermaidConfig'],
): string {
  const [themeKey, setThemeKey] = useState(_mermaidInitKey)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (config === false) return
    ensureMermaidInitialized(theme, isDark, config as MermaidInitializeOptions | MermaidConfigProvider | undefined)
      .then(() => {
        if (mountedRef.current) setThemeKey(_mermaidInitKey)
      })
      .catch(() => { /* ensureMermaidInitialized already guards errors */ })
  }, [
    config,
    isDark,
    theme.accent,
    theme.textPrimary,
    theme.borderPrimary,
    theme.borderSecondary,
    theme.bgPrimary,
    theme.bgSecondary,
    theme.bgTertiary,
    theme.fontSans,
  ])

  return themeKey
}

