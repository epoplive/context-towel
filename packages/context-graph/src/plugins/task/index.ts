// ============================================================================
// Task Plugin - Parses ## Task: blocks from markdown
// ============================================================================

import { ParserPlugin, ContextOptions, RenderContext } from '../types'
import { TaskItem } from './types'
import { detectTasks, parseTasks } from './parser'
import { TaskNode, TaskListNode, InlineTaskCard } from './components'

// Re-export types
export * from './types'
export { parseTasks, detectTasks } from './parser'
// Re-export components directly from components.tsx
export { InlineTaskCard, DetailedTaskCard, TaskNode, FullTaskNode, TaskListNode } from './components'
export type { TaskNodeData, FullTaskNodeData, TaskListNodeData } from './components'

/**
 * Task plugin definition
 */
export const taskPlugin: ParserPlugin<TaskItem> = {
  id: 'task',
  name: 'Task List',
  version: '1.0.0',
  priority: 100,  // Parse early - tasks are primary content

  detect: detectTasks,
  parse: parseTasks,

  supportedContexts: ['graph-node', 'panel', 'popover', 'card'],
  nodeType: 'tasklist',

  getComponent: (context: RenderContext) => {
    switch (context) {
      case 'graph-node':
        return TaskListNode as any
      case 'card':
        return TaskNode as any
      case 'inline':
        return InlineTaskCard as any
      default:
        return null
    }
  },

  toContextMarkdown: (items: TaskItem[], options?: ContextOptions) => {
    if (items.length === 0) return ''

    const lines: string[] = ['### Tasks']

    // Group by status for better readability
    const byStatus = {
      'in-progress': items.filter(t => t.status === 'in-progress'),
      'todo': items.filter(t => t.status === 'todo'),
      'blocked': items.filter(t => t.status === 'blocked'),
      'done': items.filter(t => t.status === 'done'),
    }

    // Show in-progress first, then todo, blocked, done
    for (const [_status, tasks] of Object.entries(byStatus)) {
      if (tasks.length === 0) continue

      // Limit items if specified
      const toShow = options?.maxItems
        ? tasks.slice(0, options.maxItems)
        : tasks

      for (const task of toShow) {
        const check = task.status === 'done' ? '[x]' : '[ ]'
        const statusBadge = task.status !== 'done' ? ` (${task.status})` : ''
        const progress = task.progress > 0 ? ` ${task.progress}%` : ''

        lines.push(`- ${check} **${task.title}**${statusBadge}${progress}`)

        // Include checklist items in full format
        if (options?.format === 'full' && task.checklist.length > 0) {
          for (const item of task.checklist) {
            const itemCheck = item.checked ? '[x]' : '[ ]'
            lines.push(`  - ${itemCheck} ${item.text}`)
          }
        }

        // Include source reference if requested
        if (options?.includeSource && task.sourceLine) {
          lines.push(`  *Source: ${task.sourceFile}:${task.sourceLine}*`)
        }

        // Include recent log entries
        if (options?.format === 'full' && task.log.length > 0) {
          const recentLogs = task.log.slice(-3)  // Last 3 entries
          for (const entry of recentLogs) {
            lines.push(`  - [${entry.timestamp}] ${entry.entry}`)
          }
        }
      }
    }

    return lines.join('\n')
  }
}
