import { useCallback, useMemo, useState, type CSSProperties } from 'react'
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
import type { BlockRenderProps } from '../../blocks/types'
import type {
  KanbanData,
  KanbanGroupBy,
  KanbanTask,
  KanbanTaskPriority,
  KanbanTaskStatus,
} from './types'
import {
  KANBAN_PRIORITY_COLORS,
  KANBAN_PRIORITY_LABELS,
  KANBAN_STATUS_COLORS,
  KANBAN_STATUS_LABELS,
  PRIORITY_COLUMN_ORDER,
  STATUS_COLUMN_ORDER,
} from './types'

// ============================================================================
// Local state — the KanbanCard manages its own task list so drag results are
// visible immediately. Status/priority changes are also surfaced via onEdit.
// ============================================================================

function useKanbanState(initialTasks: KanbanTask[]) {
  const [tasks, setTasks] = useState<KanbanTask[]>(initialTasks)

  const moveTask = useCallback(
    (taskId: string, groupBy: KanbanGroupBy, nextValue: string) => {
      setTasks(prev =>
        prev.map(t => {
          if (t.id !== taskId) return t
          if (groupBy === 'status') {
            return { ...t, status: nextValue as KanbanTaskStatus }
          }
          return { ...t, priority: nextValue as KanbanTaskPriority }
        })
      )
    },
    []
  )

  return { tasks, moveTask }
}

// ============================================================================
// Grouping logic (self-contained — no context-graph imports)
// ============================================================================

function buildColumns(
  tasks: KanbanTask[],
  groupBy: KanbanGroupBy
): Array<{ key: string; label: string; color: string; tasks: KanbanTask[] }> {
  const map = new Map<string, KanbanTask[]>()

  for (const task of tasks) {
    const key = groupBy === 'status' ? task.status : task.priority
    const bucket = map.get(key) ?? []
    bucket.push(task)
    map.set(key, bucket)
  }

  const order: string[] =
    groupBy === 'status' ? [...STATUS_COLUMN_ORDER] : [...PRIORITY_COLUMN_ORDER]

  // Include any keys not in the canonical order
  for (const key of map.keys()) {
    if (!order.includes(key)) order.push(key)
  }

  return order
    .filter(key => map.has(key))
    .map(key => ({
      key,
      label:
        groupBy === 'status'
          ? (KANBAN_STATUS_LABELS[key as KanbanTaskStatus] ?? key)
          : (KANBAN_PRIORITY_LABELS[key as KanbanTaskPriority] ?? key),
      color:
        groupBy === 'status'
          ? (KANBAN_STATUS_COLORS[key as KanbanTaskStatus] ?? '#6b7280')
          : (KANBAN_PRIORITY_COLORS[key as KanbanTaskPriority] ?? '#6b7280'),
      tasks: map.get(key) ?? [],
    }))
}

// ============================================================================
// Draggable task card
// ============================================================================

function KanbanTaskCard({
  task,
  groupBy,
  theme,
}: {
  task: KanbanTask
  groupBy: KanbanGroupBy
  theme: BlockRenderProps<KanbanData>['theme']
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { taskId: task.id },
  })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
    padding: '0.5em 0.6em',
    borderRadius: theme.radius,
    background: theme.bgPrimary,
    border: `1px solid ${theme.borderPrimary}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3em',
    fontFamily: theme.fontSans,
    userSelect: 'none',
  }

  const priorityColor = KANBAN_PRIORITY_COLORS[task.priority] ?? '#6b7280'
  const statusColor = KANBAN_STATUS_COLORS[task.status] ?? '#6b7280'
  const secondaryLabel =
    groupBy === 'status'
      ? (KANBAN_PRIORITY_LABELS[task.priority] ?? task.priority)
      : (KANBAN_STATUS_LABELS[task.status] ?? task.status)
  const secondaryColor = groupBy === 'status' ? priorityColor : statusColor

  return (
    <div
      ref={setNodeRef}
      style={style}
      onPointerDown={e => e.stopPropagation()}
      {...listeners}
      {...attributes}
      data-task-id={task.id}
    >
      {/* Title */}
      <span
        style={{
          fontSize: '0.95em',
          fontWeight: 600,
          color: theme.textPrimary,
          lineHeight: 1.3,
        }}
      >
        {task.title}
      </span>
      {/* Secondary badge row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4em' }}>
        {/* Priority dot */}
        <span
          style={{
            width: '0.5em',
            height: '0.5em',
            borderRadius: '50%',
            background: priorityColor,
            flexShrink: 0,
            display: 'inline-block',
          }}
          title={task.priority}
        />
        {/* Secondary label badge */}
        <span
          style={{
            fontSize: '0.8em',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            padding: '0.1em 0.4em',
            borderRadius: '3px',
            background: `${secondaryColor}22`,
            color: secondaryColor,
          }}
        >
          {secondaryLabel}
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// Droppable column
// ============================================================================

function KanbanColumn({
  id,
  label,
  color,
  tasks,
  groupBy,
  theme,
}: {
  id: string
  label: string
  color: string
  tasks: KanbanTask[]
  groupBy: KanbanGroupBy
  theme: BlockRenderProps<KanbanData>['theme']
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { groupBy, value: id.split(':').pop() },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: '11em',
        maxWidth: '14em',
        borderRadius: theme.radius,
        border: `1px solid ${isOver ? color : theme.borderPrimary}`,
        background: theme.bgSecondary,
        padding: '0.5em',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4em',
        transition: 'border-color 0.15s',
        flexShrink: 0,
      }}
    >
      {/* Column header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4em',
          paddingBottom: '0.3em',
          borderBottom: `1px solid ${theme.borderPrimary}`,
        }}
      >
        <span
          style={{
            width: '0.55em',
            height: '0.55em',
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
            display: 'inline-block',
          }}
        />
        <span
          style={{
            fontSize: '0.85em',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: theme.textSecondary,
            flex: 1,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: '0.8em',
            color: theme.textMuted,
            fontWeight: 600,
          }}
        >
          {tasks.length}
        </span>
      </div>
      {/* Task cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4em', minHeight: '2em' }}>
        {tasks.map(task => (
          <KanbanTaskCard key={task.id} task={task} groupBy={groupBy} theme={theme} />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// KanbanCard — the main exported card component
// ============================================================================

export function KanbanCard({
  data,
  theme,
  onEdit,
}: BlockRenderProps<KanbanData>) {
  const { tasks, moveTask } = useKanbanState(data.tasks)
  const groupBy = data.groupBy

  const columns = useMemo(() => buildColumns(tasks, groupBy), [tasks, groupBy])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!event.over) return
      const taskId = String(event.active.id)
      const overData = event.over.data.current
      const overGroupBy = overData?.groupBy as KanbanGroupBy | undefined
      const overValue = overData?.value as string | undefined
      if (!overGroupBy || !overValue || overGroupBy !== groupBy) return

      const task = tasks.find(t => t.id === taskId)
      if (!task) return

      const currentValue = groupBy === 'status' ? task.status : task.priority
      if (currentValue === overValue) return

      moveTask(taskId, groupBy, overValue)

      if (onEdit) {
        onEdit({
          blockType: 'kanban',
          field: groupBy === 'status' ? `tasks.${taskId}.status` : `tasks.${taskId}.priority`,
          value: overValue,
        })
      }
    },
    [groupBy, tasks, moveTask, onEdit]
  )

  const columnId = (key: string) => `kanban:${groupBy}:${key}`

  return (
    <div
      style={{
        fontFamily: theme.fontSans,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6em',
      }}
    >
      {/* Board header */}
      {data.title && (
        <div
          style={{
            fontSize: '0.95em',
            fontWeight: 700,
            color: theme.textPrimary,
            padding: '0.3em 0',
          }}
        >
          {data.title}
        </div>
      )}

      {/* Columns */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '0.6em',
            overflowX: 'auto',
            paddingBottom: '0.25em',
          }}
        >
          {columns.map(col => (
            <KanbanColumn
              key={col.key}
              id={columnId(col.key)}
              label={col.label}
              color={col.color}
              tasks={col.tasks}
              groupBy={groupBy}
              theme={theme}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
