import { parseDocument, isAlias, visit as visitYaml } from 'yaml'
import { blockRegistry } from './registry'
import type { BlockParseError } from './types'
import type { ChecklistItem, LogEntry, TaskData, TaskPriority, TaskStatus } from '../plugins/task/types'

export type BlockYamlValidation = {
  data: unknown | null
  errors: BlockParseError[]
}

function normalizeTaskId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseTaskIdList(value: string): string[] {
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

function parseTaskTagList(value: string): string[] {
  const tags: string[] = []
  const tagMatches = value.match(/#([a-zA-Z][a-zA-Z0-9_-]*)/g) || []
  for (const tag of tagMatches) tags.push(tag.slice(1))
  if (tags.length > 0) return tags

  return value
    .split(/[,\n]/g)
    .map(part => part.trim())
    .filter(Boolean)
}

function parseTaskBlockSource(source: string): TaskData {
  const lines = source.split('\n')

  // Defaults
  let id = ''
  let title = 'Untitled Task'
  let status: TaskStatus = 'todo'
  let priority: TaskPriority = 'medium'
  let category: string | undefined
  let owner: string | undefined
  let activeForm: string | undefined
  let description = ''
  let notes = ''
  const blockedBy: string[] = []
  const blocks: string[] = []
  const tags: string[] = []
  const checklist: ChecklistItem[] = []
  const log: LogEntry[] = []

  let currentField: string | null = null
  let currentValue: string[] = []

  const saveCurrentField = () => {
    if (!currentField) return
    const value = currentValue.join('\n').trim()

    switch (currentField) {
      case 'id':
      case 'task-id':
        id = normalizeTaskId(value)
        break
      case 'title':
        title = value || title
        break
      case 'status': {
        const normalized = value.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-')
        if (/^(todo|in-progress|done|blocked)$/i.test(normalized)) status = normalized as TaskStatus
        break
      }
      case 'priority':
        if (/^(low|medium|high|critical)$/i.test(value)) priority = value.toLowerCase() as TaskPriority
        break
      case 'category':
        category = value || undefined
        break
      case 'owner':
        owner = value || undefined
        break
      case 'active-form':
      case 'active_form':
        activeForm = value || undefined
        break
      case 'blocked-by':
      case 'blocked_by':
      case 'depends-on':
      case 'depends_on':
        blockedBy.push(...parseTaskIdList(value))
        break
      case 'blocks':
        blocks.push(...parseTaskIdList(value))
        break
      case 'tags':
      case 'labels':
        tags.push(...parseTaskTagList(value))
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
      if (value === '|' || value === '') currentValue = []
      else currentValue = [value]
    } else if (
      currentField &&
      (line.startsWith('  ') || line.startsWith('\t') || line.trim() === '')
    ) {
      currentValue.push(line.replace(/^  /, '').replace(/^\t/, ''))
    } else if (currentField) {
      currentValue.push(line)
    }
  }

  saveCurrentField()

  const normalizedTags = Array.from(new Set(tags))
  const normalizedBlockedBy = Array.from(new Set(blockedBy.map(normalizeTaskId).filter(Boolean)))
  const normalizedBlocks = Array.from(new Set(blocks.map(normalizeTaskId).filter(Boolean)))
  const progress = checklist.length > 0
    ? Math.round((checklist.filter(c => c.checked).length / checklist.length) * 100)
    : 0

  return {
    id: id || 'task',
    title,
    status,
    priority,
    category,
    owner,
    activeForm,
    blockedBy: normalizedBlockedBy,
    blocks: normalizedBlocks,
    tags: normalizedTags,
    description,
    checklist,
    log,
    notes,
    progress,
  }
}

const collectYamlErrors = (doc: ReturnType<typeof parseDocument>): BlockParseError[] => {
  const errors: BlockParseError[] = []
  if (doc.errors && doc.errors.length > 0) {
    doc.errors.forEach(err => {
      const pos = err.linePos?.[0]
      const line = pos?.line
      const column = pos?.col
      errors.push({
        message: err.message,
        line,
        column,
      })
    })
  }
  let hasAlias = false
  if (doc.contents) {
    visitYaml(doc.contents, (_key, node) => {
      if (isAlias(node)) {
        hasAlias = true
        return visitYaml.BREAK
      }
      return undefined
    })
  }
  if (hasAlias) {
    errors.push({
      message: 'YAML anchors/aliases are not supported in block data.',
    })
  }
  return errors
}

export function validateBlockYaml(type: string, yamlSource: string): BlockYamlValidation {
  const definition = blockRegistry.get(type)
  if (!definition) {
    return {
      data: null,
      errors: [{ message: `Unknown block type: ${type}` }],
    }
  }

  // Task blocks use a YAML-like syntax with markdown checklist items that YAML parsers
  // interpret incorrectly (e.g. `- [ ] item` becomes a flow sequence). Parse them manually.
  if (type === 'task') {
    return { data: parseTaskBlockSource(yamlSource), errors: [] }
  }

  const doc = parseDocument(yamlSource)
  const errors = collectYamlErrors(doc)
  if (errors.length > 0) {
    return { data: null, errors }
  }

  const parsed = doc.toJS()
  let validationErrors: BlockParseError[] = []
  if (definition.validate) {
    validationErrors = definition.validate(parsed)
  } else if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    validationErrors = [{ message: 'Block data must be a YAML mapping (object).' }]
  }

  if (validationErrors.length > 0) {
    return { data: null, errors: validationErrors }
  }

  return { data: parsed, errors: [] }
}
