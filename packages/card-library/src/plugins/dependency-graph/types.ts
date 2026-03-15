/** Task status values (shared subset — same as task plugin) */
export type DepGraphTaskStatus = 'todo' | 'in-progress' | 'done' | 'blocked'

/** Task priority values */
export type DepGraphTaskPriority = 'low' | 'medium' | 'high' | 'critical'

/** A single task node in a dependency-graph block */
export interface DepGraphTask {
  id: string
  title: string
  status: DepGraphTaskStatus
  priority?: DepGraphTaskPriority
  /** IDs of tasks this task is blocked by (its dependencies) */
  blockedBy: string[]
}

/** Parsed data from a ```dependency-graph fenced block */
export interface DepGraphData {
  title?: string
  tasks: DepGraphTask[]
}

// ---------------------------------------------------------------------------
// Layout types — used internally by the layout engine and renderer
// ---------------------------------------------------------------------------

export type DepGraphNode = {
  id: string
  task: DepGraphTask
  /** Column index (0 = root, no deps) */
  col: number
  /** Row index within the column */
  row: number
  /** Pixel x position of the left edge */
  x: number
  /** Pixel y position of the top edge */
  y: number
  width: number
  height: number
}

export type DepGraphEdge = {
  /** Source task id (the dependency) */
  sourceId: string
  /** Target task id (the dependent) */
  targetId: string
}

export type DepGraphLayout = {
  nodes: DepGraphNode[]
  edges: DepGraphEdge[]
  nodeMap: Map<string, DepGraphNode>
  hasCycle: boolean
  totalWidth: number
  totalHeight: number
}

// ---------------------------------------------------------------------------
// Status + priority colors — match statusColors in task plugin
// ---------------------------------------------------------------------------

export const DEP_STATUS_COLORS: Record<DepGraphTaskStatus, string> = {
  'todo': '#6b7280',
  'in-progress': '#3b82f6',
  'done': '#22c55e',
  'blocked': '#ef4444',
}

export const DEP_PRIORITY_COLORS: Record<DepGraphTaskPriority, string> = {
  'low': '#6b7280',
  'medium': '#eab308',
  'high': '#f97316',
  'critical': '#ef4444',
}

export const DEP_STATUS_LABELS: Record<DepGraphTaskStatus, string> = {
  'todo': 'TODO',
  'in-progress': 'WIP',
  'done': 'DONE',
  'blocked': 'BLOCKED',
}
