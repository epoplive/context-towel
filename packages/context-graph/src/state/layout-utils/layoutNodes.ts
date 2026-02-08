import type { Node, Edge } from '@xyflow/react'

import type { ViewportDimensions, NodeDimensions } from '../types'

import { buildNodeSizeMap } from './nodeSizeMap'
import { layoutFocusMode } from './focusLayout'
import { layoutMindmap } from './mindmapLayout'
import { resolveCollisions } from './collisions'

/**
 * Layout nodes using mindmap-layouts or focus mode algorithm
 */
export function layoutNodes(
  nodes: Node[],
  edges: Edge[],
  viewportDimensions?: ViewportDimensions | null,
  focusedNode?: string | null,
  measuredDimensions?: Map<string, NodeDimensions>
): Node[] {
  if (nodes.length === 0) return nodes

  const nodeSizeMap = buildNodeSizeMap(nodes, measuredDimensions)

  let positioned: Map<string, { x: number; y: number }>

  if (focusedNode) {
    positioned = layoutFocusMode(nodes, edges, focusedNode, nodeSizeMap, viewportDimensions)
  } else {
    positioned = layoutMindmap(nodes, edges, nodeSizeMap, viewportDimensions)
  }

  // Resolve any overlapping nodes
  resolveCollisions(positioned, nodeSizeMap)

  return nodes.map(node => ({
    ...node,
    position: positioned.get(node.id) || { x: 0, y: 0 },
  }))
}

