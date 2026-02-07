// ============================================================================
// Task Plugin Components - barrel exports
//
// Keep this file as the public surface for task rendering. Internal implementations
// live under `./components/*` to keep modules small and maintainable.
// ============================================================================

export { buildTaskBoardGroups, getTaskBoardDragUpdate } from './components/board/taskBoardGroups'

export { InlineTaskCard } from './components/cards/InlineTaskCard'
export { DetailedTaskCard } from './components/cards/DetailedTaskCard'

export type { TaskNodeData } from './components/nodes/TaskNode'
export { TaskNode } from './components/nodes/TaskNode'

export type { FullTaskNodeData } from './components/nodes/FullTaskNode'
export { FullTaskNode } from './components/nodes/FullTaskNode'

export type { TaskListNodeData } from './components/nodes/TaskListNode'
export { TaskListNode } from './components/nodes/TaskListNode'

