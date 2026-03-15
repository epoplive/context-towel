import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ButtonGroup, ButtonGroupItem, Select } from '../../../../compat/design-system'
import { layoutPrimitives } from '../../../../compat/layoutPrimitives'
import type { TaskBoardGroupBy, TaskBoardPrefs } from '../../../../state/slices'
import { TaskItem } from '../../types'
import { DetailedTaskCard } from '../cards/DetailedTaskCard'
import { useTaskColors } from '../useTaskColors'
import { TaskDependencyView } from './TaskDependencyView'
import { buildTaskBoardGroups, formatGroupLabel, getTaskBoardDragUpdate } from './taskBoardGroups'

// ============================================================================
// TASK BOARD VIEW (store-free)
// ============================================================================

function getTaskKey(task: TaskItem, parentDocId: string): string {
  const line = task.sourceLine ?? 0
  return `${parentDocId}:${task.id}:${line}`
}

const TaskBoardDraggableCard = ({
  task,
  dragId,
  onOpenFile,
  renderCard: CardContent,
}: {
  task: TaskItem
  dragId: string
  onOpenFile?: (filePath: string, lineNumber?: number) => void
  renderCard: (props: { task: TaskItem; compact?: boolean }) => ReactNode
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { taskId: dragId },
  })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.6 : 1,
    cursor: 'grab',
  }

  const handleDoubleClick = () => {
    if (!onOpenFile) return
    onOpenFile(task.sourceFile, task.sourceLine ?? 0)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={onOpenFile ? handleDoubleClick : undefined}
      title={onOpenFile ? 'Double-click to open source' : undefined}
      {...listeners}
      {...attributes}
    >
      <CardContent task={task} compact />
    </div>
  )
}

const TaskBoardStaticCard = ({
  task,
  parentDocId,
  onOpenFile,
  renderCard: CardContent,
}: {
  task: TaskItem
  parentDocId: string
  onOpenFile?: (filePath: string, lineNumber?: number) => void
  renderCard: (props: { task: TaskItem; compact?: boolean }) => ReactNode
}) => {
  const handleDoubleClick = () => {
    if (!onOpenFile) return
    onOpenFile(task.sourceFile, task.sourceLine ?? 0)
  }

  return (
    <div
      style={{ cursor: onOpenFile ? 'pointer' : 'default' }}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={onOpenFile ? handleDoubleClick : undefined}
      title={onOpenFile ? 'Double-click to open source' : undefined}
    >
      <CardContent task={task} compact />
    </div>
  )
}

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
        minWidth: '300px',
        flex: 1,
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

/** Custom card renderer for the board. Receives the task and whether to render compact. */
export type TaskBoardCardRenderer = (props: { task: TaskItem; compact?: boolean }) => ReactNode

export interface TaskBoardViewProps {
  tasks: TaskItem[]
  parentDocId: string
  taskListId: string
  /** Board preferences. If not provided, manages its own internal state. */
  prefs?: TaskBoardPrefs
  /** Called when prefs change. If not provided, updates internal state only. */
  onPrefsChange?: (updates: Partial<TaskBoardPrefs>) => void
  onUpdateTaskField?: (
    task: TaskItem,
    updates: { status?: TaskItem['status']; priority?: TaskItem['priority'] }
  ) => void | Promise<void>
  onOpenFile?: (filePath: string, lineNumber?: number) => void
  /** Custom card renderer. Defaults to DetailedTaskCard if not provided. */
  renderCard?: TaskBoardCardRenderer
}

const DEFAULT_PREFS: TaskBoardPrefs = { view: 'board', groupBy: 'status' }

export const TaskBoardView = ({
  tasks,
  parentDocId,
  taskListId,
  prefs: externalPrefs,
  onPrefsChange: externalOnPrefsChange,
  onUpdateTaskField,
  onOpenFile,
  renderCard,
}: TaskBoardViewProps) => {
  const [internalPrefs, setInternalPrefs] = useState<TaskBoardPrefs>(DEFAULT_PREFS)
  const prefs = externalPrefs ?? internalPrefs
  const onPrefsChange = externalOnPrefsChange ?? ((updates: Partial<TaskBoardPrefs>) => setInternalPrefs(p => ({ ...p, ...updates })))

  const CardContent = renderCard ?? (({ task, compact }: { task: TaskItem; compact?: boolean }) => (
    <DetailedTaskCard task={task} compact={compact} />
  ))
  const COLORS = useTaskColors()
  const groupBy = prefs.groupBy
  const viewMode = prefs.view
  const columnCount = prefs.columnCount ?? 1
  const dependencyHeight = prefs.dependencyHeight ?? 360
  const dependencyCardWidth = prefs.dependencyCardWidth ?? 190
  const dependencyScrollX = prefs.dependencyScrollX ?? 0
  const dependencyScrollY = prefs.dependencyScrollY ?? 0
  const dependencyWidth = prefs.dependencyWidth ?? 0

  const taskByKey = useMemo(() => {
    const map = new Map<string, TaskItem>()
    tasks.forEach(task => map.set(getTaskKey(task, parentDocId), task))
    return map
  }, [tasks, parentDocId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const orderedGroups = useMemo(() => buildTaskBoardGroups(tasks, groupBy), [groupBy, tasks])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!event.over || !onUpdateTaskField) return
      const activeTask = taskByKey.get(String(event.active.id))
      if (!activeTask) return
      const overData = event.over.data?.current
      const nextGroupBy = overData?.groupBy as TaskBoardGroupBy | undefined
      const nextValue = overData?.value as string | undefined
      const update = getTaskBoardDragUpdate(groupBy, activeTask, nextGroupBy, nextValue)
      if (!update) return
      void Promise.resolve(onUpdateTaskField(activeTask, update))
    },
    [groupBy, onUpdateTaskField, taskByKey]
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
            onClick={() => onPrefsChange({ view: 'list' })}
          >
            List
          </ButtonGroupItem>
          <ButtonGroupItem
            active={viewMode === 'board'}
            style={buttonStyle(viewMode === 'board')}
            onClick={() => onPrefsChange({ view: 'board' })}
          >
            Board
          </ButtonGroupItem>
          <ButtonGroupItem
            active={viewMode === 'dependency'}
            style={buttonStyle(viewMode === 'dependency')}
            onClick={() => onPrefsChange({ view: 'dependency' })}
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
              onChange={(event) => onPrefsChange({ groupBy: event.target.value as TaskBoardGroupBy })}
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
                  onChange={(event) => onPrefsChange({ columnCount: Number(event.target.value) })}
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
          onHeightChange={(nextHeight) => onPrefsChange({ dependencyHeight: nextHeight })}
          cardWidth={dependencyCardWidth}
          onCardWidthChange={(nextWidth) => onPrefsChange({ dependencyCardWidth: nextWidth })}
          scrollX={dependencyScrollX}
          scrollY={dependencyScrollY}
          onScrollChange={(nextX, nextY) => onPrefsChange({
            dependencyScrollX: Math.round(nextX),
            dependencyScrollY: Math.round(nextY),
          })}
          width={dependencyWidth}
          onWidthChange={(nextWidth) => onPrefsChange({ dependencyWidth: nextWidth })}
        />
      )}

      {viewMode === 'list' && (
        <div style={{ ...layoutPrimitives.column, gap: '6px' }}>
          {tasks
            .slice()
            .sort((a, b) => (a.sourceLine ?? 0) - (b.sourceLine ?? 0))
            .map(task => (
              <TaskBoardStaticCard
                key={getTaskKey(task, parentDocId)}
                task={task}
                parentDocId={parentDocId}
                onOpenFile={onOpenFile}
                renderCard={CardContent}
              />
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
                parentDocId={parentDocId}
                onOpenFile={onOpenFile}
                renderCard={CardContent}
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
              const columnId = `${taskListId}:${groupBy}:${key}`
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
                        onOpenFile={onOpenFile}
                        renderCard={CardContent}
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
