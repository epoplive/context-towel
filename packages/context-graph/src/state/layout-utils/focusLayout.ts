import type { Node, Edge } from '@xyflow/react'

import type { ViewportDimensions } from '../types'

/**
 * Layout nodes in focus mode (ancestors + breakout nodes)
 */
export function layoutFocusMode(
  nodes: Node[],
  edges: Edge[],
  focusedNode: string,
  nodeSizeMap: Map<string, { width: number; height: number }>,
  viewportDimensions?: ViewportDimensions | null
): Map<string, { x: number; y: number }> {
  const positioned = new Map<string, { x: number; y: number }>()
  const structuralEdges = edges.filter(e => e.data?.edgeType === 'structural')
  const breakoutTypes = new Set(['toc', 'tasklist', 'checklist', 'diagram', 'link-card'])

  // Build parent->children map
  const childrenOf = new Map<string, string[]>()
  structuralEdges.forEach(edge => {
    const children = childrenOf.get(edge.source) || []
    children.push(edge.target)
    childrenOf.set(edge.source, children)
  })

  const focusedDocId = focusedNode

  // Get breakout node children of the focused doc
  const allChildren = childrenOf.get(focusedDocId) || []
  const breakoutChildren = allChildren.filter(id => {
    const node = nodes.find(n => n.id === id)
    return node && breakoutTypes.has(node.type || '')
  })

  // Build parent map (child -> parent) for ancestor walking
  const parentOf = new Map<string, string>()
  structuralEdges.forEach(edge => {
    const targetNode = nodes.find(n => n.id === edge.target)
    if (targetNode && !breakoutTypes.has(targetNode.type || '')) {
      parentOf.set(edge.target, edge.source)
    }
  })

  // Walk UP from focusedDocId to CLAUDE.md to build ancestor chain
  const ancestors: string[] = []
  let current: string | undefined = focusedDocId
  const visited = new Set<string>()

  while (current && !visited.has(current)) {
    visited.add(current)
    ancestors.unshift(current)
    if (current === 'CLAUDE.md') break
    const parent = parentOf.get(current)
    if (!parent) break
    current = parent
  }

  // Ensure CLAUDE.md is first
  if (ancestors[0] !== 'CLAUDE.md') {
    ancestors.unshift('CLAUDE.md')
  }

  // Ensure focused doc is last
  if (ancestors[ancestors.length - 1] !== focusedDocId) {
    const idx = ancestors.indexOf(focusedDocId)
    if (idx >= 0) ancestors.splice(idx, 1)
    ancestors.push(focusedDocId)
  }

  // Calculate ancestor column total height
  const ancestorX = 50
  const ancestorGap = 80
  let totalAncestorHeight = 0
  for (const ancestorId of ancestors) {
    const size = nodeSizeMap.get(ancestorId) || { width: 200, height: 60 }
    totalAncestorHeight += size.height + ancestorGap
  }
  totalAncestorHeight -= ancestorGap

  // Breakout layout parameters
  const breakoutStartX = 350
  const nodeWidth = 320
  const colGap = 40
  const rowGap = 30

  // Calculate breakout columns to find their total height
  let maxBreakoutHeight = 0
  const viewportWidth = viewportDimensions?.width || 1200
  const availableWidth = viewportWidth - breakoutStartX - 50
  const numCols = Math.max(1, Math.floor(availableWidth / (nodeWidth + colGap)))
  const columns: string[][] = Array.from({ length: numCols }, () => [])

  if (breakoutChildren.length > 0) {
    breakoutChildren.forEach((id, idx) => {
      columns[idx % numCols].push(id)
    })

    for (const col of columns) {
      let colHeight = 0
      for (const nodeId of col) {
        const size = nodeSizeMap.get(nodeId) || { width: 300, height: 150 }
        colHeight += size.height + rowGap
      }
      colHeight -= rowGap
      if (colHeight > maxBreakoutHeight) maxBreakoutHeight = colHeight
    }
  }

  // Align ancestors and breakouts
  const startY = 0
  let ancestorStartY = startY
  if (maxBreakoutHeight > totalAncestorHeight) {
    ancestorStartY = startY + (maxBreakoutHeight - totalAncestorHeight) / 2
  }

  // Position ancestors
  let currentY = ancestorStartY
  for (const ancestorId of ancestors) {
    const size = nodeSizeMap.get(ancestorId) || { width: 200, height: 60 }
    positioned.set(ancestorId, { x: ancestorX, y: currentY })
    currentY += size.height + ancestorGap
  }

  // Position breakout nodes in columns
  if (breakoutChildren.length > 0) {
    const breakoutStartY = startY

    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      const col = columns[colIdx]
      const colX = breakoutStartX + colIdx * (nodeWidth + colGap)
      let colY = breakoutStartY

      for (const nodeId of col) {
        const size = nodeSizeMap.get(nodeId) || { width: 300, height: 150 }
        positioned.set(nodeId, { x: colX, y: colY })
        colY += size.height + rowGap
      }
    }
  }

  // Position orphans
  let orphanY = currentY + 100
  let orphanX = ancestorX
  nodes.forEach(node => {
    if (!positioned.has(node.id)) {
      positioned.set(node.id, { x: orphanX, y: orphanY })
      orphanX += 200
      if (orphanX > 800) {
        orphanX = ancestorX
        orphanY += 80
      }
    }
  })

  return positioned
}

