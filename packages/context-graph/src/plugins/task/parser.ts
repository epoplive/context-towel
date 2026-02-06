// ============================================================================
// Task Plugin Parser
// ============================================================================
//
// Parses ```task code blocks with YAML-like content:
//
// ```task
// title: Build Platform UI
// status: todo
// priority: high
// tags: #architecture #refactor
// blocked-by: [[other-task]]
// description: |
//   Move platform adapters to dedicated folders.
// checklist:
//   - [ ] Create types.ts
//   - [x] Create folder structure
// notes: |
//   Additional notes here
// ```

import { ParseResult, SourceMatch } from '../../types'
import { TaskItem, TaskStatus, TaskPriority, ChecklistItem, LogEntry } from './types'
import { normalizeTaskId, buildImplicitTaskId } from './idUtils'

function parseIdList(value: string): string[] {
  const ids: string[] = []
  const linkMatches = value.match(/\[\[([^\]]+)\]\]/g) || []
  if (linkMatches.length > 0) {
    for (const link of linkMatches) {
      const normalized = normalizeTaskId(link.slice(2, -2))
      if (normalized) ids.push(normalized)
    }
    return ids
  }

  const parts = value
    .split(/[,\n]/g)
    .map(part => normalizeTaskId(part))
    .filter(Boolean)

  return parts
}

function parseLabelList(value: string): string[] {
  const tags: string[] = []
  const tagMatches = value.match(/#([a-zA-Z][a-zA-Z0-9_-]*)/g) || []
  for (const tag of tagMatches) {
    tags.push(tag.slice(1))
  }

  if (tags.length > 0) return tags

  return value
    .split(/[,\n]/g)
    .map(part => part.trim())
    .filter(Boolean)
}

/**
 * Parse YAML-like content from a ```task code block
 */
function parseTaskBlock(
  content: string,
  sourceFile: string,
  startLine: number
): TaskItem {
  const lines = content.split('\n')

  // Default values
  let title = 'Untitled Task'
  let status: TaskStatus = 'todo'
  let priority: TaskPriority = 'medium'
  const blockedBy: string[] = []
  const blocks: string[] = []
  const tags: string[] = []
  const labels: string[] = []
  let category = ''
  let owner = ''
  let activeForm = ''
  let explicitId = ''
  let description = ''
  const checklist: ChecklistItem[] = []
  const log: LogEntry[] = []
  let notes = ''

  // Track which field we're currently parsing (for multiline values)
  let currentField: string | null = null
  let currentValue: string[] = []

  const saveCurrentField = () => {
    if (!currentField) return
    const value = currentValue.join('\n').trim()

    switch (currentField) {
      case 'id':
      case 'task-id':
        explicitId = normalizeTaskId(value)
        break
      case 'title':
        title = value
        break
      case 'status':
        {
          const normalized = value.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-')
          if (/^(todo|in-progress|done|blocked)$/i.test(normalized)) {
            status = normalized as TaskStatus
          }
        }
        break
      case 'priority':
        if (/^(low|medium|high|critical)$/i.test(value)) {
          priority = value.toLowerCase() as TaskPriority
        }
        break
      case 'blocked-by':
      case 'blocked_by':
      case 'depends-on':
      case 'depends_on':
        blockedBy.push(...parseIdList(value))
        break
      case 'blocks':
        blocks.push(...parseIdList(value))
        break
      case 'tags':
        tags.push(...parseLabelList(value))
        break
      case 'labels':
        labels.push(...parseLabelList(value))
        break
      case 'category':
        category = value
        break
      case 'owner':
        owner = value
        break
      case 'active-form':
      case 'active_form':
        activeForm = value
        break
      case 'description':
        description = value
        break
      case 'notes':
        notes = value
        break
      case 'checklist':
        // Parse checklist items
        const checklistLines = value.split('\n')
        for (const line of checklistLines) {
          const itemMatch = line.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/)
          if (itemMatch) {
            checklist.push({
              checked: itemMatch[1].toLowerCase() === 'x',
              text: itemMatch[2].trim()
            })
          }
        }
        break
      case 'log':
        // Parse log entries
        const logLines = value.split('\n')
        for (const line of logLines) {
          const logMatch = line.match(/^[-*]\s*\[([^\]]+)\]\s*(.+)$/)
          if (logMatch) {
            log.push({
              timestamp: logMatch[1].trim(),
              entry: logMatch[2].trim()
            })
          }
        }
        break
    }
    currentField = null
    currentValue = []
  }

  for (const line of lines) {
    // Check for new field (key: value or key: | for multiline)
    const fieldMatch = line.match(/^([a-zA-Z_-]+):\s*(.*)$/)

    if (fieldMatch && !line.startsWith('  ') && !line.startsWith('\t')) {
      // Save previous field
      saveCurrentField()

      const [, key, value] = fieldMatch
      currentField = key.toLowerCase()

      // If value is | or empty, expect multiline content
      if (value === '|' || value === '') {
        currentValue = []
      } else {
        currentValue = [value]
      }
    } else if (currentField && (line.startsWith('  ') || line.startsWith('\t') || line.trim() === '')) {
      // Continuation of multiline value
      currentValue.push(line.replace(/^  /, '').replace(/^\t/, ''))
    } else if (currentField) {
      // Unindented line continues the value (for checklist items, etc.)
      currentValue.push(line)
    }
  }

  // Save last field
  saveCurrentField()

  const normalizedTags = Array.from(new Set([...tags, ...labels]))
  const normalizedBlockedBy = Array.from(new Set(blockedBy.map(normalizeTaskId).filter(Boolean)))
  const normalizedBlocks = Array.from(new Set(blocks.map(normalizeTaskId).filter(Boolean)))

  // Calculate progress from checklist
  const progress = checklist.length > 0
    ? Math.round((checklist.filter(c => c.checked).length / checklist.length) * 100)
    : 0

  const id = explicitId
    ? normalizeTaskId(explicitId) || 'task'
    : buildImplicitTaskId(title, sourceFile)

  return {
    id,
    sourceFile,
    sourceLine: startLine,
    title,
    status,
    priority,
    category: category || undefined,
    owner: owner || undefined,
    activeForm: activeForm || undefined,
    blockedBy: normalizedBlockedBy,
    blocks: normalizedBlocks,
    tags: normalizedTags,
    labels: normalizedTags,
    description,
    checklist,
    log,
    notes,
    progress,
    rawContent: '```task\n' + content + '\n```',
    explicitId: explicitId || undefined,
  }
}

/**
 * Detect if content contains ```task code blocks
 */
export function detectTasks(content: string): boolean {
  return /```task\s*\n/m.test(content)
}

/**
 * Parse all tasks from a markdown document
 * Tasks are defined using ```task code blocks with YAML-like content
 */
export function parseTasks(content: string, sourceFile: string): ParseResult<TaskItem> {
  const items: TaskItem[] = []
  const rawMatches: SourceMatch[] = []

  // Match ```task code blocks
  const taskRegex = /```task\s*\n([\s\S]*?)```/g

  let match
  while ((match = taskRegex.exec(content)) !== null) {
    const taskContent = match[1]

    // Calculate line numbers
    const beforeMatch = content.slice(0, match.index)
    const startLine = beforeMatch.split('\n').length
    const endLine = startLine + match[0].split('\n').length - 1

    rawMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      startLine,
      endLine,
      content: match[0]
    })

    items.push(parseTaskBlock(taskContent, sourceFile, startLine))
  }

  return {
    pluginId: 'task',
    items,
    rawMatches
  }
}
