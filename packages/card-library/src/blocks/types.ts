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

/** Parsing quality level — how much structure was extracted */
export type ParsingLevel = 'semantic' | 'structural' | 'basic'

/** Capability flags describing what a parsed block offers downstream */
export interface BlockCapabilities {
  /** How deeply the block was parsed */
  parsingLevel: ParsingLevel
  /** Block has @CODE@/@MARKDOWN@ expandable markers */
  expandable: boolean
  /** Block contains entity IDs (F1, S1, etc.) for cross-referencing */
  crossReferenced: boolean
  /** Block has layer metadata for progressive disclosure */
  layered: boolean
  /** Block has full type information (typed data, not just text) */
  typed: boolean
  /** Block supports user actions (checklist toggles, form inputs) */
  interactive: boolean
  /** Block can be compiled to AICCL notation */
  compilable: boolean
  /** Parsing confidence 0.0–1.0 */
  confidence: number
}

/** Default capabilities for blocks that don't declare their own */
export const BASIC_CAPABILITIES: BlockCapabilities = {
  parsingLevel: 'basic',
  expandable: false,
  crossReferenced: false,
  layered: false,
  typed: false,
  interactive: false,
  compilable: false,
  confidence: 1.0,
}

/**
 * Resolve block capabilities by merging definition defaults with instance-specific overrides.
 * Falls back to BASIC_CAPABILITIES for any missing fields.
 */
export function resolveCapabilities(
  definitionCaps?: Partial<BlockCapabilities>,
  instanceCaps?: Partial<BlockCapabilities>,
): BlockCapabilities {
  return {
    ...BASIC_CAPABILITIES,
    ...definitionCaps,
    ...instanceCaps,
  }
}

/**
 * Check if a block has a specific capability.
 * Returns false if capabilities are not set (treats as basic).
 */
export function hasCapability(
  block: BlockInstance,
  key: keyof Omit<BlockCapabilities, 'parsingLevel' | 'confidence'>,
): boolean {
  return block.capabilities?.[key] ?? false
}

export type BlockInstance<T = unknown> = {
  type: BlockTypeId
  data: T | null
  source: BlockSource
  errors?: BlockParseError[]
  /** Self-describing capabilities — what this block offers downstream */
  capabilities?: BlockCapabilities
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
  /** Unique block ID from data (e.g. task id) */
  blockId?: string
  /** Positional index: Nth block of this type in the document (0-based) */
  blockIndex?: number
}

/**
 * Block definition — the unified plugin interface.
 * Handles parse, validate, render, and serialize for a block type.
 */
export type BlockDefinition<T = unknown> = {
  type: BlockTypeId
  name: string
  schemaVersion?: number

  /** Base capabilities for all blocks of this type. Parsing may upgrade these. */
  capabilities?: Partial<BlockCapabilities>

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

  // --- Insert ---
  /** Returns a skeleton YAML body for inserting a new block of this type via slash commands.
   *  If not defined, a minimal `title: New {name}` skeleton is used. */
  skeleton?: () => string
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
