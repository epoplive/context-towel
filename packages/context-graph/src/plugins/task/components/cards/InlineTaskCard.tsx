import { memo } from 'react'
import { layoutPrimitives } from '../../../../compat/layoutPrimitives'
import { useTaskColors } from '../useTaskColors'
import { ChecklistItem, TaskItem, getPriorityColor, getStatusColor } from '../../types'

// ============================================================================
// INLINE TASK CARD (shown within DocumentNode)
// ============================================================================
export const InlineTaskCard = memo(({ task }: { task: TaskItem }) => {
  const COLORS = useTaskColors()
  const statusColor = getStatusColor(task.status)
  const priorityColor = getPriorityColor(task.priority)
  const completedCount = task.checklist.filter((c: ChecklistItem) => c.checked).length
  const totalCount = task.checklist.length

  return (
    <div
      style={{
        background: COLORS.bgDark,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${statusColor}`,
        borderRadius: '4px',
        padding: '6px 8px',
        marginBottom: '6px',
      }}
    >
      {/* Task header */}
      <div style={{ ...layoutPrimitives.row, alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
        <span
          style={{
            background: statusColor,
            color: task.status === 'done' ? COLORS.textInverse : COLORS.bgDark,
            padding: '1px 4px',
            borderRadius: '3px',
            fontSize: '8px',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {task.status}
        </span>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: priorityColor,
          }}
          title={task.priority}
        />
        <span
          style={{
            color: COLORS.text,
            fontSize: '10px',
            fontWeight: 600,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {task.title}
        </span>
      </div>

      {/* Progress bar if has checklist */}
      {totalCount > 0 && (
        <div style={{ marginBottom: '4px' }}>
          <div
            style={{
              height: '3px',
              background: COLORS.border,
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${task.progress}%`,
                background: task.progress === 100 ? COLORS.success : statusColor,
              }}
            />
          </div>
          <div
            style={{
              fontSize: '8px',
              color: COLORS.textMuted,
              textAlign: 'right',
              marginTop: '1px',
            }}
          >
            {completedCount}/{totalCount}
          </div>
        </div>
      )}

      {/* Checklist items */}
      {task.checklist.length > 0 && (
        <div style={{ marginTop: '2px' }}>
          {task.checklist.slice(0, 4).map((item: ChecklistItem, i: number) => (
            <div
              key={i}
              style={{
                ...layoutPrimitives.row,
                alignItems: 'flex-start',
                gap: '4px',
                fontSize: '9px',
                color: item.checked ? COLORS.textMuted : COLORS.text,
                textDecoration: item.checked ? 'line-through' : 'none',
                marginBottom: '1px',
                lineHeight: 1.2,
              }}
            >
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  border: `1px solid ${item.checked ? COLORS.success : COLORS.border}`,
                  borderRadius: '2px',
                  background: item.checked ? COLORS.success : 'transparent',
                  ...layoutPrimitives.row,
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '7px',
                  color: COLORS.textInverse,
                  flexShrink: 0,
                  marginTop: '1px',
                }}
              >
                {item.checked ? '✓' : ''}
              </span>
              <span>{item.text}</span>
            </div>
          ))}
          {task.checklist.length > 4 && (
            <div style={{ fontSize: '8px', color: COLORS.textMuted, paddingLeft: '14px' }}>
              +{task.checklist.length - 4} more
            </div>
          )}
        </div>
      )}
    </div>
  )
})

