import type { Node } from '@xyflow/react'

import type { NodeDimensions } from '../types'

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

