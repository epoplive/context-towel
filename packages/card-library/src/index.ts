// Card Library - Shared markdown card rendering
// AST pipeline + block plugins + component registry

// --- Types ---

/** Detail level controls how much content a card shows */
export type DetailLevel = 'mini' | 'summary' | 'full'

/** Block plugin interface - parse + render + metadata */
export interface BlockPlugin<TData = unknown> {
  /** Unique block type identifier (e.g. 'task', 'checklist', 'diagram') */
  type: string

  /** Parse raw content into structured data */
  parse(raw: string): TData | null

  /** React component for rendering this block */
  component: React.ComponentType<BlockRenderProps<TData>>
}

/** Props passed to every block component */
export interface BlockRenderProps<TData = unknown> {
  data: TData
  detail: DetailLevel
  theme: ThemeTokens
  onEdit?: (event: BlockEditEvent) => void
}

/** Edit event emitted when a card's content changes (checkbox toggle, status drag, etc.) */
export interface BlockEditEvent {
  blockType: string
  field: string
  value: unknown
  /** Source file path if available */
  sourcePath?: string
  /** Source line if available */
  sourceLine?: number
}

/** Theme tokens - CSS custom properties that the host provides */
export interface ThemeTokens {
  bgPrimary: string
  bgSecondary: string
  borderPrimary: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  textInverse: string
  accent: string
  success: string
  warning: string
  error: string
  info: string
}

/** Default dark theme tokens */
export const defaultTheme: ThemeTokens = {
  bgPrimary: '#1a1a2e',
  bgSecondary: '#16213e',
  borderPrimary: '#2a2a4a',
  textPrimary: '#e0e0e0',
  textSecondary: '#a0a0b0',
  textMuted: '#606070',
  textInverse: '#ffffff',
  accent: '#4a9eff',
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#60a5fa',
}

// --- Component Registry ---

const pluginRegistry = new Map<string, BlockPlugin>()

/** Register a block plugin */
export function registerBlockPlugin(plugin: BlockPlugin): void {
  pluginRegistry.set(plugin.type, plugin)
}

/** Get a registered block plugin by type */
export function getBlockPlugin(type: string): BlockPlugin | undefined {
  return pluginRegistry.get(type)
}

/** Get all registered block plugins */
export function getAllBlockPlugins(): BlockPlugin[] {
  return Array.from(pluginRegistry.values())
}

// --- Re-exports (will grow as plugins are added) ---

// Block system (from LG's @looking-glass/blocks)
export * from './blocks/index'
