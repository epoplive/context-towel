/**
 * GraphRegistry — unified node type and edge type registry.
 *
 * Replaces both BlockRegistry (card-library) and PluginRegistry (context-graph)
 * with a single registry. Node types register once, render in any context.
 *
 * Usage:
 *   import { graphRegistry, registerContentTypes } from '@context-towel/card-library'
 *   registerContentTypes()  // registers task, checklist, diagram, etc.
 *   graphRegistry.registerNodeType(myCustomType)
 */

import type { ComponentType } from 'react'
import type {
  NodeTypeDefinition,
  NodeCategory,
  EdgeTypeDefinition,
  NodeRenderProps,
  RenderContext,
  LayoutHints,
} from './types'
import { DEFAULT_LAYOUT_HINTS } from './types'

// ─── Component fallback chain ─────────────────────────────────────────────────

const FALLBACK_CHAIN: Record<RenderContext, RenderContext[]> = {
  'graph-node': ['graph-node', 'card', 'inline'],
  panel: ['panel', 'card', 'inline'],
  popover: ['popover', 'card', 'inline'],
  card: ['card', 'inline'],
  inline: ['inline'],
}

/**
 * Resolve the best component for a render context, following the fallback chain.
 */
function resolveComponent<T>(
  def: NodeTypeDefinition<T>,
  context: RenderContext,
): ComponentType<NodeRenderProps<T>> | null {
  // Custom resolver takes priority
  if (def.getComponent) {
    const comp = def.getComponent(context)
    if (comp) return comp
  }

  // Walk fallback chain
  const chain = FALLBACK_CHAIN[context] ?? [context]
  for (const ctx of chain) {
    const comp = def.components[ctx]
    if (comp) return comp as ComponentType<NodeRenderProps<T>>
  }
  return null
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export class GraphRegistry {
  private nodeTypes = new Map<string, NodeTypeDefinition>()
  private edgeTypes = new Map<string, EdgeTypeDefinition>()
  private parseOrder: string[] = []

  // ─── Node Types ─────────────────────────────────────────────────────

  registerNodeType<T>(def: NodeTypeDefinition<T>): void {
    if (this.nodeTypes.has(def.id)) {
      throw new Error(`Node type '${def.id}' is already registered. Use registerOrReplaceNodeType() to override.`)
    }
    this.nodeTypes.set(def.id, def as NodeTypeDefinition)
    this.rebuildParseOrder()
  }

  registerOrReplaceNodeType<T>(def: NodeTypeDefinition<T>): void {
    this.nodeTypes.set(def.id, def as NodeTypeDefinition)
    this.rebuildParseOrder()
  }

  getNodeType<T = unknown>(id: string): NodeTypeDefinition<T> | undefined {
    return this.nodeTypes.get(id) as NodeTypeDefinition<T> | undefined
  }

  hasNodeType(id: string): boolean {
    return this.nodeTypes.has(id)
  }

  getNodeTypes(filter?: { category?: NodeCategory }): NodeTypeDefinition[] {
    const all = Array.from(this.nodeTypes.values())
    if (!filter?.category) return all
    return all.filter(t => t.category === filter.category)
  }

  unregisterNodeType(id: string): void {
    this.nodeTypes.delete(id)
    this.rebuildParseOrder()
  }

  /**
   * Get the component for a node type in a given render context.
   * Returns null if the type doesn't exist or has no component for the context.
   */
  getComponent<T = unknown>(
    typeId: string,
    context: RenderContext,
  ): ComponentType<NodeRenderProps<T>> | null {
    const def = this.nodeTypes.get(typeId) as NodeTypeDefinition<T> | undefined
    if (!def) return null
    return resolveComponent(def, context)
  }

  /**
   * Get resolved layout hints for a node type, with defaults applied.
   */
  getLayoutHints(typeId: string): LayoutHints {
    const def = this.nodeTypes.get(typeId)
    if (!def?.layoutHints) {
      return { ...DEFAULT_LAYOUT_HINTS }
    }
    return { ...DEFAULT_LAYOUT_HINTS, ...def.layoutHints }
  }

  /**
   * Build a React Flow nodeTypes map from registered types.
   * Only includes types that have a 'graph-node' (or fallback) component.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildReactFlowNodeTypes(): Record<string, ComponentType<any>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, ComponentType<any>> = {}
    for (const [id, def] of this.nodeTypes) {
      const comp = resolveComponent(def, 'graph-node')
      if (comp) {
        result[id] = comp
      }
    }
    return result
  }

  /**
   * Build a React Flow edgeTypes map from registered types.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildReactFlowEdgeTypes(): Record<string, ComponentType<any>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, ComponentType<any>> = {}
    for (const [id, def] of this.edgeTypes) {
      if (def.component) {
        result[id] = def.component
      }
    }
    return result
  }

  // ─── Edge Types ─────────────────────────────────────────────────────

  registerEdgeType(def: EdgeTypeDefinition): void {
    if (this.edgeTypes.has(def.id)) {
      throw new Error(`Edge type '${def.id}' is already registered. Use registerOrReplaceEdgeType() to override.`)
    }
    this.edgeTypes.set(def.id, def)
  }

  registerOrReplaceEdgeType(def: EdgeTypeDefinition): void {
    this.edgeTypes.set(def.id, def)
  }

  getEdgeType(id: string): EdgeTypeDefinition | undefined {
    return this.edgeTypes.get(id)
  }

  hasEdgeType(id: string): boolean {
    return this.edgeTypes.has(id)
  }

  getEdgeTypes(): EdgeTypeDefinition[] {
    return Array.from(this.edgeTypes.values())
  }

  unregisterEdgeType(id: string): void {
    this.edgeTypes.delete(id)
  }

  // ─── Parsing ────────────────────────────────────────────────────────

  /**
   * Run all registered node types' detect+parse against content.
   * Returns a map of typeId → ParseResult for types that matched.
   */
  parseAll(content: string, sourceFile: string): Map<string, unknown> {
    const results = new Map<string, unknown>()
    for (const id of this.parseOrder) {
      const def = this.nodeTypes.get(id)
      if (!def?.detect || !def.parse) continue
      const detection = def.detect(content)
      if (detection.detected) {
        results.set(id, def.parse(content, sourceFile))
      }
    }
    return results
  }

  /**
   * Parse content with a specific node type.
   */
  parseWith<T>(typeId: string, content: string, sourceFile: string): unknown {
    const def = this.nodeTypes.get(typeId)
    if (!def?.parse) return null
    return def.parse(content, sourceFile)
  }

  // ─── Utilities ──────────────────────────────────────────────────────

  /** Number of registered node types */
  get nodeTypeCount(): number {
    return this.nodeTypes.size
  }

  /** Number of registered edge types */
  get edgeTypeCount(): number {
    return this.edgeTypes.size
  }

  /** Clear all registrations */
  clear(): void {
    this.nodeTypes.clear()
    this.edgeTypes.clear()
    this.parseOrder = []
  }

  /** List all node type IDs */
  listNodeTypeIds(): string[] {
    return Array.from(this.nodeTypes.keys())
  }

  /** List all edge type IDs */
  listEdgeTypeIds(): string[] {
    return Array.from(this.edgeTypes.keys())
  }

  // ─── Internal ───────────────────────────────────────────────────────

  private rebuildParseOrder(): void {
    const entries = Array.from(this.nodeTypes.entries())
      .filter(([, def]) => def.detect && def.parse)
      .sort(([, a], [, b]) => (b.priority ?? 0) - (a.priority ?? 0))
    this.parseOrder = entries.map(([id]) => id)
  }
}

/** Singleton registry instance */
export const graphRegistry = new GraphRegistry()
