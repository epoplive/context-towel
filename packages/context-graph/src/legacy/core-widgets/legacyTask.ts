import type { WidgetSpec } from './types'

type LegacyChecklistItem = { checked: boolean; text: string }

export type LegacyTaskBlock = {
  title: string
  status: string
  priority: string
  description: string
  notes: string
  blockedBy: string[]
  tags: string[]
  checklist: LegacyChecklistItem[]
}

type TaskSegment =
  | { type: 'markdown'; content: string }
  | { type: 'task'; content: string }

const TASK_BLOCK_REGEX = /```task\s*\n([\s\S]*?)```/g

const normalizeText = (value: string): string => value.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ')

const splitParagraphs = (value: string): string[] =>
  value
    .split(/\n{2,}/g)
    .map((chunk) => normalizeText(chunk))
    .filter(Boolean)

export const parseLegacyTaskBlock = (text: string): LegacyTaskBlock => {
  const taskData: Record<string, string> = {}
  const lines = text.split('\n')
  let currentField: string | null = null
  let currentValue: string[] = []

  const saveField = () => {
    if (currentField) {
      const value = currentValue.join('\n').trim()
      taskData[currentField] = value
    }
    currentField = null
    currentValue = []
  }

  for (const line of lines) {
    const fieldMatch = line.match(/^([a-zA-Z_-]+):\s*(.*)$/)
    if (fieldMatch && !line.startsWith('  ') && !line.startsWith('\t')) {
      saveField()
      currentField = fieldMatch[1].toLowerCase()
      const value = fieldMatch[2]
      if (value && value !== '|') {
        currentValue = [value]
      }
    } else if (currentField) {
      currentValue.push(line.replace(/^  /, '').replace(/^\t/, ''))
    }
  }
  saveField()

  const checklistItems: LegacyChecklistItem[] = []
  const checklistStr = taskData.checklist || ''
  const checklistLines = checklistStr.split('\n')
  for (const line of checklistLines) {
    const itemMatch = line.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/)
    if (itemMatch) {
      checklistItems.push({
        checked: itemMatch[1].toLowerCase() === 'x',
        text: itemMatch[2].trim(),
      })
    }
  }

  const tagsStr = taskData.tags || ''
  const tags = tagsStr.match(/#([a-zA-Z][a-zA-Z0-9_-]*)/g) || []

  const blockedBy = (taskData['blocked-by'] || '')
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean)

  return {
    title: taskData.title || 'Untitled Task',
    status: (taskData.status || 'todo').toLowerCase(),
    priority: (taskData.priority || 'medium').toLowerCase(),
    description: taskData.description || '',
    notes: taskData.notes || '',
    blockedBy,
    tags,
    checklist: checklistItems,
  }
}

const buildField = (label: string, value: string): WidgetSpec | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  return {
    type: 'field',
    props: { label },
    children: [{ type: 'text', text: trimmed }],
  }
}

const buildChecklist = (items: LegacyChecklistItem[]): WidgetSpec | null => {
  if (items.length === 0) return null
  return {
    type: 'list',
    children: items.map((item) => ({
      type: 'item',
      children: [{ type: 'text', text: `${item.checked ? '[x]' : '[ ]'} ${item.text}` }],
    })),
  }
}

const buildTextBlocks = (value: string): WidgetSpec[] =>
  splitParagraphs(value).map((paragraph) => ({ type: 'text', text: paragraph }))

export const taskBlockToWidgetSpec = (task: LegacyTaskBlock): WidgetSpec => {
  const children: WidgetSpec[] = []
  const statusField = buildField('Status', task.status)
  const priorityField = buildField('Priority', task.priority)
  const tagsField = buildField('Tags', task.tags.join(' '))
  const blockedField = buildField('Blocked By', task.blockedBy.join(' '))

  if (statusField) children.push(statusField)
  if (priorityField) children.push(priorityField)
  if (tagsField) children.push(tagsField)
  if (blockedField) children.push(blockedField)

  children.push(...buildTextBlocks(task.description))
  const checklist = buildChecklist(task.checklist)
  if (checklist) children.push(checklist)
  children.push(...buildTextBlocks(task.notes))

  return {
    type: 'card',
    props: { title: task.title },
    children: children.filter(Boolean),
  }
}

export const splitLegacyTaskBlocks = (content: string): TaskSegment[] => {
  const segments: TaskSegment[] = []
  TASK_BLOCK_REGEX.lastIndex = 0
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = TASK_BLOCK_REGEX.exec(content)) !== null) {
    const [raw, taskBody] = match
    if (match.index > cursor) {
      const before = content.slice(cursor, match.index)
      if (before.trim().length > 0) {
        segments.push({ type: 'markdown', content: before })
      }
    }
    segments.push({ type: 'task', content: taskBody })
    cursor = match.index + raw.length
  }

  const tail = content.slice(cursor)
  if (tail.trim().length > 0) {
    segments.push({ type: 'markdown', content: tail })
  }

  return segments
}

export const parseLegacyTaskBlocks = (content: string): LegacyTaskBlock[] => {
  return splitLegacyTaskBlocks(content)
    .filter((segment) => segment.type === 'task')
    .map((segment) => parseLegacyTaskBlock(segment.content))
}

export const buildLegacyTaskWidgets = (content: string): WidgetSpec[] => {
  return parseLegacyTaskBlocks(content).map(taskBlockToWidgetSpec)
}

export const hasLegacyTaskBlocks = (content: string): boolean => /```task\s*\n([\s\S]*?)```/g.test(content)
