/** Task status values for kanban columns */
export type KanbanTaskStatus = 'todo' | 'in-progress' | 'done' | 'blocked'

/** Task priority values */
export type KanbanTaskPriority = 'low' | 'medium' | 'high' | 'critical'

/** Group-by options */
export type KanbanGroupBy = 'status' | 'priority'

/** A single task entry in a kanban block */
export interface KanbanTask {
  id: string
  title: string
  status: KanbanTaskStatus
  priority: KanbanTaskPriority
}

/** Parsed data from a ```kanban fenced block */
export interface KanbanData {
  title?: string
  groupBy: KanbanGroupBy
  tasks: KanbanTask[]
}

/** Status column order */
export const STATUS_COLUMN_ORDER: KanbanTaskStatus[] = ['todo', 'in-progress', 'blocked', 'done']

/** Priority column order */
export const PRIORITY_COLUMN_ORDER: KanbanTaskPriority[] = ['critical', 'high', 'medium', 'low']

/** Status display labels */
export const KANBAN_STATUS_LABELS: Record<KanbanTaskStatus, string> = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'blocked': 'Blocked',
  'done': 'Done',
}

/** Priority display labels */
export const KANBAN_PRIORITY_LABELS: Record<KanbanTaskPriority, string> = {
  'critical': 'Critical',
  'high': 'High',
  'medium': 'Medium',
  'low': 'Low',
}

/** Status accent colors */
export const KANBAN_STATUS_COLORS: Record<KanbanTaskStatus, string> = {
  'todo': '#6b7280',
  'in-progress': '#3b82f6',
  'blocked': '#ef4444',
  'done': '#22c55e',
}

/** Priority accent colors */
export const KANBAN_PRIORITY_COLORS: Record<KanbanTaskPriority, string> = {
  'critical': '#ef4444',
  'high': '#f97316',
  'medium': '#eab308',
  'low': '#6b7280',
}
