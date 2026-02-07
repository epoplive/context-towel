import {
  useCallback,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ButtonGroup, ButtonGroupItem, Select } from '../../../../compat/design-system'
import { layoutPrimitives } from '../../../../compat/layoutPrimitives'
import { fileService } from '../../../../compat/services'
import { useContextGraphController } from '../../../../hooks/useContextGraphController'
import { useGraphStore } from '../../../../state/store'
import type { TaskBoardGroupBy, TaskBoardPrefs } from '../../../../state/slices'
import { TaskItem } from '../../types'
import { DetailedTaskCard } from '../cards/DetailedTaskCard'
import { useTaskColors } from '../useTaskColors'
import { TaskDependencyView } from './TaskDependencyView'
import { buildTaskBoardGroups, formatGroupLabel, getTaskBoardDragUpdate } from './taskBoardGroups'
import { updateTaskContent } from './taskContentUpdate'

// ============================================================================
// TASK BOARD (grouped board + dependency view)
// ============================================================================

interface TaskBoardProps {
  tasks: TaskItem[]
  parentDocId: string
  taskListId: string
  view: 'focus' | 'normal'
}

function getTaskKey(task: TaskItem, parentDocId: string): string {
  const line = task.sourceLine ?? 0
  return `${parentDocId}:${task.id}:${line}`
}

const TaskBoardDraggableCard = ({ task, dragId }: { task: TaskItem; dragId: string }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { taskId: dragId },
  })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.6 : 1,
    cursor: 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      {...listeners}
      {...attributes}
    >
      <DetailedTaskCard task={task} compact />
    </div>
  )
}

const TaskBoardStaticCard = ({ task }: { task: TaskItem }) => (
  <div
    style={{ cursor: 'default' }}
    onPointerDown={(event) => event.stopPropagation()}
  >
    <DetailedTaskCard task={task} compact />
  </div>
)

const TaskBoardColumn = ({
  id,
  title,
  tasks,
  groupBy,
  value,
  highlight,
  children,
}: {
  id: string
  title: string
  tasks: TaskItem[]
  groupBy: TaskBoardGroupBy
  value: string
  highlight?: boolean
  children?: ReactNode
}) => {
  const COLORS = useTaskColors()
  const { setNodeRef, isOver } = useDroppable({ id, data: { groupBy, value } })

  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: '200px',
        maxWidth: '240px',
        borderRadius: '6px',
        border: `1px solid ${isOver || highlight ? COLORS.accent : COLORS.border}`,
        background: COLORS.bgDark,
        padding: '6px',
        ...layoutPrimitives.column,
        gap: '6px',
      }}
    >
      <div
        style={{
          fontSize: '9px',
          fontWeight: 700,
          color: COLORS.textSecondary,
          letterSpacing: '0.4px',
          textTransform: 'uppercase',
        }}
      >
        {title} ({tasks.length})
      </div>
      {children}
    </div>
  )
}

export const TaskBoard = ({ tasks, parentDocId, taskListId, view }: TaskBoardProps) => {
  const COLORS = useTaskColors()
  const taskBoardDefaults = useGraphStore(state => state.taskBoardDefaults)
  const taskBoardByList = useGraphStore(state => state.taskBoardByList)
  const setTaskBoardPrefs = useGraphStore(state => state.setTaskBoardPrefs)
  const docContents = useGraphStore(state => state.docContents)
  const treeItems = useGraphStore(state => state.treeItems)
  const setDocContentParsed = useGraphStore(state => state.setDocContentParsed)
  const controller = useContextGraphController()

  const defaults = taskBoardDefaults[view]
  const fallbackDefaults = taskBoardDefaults[view === 'focus' ? 'normal' : 'focus']
  const prefs = { ...defaults, ...taskBoardByList[taskListId] }
  const groupBy = prefs.groupBy
  const viewMode = prefs.view
  const columnCount = prefs.columnCount ?? fallbackDefaults.columnCount ?? 1
  const dependencyHeight = prefs.dependencyHeight ?? fallbackDefaults.dependencyHeight ?? 360
  const dependencyCardWidth = prefs.dependencyCardWidth ?? fallbackDefaults.dependencyCardWidth ?? 190
  const dependencyScrollX = prefs.dependencyScrollX ?? fallbackDefaults.dependencyScrollX ?? 0
  const dependencyScrollY = prefs.dependencyScrollY ?? fallbackDefaults.dependencyScrollY ?? 0
  const dependencyWidth = prefs.dependencyWidth ?? fallbackDefaults.dependencyWidth ?? 0

  const updateDependencyShared = (updates: Partial<TaskBoardPrefs>) => {
    setTaskBoardPrefs(taskListId, updates)
  }

  const taskByKey = useMemo(() => {
    const map = new Map<string, TaskItem>()
    tasks.forEach(task => map.set(getTaskKey(task, parentDocId), task))
    return map
  }, [tasks, parentDocId])

  const updateTaskField = useCallback(
    async (task: TaskItem, updates: { status?: TaskItem['status']; priority?: TaskItem['priority'] }) => {
      const doc = docContents.get(parentDocId)
      if (!doc) return
      const updated = updateTaskContent(doc.content, task, updates)
      if (!updated) return
      const item = treeItems.find(entry => entry.id === parentDocId)
      if (item) {
        try {
          await fileService.write(item.path, updated)
          const parsed = await controller.parseContent(item.path, updated)
          setDocContentParsed(parentDocId, parsed)
        } catch (err) {
          console.error('Failed to save task update:', err)
        }
      }
    },
    [controller, docContents, parentDocId, setDocContentParsed, treeItems]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const orderedGroups = useMemo(() => buildTaskBoardGroups(tasks, groupBy), [groupBy, tasks])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!event.over) return
      const activeTask = taskByKey.get(String(event.active.id))
      if (!activeTask) return
      const overData = event.over.data?.current
      const nextGroupBy = overData?.groupBy as TaskBoardGroupBy | undefined
      const nextValue = overData?.value as string | undefined
      const update = getTaskBoardDragUpdate(groupBy, activeTask, nextGroupBy, nextValue)
      if (!update) return
      updateTaskField(activeTask, update)
    },
    [groupBy, taskByKey, updateTaskField]
  )

  const buttonStyle = (active: boolean): CSSProperties => ({
    fontSize: '10px',
    padding: '4px 10px',
    borderLeft: 'none',
    background: active ? COLORS.accent : 'transparent',
    color: active ? COLORS.textInverse : COLORS.textPrimary,
    fontWeight: 600,
  })

  return (
    <div className="nodrag" style={{ ...layoutPrimitives.column, gap: '8px' }}>
      <div
        style={{
          ...layoutPrimitives.row,
          alignItems: 'center',
          gap: '6px',
          flexWrap: 'wrap',
        }}
      >
        <ButtonGroup style={{ borderRadius: 8, background: COLORS.bgDark }}>
          <ButtonGroupItem
            active={viewMode === 'list'}
            style={buttonStyle(viewMode === 'list')}
            onClick={() => setTaskBoardPrefs(taskListId, { view: 'list' })}
          >
            List
          </ButtonGroupItem>
          <ButtonGroupItem
            active={viewMode === 'board'}
            style={buttonStyle(viewMode === 'board')}
            onClick={() => setTaskBoardPrefs(taskListId, { view: 'board' })}
          >
            Board
          </ButtonGroupItem>
          <ButtonGroupItem
            active={viewMode === 'dependency'}
            style={buttonStyle(viewMode === 'dependency')}
            onClick={() => setTaskBoardPrefs(taskListId, { view: 'dependency' })}
          >
            Dependency
          </ButtonGroupItem>
        </ButtonGroup>

        {viewMode === 'board' && (
          <>
            <span style={{ fontSize: '9px', color: COLORS.textMuted, fontWeight: 600 }}>Group</span>
            <Select
              size="sm"
              value={groupBy}
              onChange={(event) => setTaskBoardPrefs(taskListId, { groupBy: event.target.value as TaskBoardGroupBy })}
              options={[
                { value: 'none', label: 'None' },
                { value: 'status', label: 'Status' },
                { value: 'priority', label: 'Priority' },
              ]}
            />
            {groupBy === 'none' && (
              <>
                <span style={{ fontSize: '9px', color: COLORS.textMuted, fontWeight: 600 }}>Columns</span>
                <Select
                  size="sm"
                  value={String(columnCount)}
                  onChange={(event) => setTaskBoardPrefs(taskListId, { columnCount: Number(event.target.value) })}
                  options={[1, 2, 3, 4, 5, 6].map(count => ({
                    value: String(count),
                    label: String(count),
                  }))}
                />
              </>
            )}
          </>
        )}
      </div>

      {viewMode === 'dependency' && (
        <TaskDependencyView
          tasks={tasks}
          height={dependencyHeight}
          onHeightChange={(nextHeight) => updateDependencyShared({ dependencyHeight: nextHeight })}
          cardWidth={dependencyCardWidth}
          onCardWidthChange={(nextWidth) => updateDependencyShared({ dependencyCardWidth: nextWidth })}
          scrollX={dependencyScrollX}
          scrollY={dependencyScrollY}
          onScrollChange={(nextX, nextY) => updateDependencyShared({
            dependencyScrollX: Math.round(nextX),
            dependencyScrollY: Math.round(nextY),
          })}
          width={dependencyWidth}
          onWidthChange={(nextWidth) => updateDependencyShared({ dependencyWidth: nextWidth })}
        />
      )}

      {viewMode === 'list' && (
        <div style={{ ...layoutPrimitives.column, gap: '6px' }}>
          {tasks
            .slice()
            .sort((a, b) => (a.sourceLine ?? 0) - (b.sourceLine ?? 0))
            .map(task => (
              <TaskBoardStaticCard key={getTaskKey(task, parentDocId)} task={task} />
            ))}
        </div>
      )}

      {viewMode === 'board' && groupBy === 'none' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.max(1, columnCount)}, minmax(0, 1fr))`,
            gap: '8px',
          }}
        >
          {tasks
            .slice()
            .sort((a, b) => (a.sourceLine ?? 0) - (b.sourceLine ?? 0))
            .map(task => (
              <TaskBoardStaticCard
                key={getTaskKey(task, parentDocId)}
                task={task}
              />
            ))}
        </div>
      )}

      {viewMode === 'board' && groupBy !== 'none' && orderedGroups && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div
            style={{
              ...layoutPrimitives.row,
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '4px',
            }}
          >
            {orderedGroups.orderedKeys.map((key) => {
              const columnId = `${groupBy}:${key}`
              const columnTasks = orderedGroups.groups.get(key) || []
              return (
                <TaskBoardColumn
                  key={columnId}
                  id={columnId}
                  title={formatGroupLabel(groupBy, key)}
                  tasks={columnTasks}
                  groupBy={groupBy}
                  value={key}
                >
                  <div style={{ ...layoutPrimitives.column, gap: '6px' }}>
                    {columnTasks.map(task => (
                      <TaskBoardDraggableCard
                        key={getTaskKey(task, parentDocId)}
                        task={task}
                        dragId={getTaskKey(task, parentDocId)}
                      />
                    ))}
                  </div>
                </TaskBoardColumn>
              )
            })}
          </div>
        </DndContext>
      )}
    </div>
  )
}

