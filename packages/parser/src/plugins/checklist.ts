// ============================================================================
// Checklist Parser Plugin
// ============================================================================
//
// Parses standalone checklist items (- [ ] / - [x]) from markdown,
// grouped by the nearest heading.
// Extracted from context-graph's plugins/checklist/parser.ts.

import type { ParseResult } from '../types'
import type { ChecklistGroup, ChecklistItem } from '../types'

// -------------------------------------------------------------------------- //
// Internal helpers
// -------------------------------------------------------------------------- //

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// -------------------------------------------------------------------------- //
// Public API
// -------------------------------------------------------------------------- //

/**
 * Detect if content contains standalone checklist items (not inside ## Task: blocks).
 */
export function detectChecklists(content: string): boolean {
  const withoutTasks = content.replace(/## Task:\s*.+?\n[\s\S]*?(?=\n## (?!Task:)|$)/g, '')
  return /^[-*]\s*\[[ xX]\]/m.test(withoutTasks)
}

/**
 * Parse standalone checklists grouped by the nearest heading.
 */
export function parseChecklists(content: string, sourceFile: string): ParseResult<ChecklistGroup> {
  const items: ChecklistGroup[] = []
  const rawMatches: ParseResult['rawMatches'] = []

  const withoutTasks = content.replace(/## Task:\s*.+?\n[\s\S]*?(?=\n## (?!Task:)|$)/g, '')

  const sections = withoutTasks.split(/^(#{1,3}\s+.+)$/m)

  let currentTitle = 'Checklist'
  let lineOffset = 0

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]

    const headingMatch = section.match(/^#{1,3}\s+(.+)$/)
    if (headingMatch) {
      currentTitle = headingMatch[1].trim()
      lineOffset += section.split('\n').length
      continue
    }

    const checklistItems: ChecklistItem[] = []
    const checklistRegex = /^[-*]\s*\[([ xX])\]\s*(.+)$/gm
    let match: RegExpExecArray | null

    while ((match = checklistRegex.exec(section)) !== null) {
      checklistItems.push({
        checked: match[1].toLowerCase() === 'x',
        text: match[2].trim(),
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
        progress: Math.round((checked / checklistItems.length) * 100),
      })

      rawMatches!.push({
        start: 0,
        end: 0,
        startLine,
        endLine: startLine + section.split('\n').length,
        content: section,
      })
    }

    lineOffset += section.split('\n').length
  }

  return { pluginId: 'checklist', items, rawMatches }
}

/** ParserPlugin descriptor for FileParserService registration */
export const checklistParserPlugin = {
  id: 'checklist',
  extensions: ['.md', '.markdown'],
  detect: detectChecklists,
  parse: parseChecklists,
}

export type { ChecklistGroup, ChecklistItem }
