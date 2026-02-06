// ============================================================================
// Document Outline Types
// ============================================================================

export interface OutlineCounts {
  tasks: number
  tasksCompleted: number
  checklists: number
  checklistsCompleted: number
}

export interface OutlineSection {
  title: string
  level: number
  sourceLine?: number  // Line number in source file for ordering
  children: OutlineSection[]
  counts?: OutlineCounts
}

export interface TaskOutlineItem {
  id: string
  title: string
  status: 'todo' | 'in-progress' | 'done' | 'blocked'
  checklistTotal: number
  checklistDone: number
  sourceLine?: number  // Line number in source file for ordering
}

export interface DocumentOutlineData {
  sections: OutlineSection[]
  tasks: TaskOutlineItem[]
  totalTasks: number
  doneTasks: number
  inProgressTasks: number
  blockedTasks: number
  totalChecklistItems: number
  doneChecklistItems: number
  contentHash: string  // Hash for cache invalidation
}
