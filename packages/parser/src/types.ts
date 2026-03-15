// ============================================================================
// @context-towel/parser — Core Types
// ============================================================================
//
// These types define the pluggable file-parsing pipeline.
// They are extracted from context-graph's compat/services.ts and types.ts
// to provide a standalone, React-free type surface.

// ----------------------------------------------------------------------------
// Shared base
// ----------------------------------------------------------------------------

/**
 * Location of a match in source content (character offsets + line numbers).
 */
export interface SourceMatch {
  start: number
  end: number
  startLine: number
  endLine: number
  content: string
}

/**
 * Base interface for all items extracted from a file by a parser plugin.
 */
export interface ExtractedItem {
  id: string
  sourceFile: string
  sourceLine?: number
  sourceEndLine?: number
}

// ----------------------------------------------------------------------------
// Parser plugin
// ----------------------------------------------------------------------------

/**
 * Result produced by a single parser plugin for a file.
 */
export interface ParseResult<T = unknown> {
  pluginId: string
  items: T[]
  rawMatches?: SourceMatch[]
}

/**
 * A parser plugin registered with FileParserService.
 *
 * - `id`         — unique identifier (e.g. 'task', 'toc', 'diagram')
 * - `extensions` — optional file-extension filter (e.g. ['.md', '.markdown'])
 * - `detect`     — cheap pre-check: should this parser run on this content?
 * - `parse`      — full extraction; only called when detect() returns true
 */
export interface ParserPlugin<T = unknown> {
  id: string
  extensions?: string[]
  detect: (content: string) => boolean
  parse: (content: string, filePath: string) => ParseResult<T>
}

// ----------------------------------------------------------------------------
// Subscription callbacks
// ----------------------------------------------------------------------------

/**
 * Callback for subscribe() — receives items for a specific parser.
 * data:    items for the changed file
 * filePath: which file changed
 * allData:  all cached items for the parser across all matching files
 */
export type ParseSubscriber<T = unknown> = (data: T[], filePath: string, allData: Map<string, T[]>) => void

/**
 * Callback for subscribeAll() — receives full ParsedFileData for a file.
 */
export type ParseAllSubscriber = (filePath: string, data: ParsedFileData) => void

// ----------------------------------------------------------------------------
// Serialized form (for persistence)
// ----------------------------------------------------------------------------

export interface SerializedParsedFileData {
  path: string
  content: string
  lastModified: number
  results: Record<string, ParseResult>
}

// ----------------------------------------------------------------------------
// ParsedContent — aggregated view across all plugins
// ----------------------------------------------------------------------------

/**
 * Aggregated parsed content from all plugins for a single file.
 * Field names correspond to well-known parser IDs.
 */
export interface ParsedContent {
  tasks: unknown[]
  sections: unknown[]
  checklists: unknown[]
  diagrams: unknown[]
  links: unknown[]
  toc: unknown[]
  blocks: unknown[]
  [key: string]: unknown[]
}

// ----------------------------------------------------------------------------
// ParsedFileData — full cached record for a file
// ----------------------------------------------------------------------------

/**
 * Cached parse result for a single file.
 */
export interface ParsedFileData {
  path: string
  content: string
  lastModified: number
  /** Map from parser ID to parse result. */
  results: Map<string, ParseResult>
}

// ----------------------------------------------------------------------------
// Typed item shapes (re-exported for consumer convenience)
// ----------------------------------------------------------------------------

export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'blocked'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export interface ChecklistItem {
  text: string
  checked: boolean
}

export interface LogEntry {
  timestamp: string
  entry: string
}

export interface TaskItem extends ExtractedItem {
  title: string
  status: TaskStatus
  priority: TaskPriority
  category?: string
  owner?: string
  activeForm?: string
  blockedBy: string[]
  blocks: string[]
  tags: string[]
  labels: string[]
  description: string
  checklist: ChecklistItem[]
  log: LogEntry[]
  notes: string
  progress: number
  rawContent: string
  explicitId?: string
}

export interface SectionCounts {
  tasks: number
  tasksCompleted: number
  checklists: number
  checklistsCompleted: number
}

export interface TocSection extends ExtractedItem {
  title: string
  level: number
  content: string
  children: TocSection[]
  counts: SectionCounts
}

export interface ChecklistGroup extends ExtractedItem {
  title: string
  items: ChecklistItem[]
  progress: number
}

export interface DiagramItem extends ExtractedItem {
  title: string
  code: string
  diagramType: string
}

export type LinkKind = 'wiki' | 'markdown'

export interface LinkItem extends ExtractedItem {
  kind: LinkKind
  target: string
  text?: string
}

export interface LogSection extends ExtractedItem {
  title: string
  entries: Array<{
    timestamp: string
    action: string
    result?: string
    next?: string
  }>
}

export interface BlockItem extends ExtractedItem {
  blockType: string
  data: unknown
  raw: string
  range: {
    startOffset: number | null
    endOffset: number | null
    startLine: number | null
    endLine: number | null
  }
  errors?: Array<{ message: string; line?: number; column?: number }>
}
