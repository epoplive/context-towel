import { parseDocument, isAlias, visit as visitYaml } from 'yaml'
import { blockRegistry } from './registry'
import type { BlockParseError } from './types'
import type { ChecklistItem, LogEntry, TaskData, TaskPriority, TaskStatus } from '../plugins/task/types'
import type { NodeBlockData, NodeMapBlockData, NodeState, ZoomLayer } from '../plugins/node/types.js'

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

// --- Node / Node-Map block parsing ---
// Format: YAML header lines, then `---` separator, then opaque body.
// Only the first `---` on its own line splits header from body.

const VALID_NODE_STATES = new Set<string>(['active', 'success', 'failed'])
const VALID_ZOOM_LAYERS = new Set<string>(['continent', 'region', 'district', 'street', 'ground'])

function splitHeaderBody(source: string): { header: string; body: string } {
  const separatorIndex = source.indexOf('\n---\n')
  if (separatorIndex !== -1) {
    return {
      header: source.slice(0, separatorIndex),
      body: source.slice(separatorIndex + 5), // skip '\n---\n'
    }
  }
  // Check if source starts with --- (no header)
  if (source.startsWith('---\n')) {
    return { header: '', body: source.slice(4) }
  }
  // Check if source ends with --- (no body)
  if (source.endsWith('\n---')) {
    return { header: source.slice(0, -4), body: '' }
  }
  // Exact match: just "---"
  if (source === '---') {
    return { header: '', body: '' }
  }
  // No separator found — treat entire content as header, empty body
  return { header: source, body: '' }
}

function parseSimpleYamlHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of header.split('\n')) {
    const match = line.match(/^([a-zA-Z_-]+):\s*(.*)$/)
    if (match) {
      result[match[1].toLowerCase()] = match[2].trim()
    }
  }
  return result
}

function parseNodeBlockSource(source: string): { data: NodeBlockData | null; errors: BlockParseError[] } {
  const { header, body } = splitHeaderBody(source)
  const fields = parseSimpleYamlHeader(header)

  if (!fields.id) {
    return { data: null, errors: [{ message: 'Node block requires an id field.' }] }
  }

  const state = fields.state || 'active'
  if (!VALID_NODE_STATES.has(state)) {
    return {
      data: null,
      errors: [{ message: `Invalid node state: "${state}". Must be one of: active, success, failed.` }],
    }
  }

  if (fields.layer && !VALID_ZOOM_LAYERS.has(fields.layer)) {
    return {
      data: null,
      errors: [{ message: `Invalid zoom layer: "${fields.layer}". Must be one of: continent, region, district, street, ground.` }],
    }
  }

  return {
    data: {
      id: fields.id,
      state: state as NodeState,
      layer: fields.layer ? (fields.layer as ZoomLayer) : undefined,
      subsystem: fields.subsystem || undefined,
      maps: fields.maps || undefined,
      body,
    },
    errors: [],
  }
}

function parseNodeMapBlockSource(source: string): { data: NodeMapBlockData | null; errors: BlockParseError[] } {
  const { header, body } = splitHeaderBody(source)
  const fields = parseSimpleYamlHeader(header)

  if (!fields.id) {
    return { data: null, errors: [{ message: 'Node-map block requires an id field.' }] }
  }

  return {
    data: {
      id: fields.id,
      body,
    },
    errors: [],
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
    const parsed = parseTaskBlockSource(yamlSource)

    // If the source doesn't contain any recognized task fields, the parser
    // returns all defaults (id=task, title=Untitled Task, etc). Treat that as
    // invalid so renderers can fall back to showing the raw block as code.
    const isEmptyLike =
      parsed.id === 'task' &&
      parsed.title === 'Untitled Task' &&
      parsed.status === 'todo' &&
      parsed.priority === 'medium' &&
      !parsed.category &&
      !parsed.owner &&
      !parsed.activeForm &&
      parsed.blockedBy.length === 0 &&
      parsed.blocks.length === 0 &&
      parsed.tags.length === 0 &&
      parsed.checklist.length === 0 &&
      parsed.log.length === 0 &&
      parsed.description.trim().length === 0 &&
      parsed.notes.trim().length === 0

    if (isEmptyLike) {
      return {
        data: null,
        errors: [{ message: 'Invalid task block: no recognized fields found.' }],
      }
    }

    return { data: parsed, errors: [] }
  }

  // Node blocks: YAML header + --- separator + opaque body
  if (type === 'node') {
    const { data, errors } = parseNodeBlockSource(yamlSource)
    return { data, errors }
  }

  // Node-map blocks: id header + --- separator + symbol map body
  if (type === 'node-map') {
    const { data, errors } = parseNodeMapBlockSource(yamlSource)
    return { data, errors }
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
