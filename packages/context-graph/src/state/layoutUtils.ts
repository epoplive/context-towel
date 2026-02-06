// ============================================================================
// Context Graph - Layout Utilities
// ============================================================================

import type { Node, Edge } from '@xyflow/react'
import type { ViewportDimensions, NodeDimensions } from './types'
import {
  ProjectSettings,
  matchesFolderId,
  normalizeProjectSettings,
} from '../compat/project-settings'

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Get document type from path
 */
export type DocType = 'core' | 'research' | 'spike' | 'other'

function getPrefixedFolderType(path: string): FolderType | null {
  if (path.startsWith('core@')) return 'core'
  if (path.startsWith('research@')) return 'research'
  if (path.startsWith('archive@')) return 'archive'
  return null
}

function getPrefixedDocType(path: string): DocType | null {
  const folderType = getPrefixedFolderType(path)
  if (!folderType) return null
  if (folderType === 'archive') return 'spike'
  return folderType
}

export function getDocType(path: string, settings?: ProjectSettings): DocType {
  const prefixed = getPrefixedDocType(path)
  if (prefixed) return prefixed
  const resolved = normalizeProjectSettings(settings)

  if (matchesFolderId(path, resolved.folders.working)) return 'core'
  if (matchesFolderId(path, resolved.folders.docs)) return 'research'
  if (matchesFolderId(path, resolved.folders.archive)) return 'spike'
  if (['CLAUDE.md', 'plan.md', 'architecture.md', 'current-focus.md', 'decisions.md'].some(f => path.endsWith(f))) {
    return 'core'
  }
  return 'other'
}

/**
 * Get folder type from path
 */
export type FolderType = 'core' | 'research' | 'archive' | 'other'

export function getFolderType(path: string, settings?: ProjectSettings): FolderType {
  const prefixed = getPrefixedFolderType(path)
  if (prefixed) return prefixed
  const resolved = normalizeProjectSettings(settings)

  if (matchesFolderId(path, resolved.folders.working)) return 'core'
  if (matchesFolderId(path, resolved.folders.docs)) return 'research'
  if (matchesFolderId(path, resolved.folders.archive)) return 'archive'
  return 'other'
}

/**
 * Check if a folder type should show as a collapsed tree widget by default
 * Per CLAUDE.md: archive shows as FileTreeNode, docs is utility folder
 * Only working folder ('core') expands to show full nodes
 */
export function shouldDefaultToTreeWidget(folderType: FolderType): boolean {
  return folderType === 'archive' || folderType === 'research'
}

/**
 * Build node size map for layout calculations
 */
export function buildNodeSizeMap(
  nodes: Node[],
  measuredDimensions?: Map<string, NodeDimensions>
): Map<string, { width: number; height: number }> {
  const nodeSizeMap = new Map<string, { width: number; height: number }>()

  nodes.forEach(node => {
    // Use measured dimensions if available
    const measured = measuredDimensions?.get(node.id)
    if (measured) {
      nodeSizeMap.set(node.id, measured)
      return
    }

    // Estimate sizes based on node type
    if (node.type === 'filetree') {
      const items = (node.data?.items as unknown[]) || []
      const height = Math.max(100, 50 + Math.min(items.length, 20) * 24)
      nodeSizeMap.set(node.id, { width: 220, height })
    } else if (node.type === 'folder') {
      nodeSizeMap.set(node.id, { width: 150, height: 40 })
    } else if (node.type === 'toc') {
      const sections = (node.data?.sections as unknown[]) || []
      const height = Math.max(80, 50 + sections.length * 24)
      nodeSizeMap.set(node.id, { width: 240, height })
    } else if (node.type === 'task') {
      // Single task node
      nodeSizeMap.set(node.id, { width: 280, height: 120 })
    } else if (node.type === 'tasklist') {
      const tasks = (node.data?.tasks as unknown[]) || []
      const height = Math.max(100, 60 + tasks.length * 80)
      nodeSizeMap.set(node.id, { width: 300, height })
    } else if (node.type === 'checklist') {
      const group = (node.data?.group as { items?: unknown[] }) || { items: [] }
      const height = Math.max(80, 50 + (group.items?.length || 0) * 24)
      nodeSizeMap.set(node.id, { width: 240, height })
    } else if (node.type === 'diagram') {
      nodeSizeMap.set(node.id, { width: 500, height: 400 })
    } else if (node.type === 'link-stub') {
      nodeSizeMap.set(node.id, { width: 220, height: 70 })
    } else if (node.type === 'link-card') {
      const links = (node.data?.links as unknown[]) || []
      const height = Math.max(120, 70 + Math.min(links.length, 10) * 22)
      nodeSizeMap.set(node.id, { width: 300, height })
    } else if (node.type === 'document' || node.type === 'workingdoc') {
      // Document nodes can be tall if they have tasks/sections displayed
      const tasks = (node.data?.tasks as unknown[]) || []
      const sections = (node.data?.sections as unknown[]) || []
      const checklists = (node.data?.checklists as unknown[]) || []

      // Base height plus content
      let height = 80 // Header + base padding
      if (tasks.length > 0) {
        height += 40 + tasks.length * 28 // Task list section
      }
      if (sections.length > 0) {
        height += 30 + Math.min(sections.length, 5) * 20 // Sections preview
      }
      if (checklists.length > 0) {
        height += 30 + checklists.length * 24
      }

      nodeSizeMap.set(node.id, { width: 320, height: Math.max(80, height) })
    } else {
      nodeSizeMap.set(node.id, { width: 180, height: 50 })
    }
  })

  return nodeSizeMap
}

// ----------------------------------------------------------------------------
// Focus Mode Layout
// ----------------------------------------------------------------------------

/**
 * Layout nodes in focus mode (ancestors + breakout nodes)
 */
function layoutFocusMode(
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

// ----------------------------------------------------------------------------
// Mindmap Layout
// ----------------------------------------------------------------------------

/**
 * Layout nodes to fill viewport while maintaining hierarchy
 * Uses layered approach - place each layer considering available space
 */
function layoutMindmap(
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

// ----------------------------------------------------------------------------
// Main Layout Function
// ----------------------------------------------------------------------------

/**
 * Simple collision resolution - push overlapping nodes apart
 */
function resolveCollisions(
  positioned: Map<string, { x: number; y: number }>,
  nodeSizeMap: Map<string, { width: number; height: number }>,
  iterations = 15
): void {
  const ids = Array.from(positioned.keys())
  const padding = 15

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i]
        const idB = ids[j]
        const posA = positioned.get(idA)!
        const posB = positioned.get(idB)!
        const sizeA = nodeSizeMap.get(idA) || { width: 200, height: 100 }
        const sizeB = nodeSizeMap.get(idB) || { width: 200, height: 100 }

        // Positions are TOP-LEFT corners in ReactFlow
        // Check if rectangles overlap (with padding)
        const aLeft = posA.x - padding
        const aRight = posA.x + sizeA.width + padding
        const aTop = posA.y - padding
        const aBottom = posA.y + sizeA.height + padding

        const bLeft = posB.x
        const bRight = posB.x + sizeB.width
        const bTop = posB.y
        const bBottom = posB.y + sizeB.height

        // Check overlap
        const overlapX = Math.min(aRight, bRight) - Math.max(aLeft, bLeft)
        const overlapY = Math.min(aBottom, bBottom) - Math.max(aTop, bTop)

        if (overlapX > 0 && overlapY > 0) {
          // Push apart along the axis with less overlap
          const pushX = overlapX / 2 + 5
          const pushY = overlapY / 2 + 5

          if (overlapX < overlapY) {
            // Push horizontally
            if (posA.x < posB.x) {
              posA.x -= pushX
              posB.x += pushX
            } else {
              posA.x += pushX
              posB.x -= pushX
            }
          } else {
            // Push vertically
            if (posA.y < posB.y) {
              posA.y -= pushY
              posB.y += pushY
            } else {
              posA.y += pushY
              posB.y -= pushY
            }
          }
        }
      }
    }
  }
}

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
