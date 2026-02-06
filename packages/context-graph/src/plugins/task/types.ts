// ============================================================================
// Task Plugin Types
// ============================================================================

import { ExtractedItem } from '../../types'

export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'blocked'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export interface ChecklistItem {
  text: string
  checked: boolean
}

export interface LogEntry {
  timestamp: string
  entry: string
}

export interface TaskItem extends ExtractedItem {
  title: string
  status: TaskStatus
  priority: TaskPriority
  category?: string
  owner?: string
  activeForm?: string
  blockedBy: string[]           // Task IDs this task is blocked by
  blocks: string[]              // Task IDs this task blocks
  tags: string[]
  labels: string[]
  description: string           // Markdown content
  checklist: ChecklistItem[]
  log: LogEntry[]               // Work log entries
  notes: string                 // Markdown content
  progress: number              // 0-100, calculated from checklist
  rawContent: string            // Original markdown for this task block
  explicitId?: string           // Set when id: is explicitly provided
}

// Color helpers
export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case 'todo': return '#888'
    case 'in-progress': return '#3b82f6'
    case 'done': return '#22c55e'
    case 'blocked': return '#ef4444'
  }
}

export function getPriorityColor(priority: TaskPriority): string {
  switch (priority) {
    case 'low': return '#888'
    case 'medium': return '#f59e0b'
    case 'high': return '#f97316'
    case 'critical': return '#ef4444'
  }
}
