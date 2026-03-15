import type { ComponentType, ReactNode } from 'react'

export type BlockTypeId = string

/** Detail level controls how much content a card shows */
export type DetailLevel = 'mini' | 'summary' | 'full'

export type BlockSourceRange = {
  startOffset: number | null
  endOffset: number | null
  startLine: number | null
  endLine: number | null
}

export type BlockSource = {
  filePath: string
  range: BlockSourceRange
  raw: string
}

export type BlockParseError = {
  message: string
  line?: number
  column?: number
}

export type BlockInstance<T = unknown> = {
  type: BlockTypeId
  data: T | null
  source: BlockSource
  errors?: BlockParseError[]
}

/** Theme tokens — CSS custom properties that the host provides */
export interface ThemeTokens {
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
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
  fontMono: string
  fontSans: string
  radius: string
}

export type HostApiAllowlistEntry = {
  type: string
  value: string
}

export type HostApiExecuteArgs = {
  /**
   * Raw request object from a block (may contain ${responses.*}, ${params.*},
   * ${secrets.*} templates). The host decides how to resolve templates.
   */
  request: Record<string, unknown>
  /** Form/question responses collected by the card. */
  responses?: Record<string, unknown>
  /** Host-provided parameters (workspace ids, etc.). */
  params?: Record<string, unknown>
  /** Optional allowlist for host-side enforcement. */
  allowlist?: HostApiAllowlistEntry[]
}

export type HostApiExecuteResult = {
  status: number
  data: unknown
  error?: string
  timestamp?: string
}

export interface CardHost {
  api?: {
    execute?: (args: HostApiExecuteArgs) => Promise<HostApiExecuteResult>
  }
}

/** Props passed to every block render component */
export interface BlockRenderProps<T = unknown> {
  data: T
  detail: DetailLevel
  theme: ThemeTokens
  source?: BlockSource
  onEdit?: (event: BlockEditEvent) => void
  host?: CardHost
  /** Host-provided syntax highlighter for code content */
  highlighter?: (code: string, lang: string) => ReactNode
}

/** A single field update to apply to a block */
export type BlockUpdate = {
  path: Array<string | number>
  value: unknown
}

/** Edit event emitted when a card's content changes */
export interface BlockEditEvent {
  blockType: string
  field: string
  value: unknown
  sourcePath?: string
  sourceLine?: number
}

/**
 * Block definition — the unified plugin interface.
 * Handles parse, validate, render, and serialize for a block type.
 */
export type BlockDefinition<T = unknown> = {
  type: BlockTypeId
  name: string
  schemaVersion?: number

  // --- Render ---
  /** Components for different render contexts */
  components?: {
    /** Inline in markdown flow */
    inline?: ComponentType<BlockRenderProps<T>>
    /** Card view (default for panels and graph nodes) */
    card?: ComponentType<BlockRenderProps<T>>
    /** ReactFlow standalone node */
    node?: ComponentType<BlockRenderProps<T>>
  }

  // --- Validate & Transform ---
  validate?: (data: T) => BlockParseError[]
  toRuntime?: (data: T) => T

  // --- Serialize ---
  toContextMarkdown?: (blocks: BlockInstance<T>[]) => string
  serialize?: (data: T) => string

  // --- Update ---
  /** Apply field updates to parsed data and return serialized block content.
   *  If not defined, updateBlockInMarkdown falls back to generic YAML manipulation.
   *  Block types with non-standard syntax (e.g. markdown checklists) MUST implement this. */
  applyUpdate?: (data: T, updates: BlockUpdate[]) => { content: string; errors: BlockParseError[] }
}

export type BlockRuntime<T = unknown> = {
  type: BlockTypeId
  schemaVersion: number
  data: T
}

/** Default dark theme tokens */
export const defaultTheme: ThemeTokens = {
  bgPrimary: '#1a1a2e',
  bgSecondary: '#16213e',
  bgTertiary: '#0d0d1a',
  borderPrimary: '#2a2a4a',
  borderSecondary: '#3a3a6a',
  textPrimary: '#e0e0e0',
  textSecondary: '#a0a0b0',
  textMuted: '#606070',
  textInverse: '#ffffff',
  accent: '#4a9eff',
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#60a5fa',
  fontMono: "'SF Mono', 'Fira Code', monospace",
  fontSans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  radius: '6px',
}
