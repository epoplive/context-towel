import { memo, useState } from 'react'
import { layoutPrimitives } from '../../../../compat/layoutPrimitives'
import { useTaskColors } from '../useTaskColors'
import { ChecklistItem, TaskItem, getPriorityColor, getStatusColor } from '../../types'

// ============================================================================
// DETAILED TASK CARD - Compact task view for preview panel and full view
// ============================================================================
interface DetailedTaskCardProps {
  task: TaskItem
  compact?: boolean
  onToggleCheckbox?: (checkboxText: string, currentlyChecked: boolean) => void
}

export const DetailedTaskCard = memo(({ task, compact = false, onToggleCheckbox }: DetailedTaskCardProps) => {
  const COLORS = useTaskColors()
  const [checklistExpanded, setChecklistExpanded] = useState(!compact)
  const [togglingItem, setTogglingItem] = useState<string | null>(null)
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
        padding: compact ? '6px 8px' : '8px 10px',
      }}
    >
      {/* Header: Status + Priority + Title + Tags */}
      <div
        style={{
          ...layoutPrimitives.row,
          alignItems: 'center',
          gap: '4px',
          marginBottom: '4px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            background: statusColor,
            color: task.status === 'done' ? COLORS.textInverse : COLORS.bgDark,
            padding: '1px 5px',
            borderRadius: '3px',
            fontSize: '8px',
            fontWeight: 700,
            textTransform: 'uppercase',
          }}
        >
          {task.status === 'in-progress' ? 'WIP' : task.status}
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
            fontWeight: 600,
            fontSize: compact ? '10px' : '11px',
            flex: 1,
            lineHeight: 1.3,
          }}
        >
          {task.title}
        </span>
        {task.tags.slice(0, 2).map((tag: string) => (
          <span
            key={tag}
            style={{
              background: COLORS.bg,
              color: COLORS.textMuted,
              padding: '1px 4px',
              borderRadius: '2px',
              fontSize: '7px',
            }}
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* Description */}
      {task.description && !compact && (
        <div
          style={{
            color: COLORS.textMuted,
            fontSize: '9px',
            lineHeight: 1.4,
            marginBottom: '6px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {task.description}
        </div>
      )}

      {/* Progress bar + collapsible checklist */}
      {totalCount > 0 && (
        <div style={{ marginBottom: task.blockedBy.length > 0 ? '4px' : 0 }}>
          <div
            onClick={() => setChecklistExpanded(!checklistExpanded)}
            style={{
              ...layoutPrimitives.row,
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              marginBottom: checklistExpanded ? '4px' : 0,
            }}
          >
            <span
              style={{
                fontSize: '8px',
                color: COLORS.textMuted,
                transform: checklistExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s',
              }}
            >
              ▶
            </span>
            <div
              style={{
                flex: 1,
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
            <span
              style={{
                fontSize: '8px',
                color: task.progress === 100 ? COLORS.success : COLORS.textMuted,
                fontWeight: 500,
              }}
            >
              {completedCount}/{totalCount}
            </span>
          </div>

          {/* Collapsible checklist */}
          {checklistExpanded && (
            <div
              style={{
                background: COLORS.bg,
                borderRadius: '3px',
                padding: '4px 6px',
              }}
            >
              {task.checklist.map((item: ChecklistItem, i: number) => {
                const isToggling = togglingItem === item.text
                const handleClick = async (e: React.MouseEvent) => {
                  e.stopPropagation()
                  if (!onToggleCheckbox || isToggling) return
                  setTogglingItem(item.text)
                  await onToggleCheckbox(item.text, item.checked)
                  setTogglingItem(null)
                }

                return (
                  <div
                    key={i}
                    onClick={handleClick}
                    style={{
                      ...layoutPrimitives.row,
                      alignItems: 'flex-start',
                      gap: '4px',
                      fontSize: '9px',
                      color: item.checked ? COLORS.textMuted : COLORS.text,
                      marginBottom: i < task.checklist.length - 1 ? '2px' : 0,
                      lineHeight: 1.2,
                      cursor: onToggleCheckbox ? 'pointer' : 'default',
                      opacity: isToggling ? 0.5 : 1,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <span
                      style={{
                        width: '12px',
                        height: '12px',
                        border: `1.5px solid ${item.checked ? COLORS.success : COLORS.border}`,
                        borderRadius: '3px',
                        background: item.checked ? COLORS.success : 'transparent',
                        ...layoutPrimitives.row,
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '8px',
                        color: COLORS.textInverse,
                        flexShrink: 0,
                        marginTop: '1px',
                        transition: 'all 0.15s',
                      }}
                    >
                      {item.checked ? '✓' : ''}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        textDecoration: item.checked ? 'line-through' : 'none',
                      }}
                    >
                      {item.text}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Blocked-by - compact */}
      {task.blockedBy.length > 0 && (
        <div
          style={{
            ...layoutPrimitives.row,
            alignItems: 'center',
            gap: '4px',
            fontSize: '8px',
            color: COLORS.error,
            marginBottom: (task.notes || (task.log && task.log.length > 0)) && !compact ? '4px' : 0,
          }}
        >
          <span>Blocked:</span>
          {task.blockedBy.slice(0, 2).map((id: string) => (
            <span
              key={id}
              style={{
                background: `${COLORS.error}20`,
                padding: '1px 4px',
                borderRadius: '2px',
              }}
            >
              {id}
            </span>
          ))}
          {task.blockedBy.length > 2 && <span>+{task.blockedBy.length - 2}</span>}
        </div>
      )}

      {/* Notes */}
      {task.notes && !compact && (
        <div style={{ marginBottom: '4px' }}>
          <div
            style={{
              fontSize: '8px',
              fontWeight: 600,
              color: COLORS.textMuted,
              marginBottom: '2px',
              textTransform: 'uppercase',
            }}
          >
            Notes
          </div>
          <div
            style={{
              color: COLORS.text,
              fontSize: '9px',
              lineHeight: 1.4,
              padding: '4px 6px',
              background: COLORS.bg,
              borderRadius: '3px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {task.notes}
          </div>
        </div>
      )}

      {/* Log entries */}
      {task.log && task.log.length > 0 && !compact && (
        <div style={{ marginBottom: '4px' }}>
          <div
            style={{
              fontSize: '8px',
              fontWeight: 600,
              color: COLORS.textMuted,
              marginBottom: '2px',
              textTransform: 'uppercase',
            }}
          >
            Log ({task.log.length})
          </div>
          <div
            style={{
              background: COLORS.bg,
              borderRadius: '3px',
              padding: '4px 6px',
            }}
          >
            {task.log.map((entry, i) => (
              <div
                key={i}
                style={{
                  ...layoutPrimitives.row,
                  gap: '4px',
                  fontSize: '8px',
                  marginBottom: i < task.log.length - 1 ? '2px' : 0,
                }}
              >
                <span
                  style={{
                    color: COLORS.textMuted,
                    fontFamily: 'monospace',
                    fontSize: '7px',
                    flexShrink: 0,
                  }}
                >
                  {entry.timestamp}
                </span>
                <span style={{ color: COLORS.text }}>{entry.entry}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source location */}
      {task.sourceFile && !compact && (
        <div
          style={{
            ...layoutPrimitives.row,
            alignItems: 'center',
            gap: '4px',
            fontSize: '7px',
            color: COLORS.textMuted,
            paddingTop: '4px',
            borderTop: `1px solid ${COLORS.border}`,
          }}
        >
          <span style={{ fontFamily: 'monospace' }}>
            {task.sourceFile}
            {task.sourceLine ? `:${task.sourceLine}` : ''}
          </span>
        </div>
      )}
    </div>
  )
})

