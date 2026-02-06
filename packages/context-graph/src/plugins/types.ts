// ============================================================================
// Plugin System Types
// ============================================================================

import { ComponentType } from 'react'
import { ExtractedItem, ParseResult, RenderContext } from '../types'

// Re-export for convenience
export type { RenderContext } from '../types'

/**
 * Options for context markdown generation
 */
export interface ContextOptions {
  includeSource?: boolean       // Include file/line references
  maxItems?: number             // Limit items shown
  format?: 'full' | 'summary'   // Detail level
}

/**
 * Props passed to all widget components
 */
export interface WidgetProps<T extends ExtractedItem = ExtractedItem> {
  items: T[]
  sourceFile: string
  context: RenderContext
  cardScale?: number
  onItemClick?: (item: T) => void
  onItemChange?: (item: T, changes: Partial<T>) => void
}

/**
 * Core plugin interface - every parser plugin implements this
 */
export interface ParserPlugin<T extends ExtractedItem = ExtractedItem> {
  // Identity
  id: string                    // 'task', 'checklist', 'mermaid', etc.
  name: string                  // 'Task List', 'Checklist', etc.
  version: string               // Semver for compatibility

  // Detection - does this content have stuff for this plugin?
  detect: (content: string) => boolean

  // Extraction - parse content into structured data
  parse: (content: string, sourceFile: string) => ParseResult<T>

  // Supported render contexts
  supportedContexts: RenderContext[]

  // Graph node type identifier
  nodeType: string              // Used in ReactFlow nodeTypes registry

  // Component for each context (lazy loaded)
  getComponent: (context: RenderContext) => ComponentType<WidgetProps<T>> | null

  // Serialization for context injection (CLAUDE.md)
  toContextMarkdown: (items: T[], options?: ContextOptions) => string

  // Optional: priority for parsing order (higher = earlier)
  priority?: number

  // Optional: dependencies on other plugins
  dependencies?: string[]
}

/**
 * Plugin metadata (without implementation details)
 */
export interface PluginInfo {
  id: string
  name: string
  version: string
  supportedContexts: RenderContext[]
  nodeType: string
}
