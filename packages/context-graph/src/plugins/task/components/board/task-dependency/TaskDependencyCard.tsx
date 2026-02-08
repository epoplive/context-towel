import { layoutPrimitives } from '../../../../../compat/layoutPrimitives'

import { getPriorityColor, getStatusColor, type TaskItem } from '../../../types'
import { useTaskColors } from '../../useTaskColors'

export function TaskDependencyCard({
  task,
  width,
  height,
}: {
  task: TaskItem
  width: number
  height: number
}) {
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

