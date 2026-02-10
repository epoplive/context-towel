import type { ComponentType, CSSProperties } from 'react'
import type { BlockEditEvent, CardHost, ThemeTokens } from '@context-towel/card-library'

export type CodeViewerProps = {
  value: string
  language?: string
  readOnly?: boolean
  lineNumbers?: boolean
  wordWrap?: boolean
  minimap?: boolean
  height?: string
  style?: CSSProperties
}

export type CodeViewerComponent = ComponentType<CodeViewerProps>

export type MermaidInitializeOptions = Parameters<typeof import('mermaid').default.initialize>[0]
export type MermaidConfigProvider = (args: { theme: ThemeTokens; isDark: boolean }) => MermaidInitializeOptions

export type MarkdownUiColors = {
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  bgOverlay: string
  borderPrimary: string
  borderSecondary: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  textInverse: string
  accent: string
  success: string
  warning: string
  error: string
  info: string
  buttonBg: string
}

export interface FullscreenModalState {
  open: boolean
  type: 'mermaid' | 'code' | null
  content: string
  lang?: string
  svg?: string
}

export interface MarkdownRendererProps {
  content: string
  /** Optional host capabilities (API execution, etc.) passed to embedded cards. */
  host?: CardHost
  /**
   * ThemeTokens used for:
   * - CardThemeProvider when rendering typed blocks (```task, ```checklist, etc.)
   * - Markdown CSS variables (scoped to this renderer instance)
   */
  theme?: ThemeTokens
  /** Provide if you want deterministic mermaid theming. */
  isDark?: boolean
  /**
   * Override mermaid initialization.
   * - `false`: do not initialize mermaid (host handles it)
   * - object: merged into the default options
   * - function: called with theme/isDark, merged into the default options
   */
  mermaidConfig?: MermaidInitializeOptions | MermaidConfigProvider | false
  /** Optional host code viewer (Monaco, etc.) for fullscreen code blocks. */
  CodeViewer?: CodeViewerComponent
  /**
   * How to render fenced code blocks inline in the markdown flow.
   * - `highlight` (default): lightweight <pre> with highlight.js
   * - `viewer`: host CodeViewer component inline (Monaco, etc.)
   */
  codeBlockMode?: 'highlight' | 'viewer'
  /** Max height (px) for inline code blocks when `codeBlockMode="viewer"`. */
  codeBlockMaxHeight?: number
  /**
   * Optional UI token overrides for fullscreen modal chrome.
   * Use this to preserve exact host theming (buttonBg, bgOverlay, etc.).
   */
  uiColors?: Partial<MarkdownUiColors>
  onCheckboxChange?: (lineIndex: number, checked: boolean) => void
  onFullscreen?: (state: FullscreenModalState) => void
  /** Called when an embedded card emits an edit event (forms, etc.). */
  onEditBlock?: (event: BlockEditEvent) => void
}
