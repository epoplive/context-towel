import type { TaskItem } from '../../../types'

export type TaskLayoutNode = {
  id: string
  task: TaskItem
  x: number
  y: number
  width: number
  height: number
}

export type TaskLayoutEdge = {
  sourceId: string
  targetId: string
}

export type TaskLayoutBounds = {
  minX: number
  minY: number
  width: number
  height: number
}

