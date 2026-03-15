import type { DepGraphData, DepGraphEdge, DepGraphLayout, DepGraphNode, DepGraphTask } from './types'

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const NODE_WIDTH = 180
const NODE_HEIGHT = 56
const COL_GAP = 60  // horizontal gap between columns
const ROW_GAP = 16  // vertical gap between nodes in the same column
const PADDING = 16  // canvas padding

// ---------------------------------------------------------------------------
// Cycle detection via DFS
// ---------------------------------------------------------------------------

/** Returns true if the graph has any cycle. */
export function hasCycleInGraph(tasks: DepGraphTask[]): boolean {
  const taskIds = new Set(tasks.map(t => t.id))
  // Build adjacency: id -> blockedBy ids (only those that exist)
  const deps = new Map<string, string[]>()
  for (const task of tasks) {
    deps.set(task.id, task.blockedBy.filter(id => taskIds.has(id)))
  }

  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  for (const id of taskIds) color.set(id, WHITE)

  function dfs(id: string): boolean {
    color.set(id, GRAY)
    for (const depId of deps.get(id) ?? []) {
      const c = color.get(depId)
      if (c === GRAY) return true  // back-edge → cycle
      if (c === WHITE && dfs(depId)) return true
    }
    color.set(id, BLACK)
    return false
  }

  for (const id of taskIds) {
    if (color.get(id) === WHITE && dfs(id)) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Topological column assignment
// ---------------------------------------------------------------------------

/**
 * Assign each task a column depth:
 *   - tasks with no (known) dependencies → col 0
 *   - tasks whose deps are all in col N → col N+1
 *
 * If a cycle exists, we fall back to treating the cycle members as having
 * depth 0 so the graph still renders.
 */
function assignColumns(tasks: DepGraphTask[]): Map<string, number> {
  const taskIds = new Set(tasks.map(t => t.id))
  const colMap = new Map<string, number>()

  // Only track deps that actually exist in this task set
  const deps = new Map<string, string[]>()
  for (const task of tasks) {
    deps.set(task.id, task.blockedBy.filter(id => taskIds.has(id)))
  }

  const queue: string[] = []
  const inDegree = new Map<string, number>()

  // Kahn's algorithm prep
  for (const task of tasks) {
    inDegree.set(task.id, deps.get(task.id)!.length)
    if (deps.get(task.id)!.length === 0) queue.push(task.id)
  }

  // Build reverse adjacency: dependency -> list of tasks that depend on it
  const dependents = new Map<string, string[]>()
  for (const task of tasks) {
    dependents.set(task.id, [])
  }
  for (const task of tasks) {
    for (const depId of deps.get(task.id)!) {
      dependents.get(depId)!.push(task.id)
    }
  }

  // Process in topological order
  let i = 0
  while (i < queue.length) {
    const id = queue[i++]
    const myDeps = deps.get(id)!
    const col = myDeps.length === 0
      ? 0
      : Math.max(...myDeps.map(d => (colMap.get(d) ?? 0))) + 1
    colMap.set(id, col)

    for (const depId of dependents.get(id)!) {
      const remaining = (inDegree.get(depId) ?? 0) - 1
      inDegree.set(depId, remaining)
      if (remaining === 0) queue.push(depId)
    }
  }

  // Fallback for cycle members — assign col 0 so they still appear
  for (const task of tasks) {
    if (!colMap.has(task.id)) colMap.set(task.id, 0)
  }

  return colMap
}

// ---------------------------------------------------------------------------
// Main layout function
// ---------------------------------------------------------------------------

export function computeDepGraphLayout(data: DepGraphData): DepGraphLayout {
  const { tasks } = data
  if (tasks.length === 0) {
    return { nodes: [], edges: [], nodeMap: new Map(), hasCycle: false, totalWidth: 0, totalHeight: 0 }
  }

  const hasCycle = hasCycleInGraph(tasks)
  const colMap = assignColumns(tasks)

  // Group by column
  const byCol = new Map<number, DepGraphTask[]>()
  for (const task of tasks) {
    const col = colMap.get(task.id) ?? 0
    const list = byCol.get(col) ?? []
    list.push(task)
    byCol.set(col, list)
  }

  const colCount = Math.max(...Array.from(byCol.keys())) + 1

  // Build nodes with pixel positions
  const nodes: DepGraphNode[] = []
  const nodeMap = new Map<string, DepGraphNode>()

  for (let col = 0; col < colCount; col++) {
    const colTasks = byCol.get(col) ?? []
    const x = PADDING + col * (NODE_WIDTH + COL_GAP)

    for (let row = 0; row < colTasks.length; row++) {
      const task = colTasks[row]
      const y = PADDING + row * (NODE_HEIGHT + ROW_GAP)
      const node: DepGraphNode = {
        id: task.id,
        task,
        col,
        row,
        x,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      }
      nodes.push(node)
      nodeMap.set(task.id, node)
    }
  }

  // Vertically center each column relative to the tallest column
  const maxRows = Math.max(...Array.from(byCol.values()).map(t => t.length))
  const maxColHeight = maxRows * (NODE_HEIGHT + ROW_GAP) - ROW_GAP
  for (const node of nodes) {
    const colTasks = byCol.get(node.col) ?? []
    const colHeight = colTasks.length * (NODE_HEIGHT + ROW_GAP) - ROW_GAP
    const offset = Math.floor((maxColHeight - colHeight) / 2)
    node.y = PADDING + offset + node.row * (NODE_HEIGHT + ROW_GAP)
  }

  // Build edges: for each task, for each known dep → edge from dep → task
  const taskIds = new Set(tasks.map(t => t.id))
  const edges: DepGraphEdge[] = []
  for (const task of tasks) {
    for (const depId of task.blockedBy) {
      if (taskIds.has(depId)) {
        edges.push({ sourceId: depId, targetId: task.id })
      }
    }
  }

  const totalWidth = PADDING + colCount * (NODE_WIDTH + COL_GAP) - COL_GAP + PADDING
  const totalHeight = PADDING + maxColHeight + PADDING

  return { nodes, edges, nodeMap, hasCycle, totalWidth, totalHeight }
}

// ---------------------------------------------------------------------------
// Dependency chain detection (for click-highlight)
// ---------------------------------------------------------------------------

/**
 * Returns the set of task IDs that are in the dependency chain of `taskId`
 * (all ancestors + all descendants).
 */
export function getDependencyChain(taskId: string, tasks: DepGraphTask[]): Set<string> {
  const taskIds = new Set(tasks.map(t => t.id))
  const deps = new Map<string, string[]>()
  const dependents = new Map<string, string[]>()
  for (const task of tasks) {
    deps.set(task.id, task.blockedBy.filter(id => taskIds.has(id)))
    dependents.set(task.id, [])
  }
  for (const task of tasks) {
    for (const depId of deps.get(task.id)!) {
      dependents.get(depId)!.push(task.id)
    }
  }

  const result = new Set<string>([taskId])

  // Walk ancestors (tasks this depends on)
  const ancestorQueue = [...(deps.get(taskId) ?? [])]
  while (ancestorQueue.length > 0) {
    const id = ancestorQueue.pop()!
    if (!result.has(id)) {
      result.add(id)
      ancestorQueue.push(...(deps.get(id) ?? []))
    }
  }

  // Walk descendants (tasks that depend on this)
  const descendantQueue = [...(dependents.get(taskId) ?? [])]
  while (descendantQueue.length > 0) {
    const id = descendantQueue.pop()!
    if (!result.has(id)) {
      result.add(id)
      descendantQueue.push(...(dependents.get(id) ?? []))
    }
  }

  return result
}
