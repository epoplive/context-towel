/**
 * Shared layout utilities — collision resolution and node sizing.
 * Extracted from context-graph/src/state/layout-utils/.
 */

import type { LayoutDimensions, LayoutPosition } from '../types'

// ─── Collision Resolution ─────────────────────────────────────────────────────

/**
 * Push overlapping nodes apart using iterative force-directed resolution.
 * Mutates the positions map in place.
 *
 * @param positions - Mutable map of nodeId → top-left position
 * @param sizes - Map of nodeId → dimensions
 * @param options - Padding and iteration count
 */
export function resolveCollisions(
  positions: Map<string, LayoutPosition>,
  sizes: Map<string, LayoutDimensions>,
  options: { padding?: number; iterations?: number } = {},
): void {
  const { padding = 15, iterations = 15 } = options
  const ids = Array.from(positions.keys())

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i]
        const idB = ids[j]
        const posA = positions.get(idA)!
        const posB = positions.get(idB)!
        const sizeA = sizes.get(idA) ?? { width: 200, height: 100 }
        const sizeB = sizes.get(idB) ?? { width: 200, height: 100 }

        // Positions are TOP-LEFT corners (React Flow convention)
        const aLeft = posA.x - padding
        const aRight = posA.x + sizeA.width + padding
        const aTop = posA.y - padding
        const aBottom = posA.y + sizeA.height + padding

        const bLeft = posB.x
        const bRight = posB.x + sizeB.width
        const bTop = posB.y
        const bBottom = posB.y + sizeB.height

        const overlapX = Math.min(aRight, bRight) - Math.max(aLeft, bLeft)
        const overlapY = Math.min(aBottom, bBottom) - Math.max(aTop, bTop)

        if (overlapX > 0 && overlapY > 0) {
          const pushX = overlapX / 2 + 5
          const pushY = overlapY / 2 + 5

          if (overlapX < overlapY) {
            if (posA.x < posB.x) {
              posA.x -= pushX
              posB.x += pushX
            } else {
              posA.x += pushX
              posB.x -= pushX
            }
          } else {
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

// ─── Node Size Estimation ─────────────────────────────────────────────────────

/** Default size estimates by node type */
export const DEFAULT_NODE_SIZES: Record<string, LayoutDimensions> = {
  folder: { width: 150, height: 40 },
  task: { width: 280, height: 120 },
  diagram: { width: 500, height: 400 },
}

/** Fallback size for unknown node types */
export const FALLBACK_NODE_SIZE: LayoutDimensions = { width: 180, height: 50 }

/**
 * Estimate node size based on type and data.
 * Override with measured dimensions when available.
 */
export function estimateNodeSize(
  nodeType: string,
  data: Record<string, unknown>,
  measured?: LayoutDimensions,
): LayoutDimensions {
  if (measured) return measured

  switch (nodeType) {
    case 'filetree': {
      const items = (data.items as unknown[]) ?? []
      return { width: 220, height: Math.max(100, 50 + Math.min(items.length, 20) * 24) }
    }
    case 'folder':
      return { width: 150, height: 40 }
    case 'toc': {
      const sections = (data.sections as unknown[]) ?? []
      return { width: 240, height: Math.max(80, 50 + sections.length * 24) }
    }
    case 'task':
      return { width: 280, height: 120 }
    case 'tasklist': {
      const tasks = (data.tasks as unknown[]) ?? []
      return { width: 300, height: Math.max(100, 60 + tasks.length * 80) }
    }
    case 'checklist': {
      const group = (data.group as { items?: unknown[] }) ?? { items: [] }
      return { width: 240, height: Math.max(80, 50 + (group.items?.length ?? 0) * 24) }
    }
    case 'diagram':
      return { width: 500, height: 400 }
    case 'link-card': {
      const links = (data.links as unknown[]) ?? []
      return { width: 300, height: Math.max(120, 70 + Math.min(links.length, 10) * 22) }
    }
    case 'document':
    case 'workingdoc': {
      const docTasks = (data.tasks as unknown[]) ?? []
      const docSections = (data.sections as unknown[]) ?? []
      const checklists = (data.checklists as unknown[]) ?? []
      let height = 80
      if (docTasks.length > 0) height += 40 + docTasks.length * 28
      if (docSections.length > 0) height += 30 + Math.min(docSections.length, 5) * 20
      if (checklists.length > 0) height += 30 + checklists.length * 24
      return { width: 320, height: Math.max(80, height) }
    }
    // Packet node types
    case 'vector':
      return { width: 300, height: 200 }
    case 'gap':
      return { width: 240, height: 140 }
    case 'delta-timeline':
      return { width: 260, height: 180 }
    case 'criterion':
    case 'reference-pill':
    case 'test-pill':
      return { width: 160, height: 36 }
    case 'packet-diagram':
      return { width: 400, height: 300 }
    default:
      return FALLBACK_NODE_SIZE
  }
}

/**
 * Build a size map for all nodes, using measured dimensions where available.
 */
export function buildNodeSizeMap(
  nodes: Array<{ id: string; type?: string; data?: unknown }>,
  measuredDimensions?: Map<string, LayoutDimensions>,
): Map<string, LayoutDimensions> {
  const sizeMap = new Map<string, LayoutDimensions>()
  for (const node of nodes) {
    const measured = measuredDimensions?.get(node.id)
    const size = estimateNodeSize(
      node.type ?? 'default',
      (node.data as Record<string, unknown>) ?? {},
      measured,
    )
    sizeMap.set(node.id, size)
  }
  return sizeMap
}
