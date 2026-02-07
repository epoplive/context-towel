import { memo } from 'react'
import { layoutPrimitives } from '../../../../compat/layoutPrimitives'
import { useTaskColors } from '../useTaskColors'
import { ChecklistItem, TaskItem, getPriorityColor, getStatusColor } from '../../types'
import { EdgeHandles } from './EdgeHandles'

// ============================================================================
// TASK NODE (standalone - for task-focused views)
// ============================================================================
export interface TaskNodeData {
  task: TaskItem
  onToggleChecklist?: (index: number) => void
}

interface TaskNodeProps {
  data: TaskNodeData
  selected?: boolean
}

export const TaskNode = memo(({ data, selected }: TaskNodeProps) => {
  const COLORS = useTaskColors()
  const { task } = data
  const statusColor = getStatusColor(task.status)
  const priorityColor = getPriorityColor(task.priority)

  const completedCount = task.checklist.filter((c: ChecklistItem) => c.checked).length
  const totalCount = task.checklist.length

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `2px solid ${selected ? statusColor : COLORS.border}`,
        borderRadius: '8px',
        padding: '10px',
        minWidth: '180px',
        maxWidth: '260px',
        cursor: 'pointer',
      }}
    >
      <EdgeHandles color={statusColor} />

      {/* Header with status and priority */}
      <div style={{ ...layoutPrimitives.row, alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <span
          style={{
            background: statusColor,
            color: task.status === 'done' ? COLORS.textInverse : COLORS.bgDark,
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '9px',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {task.status}
        </span>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: priorityColor,
            border: task.priority === 'critical' ? `2px solid ${COLORS.textInverse}` : 'none',
          }}
          title={task.priority}
        />
        <span style={{ flex: 1 }} />
        {task.tags.slice(0, 2).map((tag: string) => (
          <span
            key={tag}
            style={{
              background: COLORS.bgDark,
              color: COLORS.textMuted,
              padding: '1px 4px',
              borderRadius: '3px',
              fontSize: '8px',
            }}
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* Title */}
      <div
        style={{
          color: COLORS.text,
          fontWeight: 600,
          fontSize: '12px',
          marginBottom: '8px',
          lineHeight: 1.3,
        }}
      >
        {task.title}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div
            style={{
              ...layoutPrimitives.row,
              justifyContent: 'space-between',
              fontSize: '9px',
              color: COLORS.textMuted,
              marginBottom: '2px',
            }}
          >
            <span>Progress</span>
            <span>
              {completedCount}/{totalCount}
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
                width: `${task.progress}%`,
                background: task.progress === 100 ? COLORS.success : statusColor,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Checklist preview (first 3 items) */}
      {task.checklist.length > 0 && (
        <div style={{ marginBottom: '4px' }}>
          {task.checklist.slice(0, 3).map((item: ChecklistItem, i: number) => (
            <div
              key={i}
              style={{
                ...layoutPrimitives.row,
                alignItems: 'flex-start',
                gap: '6px',
                fontSize: '10px',
                color: item.checked ? COLORS.textMuted : COLORS.text,
                textDecoration: item.checked ? 'line-through' : 'none',
                marginBottom: '2px',
              }}
              onClick={(e) => {
                e.stopPropagation()
                data.onToggleChecklist?.(i)
              }}
            >
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  border: `1px solid ${item.checked ? COLORS.success : COLORS.border}`,
                  borderRadius: '2px',
                  background: item.checked ? COLORS.success : 'transparent',
                  ...layoutPrimitives.row,
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '8px',
                  color: COLORS.textInverse,
                  flexShrink: 0,
                }}
              >
                {item.checked ? '✓' : ''}
              </span>
              <span style={{ lineHeight: 1.2 }}>{item.text}</span>
            </div>
          ))}
          {task.checklist.length > 3 && (
            <div style={{ fontSize: '9px', color: COLORS.textMuted, paddingLeft: '18px' }}>
              +{task.checklist.length - 3} more...
            </div>
          )}
        </div>
      )}

      {/* Blocked-by indicator */}
      {task.blockedBy.length > 0 && (
        <div
          style={{
            ...layoutPrimitives.row,
            alignItems: 'center',
            gap: '4px',
            fontSize: '9px',
            color: COLORS.error,
            marginTop: '4px',
          }}
        >
          <span>Blocked by:</span>
          {task.blockedBy.map((id: string) => (
            <span
              key={id}
              style={{
                background: `${COLORS.error}33`,
                padding: '1px 4px',
                borderRadius: '3px',
              }}
            >
              {id}
            </span>
          ))}
        </div>
      )}
    </div>
  )
})

