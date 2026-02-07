import { TaskItem } from '../../types'
import type { TaskBoardGroupBy } from '../../../../state/slices'

const STATUS_ORDER: TaskItem['status'][] = ['todo', 'in-progress', 'blocked', 'done']
const PRIORITY_ORDER: TaskItem['priority'][] = ['critical', 'high', 'medium', 'low']

const STATUS_LABELS: Record<TaskItem['status'], string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
}

export function formatGroupLabel(groupBy: TaskBoardGroupBy, value: string): string {
  if (groupBy === 'status') {
    return STATUS_LABELS[value as TaskItem['status']] || value
  }
  if (groupBy === 'priority') {
    return value.charAt(0).toUpperCase() + value.slice(1)
  }
  return value
}

export function buildTaskBoardGroups(tasks: TaskItem[], groupBy: TaskBoardGroupBy) {
  if (groupBy === 'none') return null
  const groups = new Map<string, TaskItem[]>()
  tasks.forEach(task => {
    const key = groupBy === 'status' ? task.status : task.priority
    const bucket = groups.get(key) || []
    bucket.push(task)
    groups.set(key, bucket)
  })

  groups.forEach((items, key) => {
    items.sort((a, b) => (a.sourceLine ?? 0) - (b.sourceLine ?? 0))
    groups.set(key, items)
  })

  const orderedKeys = (groupBy === 'status' ? STATUS_ORDER : PRIORITY_ORDER)
    .filter(key => groups.has(key))
    .map(key => key as string)

  for (const key of groups.keys()) {
    if (!orderedKeys.includes(key)) {
      orderedKeys.push(key)
    }
  }

  return { groups, orderedKeys }
}

export function getTaskBoardDragUpdate(
  groupBy: TaskBoardGroupBy,
  task: TaskItem,
  nextGroupBy?: TaskBoardGroupBy,
  nextValue?: string
): { status?: TaskItem['status']; priority?: TaskItem['priority'] } | null {
  if (!nextGroupBy || !nextValue || nextGroupBy !== groupBy) return null
  if (groupBy === 'status' && task.status !== nextValue) {
    return { status: nextValue as TaskItem['status'] }
  }
  if (groupBy === 'priority' && task.priority !== nextValue) {
    return { priority: nextValue as TaskItem['priority'] }
  }
  return null
}
