import { memo, useMemo } from 'react'
import { layoutPrimitives } from '../../../../compat/layoutPrimitives'
import { useGraphStore } from '../../../../state/store'
import { ChecklistItem, TaskItem, getStatusColor } from '../../types'
import { TaskBoard } from '../board/TaskBoard'
import { useTaskColors } from '../useTaskColors'
import { EdgeHandles } from './EdgeHandles'

// ============================================================================
// TASK LIST NODE - Shows tasks grouped (optionally by section)
// ============================================================================
export interface TaskListNodeData {
  tasks: TaskItem[]
  parentDocId: string
  sectionTitle?: string  // If grouped by section, shows section name
  cardScale?: number
}

interface TaskListNodeProps {
  id?: string
  data: TaskListNodeData
  selected?: boolean
}

// Helper to get cardScale from node data with default.
const getCardScale = (data: any): number => data?.cardScale ?? 1.0

export const TaskListNode = memo(({ id, data, selected }: TaskListNodeProps) => {
  const COLORS = useTaskColors()
  const scale = getCardScale(data)
  const { tasks, sectionTitle } = data
  const taskColor = COLORS.info
  const focusedNode = useGraphStore(state => state.focusedNode)
  const taskBoardByList = useGraphStore(state => state.taskBoardByList)
  const taskBoardDefaults = useGraphStore(state => state.taskBoardDefaults)
  const taskListId = useMemo(() => {
    if (id) return id
    const firstLine = tasks[0]?.sourceLine ?? 0
    return `${data.parentDocId}::${sectionTitle ?? 'tasks'}::${firstLine}`
  }, [data.parentDocId, id, sectionTitle, tasks])
  const dependencyWidth = taskBoardByList[taskListId]?.dependencyWidth
    ?? taskBoardDefaults.normal.dependencyWidth
    ?? 0

  const totalChecklist = tasks.reduce((acc, t) => acc + t.checklist.length, 0)
  const completedChecklist = tasks.reduce((acc, t) => acc + t.checklist.filter((c: ChecklistItem) => c.checked).length, 0)
  const overallProgress = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0

  const statusCounts = {
    todo: tasks.filter(t => t.status === 'todo').length,
    'in-progress': tasks.filter(t => t.status === 'in-progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
  }

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `2px solid ${selected ? taskColor : COLORS.border}`,
        borderLeft: `4px solid ${taskColor}`,
        borderRadius: '8px',
        padding: '12px',
        minWidth: '260px',
        width: dependencyWidth > 0 ? `${dependencyWidth}px` : undefined,
        maxWidth: dependencyWidth > 0 ? `${dependencyWidth}px` : '900px',
        boxSizing: 'border-box',
        cursor: 'default',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
    >
      <EdgeHandles color={taskColor} />

      {/* Header */}
      <div
        style={{
          ...layoutPrimitives.row,
          alignItems: 'center',
          gap: '8px',
          marginBottom: '10px',
          borderBottom: `1px solid ${COLORS.border}`,
          paddingBottom: '8px',
        }}
      >
        <span style={{ color: taskColor, fontSize: '12px', fontWeight: 600 }}>
          {sectionTitle || 'Tasks'}
        </span>
        <span
          style={{
            background: taskColor,
            color: COLORS.textInverse,
            padding: '2px 6px',
            borderRadius: '10px',
            fontSize: '10px',
            fontWeight: 600,
          }}
        >
          {tasks.length}
        </span>
        <span style={{ flex: 1 }} />
        {statusCounts['in-progress'] > 0 && (
          <span
            style={{
              background: getStatusColor('in-progress'),
              color: COLORS.bgDark,
              padding: '1px 4px',
              borderRadius: '3px',
              fontSize: '8px',
              fontWeight: 600,
            }}
          >
            {statusCounts['in-progress']} active
          </span>
        )}
        {statusCounts.blocked > 0 && (
          <span
            style={{
              background: getStatusColor('blocked'),
              color: COLORS.textInverse,
              padding: '1px 4px',
              borderRadius: '3px',
              fontSize: '8px',
              fontWeight: 600,
            }}
          >
            {statusCounts.blocked} blocked
          </span>
        )}
      </div>

      {/* Overall progress */}
      {totalChecklist > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div
            style={{
              ...layoutPrimitives.row,
              justifyContent: 'space-between',
              fontSize: '9px',
              color: COLORS.textMuted,
              marginBottom: '3px',
            }}
          >
            <span>Overall Progress</span>
            <span>
              {completedChecklist}/{totalChecklist} ({overallProgress}%)
            </span>
          </div>
          <div
            style={{
              height: '6px',
              background: COLORS.border,
              borderRadius: '3px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${overallProgress}%`,
                background: overallProgress === 100 ? COLORS.success : taskColor,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      <TaskBoard
        tasks={tasks}
        parentDocId={data.parentDocId}
        taskListId={taskListId}
        view={focusedNode ? 'focus' : 'normal'}
      />
    </div>
  )
})

