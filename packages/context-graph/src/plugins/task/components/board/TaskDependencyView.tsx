import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { Position, getSmoothStepPath } from '@xyflow/react'
import * as dagre from 'dagre'
import { ButtonGroup, ButtonGroupItem } from '../../../../compat/design-system'
import { layoutPrimitives } from '../../../../compat/layoutPrimitives'
import { buildTaskIndex, resolveTaskRefList } from '../../idUtils'
import { TaskItem, getPriorityColor, getStatusColor } from '../../types'
import { useTaskColors } from '../useTaskColors'

type TaskLayoutNode = {
  id: string
  task: TaskItem
  x: number
  y: number
  width: number
  height: number
}

const TaskDependencyCard = ({
  task,
  width,
  height,
}: {
  task: TaskItem
  width: number
  height: number
}) => {
  const COLORS = useTaskColors()
  const statusColor = getStatusColor(task.status)
  const priorityColor = getPriorityColor(task.priority)
  const fontScale = 1
  const titleSize = Math.round(10 * fontScale)
  const metaSize = Math.round(8 * fontScale)
  const paddingX = Math.round(8 * fontScale)
  const paddingY = Math.round(6 * fontScale)

  return (
    <div
      data-task-dep-card
      style={{
        width,
        height,
        background: COLORS.bgDark,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${statusColor}`,
        borderRadius: '4px',
        padding: `${paddingY}px ${paddingX}px`,
        ...layoutPrimitives.column,
        gap: `${Math.max(2, Math.round(3 * fontScale))}px`,
        userSelect: 'text',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          ...layoutPrimitives.row,
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span
          style={{
            background: statusColor,
            color: task.status === 'done' ? COLORS.textInverse : COLORS.bgDark,
            padding: '1px 5px',
            borderRadius: '3px',
            fontSize: `${metaSize}px`,
            fontWeight: 700,
            textTransform: 'uppercase',
            lineHeight: 1.2,
          }}
        >
          {task.status === 'in-progress' ? 'WIP' : task.status}
        </span>
        <span
          style={{
            width: `${Math.max(6, Math.round(6 * fontScale))}px`,
            height: `${Math.max(6, Math.round(6 * fontScale))}px`,
            borderRadius: '50%',
            background: priorityColor,
          }}
        />
        <span style={{ flex: 1 }} />
        <span
          title={task.id}
          style={{
            color: COLORS.textMuted,
            fontSize: `${Math.round(7 * fontScale)}px`,
            maxWidth: '60%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          #{task.id}
        </span>
      </div>
      <div
        style={{
          color: COLORS.text,
          fontWeight: 600,
          fontSize: `${titleSize}px`,
          lineHeight: 1.25,
          maxHeight: `${Math.round(titleSize * 2.6)}px`,
          overflow: 'hidden',
        }}
      >
        {task.title}
      </div>
    </div>
  )
}

export const TaskDependencyView = ({
  tasks,
  height,
  onHeightChange,
  cardWidth,
  onCardWidthChange,
  scrollX,
  scrollY,
  onScrollChange,
  width,
  onWidthChange,
}: {
  tasks: TaskItem[]
  height: number
  onHeightChange: (nextHeight: number) => void
  cardWidth: number
  onCardWidthChange: (nextWidth: number) => void
  scrollX: number
  scrollY: number
  onScrollChange: (nextX: number, nextY: number) => void
  width: number
  onWidthChange: (nextWidth: number) => void
}) => {
  const COLORS = useTaskColors()
  const markerId = useId()
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const panState = useRef({
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  })
  const resizeState = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startHeight: 0,
    startWidth: 0,
  })
  const scrollRaf = useRef<number | null>(null)
  const lastScroll = useRef({ x: scrollX, y: scrollY })

  const { nodes, edges, hasCycle, bounds, nodeMap } = useMemo(() => {
    const taskIndex = buildTaskIndex(tasks)
    const nodeIdsByTaskId = new Map<string, string[]>()
    const edges: Array<{ sourceId: string; targetId: string }> = []

    const normalizedDeps = new Map<string, string[]>()
    const levelCache = new Map<string, number>()
    const visiting = new Set<string>()
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

    const computeLevel = (taskId: string): number => {
      if (levelCache.has(taskId)) return levelCache.get(taskId) as number
      if (visiting.has(taskId)) {
        hasCycle = true
        return 0
      }
      visiting.add(taskId)
      const deps = normalizedDeps.get(taskId) || []
      const level = deps.length === 0 ? 0 : Math.max(...deps.map(dep => computeLevel(dep))) + 1
      visiting.delete(taskId)
      levelCache.set(taskId, level)
      return level
    }

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
    const bounds = {
      minX: Number.isFinite(minX) ? minX - padding : 0,
      minY: Number.isFinite(minY) ? minY - padding : 0,
      width: Number.isFinite(maxX) ? maxX - minX + padding * 2 : 240,
      height: Number.isFinite(maxY) ? maxY - minY + padding * 2 : 180,
    }

    return { nodes, edges, hasCycle, bounds, nodeMap }
  }, [cardWidth, tasks])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (resizeState.current.active) {
        const deltaX = event.clientX - resizeState.current.startX
        const delta = event.clientY - resizeState.current.startY
        const nextHeight = Math.max(220, Math.min(720, resizeState.current.startHeight + delta))
        onHeightChange(nextHeight)
        const nextWidth = Math.max(260, Math.min(1400, resizeState.current.startWidth + deltaX))
        onWidthChange(nextWidth)
        return
      }
      if (!panState.current.active) return
      const viewport = viewportRef.current
      if (!viewport) return
      viewport.scrollLeft = panState.current.scrollLeft - (event.clientX - panState.current.startX)
      viewport.scrollTop = panState.current.scrollTop - (event.clientY - panState.current.startY)
    }

    const handleMouseUp = () => {
      if (resizeState.current.active) {
        resizeState.current.active = false
        document.body.style.userSelect = ''
      }
      if (panState.current.active) {
        panState.current.active = false
        const viewport = viewportRef.current
        if (viewport) viewport.style.cursor = 'grab'
        document.body.style.userSelect = ''
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onHeightChange, onScrollChange])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    lastScroll.current = { x: scrollX, y: scrollY }
    const maxX = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    const maxY = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    const nextX = Math.min(maxX, Math.max(0, scrollX))
    const nextY = Math.min(maxY, Math.max(0, scrollY))
    if (Math.abs(viewport.scrollLeft - nextX) > 1 || Math.abs(viewport.scrollTop - nextY) > 1) {
      viewport.scrollLeft = nextX
      viewport.scrollTop = nextY
    }
  }, [bounds.height, bounds.width, cardWidth, height, scrollX, scrollY])

  const handleScroll = useCallback(() => {
    if (scrollRaf.current) return
    scrollRaf.current = window.requestAnimationFrame(() => {
      scrollRaf.current = null
      const viewport = viewportRef.current
      if (!viewport) return
      const nextX = viewport.scrollLeft
      const nextY = viewport.scrollTop
      if (nextX === lastScroll.current.x && nextY === lastScroll.current.y) return
      lastScroll.current = { x: nextX, y: nextY }
      onScrollChange(nextX, nextY)
    })
  }, [onScrollChange])

  const handlePanMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('[data-task-dep-card]')) return
    const viewport = viewportRef.current
    if (!viewport) return
    panState.current.active = true
    panState.current.startX = event.clientX
    panState.current.startY = event.clientY
    panState.current.scrollLeft = viewport.scrollLeft
    panState.current.scrollTop = viewport.scrollTop
    viewport.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    event.preventDefault()
  }, [])

  const handleResizeMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      const viewport = viewportRef.current
      const currentWidth = width > 0 ? width : (viewport?.getBoundingClientRect().width ?? 360)
      resizeState.current.active = true
      resizeState.current.startX = event.clientX
      resizeState.current.startY = event.clientY
      resizeState.current.startHeight = height
      resizeState.current.startWidth = currentWidth
      document.body.style.userSelect = 'none'
    },
    [height, width]
  )

  return (
    <div style={{ ...layoutPrimitives.column, gap: '6px' }}>
      {hasCycle && (
        <div
          style={{
            fontSize: '9px',
            color: COLORS.error,
            background: `${COLORS.error}22`,
            border: `1px solid ${COLORS.error}`,
            borderRadius: '4px',
            padding: '4px 6px',
          }}
        >
          Cycle detected in task dependencies.
        </div>
      )}
      <div style={{ ...layoutPrimitives.row, alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '9px', color: COLORS.textMuted }}>Dependency layout</span>
        <div style={{ ...layoutPrimitives.row, alignItems: 'center', gap: '6px' }}>
          <ButtonGroup>
            <ButtonGroupItem onClick={() => onCardWidthChange(Math.max(150, cardWidth - 20))}>−</ButtonGroupItem>
            <ButtonGroupItem onClick={() => onCardWidthChange(Math.min(260, cardWidth + 20))}>+</ButtonGroupItem>
          </ButtonGroup>
          <span style={{ fontSize: '9px', color: COLORS.textMuted }}>Width {cardWidth}px</span>
        </div>
      </div>
      <div
        style={{
          position: 'relative',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div
          ref={viewportRef}
          onMouseDown={handlePanMouseDown}
          onScroll={handleScroll}
          style={{
            position: 'relative',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '6px',
            background: COLORS.bgDark,
            padding: '6px',
            overflow: 'auto',
            height: `${height}px`,
            cursor: 'grab',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ minWidth: '100%', minHeight: '100%', ...layoutPrimitives.row, justifyContent: 'center' }}>
            <div
              style={{
                position: 'relative',
                width: `${bounds.width}px`,
                height: `${bounds.height}px`,
              }}
            >
              <svg width={bounds.width} height={bounds.height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <defs>
                  {[
                    { key: 'default', color: COLORS.border },
                    { key: 'done', color: COLORS.success },
                    { key: 'blocked', color: COLORS.error },
                    { key: 'inprogress', color: COLORS.info },
                  ].map(marker => (
                    <marker
                      key={marker.key}
                      id={`${markerId}-${marker.key}`}
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={marker.color} />
                    </marker>
                  ))}
                </defs>
                {edges.map((edge, index) => {
                  const source = nodeMap.get(edge.sourceId)
                  const target = nodeMap.get(edge.targetId)
                  if (!source || !target) return null
                  const sourceStatus = source.task.status
                  let edgeColor = COLORS.border
                  let markerKey = 'default'
                  if (sourceStatus === 'done') {
                    edgeColor = COLORS.success
                    markerKey = 'done'
                  } else if (sourceStatus === 'blocked') {
                    edgeColor = COLORS.error
                    markerKey = 'blocked'
                  } else if (sourceStatus === 'in-progress') {
                    edgeColor = COLORS.info
                    markerKey = 'inprogress'
                  }
                  const sourceX = source.x + source.width / 2 - bounds.minX
                  const sourceY = source.y + source.height - bounds.minY
                  const targetX = target.x + target.width / 2 - bounds.minX
                  const targetY = target.y - bounds.minY
                  const [edgePath] = getSmoothStepPath({
                    sourceX,
                    sourceY,
                    targetX,
                    targetY,
                    sourcePosition: Position.Bottom,
                    targetPosition: Position.Top,
                    borderRadius: 18,
                    offset: 22,
                  })
                  return (
                    <path
                      key={`${edge.sourceId}->${edge.targetId}-${index}`}
                      d={edgePath}
                      fill="none"
                      stroke={edgeColor}
                      strokeWidth={1.4}
                      opacity={target.task.status === 'done' ? 0.5 : 0.9}
                      markerEnd={`url(#${markerId}-${markerKey})`}
                    />
                  )
                })}
              </svg>

              {nodes.map(node => (
                <div
                  key={node.id}
                  style={{
                    position: 'absolute',
                    left: node.x - bounds.minX,
                    top: node.y - bounds.minY,
                    width: node.width,
                    height: node.height,
                  }}
                >
                  <TaskDependencyCard task={node.task} width={node.width} height={node.height} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          onMouseDown={handleResizeMouseDown}
          style={{
            position: 'absolute',
            right: 4,
            bottom: 4,
            width: 16,
            height: 16,
            cursor: 'nwse-resize',
            border: `1px solid ${COLORS.border}`,
            background: COLORS.bg,
            borderRadius: '3px',
            boxShadow: `0 0 0 1px ${COLORS.bgDark}`,
            opacity: 0.9,
            zIndex: 5,
            pointerEvents: 'auto',
          }}
          title="Resize"
        />
      </div>
    </div>
  )
}
