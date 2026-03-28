/**
 * Focus layout strategy.
 *
 * Two-column layout: ancestor chain on the left, breakout nodes
 * (toc, tasklist, checklist, diagram, link-card) in columns on the right.
 *
 * Extracted from context-graph/src/state/layout-utils/focusLayout.ts.
 */

import type {
  LayoutStrategy,
  LayoutNode,
  LayoutEdge,
  LayoutViewport,
  LayoutResult,
  LayoutPosition,
  LayoutCapabilities,
} from '../types'

const BREAKOUT_TYPES = new Set(['toc', 'tasklist', 'checklist', 'diagram', 'link-card'])

export interface FocusLayoutOptions {
  /** The node ID to focus on */
  focusedNode: string
}

/**
 * Create a FocusLayout strategy for a specific focused node.
 */
export function createFocusLayout(focusedNode: string): LayoutStrategy {
  return {
    id: 'focus',
    name: 'Focus Layout',
    capabilities: {
      focus: true,
      collapse: false,
      layers: true,
      incremental: false,
    } satisfies LayoutCapabilities,

    compute(
      nodes: LayoutNode[],
      edges: LayoutEdge[],
      viewport: LayoutViewport,
    ): LayoutResult {
      const positioned = new Map<string, LayoutPosition>()
      const structuralEdges = edges.filter(e => e.edgeType === 'structural')

      // Build parent->children map
      const childrenOf = new Map<string, string[]>()
      for (const edge of structuralEdges) {
        const children = childrenOf.get(edge.source) ?? []
        children.push(edge.target)
        childrenOf.set(edge.source, children)
      }

      // Build parent map (skip breakout types)
      const parentOf = new Map<string, string>()
      for (const edge of structuralEdges) {
        const targetNode = nodes.find(n => n.id === edge.target)
        if (targetNode && !BREAKOUT_TYPES.has(targetNode.type)) {
          parentOf.set(edge.target, edge.source)
        }
      }

      // Get breakout children of focused node
      const allChildren = childrenOf.get(focusedNode) ?? []
      const breakoutChildren = allChildren.filter(id => {
        const node = nodes.find(n => n.id === id)
        return node && BREAKOUT_TYPES.has(node.type)
      })

      // Walk UP to build ancestor chain
      const ancestors: string[] = []
      let current: string | undefined = focusedNode
      const visited = new Set<string>()

      while (current && !visited.has(current)) {
        visited.add(current)
        ancestors.unshift(current)
        if (current === 'CLAUDE.md') break
        const parent = parentOf.get(current)
        if (!parent) break
        current = parent
      }

      if (ancestors[0] !== 'CLAUDE.md') ancestors.unshift('CLAUDE.md')
      if (ancestors[ancestors.length - 1] !== focusedNode) {
        const idx = ancestors.indexOf(focusedNode)
        if (idx >= 0) ancestors.splice(idx, 1)
        ancestors.push(focusedNode)
      }

      // Layout parameters
      const ancestorX = 50
      const ancestorGap = 80
      const breakoutStartX = 350
      const nodeWidth = 320
      const colGap = 40
      const rowGap = 30

      const getSize = (id: string) => {
        const node = nodes.find(n => n.id === id)
        return node?.dimensions ?? { width: 200, height: 60 }
      }

      // Calculate ancestor total height
      let totalAncestorHeight = 0
      for (const id of ancestors) {
        totalAncestorHeight += getSize(id).height + ancestorGap
      }
      totalAncestorHeight -= ancestorGap

      // Calculate breakout columns
      let maxBreakoutHeight = 0
      const availableWidth = viewport.width - breakoutStartX - 50
      const numCols = Math.max(1, Math.floor(availableWidth / (nodeWidth + colGap)))
      const columns: string[][] = Array.from({ length: numCols }, () => [])

      if (breakoutChildren.length > 0) {
        breakoutChildren.forEach((id, idx) => columns[idx % numCols].push(id))

        for (const col of columns) {
          let colHeight = 0
          for (const nodeId of col) {
            colHeight += getSize(nodeId).height + rowGap
          }
          colHeight -= rowGap
          if (colHeight > maxBreakoutHeight) maxBreakoutHeight = colHeight
        }
      }

      // Align
      const startY = 0
      let ancestorStartY = startY
      if (maxBreakoutHeight > totalAncestorHeight) {
        ancestorStartY = startY + (maxBreakoutHeight - totalAncestorHeight) / 2
      }

      // Position ancestors
      let currentY = ancestorStartY
      for (const id of ancestors) {
        const size = getSize(id)
        positioned.set(id, { x: ancestorX, y: currentY })
        currentY += size.height + ancestorGap
      }

      // Position breakout columns
      if (breakoutChildren.length > 0) {
        for (let colIdx = 0; colIdx < columns.length; colIdx++) {
          const col = columns[colIdx]
          const colX = breakoutStartX + colIdx * (nodeWidth + colGap)
          let colY = startY

          for (const nodeId of col) {
            const size = getSize(nodeId)
            positioned.set(nodeId, { x: colX, y: colY })
            colY += size.height + rowGap
          }
        }
      }

      // Position orphans
      let orphanY = currentY + 100
      let orphanX = ancestorX
      for (const node of nodes) {
        if (!positioned.has(node.id)) {
          positioned.set(node.id, { x: orphanX, y: orphanY })
          orphanX += 200
          if (orphanX > 800) {
            orphanX = ancestorX
            orphanY += 80
          }
        }
      }

      return { positions: positioned }
    },
  }
}
