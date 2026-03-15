// ============================================================================
// TOC (Table of Contents) Parser Plugin
// ============================================================================
//
// Parses markdown headings into a hierarchical section tree.
// Extracted from context-graph's plugins/toc/parser.ts.

import type { ParseResult } from '../types'
import type { TocSection, SectionCounts } from '../types'

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

/**
 * Count checklist items in a content string.
 * Tasks come from ```task blocks (handled by the task plugin), not checkboxes.
 */
function countInContent(content: string): SectionCounts {
  const lines = content.split('\n')
  let checklists = 0
  let checklistsCompleted = 0

  for (const line of lines) {
    if (/^\s*-\s*\[\s*\]/.test(line)) {
      checklists++
    } else if (/^\s*-\s*\[x\]/i.test(line)) {
      checklists++
      checklistsCompleted++
    }
  }

  return { tasks: 0, tasksCompleted: 0, checklists, checklistsCompleted }
}

const MAX_RECURSION_DEPTH = 20

function countTasksRecursive(section: TocSection, depth = 0): SectionCounts {
  const directCounts = countInContent(section.content)

  if (depth >= MAX_RECURSION_DEPTH) return directCounts

  for (const child of section.children) {
    const childCounts = countTasksRecursive(child, depth + 1)
    directCounts.tasks += childCounts.tasks
    directCounts.tasksCompleted += childCounts.tasksCompleted
    directCounts.checklists += childCounts.checklists
    directCounts.checklistsCompleted += childCounts.checklistsCompleted
  }

  return directCounts
}

// -------------------------------------------------------------------------- //
// Public API
// -------------------------------------------------------------------------- //

export function detectToc(content: string): boolean {
  return /^#{1,6}\s+.+$/m.test(content)
}

export function parseToc(content: string, sourceFile: string): ParseResult<TocSection> {
  const lines = content.split('\n')
  const root: TocSection[] = []
  const stack: { section: TocSection; level: number }[] = []
  const rawMatches: ParseResult['rawMatches'] = []

  let currentContent: string[] = []
  let currentSection: TocSection | null = null
  let lineNumber = 0

  for (const line of lines) {
    lineNumber++
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)

    if (headingMatch) {
      if (currentSection) {
        currentSection.content = currentContent.join('\n').trim()
      }

      const level = headingMatch[1].length
      const title = headingMatch[2].trim()
      const id = slugify(title)

      const newSection: TocSection = {
        id,
        sourceFile,
        sourceLine: lineNumber,
        title,
        level,
        content: '',
        children: [],
        counts: { tasks: 0, tasksCompleted: 0, checklists: 0, checklistsCompleted: 0 },
      }

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }

      if (stack.length === 0) {
        root.push(newSection)
      } else {
        stack[stack.length - 1].section.children.push(newSection)
      }

      stack.push({ section: newSection, level })
      currentSection = newSection
      currentContent = []

      rawMatches!.push({
        start: 0,
        end: 0,
        startLine: lineNumber,
        endLine: lineNumber,
        content: line,
      })
    } else {
      currentContent.push(line)
    }
  }

  if (currentSection) {
    currentSection.content = currentContent.join('\n').trim()
  }

  const totalLines = lines.length

  const setEndLines = (sections: TocSection[], parentEndLine: number, depth = 0): void => {
    if (depth > MAX_RECURSION_DEPTH) return
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]
      const nextSibling = sections[i + 1]
      const siblingEndLine = nextSibling
        ? (nextSibling.sourceLine !== undefined ? nextSibling.sourceLine - 1 : parentEndLine)
        : parentEndLine

      section.sourceEndLine = siblingEndLine

      if (section.children.length > 0) {
        setEndLines(section.children, siblingEndLine, depth + 1)
      }
    }
  }

  setEndLines(root, totalLines)

  const calculateAllCounts = (sections: TocSection[], depth = 0): void => {
    if (depth > MAX_RECURSION_DEPTH) return
    for (const section of sections) {
      if (section.children.length > 0) {
        calculateAllCounts(section.children, depth + 1)
      }
      section.counts = countTasksRecursive(section)
    }
  }

  calculateAllCounts(root)

  return { pluginId: 'toc', items: root, rawMatches }
}

/** ParserPlugin descriptor for FileParserService registration */
export const tocParserPlugin = {
  id: 'toc',
  extensions: ['.md', '.markdown'],
  detect: detectToc,
  parse: parseToc,
}

export type { TocSection }
