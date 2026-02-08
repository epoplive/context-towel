import * as dagre from 'dagre'

import { buildTaskIndex, resolveTaskRefList } from '../../../idUtils'
import type { TaskItem } from '../../../types'

import type { TaskLayoutBounds, TaskLayoutEdge, TaskLayoutNode } from './types'

export type TaskDependencyLayout = {
  nodes: TaskLayoutNode[]
  edges: TaskLayoutEdge[]
  hasCycle: boolean
  bounds: TaskLayoutBounds
  nodeMap: Map<string, TaskLayoutNode>
}

export function computeTaskDependencyLayout(tasks: TaskItem[], cardWidth: number): TaskDependencyLayout {
  const taskIndex = buildTaskIndex(tasks)
  const nodeIdsByTaskId = new Map<string, string[]>()
  const edges: TaskLayoutEdge[] = []

  const normalizedDeps = new Map<string, string[]>()
  let hasCycle = false

  tasks.forEach(task => {
    const deps = resolveTaskRefList(task.blockedBy ?? [], task, taskIndex)
    normalizedDeps.set(task.id, deps)
  })

  tasks.forEach(task => {
    const nodeId = `${task.id}:${task.sourceLine ?? 0}`
    const list = nodeIdsByTaskId.get(task.id) || []
    list.push(nodeId)
    nodeIdsByTaskId.set(task.id, list)
  })

  tasks.forEach(task => {
    const deps = normalizedDeps.get(task.id) || []
    deps.forEach(depId => {
      const sourceIds = nodeIdsByTaskId.get(depId) || []
      const targetIds = nodeIdsByTaskId.get(task.id) || []
      sourceIds.forEach(sourceId => {
        targetIds.forEach(targetId => {
          edges.push({ sourceId, targetId })
        })
      })
    })
  })

  const NODE_WIDTH = Math.round(cardWidth)
  const estimateNodeHeight = (task: TaskItem): number => {
    const paddingY = 12
    const headerHeight = 12
    const gap = 3
    const lineHeight = 12
    const charsPerLine = Math.max(16, Math.floor((NODE_WIDTH - 24) / 6))
    const lines = Math.min(2, Math.max(1, Math.ceil(task.title.length / charsPerLine)))
    const height = paddingY + headerHeight + gap + (lines * lineHeight)
    return Math.max(40, height)
  }

  const graph = new dagre.graphlib.Graph({ multigraph: true })
  graph.setGraph({
    rankdir: 'TB',
    nodesep: 26,
    ranksep: 36,
    marginx: 16,
    marginy: 16,
  })
  graph.setDefaultEdgeLabel(() => ({}))

  const nodeTaskMap = new Map<string, TaskItem>()
  const nodeHeights = new Map<string, number>()
  tasks.forEach(task => {
    const nodeId = `${task.id}:${task.sourceLine ?? 0}`
    nodeTaskMap.set(nodeId, task)
    const nodeHeight = estimateNodeHeight(task)
    nodeHeights.set(nodeId, nodeHeight)
    graph.setNode(nodeId, { width: NODE_WIDTH, height: nodeHeight })
  })

  edges.forEach(edge => {
    graph.setEdge(edge.sourceId, edge.targetId)
  })

  dagre.layout(graph)

  const nodes: TaskLayoutNode[] = []
  const nodeMap = new Map<string, TaskLayoutNode>()
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = 0
  let maxY = 0

  graph.nodes().forEach(nodeId => {
    const layout = graph.node(nodeId) as { x: number; y: number; width: number; height: number }
    const task = nodeTaskMap.get(nodeId)
    if (!task) return
    const nodeHeight = nodeHeights.get(nodeId) ?? 52
    const node: TaskLayoutNode = {
      id: nodeId,
      task,
      x: layout.x - layout.width / 2,
      y: layout.y - layout.height / 2,
      width: layout.width,
      height: nodeHeight,
    }
    nodes.push(node)
    nodeMap.set(nodeId, node)
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.height)
  })

  const padding = 12
  const bounds: TaskLayoutBounds = {
    minX: Number.isFinite(minX) ? minX - padding : 0,
    minY: Number.isFinite(minY) ? minY - padding : 0,
    width: Number.isFinite(maxX) ? maxX - minX + padding * 2 : 240,
    height: Number.isFinite(maxY) ? maxY - minY + padding * 2 : 180,
  }

  return { nodes, edges, hasCycle, bounds, nodeMap }
}

