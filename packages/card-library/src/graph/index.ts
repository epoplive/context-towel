// Graph System — unified node/edge type registry, layout strategies, and graph engine
// React Flow is optional — only GraphCanvas requires it as a peer dep.

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  // Render
  RenderContext,
  NodeRenderProps,
  SizeCategory,
  LayoutHints,

  // Node types
  NodeTypeDefinition,
  NodeCategory,
  DetectResult,
  ParseResult,
  ParsedItem,
  SourceMatch,

  // Edge types
  EdgeTypeDefinition,
  EdgeStyle,
  EdgeData,

  // Layout
  LayoutStrategy,
  LayoutCapabilities,
  LayoutNode,
  LayoutEdge,
  LayoutViewport,
  LayoutPosition,
  LayoutDimensions,
  LayoutResult,

  // Interactions
  InteractionConfig,
  ContextMenuItem,
  ContextMenuFactory,

  // Graph context
  GraphContextConfig,
} from './types'

export { DEFAULT_LAYOUT_HINTS, DEFAULT_INTERACTIONS } from './types'

// ─── Registry ─────────────────────────────────────────────────────────────────
export { GraphRegistry, graphRegistry } from './GraphRegistry'

// ─── Store ────────────────────────────────────────────────────────────────────
export { createGraphStore } from './GraphStore'
export type {
  GraphStoreState,
  GraphNode,
  GraphEdge,
  GraphViewport,
  ContextMenuState,
} from './GraphStore'

// ─── Canvas (requires @xyflow/react peer dep) ─────────────────────────────────
export { GraphCanvas } from './GraphCanvas'
export type { GraphCanvasProps } from './GraphCanvas'

// ─── Built-in Edge Types ──────────────────────────────────────────────────────
// ─── Layout Utilities ─────────────────────────────────────────────────────────
export {
  resolveCollisions,
  estimateNodeSize,
  buildNodeSizeMap,
  DEFAULT_NODE_SIZES,
  FALLBACK_NODE_SIZE,
  MindmapLayout,
  createFocusLayout,
} from './layout'
export type { FocusLayoutOptions } from './layout'

// ─── Adapter ──────────────────────────────────────────────────────────────────
export { adaptBlockToNodeType } from './adapt.js'
export type { AdaptBlockOptions } from './adapt.js'

// ─── Registration ─────────────────────────────────────────────────────────────
export { registerContentNodeTypes, registerAllBuiltInTypes } from './register'
export { registerPacketNodeTypes, registerPacketNodeTypeStubs, packetNodeStubs } from './packet-types'
export type { PacketNodeTypeStub } from './packet-types'

// ─── Built-in Graph Contexts ──────────────────────────────────────────────────
export {
  DocsGraphContext,
  PacketGraphContext,
  PlanGraphContext,
  createGraphContext,
  withLayout,
} from './contexts'

// ─── Shared Primitives ────────────────────────────────────────────────────────
export {
  PACKET_COLORS,
  DELTA_TYPE_COLORS,
  getDeltaColor,
  PillHandles,
  CardHandles,
  shortPath,
  isUrl,
  ProgressRing,
  SectionLabel,
  StatusDot,
} from './primitives'
export type { ProgressRingProps } from './primitives'

// ─── Built-in Edge Types ──────────────────────────────────────────────────────
export {
  structuralEdge,
  referenceEdge,
  dependencyEdge,
  temporalEdge,
  attachmentEdge,
  dataFlowEdge,
  builtInEdgeTypes,
  registerBuiltInEdgeTypes,
} from './edges'
