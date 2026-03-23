import { parseDocument, isAlias, visit as visitYaml } from 'yaml'
import { blockRegistry } from './registry'
import type { BlockParseError } from './types'
import type { ChecklistItem, LogEntry, TaskData, TaskPriority, TaskStatus } from '../plugins/task/types'
import type { NodeBlockData, NodeMapBlockData, NodeState, ZoomLayer } from '../plugins/node/types.js'
import type { KanbanData, KanbanGroupBy, KanbanTaskPriority, KanbanTaskStatus } from '../plugins/kanban/types.js'
import type { DepGraphData, DepGraphTaskPriority, DepGraphTaskStatus } from '../plugins/dependency-graph/types.js'
import type { TimelineData, TimelineStatus } from '../plugins/timeline/types.js'
import { parseDateMs } from '../plugins/timeline/types.js'
import { parseIndexBlock } from '../plugins/index/parser'

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

// ============================================================================
// Kanban block parsing
// ============================================================================

const VALID_KANBAN_STATUSES = new Set<string>(['todo', 'in-progress', 'done', 'blocked'])
const VALID_KANBAN_PRIORITIES = new Set<string>(['low', 'medium', 'high', 'critical'])

function parseKanbanBlockSource(
  source: string
): { data: KanbanData | null; errors: BlockParseError[] } {
  const doc = parseDocument(source)
  const yamlErrors = collectYamlErrors(doc)
  if (yamlErrors.length > 0) {
    return { data: null, errors: yamlErrors }
  }

  const raw = doc.toJS() as Record<string, unknown> | null
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { data: null, errors: [{ message: 'Kanban block must be a YAML mapping.' }] }
  }

  if (!Array.isArray(raw.tasks)) {
    return { data: null, errors: [{ message: 'Kanban block requires a "tasks" list.' }] }
  }

  const rawGroupBy = typeof raw['group-by'] === 'string' ? raw['group-by'] : 'status'
  if (rawGroupBy !== 'status' && rawGroupBy !== 'priority') {
    return {
      data: null,
      errors: [{ message: `Invalid group-by value "${rawGroupBy}". Must be "status" or "priority".` }],
    }
  }
  const groupBy = rawGroupBy as KanbanGroupBy

  const tasks = (raw.tasks as unknown[]).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return null
    }
    const t = item as Record<string, unknown>
    const id = typeof t.id === 'string' ? t.id.trim() : `task-${index}`
    const title = typeof t.title === 'string' ? t.title.trim() : id
    const rawStatus = typeof t.status === 'string' ? t.status.toLowerCase().replace(/_/g, '-') : 'todo'
    const status: KanbanTaskStatus = VALID_KANBAN_STATUSES.has(rawStatus) ? rawStatus as KanbanTaskStatus : 'todo'
    const rawPriority = typeof t.priority === 'string' ? t.priority.toLowerCase() : 'medium'
    const priority: KanbanTaskPriority = VALID_KANBAN_PRIORITIES.has(rawPriority) ? rawPriority as KanbanTaskPriority : 'medium'
    return { id, title, status, priority }
  }).filter((t): t is NonNullable<typeof t> => t !== null)

  return {
    data: {
      title: typeof raw.title === 'string' ? raw.title : undefined,
      groupBy,
      tasks,
    },
    errors: [],
  }
}

// ============================================================================
// Dependency-graph block parsing
// ============================================================================

const VALID_DEP_STATUSES = new Set<string>(['todo', 'in-progress', 'done', 'blocked'])
const VALID_DEP_PRIORITIES = new Set<string>(['low', 'medium', 'high', 'critical'])

function parseDependencyGraphBlockSource(
  source: string
): { data: DepGraphData | null; errors: BlockParseError[] } {
  const doc = parseDocument(source)
  const yamlErrors = collectYamlErrors(doc)
  if (yamlErrors.length > 0) {
    return { data: null, errors: yamlErrors }
  }

  const raw = doc.toJS() as Record<string, unknown> | null
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { data: null, errors: [{ message: 'dependency-graph block must be a YAML mapping.' }] }
  }

  if (!Array.isArray(raw.tasks)) {
    return { data: null, errors: [{ message: 'dependency-graph block requires a "tasks" list.' }] }
  }

  const tasks = (raw.tasks as unknown[]).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return null
    }
    const t = item as Record<string, unknown>

    const id = typeof t.id === 'string' ? t.id.trim() : `task-${index}`
    const title = typeof t.title === 'string' ? t.title.trim() : id
    const rawStatus = typeof t.status === 'string'
      ? t.status.toLowerCase().replace(/_/g, '-')
      : 'todo'
    const status: DepGraphTaskStatus = VALID_DEP_STATUSES.has(rawStatus)
      ? rawStatus as DepGraphTaskStatus
      : 'todo'
    const rawPriority = typeof t.priority === 'string' ? t.priority.toLowerCase() : undefined
    const priority: DepGraphTaskPriority | undefined =
      rawPriority !== undefined && VALID_DEP_PRIORITIES.has(rawPriority)
        ? rawPriority as DepGraphTaskPriority
        : undefined

    // blocked-by: accept array, comma-separated string, or omit
    let blockedBy: string[] = []
    const rawBlockedBy = t['blocked-by'] ?? t['blockedBy']
    if (Array.isArray(rawBlockedBy)) {
      blockedBy = rawBlockedBy
        .filter((v): v is string => typeof v === 'string')
        .map(v => v.trim())
        .filter(Boolean)
    } else if (typeof rawBlockedBy === 'string' && rawBlockedBy.trim() !== '') {
      blockedBy = rawBlockedBy
        .split(',')
        .map(v => v.trim())
        .filter(Boolean)
    }

    return { id, title, status, priority, blockedBy }
  }).filter((t): t is NonNullable<typeof t> => t !== null)

  return {
    data: {
      title: typeof raw.title === 'string' ? raw.title : undefined,
      tasks,
    },
    errors: [],
  }
}

// ============================================================================
// Timeline block parsing
// ============================================================================

const VALID_TIMELINE_STATUSES = new Set<string>(['done', 'in-progress', 'todo', 'blocked'])

function parseTimelineBlockSource(
  source: string
): { data: TimelineData | null; errors: BlockParseError[] } {
  const doc = parseDocument(source)
  const yamlErrors = collectYamlErrors(doc)
  if (yamlErrors.length > 0) {
    return { data: null, errors: yamlErrors }
  }

  const raw = doc.toJS() as Record<string, unknown> | null
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { data: null, errors: [{ message: 'Timeline block must be a YAML mapping.' }] }
  }

  if (!Array.isArray(raw.phases)) {
    return { data: null, errors: [{ message: 'Timeline block requires a "phases" list.' }] }
  }

  const phases = (raw.phases as unknown[]).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return null
    }
    const p = item as Record<string, unknown>

    const name = typeof p.name === 'string' ? p.name.trim() : `Phase ${index + 1}`

    // Dates: accept string or number (yaml may parse unquoted dates as Date objects or strings)
    const rawStart = p.start instanceof Date
      ? p.start.toISOString().slice(0, 10)
      : typeof p.start === 'string'
        ? p.start.trim()
        : ''
    const rawEnd = p.end instanceof Date
      ? p.end.toISOString().slice(0, 10)
      : typeof p.end === 'string'
        ? p.end.trim()
        : ''

    if (!rawStart || isNaN(parseDateMs(rawStart))) {
      return null
    }
    if (!rawEnd || isNaN(parseDateMs(rawEnd))) {
      return null
    }

    const rawStatus = typeof p.status === 'string'
      ? p.status.toLowerCase().replace(/_/g, '-')
      : 'todo'
    const status: TimelineStatus = VALID_TIMELINE_STATUSES.has(rawStatus)
      ? rawStatus as TimelineStatus
      : 'todo'

    const rawTasks = Array.isArray(p.tasks) ? p.tasks : []
    const tasks = (rawTasks as unknown[]).map((t) => {
      if (!t || typeof t !== 'object' || Array.isArray(t)) return null
      const task = t as Record<string, unknown>
      const taskTitle = typeof task.title === 'string' ? task.title.trim() : ''
      if (!taskTitle) return null
      const rawTaskStatus = typeof task.status === 'string'
        ? task.status.toLowerCase().replace(/_/g, '-')
        : 'todo'
      const taskStatus: TimelineStatus = VALID_TIMELINE_STATUSES.has(rawTaskStatus)
        ? rawTaskStatus as TimelineStatus
        : 'todo'
      return { title: taskTitle, status: taskStatus }
    }).filter((t): t is NonNullable<typeof t> => t !== null)

    return { name, start: rawStart, end: rawEnd, status, tasks }
  }).filter((p): p is NonNullable<typeof p> => p !== null)

  if (phases.length === 0) {
    return { data: null, errors: [{ message: 'Timeline block requires at least one valid phase with start and end dates.' }] }
  }

  return {
    data: {
      title: typeof raw.title === 'string' ? raw.title : undefined,
      phases,
    },
    errors: [],
  }
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

  // Kanban blocks: YAML with title, group-by, and tasks list
  if (type === 'kanban') {
    const { data, errors } = parseKanbanBlockSource(yamlSource)
    return { data, errors }
  }

  // Dependency-graph blocks: YAML with title and tasks list
  if (type === 'dependency-graph') {
    const { data, errors } = parseDependencyGraphBlockSource(yamlSource)
    return { data, errors }
  }

  // Timeline blocks: YAML with title and phases list
  if (type === 'timeline') {
    const { data, errors } = parseTimelineBlockSource(yamlSource)
    return { data, errors }
  }

  // Index blocks: CodeIndexer-style section format (not YAML)
  if (type === 'index') {
    const data = parseIndexBlock(yamlSource)
    // Validate via the block definition if available
    if (definition.validate) {
      const validationErrors = definition.validate(data)
      if (validationErrors.length > 0) {
        return { data: null, errors: validationErrors }
      }
    }
    return { data, errors: [] }
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
