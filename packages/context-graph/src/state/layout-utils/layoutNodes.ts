/**
 * Layout coordinator — delegates to card-library's unified layout strategies.
 *
 * The actual layout algorithms (MindmapLayout, FocusLayout) and utilities
 * (resolveCollisions, buildNodeSizeMap) live in @context-towel/card-library.
 * This file adapts from React Flow types to the LayoutStrategy interface.
 */

import type { Node, Edge } from '@xyflow/react'
import {
  MindmapLayout,
  createFocusLayout,
  resolveCollisions,
  buildNodeSizeMap,
  type LayoutNode,
  type LayoutEdge,
  type LayoutDimensions,
} from '@context-towel/card-library'

import type { ViewportDimensions, NodeDimensions } from '../types'

/**
 * Layout nodes using card-library's layout strategies.
 */
export function layoutNodes(
  nodes: Node[],
  edges: Edge[],
  viewportDimensions?: ViewportDimensions | null,
  focusedNode?: string | null,
  measuredDimensions?: Map<string, NodeDimensions>,
): Node[] {
  if (nodes.length === 0) return nodes

  // Build size map using card-library's utility
  const sizeMap = buildNodeSizeMap(
    nodes.map(n => ({ id: n.id, type: n.type, data: n.data })),
    measuredDimensions as Map<string, LayoutDimensions> | undefined,
  )

  // Convert React Flow nodes/edges to LayoutNode/LayoutEdge
  const layoutNodeList: LayoutNode[] = nodes.map(n => ({
    id: n.id,
    type: n.type ?? 'default',
    dimensions: sizeMap.get(n.id) ?? { width: 200, height: 100 },
    layoutHints: { defaultWidth: 200, defaultHeight: 100, sizeCategory: 'standard' as const, groupable: false, isContainer: false },
    data: n.data,
    position: n.position,
  }))

  const layoutEdgeList: LayoutEdge[] = edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    edgeType: (e.data as Record<string, unknown>)?.edgeType as string ?? 'structural',
  }))

  const viewport = {
    width: viewportDimensions?.width ?? 1200,
    height: viewportDimensions?.height ?? 800,
    zoom: 1,
  }

  // Pick strategy
  const strategy = focusedNode
    ? createFocusLayout(focusedNode)
    : MindmapLayout

  const result = strategy.compute(layoutNodeList, layoutEdgeList, viewport)

  // Strategy.compute may return a Promise (for async layouts like ELK).
  // MindmapLayout and FocusLayout are synchronous.
  if (result instanceof Promise) {
    // Fallback: return nodes as-is, let caller handle async
    return nodes
  }

  const positions = result.positions

  // Resolve collisions
  resolveCollisions(positions, sizeMap)

  return nodes.map(node => {
    const pos = positions.get(node.id) ?? { x: 0, y: 0 }
    return {
      ...node,
      position: { x: Math.round(pos.x), y: Math.round(pos.y) },
    }
  })
}

