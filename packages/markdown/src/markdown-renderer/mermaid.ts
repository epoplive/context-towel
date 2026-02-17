import { useEffect } from 'react'
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

function defaultMermaidOptions(theme: ThemeTokens, isDark: boolean): MermaidInitializeOptions {
  return {
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    themeVariables: {
      primaryColor: theme.accent,
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
    },
    securityLevel: 'loose',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
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

export function useMermaidThemeTokens(
  theme: ThemeTokens,
  isDark: boolean,
  config: MarkdownRendererProps['mermaidConfig'],
) {
  useEffect(() => {
    if (config === false) return
    ensureMermaidInitialized(theme, isDark, config as MermaidInitializeOptions | MermaidConfigProvider | undefined)
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
}

