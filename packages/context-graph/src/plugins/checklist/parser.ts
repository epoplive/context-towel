// ============================================================================
// Checklist Plugin Parser
// ============================================================================

import { ParseResult, SourceMatch } from '../../types'
import { ChecklistGroup, ChecklistItem } from './types'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/**
 * Detect if content contains standalone checklists (not inside ## Task: blocks)
 */
export function detectChecklists(content: string): boolean {
  // Remove task blocks first
  const withoutTasks = content.replace(/## Task:\s*.+?\n[\s\S]*?(?=\n## (?!Task:)|$)/g, '')
  return /^[-*]\s*\[[ xX]\]/m.test(withoutTasks)
}

/**
 * Parse standalone checklists from markdown (not inside ## Task: blocks)
 */
export function parseChecklists(content: string, sourceFile: string): ParseResult<ChecklistGroup> {
  const items: ChecklistGroup[] = []
  const rawMatches: SourceMatch[] = []

  // Remove task blocks first
  const withoutTasks = content.replace(/## Task:\s*.+?\n[\s\S]*?(?=\n## (?!Task:)|$)/g, '')

  // Split by headings and look for checklists
  const sections = withoutTasks.split(/^(#{1,3}\s+.+)$/m)

  let currentTitle = 'Checklist'
  let lineOffset = 0

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]

    // Check if this is a heading
    const headingMatch = section.match(/^#{1,3}\s+(.+)$/)
    if (headingMatch) {
      currentTitle = headingMatch[1].trim()
      lineOffset += section.split('\n').length
      continue
    }

    // Look for checklist items in this section
    const checklistItems: ChecklistItem[] = []
    const checklistRegex = /^[-*]\s*\[([ xX])\]\s*(.+)$/gm
    let match

    while ((match = checklistRegex.exec(section)) !== null) {
      checklistItems.push({
        checked: match[1].toLowerCase() === 'x',
        text: match[2].trim()
      })
    }

    if (checklistItems.length > 0) {
      const checked = checklistItems.filter(item => item.checked).length
      const startLine = lineOffset + 1

      items.push({
        id: slugify(currentTitle) + '-checklist',
        sourceFile,
        sourceLine: startLine,
        title: currentTitle,
        items: checklistItems,
        progress: Math.round((checked / checklistItems.length) * 100)
      })

      rawMatches.push({
        start: 0,  // Would need more complex tracking for exact positions
        end: 0,
        startLine,
        endLine: startLine + section.split('\n').length,
        content: section
      })
    }

    lineOffset += section.split('\n').length
  }

  return {
    pluginId: 'checklist',
    items,
    rawMatches
  }
}
