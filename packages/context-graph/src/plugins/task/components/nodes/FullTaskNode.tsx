import { memo } from 'react'
import { layoutPrimitives } from '../../../../compat/layoutPrimitives'
import { useTaskColors } from '../useTaskColors'
import { ChecklistItem, TaskItem, getPriorityColor, getStatusColor } from '../../types'
import { EdgeHandles } from './EdgeHandles'

// ============================================================================
// FULL TASK NODE - Shows ALL checklist items (no truncation)
// ============================================================================
export interface FullTaskNodeData {
  task: TaskItem
  parentDocId: string
}

interface FullTaskNodeProps {
  data: FullTaskNodeData
  selected?: boolean
}

export const FullTaskNode = memo(({ data, selected }: FullTaskNodeProps) => {
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
        borderLeft: `4px solid ${statusColor}`,
        borderRadius: '8px',
        padding: '12px',
        minWidth: '220px',
        maxWidth: '300px',
        cursor: 'default',
      }}
    >
      <EdgeHandles color={statusColor} />

      {/* Header */}
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
        <div style={{ marginBottom: '10px' }}>
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
              {completedCount}/{totalCount} ({task.progress}%)
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

      {/* ALL checklist items */}
      {task.checklist.length > 0 && (
        <div>
          {task.checklist.map((item: ChecklistItem, i: number) => (
            <div
              key={i}
              style={{
                ...layoutPrimitives.row,
                alignItems: 'flex-start',
                gap: '6px',
                fontSize: '10px',
                color: item.checked ? COLORS.textMuted : COLORS.text,
                textDecoration: item.checked ? 'line-through' : 'none',
                marginBottom: '4px',
                lineHeight: 1.3,
              }}
            >
              <span
                style={{
                  width: '14px',
                  height: '14px',
                  border: `1.5px solid ${item.checked ? COLORS.success : COLORS.border}`,
                  borderRadius: '3px',
                  background: item.checked ? COLORS.success : 'transparent',
                  ...layoutPrimitives.row,
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  color: COLORS.textInverse,
                  flexShrink: 0,
                  marginTop: '1px',
                }}
              >
                {item.checked ? '✓' : ''}
              </span>
              <span style={{ flex: 1 }}>{item.text}</span>
            </div>
          ))}
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
            marginTop: '8px',
            paddingTop: '6px',
            borderTop: `1px solid ${COLORS.border}`,
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

