// ============================================================================
// Context Graph Feature - Core Types
// ============================================================================

/**
 * Tree item from file system (from Rust backend)
 */
export interface TreeItem {
  id: string        // Relative path from configured workspace roots
  name: string      // File/folder name
  path: string      // Absolute path
  is_dir: boolean
}

/**
 * Base interface for all extracted items from markdown.
 * Every plugin produces items extending this.
 */
export interface ExtractedItem {
  id: string
  sourceFile: string
  sourceLine?: number
  sourceEndLine?: number
}

/**
 * Parsed document with all extracted data
 */
export interface ParsedDocument {
  id: string                    // File ID (relative path)
  path: string                  // Absolute path
  content: string               // Raw markdown
  extractions: Map<string, ParseResult<ExtractedItem>>  // Plugin ID -> results
}

/**
 * Result from a single plugin's parse operation
 */
export interface ParseResult<T extends ExtractedItem> {
  pluginId: string
  items: T[]
  rawMatches: SourceMatch[]
}

/**
 * Location of a match in source content
 */
export interface SourceMatch {
  start: number       // Character offset
  end: number
  startLine: number
  endLine: number
  content: string     // The matched content
}

// ============================================================================
// Workspace State Types
// ============================================================================

/**
 * Which section of accordion is visible
 */
export interface AccordionSection {
  fileId: string
  sectionId: string         // Heading ID or 'full'
  sectionTitle: string
  startLine: number
  endLine: number
}

/**
 * Graph focus state
 */
export interface FocusState {
  mode: 'full' | 'single' | 'custom'
  focusedNodeId: string | null
  customNodeIds: string[]       // For multi-select focus
}

/**
 * Complete workspace state - single source of truth
 */
export interface WorkspaceState {
  // Project
  projectPath: string | null

  // File tree
  treeItems: TreeItem[]

  // Parsed documents (content + extractions)
  documents: Map<string, ParsedDocument>

  // Graph view state
  focus: FocusState
  collapsedFolders: Set<string>
  treeWidgetFolders: Set<string>    // Folders shown as tree widget

  // Accordion state
  openPanels: string[]              // File IDs open in accordion
  expandedPanel: string | null      // Which one is expanded
  visibleSection: AccordionSection | null  // Currently visible section

  // UI state
  quickPreviewNode: string | null
  cardScale: number
}

// ============================================================================
// Graph Node Types
// ============================================================================

/**
 * Render context for widgets
 */
export type RenderContext = 'graph-node' | 'panel' | 'popover' | 'inline' | 'card'

/**
 * Base data for all graph nodes
 */
export interface BaseNodeData {
  label: string
  cardScale: number
}

/**
 * Document node data
 */
export interface DocumentNodeData extends BaseNodeData {
  filePath: string
  preview?: string
}

/**
 * Folder node data
 */
export interface FolderNodeData extends BaseNodeData {
  isCollapsed: boolean
  childCount: number
}

/**
 * Widget node data (for plugin-rendered nodes)
 */
export interface WidgetNodeData extends BaseNodeData {
  pluginId: string
  parentDocId: string
  items: ExtractedItem[]
}

// ============================================================================
// Context Generation Types
// ============================================================================

/**
 * Options for generating context markdown
 */
export interface ContextGenerationOptions {
  includeSource: boolean        // Include file/line references
  maxItems: number              // Limit items per section
  format: 'full' | 'summary'    // Detail level
  includeFramework: boolean     // Include framework rules
}

/**
 * Generated context for CLAUDE.md or agents.md
 */
export interface GeneratedContext {
  framework: string             // Framework rules section
  currentFocus: string          // Current focus section
  fullContent: string           // Complete file content
}
