import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition, BlockUpdate, BlockParseError } from '../../blocks/types'
import { TaskCard } from './TaskCard'
import type { TaskData, ChecklistItem } from './types'

export type { TaskData, TaskStatus, TaskPriority, ChecklistItem, LogEntry } from './types'
export { statusColors, priorityColors, statusLabels } from './types'
export { TaskCard } from './TaskCard'

/** Serialize TaskData back into the task block's native format.
 *  This preserves the markdown checklist syntax (- [x] / - [ ]) that
 *  standard YAML can't represent. */
function serializeTaskData(data: TaskData): string {
  const lines: string[] = []

  if (data.id) lines.push(`id: ${data.id}`)
  lines.push(`title: ${data.title}`)
  lines.push(`status: ${data.status}`)
  lines.push(`priority: ${data.priority}`)
  if (data.owner) lines.push(`owner: ${data.owner}`)
  if (data.category) lines.push(`category: ${data.category}`)
  if (data.activeForm) lines.push(`active-form: ${data.activeForm}`)
  if (data.tags.length > 0) lines.push(`tags: ${data.tags.join(', ')}`)
  if (data.blockedBy.length > 0) lines.push(`blocked-by: ${data.blockedBy.join(', ')}`)
  if (data.blocks.length > 0) lines.push(`blocks: ${data.blocks.join(', ')}`)
  if (data.dueDate) lines.push(`due-date: ${data.dueDate}`)
  if (data.estimatedEffort) lines.push(`estimated-effort: ${data.estimatedEffort}`)

  if (data.description) {
    lines.push(`description: |`)
    for (const line of data.description.split('\n')) {
      lines.push(`  ${line}`)
    }
  }

  if (data.checklist.length > 0) {
    lines.push(`checklist:`)
    for (const item of data.checklist) {
      const mark = item.checked ? 'x' : ' '
      lines.push(`  - [${mark}] ${item.text}`)
    }
  }

  if (data.notes) {
    lines.push(`notes: |`)
    for (const line of data.notes.split('\n')) {
      lines.push(`  ${line}`)
    }
  }

  if (data.log.length > 0) {
    lines.push(`log:`)
    for (const entry of data.log) {
      lines.push(`  - [${entry.timestamp}] ${entry.entry}`)
    }
  }

  return lines.join('\n')
}

/** Apply updates to TaskData and serialize back to native format */
function applyTaskUpdate(data: TaskData, updates: BlockUpdate[]): { content: string; errors: BlockParseError[] } {
  // Deep clone to avoid mutating the original
  const updated = JSON.parse(JSON.stringify(data)) as TaskData

  for (const update of updates) {
    let target: any = updated
    const path = update.path
    for (let i = 0; i < path.length - 1; i++) {
      target = target[path[i]]
      if (target === undefined || target === null) break
    }
    if (target !== undefined && target !== null) {
      target[path[path.length - 1]] = update.value
    }
  }

  return { content: serializeTaskData(updated), errors: [] }
}

/** Task block definition for the card library registry */
export const taskBlockDefinition: BlockDefinition<TaskData> = {
  type: 'task',
  name: 'Task',
  schemaVersion: 1,
  components: {
    inline: TaskCard,
    card: TaskCard,
  },
  applyUpdate: applyTaskUpdate,
  toContextMarkdown(blocks) {
    const tasks = blocks
      .filter((b) => b.data !== null)
      .map((b) => b.data!)

    if (tasks.length === 0) return ''

    const byStatus = new Map<string, TaskData[]>()
    for (const task of tasks) {
      const list = byStatus.get(task.status) || []
      list.push(task)
      byStatus.set(task.status, list)
    }

    const lines: string[] = ['### Tasks']
    const statusOrder = ['in-progress', 'blocked', 'todo', 'done']

    for (const status of statusOrder) {
      const group = byStatus.get(status)
      if (!group) continue

      for (const task of group) {
        const check = task.status === 'done' ? 'x' : ' '
        const pctStr = task.checklist.length > 0 ? ` ${task.progress}%` : ''
        lines.push(`- [${check}] **${task.title}** (${task.status})${pctStr}`)
      }
    }

    return lines.join('\n')
  },
}

/** Register the task block plugin in the card library registry */
export function registerTaskBlock(): void {
  // Always attempt to register. Core blocks may have already seeded a stub
  // definition for this type; plugins must be able to override it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockRegistry.registerOrReplace(taskBlockDefinition as any)
}
