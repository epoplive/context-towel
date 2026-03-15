// ============================================================================
// Task Parser Plugin
// ============================================================================
//
// Parses ```task / ~~~task fenced code blocks with YAML-like content.
// Extracted from context-graph's plugins/task/parser.ts.

import type { ParseResult } from '../types'
import type { TaskItem, TaskStatus, TaskPriority, ChecklistItem, LogEntry } from '../types'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { visit } from 'unist-util-visit'
import type { Code } from 'mdast'

// -------------------------------------------------------------------------- //
// ID utilities (inlined from context-graph's idUtils.ts)
// -------------------------------------------------------------------------- //

const TASK_ID_SEPARATOR = '__'

function normalizeTaskId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getTaskFilePrefix(sourceFile: string | undefined): string {
  if (!sourceFile) return ''
  const normalizedPath = sourceFile.replace(/\\/g, '/')
  const marker = '/.context/'
  const markerIndex = normalizedPath.lastIndexOf(marker)
  const stablePath = markerIndex >= 0
    ? normalizedPath.slice(markerIndex + 1)
    : normalizedPath
  const withoutExt = stablePath.replace(/\.[^/.]+$/, '')
  return normalizeTaskId(withoutExt)
}

function buildImplicitTaskId(title: string, sourceFile: string | undefined): string {
  const localId = normalizeTaskId(title) || 'task'
  const prefix = getTaskFilePrefix(sourceFile)
  return prefix ? `${prefix}${TASK_ID_SEPARATOR}${localId}` : localId
}

// -------------------------------------------------------------------------- //
// Internal helpers
// -------------------------------------------------------------------------- //

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
  return value
    .split(/[,\n]/g)
    .map(part => normalizeTaskId(part))
    .filter(Boolean)
}

function parseLabelList(value: string): string[] {
  const tagMatches = value.match(/#([a-zA-Z][a-zA-Z0-9_-]*)/g) || []
  if (tagMatches.length > 0) {
    return tagMatches.map(tag => tag.slice(1))
  }
  return value
    .split(/[,\n]/g)
    .map(part => part.trim())
    .filter(Boolean)
}

function parseTaskBlock(
  content: string,
  sourceFile: string,
  startLine: number,
): TaskItem {
  const lines = content.split('\n')

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
      case 'status': {
        const normalized = value.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-')
        if (/^(todo|in-progress|done|blocked)$/i.test(normalized)) {
          status = normalized as TaskStatus
        }
        break
      }
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
      case 'checklist': {
        const checklistLines = value.split('\n')
        for (const line of checklistLines) {
          const itemMatch = line.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/)
          if (itemMatch) {
            checklist.push({
              checked: itemMatch[1].toLowerCase() === 'x',
              text: itemMatch[2].trim(),
            })
          }
        }
        break
      }
      case 'log': {
        const logLines = value.split('\n')
        for (const line of logLines) {
          const logMatch = line.match(/^[-*]\s*\[([^\]]+)\]\s*(.+)$/)
          if (logMatch) {
            log.push({
              timestamp: logMatch[1].trim(),
              entry: logMatch[2].trim(),
            })
          }
        }
        break
      }
    }

    currentField = null
    currentValue = []
  }

  for (const line of lines) {
    const fieldMatch = line.match(/^([a-zA-Z_-]+):\s*(.*)$/)

    if (fieldMatch && !line.startsWith('  ') && !line.startsWith('\t')) {
      saveCurrentField()
      const [, key, value] = fieldMatch
      currentField = key.toLowerCase()
      if (value === '|' || value === '') {
        currentValue = []
      } else {
        currentValue = [value]
      }
    } else if (currentField && (line.startsWith('  ') || line.startsWith('\t') || line.trim() === '')) {
      currentValue.push(line.replace(/^  /, '').replace(/^\t/, ''))
    } else if (currentField) {
      currentValue.push(line)
    }
  }

  saveCurrentField()

  const normalizedTags = Array.from(new Set([...tags, ...labels]))
  const normalizedBlockedBy = Array.from(new Set(blockedBy.map(normalizeTaskId).filter(Boolean)))
  const normalizedBlocks = Array.from(new Set(blocks.map(normalizeTaskId).filter(Boolean)))

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

// -------------------------------------------------------------------------- //
// Public API
// -------------------------------------------------------------------------- //

export function detectTasks(content: string): boolean {
  return /(?:`{3,}|~{3,})\s*task\b/im.test(content)
}

export function parseTasks(content: string, sourceFile: string): ParseResult<TaskItem> {
  const items: TaskItem[] = []
  const rawMatches: ParseResult['rawMatches'] = []

  let tree: unknown
  try {
    tree = unified().use(remarkParse).parse(content)
  } catch {
    return { pluginId: 'task', items, rawMatches }
  }

  const sliceRawBlock = (node: Code): string => {
    const start = node.position?.start?.offset
    const end = node.position?.end?.offset
    if (typeof start === 'number' && typeof end === 'number') {
      return content.slice(start, end)
    }
    return '```task\n' + (node.value ?? '') + '\n```'
  }

  visit(tree as Parameters<typeof visit>[0], 'code', (node: Code) => {
    const lang = node.lang?.trim().toLowerCase()
    if (lang !== 'task') return

    const startLine = node.position?.start?.line ?? 1
    const endLine = node.position?.end?.line ?? startLine
    const raw = sliceRawBlock(node)

    const startOffset = node.position?.start?.offset
    const endOffset = node.position?.end?.offset

    rawMatches!.push({
      start: typeof startOffset === 'number' ? startOffset : 0,
      end: typeof endOffset === 'number' ? endOffset : 0,
      startLine,
      endLine,
      content: raw,
    })

    const item = parseTaskBlock(node.value ?? '', sourceFile, startLine)
    item.sourceEndLine = endLine
    item.rawContent = raw
    items.push(item)
  })

  return { pluginId: 'task', items, rawMatches }
}

/** ParserPlugin descriptor for FileParserService registration */
export const taskParserPlugin = {
  id: 'task',
  extensions: ['.md', '.markdown'],
  detect: detectTasks,
  parse: parseTasks,
}

export type { TaskItem }
