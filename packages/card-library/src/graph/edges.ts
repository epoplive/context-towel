/**
 * Built-in edge type definitions.
 *
 * These are style-only definitions — they don't ship React components.
 * The actual rendering uses the FloatingEdge component from the graph engine
 * (which requires React Flow). These definitions just describe the visual style
 * for each semantic edge type.
 *
 * When the graph engine renders an edge, it reads the style from the edge type
 * definition and applies it to the FloatingEdge path.
 */

import type { EdgeTypeDefinition } from './types'

// ─── Built-in Edge Styles ─────────────────────────────────────────────────────

/** Parent-child relationships (folder→document, phase→task). Solid, muted. */
export const structuralEdge: EdgeTypeDefinition = {
  id: 'structural',
  name: 'Structural',
  style: {
    stroke: '#4a5568',
    strokeWidth: 1.5,
    opacity: 0.6,
  },
}

/** Node→referenced resource. Dashed, accent color. */
export const referenceEdge: EdgeTypeDefinition = {
  id: 'reference',
  name: 'Reference',
  style: {
    stroke: '#60a5fa',
    strokeWidth: 1.5,
    strokeDasharray: '6 3',
    opacity: 0.8,
  },
}

/** blocked-by / blocks relationships. Solid with arrow, directional. */
export const dependencyEdge: EdgeTypeDefinition = {
  id: 'dependency',
  name: 'Dependency',
  style: {
    stroke: '#f59e0b',
    strokeWidth: 2,
    markerEnd: true,
    opacity: 0.9,
  },
}

/** Sequence / timeline connections. Dotted, gray. */
export const temporalEdge: EdgeTypeDefinition = {
  id: 'temporal',
  name: 'Temporal',
  style: {
    stroke: '#9ca3af',
    strokeWidth: 1,
    strokeDasharray: '2 4',
    opacity: 0.5,
  },
}

/** Work-node→test/diagram/ref. Thin, subtle. */
export const attachmentEdge: EdgeTypeDefinition = {
  id: 'attachment',
  name: 'Attachment',
  style: {
    stroke: '#6b7280',
    strokeWidth: 1,
    opacity: 0.4,
  },
}

/** Data flow between processing steps. Animated, accent. */
export const dataFlowEdge: EdgeTypeDefinition = {
  id: 'data-flow',
  name: 'Data Flow',
  style: {
    stroke: '#8b5cf6',
    strokeWidth: 2,
    animated: true,
    markerEnd: true,
    opacity: 0.8,
  },
}

// ─── All built-in edges ───────────────────────────────────────────────────────

export const builtInEdgeTypes: EdgeTypeDefinition[] = [
  structuralEdge,
  referenceEdge,
  dependencyEdge,
  temporalEdge,
  attachmentEdge,
  dataFlowEdge,
]

// ─── Registration helper ──────────────────────────────────────────────────────

import { graphRegistry } from './GraphRegistry'

/**
 * Register all built-in edge types into the global registry.
 * Call this at app startup alongside registerContentTypes(), etc.
 */
export function registerBuiltInEdgeTypes(): void {
  for (const edge of builtInEdgeTypes) {
    if (!graphRegistry.hasEdgeType(edge.id)) {
      graphRegistry.registerEdgeType(edge)
    }
  }
}
