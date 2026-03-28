/**
 * Built-in graph context configurations.
 *
 * Each context defines which node types, edge types, layout strategy,
 * and interactions to use for a specific type of graph view.
 *
 * Apps import these directly or extend them for custom views.
 */

import type { GraphContextConfig, LayoutStrategy, LayoutResult, InteractionConfig } from './types'
import { DEFAULT_INTERACTIONS } from './types'
import { MindmapLayout } from './layout/MindmapLayout'

// ─── Docs Graph Context ───────────────────────────────────────────────────────

export const DocsGraphContext: GraphContextConfig = {
  id: 'docs',
  name: 'Documentation Graph',
  nodeTypes: [
    'folder', 'document', 'workingdoc', 'filetree',
    'toc', 'tasklist', 'task', 'checklist', 'diagram',
    'link-card', 'entity-index',
  ],
  edgeTypes: ['structural'],
  layout: MindmapLayout, // replaced by MindmapLayout at runtime
  // Focus layout is created per-node via createFocusLayout(nodeId) // replaced by FocusLayout at runtime
  interactions: {
    ...DEFAULT_INTERACTIONS,
    focus: true,
    select: 'multi',
    pin: true,
    lock: true,
    contextMenu: true,
    quickPreview: true,
  },
}

// ─── Packet Graph Context ─────────────────────────────────────────────────────

export const PacketGraphContext: GraphContextConfig = {
  id: 'packet',
  name: 'Packet Workspace',
  nodeTypes: [
    'vector', 'gap', 'delta-timeline', 'criterion',
    'reference-pill', 'test-pill', 'packet-diagram',
  ],
  edgeTypes: ['attachment', 'reference', 'dependency'],
  layout: MindmapLayout, // replaced by ElkLayout at runtime
  interactions: {
    ...DEFAULT_INTERACTIONS,
    focus: true,
    select: 'single',
    pin: false,
    lock: false,
    quickPreview: false,
  },
}

// ─── Plan Graph Context ───────────────────────────────────────────────────────

export const PlanGraphContext: GraphContextConfig = {
  id: 'plan',
  name: 'Plan View',
  nodeTypes: ['task', 'checklist', 'diagram'],
  edgeTypes: ['dependency', 'structural'],
  layout: MindmapLayout, // replaced by PlanLayout at runtime
  interactions: {
    ...DEFAULT_INTERACTIONS,
    focus: false,
    select: 'multi',
    pin: false,
    lock: false,
    quickPreview: false,
    drag: false,
  },
}

// ─── Context factory ──────────────────────────────────────────────────────────

/**
 * Create a custom graph context by extending a built-in one.
 */
export function createGraphContext(
  base: GraphContextConfig,
  overrides: Partial<GraphContextConfig>,
): GraphContextConfig {
  return {
    ...base,
    ...overrides,
    interactions: {
      ...base.interactions,
      ...overrides.interactions,
    } as InteractionConfig,
  }
}

/**
 * Inject a layout strategy into a context config.
 * Used by consumers that have their own layout implementations.
 */
export function withLayout(
  config: GraphContextConfig,
  layout: LayoutStrategy,
  focusLayout?: LayoutStrategy,
): GraphContextConfig {
  return {
    ...config,
    layout,
    focusLayout: focusLayout ?? config.focusLayout,
  }
}
