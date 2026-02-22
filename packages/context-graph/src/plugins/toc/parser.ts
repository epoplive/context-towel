// ============================================================================
// TOC Plugin Parser
// ============================================================================

import { ParseResult, SourceMatch } from '../../types'
import { TocSection, SectionCounts } from './types'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/**
 * Count checklists in content string
 * Checkboxes (- [ ] / - [x]) are counted as checklists, not tasks
 * Tasks are only parsed from ```task blocks by the task plugin
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

  // tasks = 0 because tasks come from ```task blocks, not checkboxes
  return { tasks: 0, tasksCompleted: 0, checklists, checklistsCompleted }
}

const MAX_RECURSION_DEPTH = 20

/**
 * Recursively count tasks in a section and all its children.
 * Depth-limited to prevent stack overflow on malformed data.
 */
function countTasksRecursive(section: TocSection, depth = 0): SectionCounts {
  // Start with this section's direct content
  const directCounts = countInContent(section.content)

  if (depth >= MAX_RECURSION_DEPTH) return directCounts

  // Add counts from all children
  for (const child of section.children) {
    const childCounts = countTasksRecursive(child, depth + 1)
    directCounts.tasks += childCounts.tasks
    directCounts.tasksCompleted += childCounts.tasksCompleted
    directCounts.checklists += childCounts.checklists
    directCounts.checklistsCompleted += childCounts.checklistsCompleted
  }

  return directCounts
}

/**
 * Detect if content contains headings
 */
export function detectToc(content: string): boolean {
  return /^#{1,6}\s+.+$/m.test(content)
}

/**
 * Parse document into hierarchical sections (TOC)
 */
export function parseToc(content: string, sourceFile: string): ParseResult<TocSection> {
  const lines = content.split('\n')
  const root: TocSection[] = []
  const stack: { section: TocSection; level: number }[] = []
  const rawMatches: SourceMatch[] = []

  let currentContent: string[] = []
  let currentSection: TocSection | null = null
  let lineNumber = 0

  for (const line of lines) {
    lineNumber++
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)

    if (headingMatch) {
      // Save content to current section (counts calculated after parsing)
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
        counts: { tasks: 0, tasksCompleted: 0, checklists: 0, checklistsCompleted: 0 }
      }

      // Pop stack until we find a parent with lower level
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

      rawMatches.push({
        start: 0,
        end: 0,
        startLine: lineNumber,
        endLine: lineNumber,
        content: line
      })
    } else {
      currentContent.push(line)
    }
  }

  // Save final content
  if (currentSection) {
    currentSection.content = currentContent.join('\n').trim()
  }

  // Calculate sourceEndLine for all sections
  const totalLines = lines.length
  const setEndLines = (sections: TocSection[], parentEndLine: number, depth = 0): void => {
    if (depth > MAX_RECURSION_DEPTH) return
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]
      // End line is either the line before the next sibling, or the parent's end line
      const nextSibling = sections[i + 1]
      const siblingEndLine = nextSibling
        ? (nextSibling.sourceLine !== undefined ? nextSibling.sourceLine - 1 : parentEndLine)
        : parentEndLine

      section.sourceEndLine = siblingEndLine

      // Recursively set end lines for children
      if (section.children.length > 0) {
        setEndLines(section.children, siblingEndLine, depth + 1)
      }
    }
  }
  setEndLines(root, totalLines)

  // Calculate recursive counts for all sections (includes children)
  const calculateAllCounts = (sections: TocSection[], depth = 0): void => {
    if (depth > MAX_RECURSION_DEPTH) return
    for (const section of sections) {
      // First calculate children
      if (section.children.length > 0) {
        calculateAllCounts(section.children, depth + 1)
      }
      // Then calculate this section (includes children via recursion)
      section.counts = countTasksRecursive(section)
    }
  }
  calculateAllCounts(root)

  return {
    pluginId: 'toc',
    items: root,
    rawMatches
  }
}
