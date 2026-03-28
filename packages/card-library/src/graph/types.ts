/**
 * Unified Graph Type System
 *
 * These types unify BlockDefinition (card-library) and ParserPlugin (context-graph)
 * into a single type system. A NodeTypeDefinition describes a card that can render
 * in any context: inline in markdown, standalone as a card, or as a React Flow node
 * in a graph.
 *
 * React Flow is optional — standalone/inline rendering works without it.
 * Only GraphCanvas requires @xyflow/react as a peer dependency.
 */

import type { ComponentType, ReactNode } from 'react'
import type {
  BlockCapabilities,
  BlockParseError,
  BlockSource,
  BlockInstance,
  BlockUpdate,
  ThemeTokens,
  BlockEditEvent,
  CardHost,
} from '../blocks/types'

// ─── Render Contexts ──────────────────────────────────────────────────────────

/** Where a card is being rendered */
export type RenderContext =
  | 'inline'      // Inline in markdown flow
  | 'card'        // Standalone card (sidebar, panel, chat response)
  | 'graph-node'  // React Flow node in a graph
  | 'popover'     // Hover preview / quick look
  | 'panel'       // Full panel view

// ─── Node Type Definition ─────────────────────────────────────────────────────

/** Size category for layout hints — tells the layout engine how big this card tends to be */
export type SizeCategory = 'pill' | 'compact' | 'standard' | 'wide' | 'tall' | 'large'

/** Layout hints for the graph engine */
export interface LayoutHints {
  /** Default width in pixels (used before measurement) */
  defaultWidth: number
  /** Default height in pixels (used before measurement) */
  defaultHeight: number
  /** Size category for layout grouping */
  sizeCategory: SizeCategory
  /** Whether nodes of this type can be grouped together */
  groupable: boolean
  /** Whether this node type acts as a container for children */
  isContainer: boolean
}

const DEFAULT_LAYOUT_HINTS: LayoutHints = {
  defaultWidth: 200,
  defaultHeight: 100,
  sizeCategory: 'standard',
  groupable: false,
  isContainer: false,
}

export { DEFAULT_LAYOUT_HINTS }

/** Props passed to node components in any render context */
export interface NodeRenderProps<T = unknown> {
  /** Parsed node data */
  data: T
  /** Current render context */
  context: RenderContext
  /** Detail level */
  detail: 'mini' | 'summary' | 'full'
  /** Theme tokens from the host */
  theme: ThemeTokens
  /** Source location info */
  source?: BlockSource
  /** Edit callback */
  onEdit?: (event: BlockEditEvent) => void
  /** Host API access */
  host?: CardHost
  /** Code syntax highlighter */
  highlighter?: (code: string, lang: string) => ReactNode
  /** Card scale factor (graph zoom) */
  cardScale?: number
}

/** Detection result from a node type's detect function */
export interface DetectResult {
  /** Whether this type was detected */
  detected: boolean
  /** Confidence 0.0–1.0 */
  confidence: number
  /** Byte range of the match in the source content */
  range?: { start: number; end: number }
}

/** Parse result from a node type */
export interface ParseResult<T = unknown> {
  /** Parsed items */
  items: ParsedItem<T>[]
  /** Raw source matches */
  matches: SourceMatch[]
}

export interface ParsedItem<T = unknown> {
  /** Unique ID within the source document */
  id: string
  /** Source file path */
  sourceFile: string
  /** Source line number */
  sourceLine?: number
  /** Source end line */
  sourceEndLine?: number
  /** Parsed data */
  data: T
}

export interface SourceMatch {
  start: number
  end: number
  startLine: number
  endLine: number
  content: string
}

/**
 * NodeTypeDefinition — the unified plugin interface.
 *
 * Replaces both BlockDefinition (card-library) and ParserPlugin (context-graph).
 * A single definition handles detection, parsing, rendering in all contexts,
 * validation, and serialization.
 *
 * Generic parameter T is the parsed data type for this node kind.
 */
export interface NodeTypeDefinition<T = unknown> {
  /** Unique type identifier (e.g. 'task', 'vector', 'folder') */
  id: string
  /** Human-readable name */
  name: string
  /** Semantic category for grouping and filtering */
  category: NodeCategory
  /** Schema version for data migration */
  schemaVersion?: number

  // ─── Detection & Parsing ──────────────────────────────────────────────

  /**
   * Detect whether this type appears in markdown content.
   * Returns confidence score. Optional — types without detect are
   * manually instantiated (e.g. folder nodes created by file tree scan).
   */
  detect?: (content: string) => DetectResult

  /**
   * Parse all instances of this type from markdown content.
   * Returns parsed items with source locations.
   */
  parse?: (content: string, sourceFile: string) => ParseResult<T>

  /** Which render contexts this type supports */
  supportedContexts: RenderContext[]

  // ─── Rendering ────────────────────────────────────────────────────────

  /**
   * Component map for different render contexts.
   * Not all contexts need to be provided — the renderer falls back:
   * popover → card → inline, graph-node → card → inline
   */
  components: {
    inline?: ComponentType<NodeRenderProps<T>>
    card?: ComponentType<NodeRenderProps<T>>
    'graph-node'?: ComponentType<NodeRenderProps<T>>
    popover?: ComponentType<NodeRenderProps<T>>
    panel?: ComponentType<NodeRenderProps<T>>
  }

  /**
   * Get the best component for a given context, with fallback.
   * If not provided, the registry uses the default fallback chain.
   */
  getComponent?: (context: RenderContext) => ComponentType<NodeRenderProps<T>> | null

  // ─── Capabilities & Layout ────────────────────────────────────────────

  /** Block capabilities (parsing level, interactivity, etc.) */
  capabilities?: Partial<BlockCapabilities>

  /** Layout hints for the graph engine */
  layoutHints?: Partial<LayoutHints>

  // ─── Validation & Serialization ───────────────────────────────────────

  /** Validate parsed data */
  validate?: (data: T) => BlockParseError[]

  /** Transform parsed data to runtime form */
  toRuntime?: (data: T) => T

  /** Serialize to context markdown (for AICCL / agent injection) */
  toContextMarkdown?: (items: BlockInstance<T>[]) => string

  /** Serialize data back to source format */
  serialize?: (data: T) => string

  // ─── Editing ──────────────────────────────────────────────────────────

  /** Apply field updates and return serialized content */
  applyUpdate?: (data: T, updates: BlockUpdate[]) => { content: string; errors: BlockParseError[] }

  /** Return skeleton content for inserting a new instance */
  skeleton?: () => string

  // ─── Plugin metadata ──────────────────────────────────────────────────

  /** Parse priority — higher runs first during detection */
  priority?: number

  /** Dependencies on other node type IDs */
  dependencies?: string[]
}

/** Semantic category for node types */
export type NodeCategory =
  | 'content'      // task, checklist, diagram, note, code, etc.
  | 'structural'   // folder, document, link-card, filetree
  | 'metric'       // vector, criterion, progress indicators
  | 'reference'    // reference-pill, test-pill, attachment
  | 'temporal'     // delta-timeline, log entries
  | 'layout'       // container, group, spacer

// ─── Edge Type Definition ─────────────────────────────────────────────────────

/** Edge visual style */
export interface EdgeStyle {
  stroke: string
  strokeWidth: number
  strokeDasharray?: string
  animated?: boolean
  /** Arrow marker at target end */
  markerEnd?: boolean
  /** Arrow marker at source end */
  markerStart?: boolean
  /** Opacity 0–1 */
  opacity?: number
}

/** Data carried by an edge instance */
export interface EdgeData {
  /** Edge type ID */
  edgeType: string
  /** Optional label displayed on the edge */
  label?: string
  /** Custom data */
  metadata?: Record<string, unknown>
}

/**
 * EdgeTypeDefinition — describes a kind of edge.
 *
 * Each edge type has a visual style and an optional custom React Flow
 * edge component. If no component is provided, the default FloatingEdge
 * is used with the type's style applied.
 */
export interface EdgeTypeDefinition {
  /** Unique type identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Default visual style */
  style: EdgeStyle
  /** Custom React Flow edge component (optional — uses FloatingEdge if not set) */
  component?: ComponentType<unknown>
}

// ─── Layout Strategy ──────────────────────────────────────────────────────────

/** Position for a node after layout */
export interface LayoutPosition {
  x: number
  y: number
}

/** Dimensions of a node */
export interface LayoutDimensions {
  width: number
  height: number
}

/** Input node for layout computation */
export interface LayoutNode {
  id: string
  type: string
  /** Measured or default dimensions */
  dimensions: LayoutDimensions
  /** Layout hints from the node type definition */
  layoutHints: LayoutHints
  /** Node data (layout may use category, label, etc.) */
  data: unknown
  /** If already positioned and pinned, layout should preserve */
  pinned?: boolean
  /** Current position (if any) */
  position?: LayoutPosition
}

/** Input edge for layout computation */
export interface LayoutEdge {
  id: string
  source: string
  target: string
  edgeType: string
}

/** Viewport info for layout */
export interface LayoutViewport {
  width: number
  height: number
  zoom: number
}

/** Result of a layout computation */
export interface LayoutResult {
  positions: Map<string, LayoutPosition>
  /** Optional edge routing points */
  edgeRoutes?: Map<string, LayoutPosition[]>
}

/** Feature flags for what a layout strategy supports */
export interface LayoutCapabilities {
  /** Supports focus mode (highlighting a single node with context) */
  focus: boolean
  /** Supports collapsing/expanding groups */
  collapse: boolean
  /** Organizes nodes in layers/tiers */
  layers: boolean
  /** Supports incremental re-layout without full recomputation */
  incremental: boolean
}

/**
 * LayoutStrategy — pluggable layout algorithm.
 *
 * Graph contexts pick a layout strategy. Consumers can use built-in
 * strategies (Mindmap, Focus, ELK) or provide their own.
 */
export interface LayoutStrategy {
  /** Unique strategy identifier */
  id: string
  /** Human-readable name */
  name: string
  /** What this strategy supports */
  capabilities: LayoutCapabilities

  /**
   * Compute positions for all nodes.
   * Pinned nodes should be preserved at their current positions.
   */
  compute(
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    viewport: LayoutViewport,
  ): LayoutResult | Promise<LayoutResult>
}

// ─── Interaction Config ───────────────────────────────────────────────────────

/** Context menu item */
export interface ContextMenuItem {
  label: string
  action: string
  icon?: string
  disabled?: boolean
  divider?: boolean
}

/** Context menu factory — builds menu items for a given node */
export type ContextMenuFactory = (nodeId: string, nodeType: string) => ContextMenuItem[]

/** Interaction configuration for a graph context */
export interface InteractionConfig {
  /** Enable focus/breakout mode */
  focus: boolean
  /** Enable node selection (single or multi) */
  select: boolean | 'single' | 'multi'
  /** Enable node pinning */
  pin: boolean
  /** Enable node locking */
  lock: boolean
  /** Enable zoom controls */
  zoom: boolean
  /** Enable panning */
  pan: boolean
  /** Enable context menu */
  contextMenu: boolean
  /** Context menu item factory */
  contextMenuItems?: ContextMenuFactory
  /** Enable quick preview on hover */
  quickPreview: boolean
  /** Enable drag to reposition */
  drag: boolean
}

const DEFAULT_INTERACTIONS: InteractionConfig = {
  focus: true,
  select: 'multi',
  pin: true,
  lock: false,
  zoom: true,
  pan: true,
  contextMenu: true,
  quickPreview: true,
  drag: true,
}

export { DEFAULT_INTERACTIONS }

// ─── Graph Context Config ─────────────────────────────────────────────────────

/**
 * GraphContextConfig — defines a type of graph view.
 *
 * A graph context is a configuration that tells the graph engine
 * which node types, edge types, layout strategy, and interactions
 * to use. Apps compose views by picking or creating contexts.
 *
 * Examples: DocsGraphContext, PacketGraphContext, PlanGraphContext
 */
export interface GraphContextConfig {
  /** Unique context identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Which node type IDs this context uses */
  nodeTypes: string[]
  /** Which edge type IDs this context uses */
  edgeTypes: string[]
  /** Primary layout strategy */
  layout: LayoutStrategy
  /** Secondary layout (e.g. focus mode uses a different layout) */
  focusLayout?: LayoutStrategy
  /** Interaction configuration */
  interactions: InteractionConfig
  /** Theme overrides for this context */
  themeOverrides?: Partial<ThemeTokens>
}
