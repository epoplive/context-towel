import { memo, useState } from 'react'
import type { BlockRenderProps } from '../../blocks/types'
import type { TaskData, TaskStatus, TaskPriority } from './types'
import { statusColors, priorityColors, statusLabels } from './types'

/** Task card — renders a task block at different detail levels */
export const TaskCard = memo(function TaskCard({
  data,
  detail,
  theme,
  onEdit,
}: BlockRenderProps<TaskData>) {
  const [checklistExpanded, setChecklistExpanded] = useState(detail === 'full')

  const statusColor = statusColors[data.status]
  const completedCount = data.checklist.filter((c) => c.checked).length
  const totalCount = data.checklist.length

  if (detail === 'mini') {
    return (
      <div style={{
        borderLeft: `3px solid ${statusColor}`,
        padding: '4px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: theme.fontSans,
      }}>
        <StatusBadge status={data.status} />
        <PriorityDot priority={data.priority} />
        <span style={{
          fontSize: 11,
          color: theme.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {data.title}
        </span>
        {totalCount > 0 && (
          <span style={{ fontSize: 9, color: theme.textMuted }}>
            {completedCount}/{totalCount}
          </span>
        )}
      </div>
    )
  }

  if (detail === 'summary') {
    return (
      <div style={{
        borderLeft: `3px solid ${statusColor}`,
        padding: '6px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontSans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <StatusBadge status={data.status} />
          <PriorityDot priority={data.priority} />
          <span style={{
            fontSize: 11,
            color: theme.textPrimary,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {data.title}
          </span>
          {data.tags.length > 0 && (
            <span style={{ fontSize: 8, color: theme.textMuted }}>
              {data.tags.slice(0, 2).join(' ')}
            </span>
          )}
        </div>
        {totalCount > 0 && (
          <ProgressBar
            completed={completedCount}
            total={totalCount}
            color={statusColor}
            bgColor={theme.bgTertiary}
          />
        )}
        {data.checklist.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {data.checklist.slice(0, 4).map((item, i) => (
              <ChecklistRow
                key={i}
                item={item}
                theme={theme}
                onToggle={onEdit ? () => onEdit({
                  blockType: 'task',
                  field: `checklist.${i}.checked`,
                  value: !item.checked,
                }) : undefined}
              />
            ))}
            {data.checklist.length > 4 && (
              <div style={{ fontSize: 8, color: theme.textMuted, paddingLeft: 16 }}>
                +{data.checklist.length - 4} more
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // detail === 'full'
  return (
    <div style={{
      borderLeft: `3px solid ${statusColor}`,
      padding: '8px 10px',
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      fontFamily: theme.fontSans,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <StatusBadge status={data.status} />
        <PriorityDot priority={data.priority} />
        <span style={{
          fontSize: 12,
          color: theme.textPrimary,
          fontWeight: 600,
          flex: 1,
        }}>
          {data.title}
        </span>
      </div>

      {/* Tags */}
      {data.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {data.tags.map((tag) => (
            <span key={tag} style={{
              fontSize: 8,
              padding: '1px 5px',
              borderRadius: 3,
              background: `${theme.accent}22`,
              color: theme.accent,
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      {data.description && (
        <div style={{
          fontSize: 10,
          color: theme.textSecondary,
          marginBottom: 6,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
        }}>
          {data.description.slice(0, 200)}
          {data.description.length > 200 && '...'}
        </div>
      )}

      {/* Checklist */}
      {totalCount > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div
            onClick={() => setChecklistExpanded(!checklistExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              marginBottom: 4,
            }}
          >
            <span style={{
              fontSize: 8,
              color: theme.textMuted,
              transition: 'transform 0.15s',
              transform: checklistExpanded ? 'rotate(90deg)' : 'rotate(0)',
              display: 'inline-block',
            }}>
              &#9654;
            </span>
            <ProgressBar
              completed={completedCount}
              total={totalCount}
              color={statusColor}
              bgColor={theme.bgTertiary}
            />
          </div>
          {checklistExpanded && data.checklist.map((item, i) => (
            <ChecklistRow
              key={i}
              item={item}
              theme={theme}
              onToggle={onEdit ? () => onEdit({
                blockType: 'task',
                field: `checklist.${i}.checked`,
                value: !item.checked,
              }) : undefined}
            />
          ))}
        </div>
      )}

      {/* Blocked by */}
      {data.blockedBy.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 8, color: theme.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>
            Blocked by
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {data.blockedBy.map((id) => (
              <span key={id} style={{
                fontSize: 8,
                padding: '1px 5px',
                borderRadius: 3,
                background: `${theme.error}22`,
                color: theme.error,
              }}>
                {id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {data.notes && (
        <div style={{
          fontSize: 9,
          color: theme.textSecondary,
          padding: '4px 6px',
          borderLeft: `2px solid ${theme.borderPrimary}`,
          marginBottom: 6,
          lineHeight: 1.4,
          whiteSpace: 'pre-wrap',
        }}>
          {data.notes.slice(0, 150)}
          {data.notes.length > 150 && '...'}
        </div>
      )}

      {/* Log (last 3 entries) */}
      {data.log.length > 0 && (
        <div>
          <div style={{ fontSize: 8, color: theme.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>
            Log
          </div>
          {data.log.slice(-3).map((entry, i) => (
            <div key={i} style={{
              fontSize: 8,
              color: theme.textSecondary,
              display: 'flex',
              gap: 6,
            }}>
              <span style={{ color: theme.textMuted, fontFamily: theme.fontMono }}>
                {entry.timestamp}
              </span>
              <span>{entry.entry}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

// --- Subcomponents ---

function StatusBadge({ status }: { status: TaskStatus }) {
  const color = statusColors[status]
  return (
    <span style={{
      fontSize: 7,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      padding: '1px 5px',
      borderRadius: 3,
      background: `${color}22`,
      color,
      whiteSpace: 'nowrap',
    }}>
      {statusLabels[status]}
    </span>
  )
}

function PriorityDot({ priority }: { priority: TaskPriority }) {
  const color = priorityColors[priority]
  return (
    <span style={{
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: color,
      display: 'inline-block',
      flexShrink: 0,
    }} title={priority} />
  )
}

function ProgressBar({
  completed,
  total,
  color,
  bgColor,
}: {
  completed: number
  total: number
  color: string
  bgColor: string
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
      <div style={{
        flex: 1,
        height: 3,
        borderRadius: 2,
        background: bgColor,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 2,
          transition: 'width 0.2s',
        }} />
      </div>
      <span style={{ fontSize: 8, color, fontWeight: 600, whiteSpace: 'nowrap' }}>
        {completed}/{total}
      </span>
    </div>
  )
}

function ChecklistRow({
  item,
  theme,
  onToggle,
}: {
  item: { text: string; checked: boolean }
  theme: { textPrimary: string; textMuted: string; accent: string; success: string }
  onToggle?: () => void
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 5,
        padding: '1px 0',
        cursor: onToggle ? 'pointer' : 'default',
        fontSize: 9,
      }}
    >
      <span style={{
        fontSize: 10,
        lineHeight: '13px',
        color: item.checked ? theme.success : theme.textMuted,
        flexShrink: 0,
      }}>
        {item.checked ? '\u2611' : '\u2610'}
      </span>
      <span style={{
        color: item.checked ? theme.textMuted : theme.textPrimary,
        textDecoration: item.checked ? 'line-through' : 'none',
        lineHeight: '13px',
      }}>
        {item.text}
      </span>
    </div>
  )
}
