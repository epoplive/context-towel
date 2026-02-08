import type { Node, Edge } from '@xyflow/react'

import type { ViewportDimensions } from '../types'

/**
 * Layout nodes to fill viewport while maintaining hierarchy
 * Uses layered approach - place each layer considering available space
 */
export function layoutMindmap(
  nodes: Node[],
  edges: Edge[],
  nodeSizeMap: Map<string, { width: number; height: number }>,
  _viewportDimensions?: ViewportDimensions | null
): Map<string, { x: number; y: number }> {
  const positioned = new Map<string, { x: number; y: number }>()
  const structuralEdges = edges.filter(e => e.data?.edgeType === 'structural')

  // Build parent->children map
  const childrenOf = new Map<string, string[]>()
  const parentOf = new Map<string, string>()
  structuralEdges.forEach(edge => {
    const children = childrenOf.get(edge.source) || []
    children.push(edge.target)
    childrenOf.set(edge.source, children)
    parentOf.set(edge.target, edge.source)
  })

  const gap = 25  // Tight but no overlap

  // Get sizes helper
  const getSize = (id: string) => nodeSizeMap.get(id) || { width: 200, height: 100 }

  // LAYER 0: CLAUDE.md at center (position is top-left corner)
  const claudeSize = getSize('CLAUDE.md')
  positioned.set('CLAUDE.md', { x: -claudeSize.width / 2, y: -claudeSize.height / 2 })

  // Get direct children of CLAUDE.md
  const rootChildren = childrenOf.get('CLAUDE.md') || []
  const workingFolder = rootChildren.find(id => id.toLowerCase().includes('working'))
  const rightChildren = rootChildren.filter(id => id !== workingFolder)

  // LAYER 1: Right children (archive, docs) - right of CLAUDE
  let totalRightHeight = 0
  rightChildren.forEach(id => { totalRightHeight += getSize(id).height + gap })
  totalRightHeight -= gap

  let rightY = -totalRightHeight / 2
  const rightX = claudeSize.width / 2 + gap + 50  // More gap to avoid overlap
  rightChildren.forEach(childId => {
    const size = getSize(childId)
    positioned.set(childId, { x: rightX, y: rightY })
    rightY += size.height + gap
  })

  // LAYER 1: Working folder to the left of CLAUDE.md
  if (workingFolder) {
    const workingSize = getSize(workingFolder)
    const workingX = -claudeSize.width / 2 - gap - workingSize.width - 50
    positioned.set(workingFolder, { x: workingX, y: -workingSize.height / 2 })
    const workingPos = positioned.get(workingFolder)!

    // LAYER 2: Working's children - L-shape: tall left, others top/bottom
    const workingChildren = childrenOf.get(workingFolder) || []

    if (workingChildren.length > 0) {
      const sorted = [...workingChildren].map(id => ({ id, size: getSize(id) }))
        .sort((a, b) => b.size.height - a.size.height)

      // 1st (tallest): far left of working
      if (sorted.length >= 1) {
        const n1 = sorted[0]
        positioned.set(n1.id, {
          x: workingPos.x - gap - n1.size.width,
          y: workingPos.y - n1.size.height / 3
        })
      }

      // 2nd: above working folder, close to center
      if (sorted.length >= 2) {
        const n2 = sorted[1]
        positioned.set(n2.id, {
          x: workingPos.x + workingSize.width / 2 - n2.size.width / 2,
          y: workingPos.y - gap - n2.size.height
        })
      }

      // 3rd: bottom left (below tallest)
      if (sorted.length >= 3) {
        const n1 = sorted[0]
        const n1Pos = positioned.get(n1.id)!
        const n3 = sorted[2]
        positioned.set(n3.id, {
          x: n1Pos.x,
          y: n1Pos.y + n1.size.height + gap
        })
      }

      // 4th: bottom, next to 3rd
      if (sorted.length >= 4) {
        const n3 = sorted[2]
        const n3Pos = positioned.get(n3.id)!
        const n4 = sorted[3]
        positioned.set(n4.id, {
          x: n3Pos.x + n3.size.width + gap,
          y: n3Pos.y
        })
      }

      // Remaining: stack
      for (let i = 4; i < sorted.length; i++) {
        const prev = sorted[i - 1]
        const curr = sorted[i]
        const prevPos = positioned.get(prev.id)!
        const prevSize = getSize(prev.id)
        positioned.set(curr.id, {
          x: prevPos.x,
          y: prevPos.y + prevSize.height + gap
        })
      }
    }
  }

  // Handle orphans
  let orphanIdx = 0
  nodes.forEach(node => {
    if (!positioned.has(node.id)) {
      const parent = parentOf.get(node.id)
      if (parent && positioned.has(parent)) {
        const parentPos = positioned.get(parent)!
        const size = getSize(node.id)
        positioned.set(node.id, {
          x: parentPos.x + 150 + orphanIdx * 30,
          y: parentPos.y + 100 + orphanIdx * (size.height + 20),
        })
      } else {
        positioned.set(node.id, {
          x: 500 + (orphanIdx % 3) * 200,
          y: -200 + Math.floor(orphanIdx / 3) * 150,
        })
      }
      orphanIdx++
    }
  })

  return positioned
}

