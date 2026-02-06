/** Task status values */
export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'blocked'

/** Task priority values */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export interface ChecklistItem {
  text: string
  checked: boolean
}

export interface LogEntry {
  timestamp: string
  entry: string
}

/** Core task data — the structured data inside a ```task block */
export interface TaskData {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  category?: string
  owner?: string
  activeForm?: string
  blockedBy: string[]
  blocks: string[]
  tags: string[]
  description: string
  checklist: ChecklistItem[]
  log: LogEntry[]
  notes: string
  progress: number
}

/** Status → color mapping */
export const statusColors: Record<TaskStatus, string> = {
  'todo': '#6b7280',
  'in-progress': '#3b82f6',
  'done': '#22c55e',
  'blocked': '#ef4444',
}

/** Priority → color mapping */
export const priorityColors: Record<TaskPriority, string> = {
  'low': '#6b7280',
  'medium': '#eab308',
  'high': '#f97316',
  'critical': '#ef4444',
}

/** Status display labels */
export const statusLabels: Record<TaskStatus, string> = {
  'todo': 'TODO',
  'in-progress': 'IN PROGRESS',
  'done': 'DONE',
  'blocked': 'BLOCKED',
}
