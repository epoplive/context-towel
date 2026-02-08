import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { TaskCard } from './TaskCard'
import type { TaskData } from './types'

export type { TaskData, TaskStatus, TaskPriority, ChecklistItem, LogEntry } from './types'
export { statusColors, priorityColors, statusLabels } from './types'
export { TaskCard } from './TaskCard'

/** Task block definition for the card library registry */
export const taskBlockDefinition: BlockDefinition<TaskData> = {
  type: 'task',
  name: 'Task',
  schemaVersion: 1,
  components: {
    inline: TaskCard,
    card: TaskCard,
  },
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
