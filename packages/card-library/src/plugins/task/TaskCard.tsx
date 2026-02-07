import { memo, useState } from 'react'
import {
  CheckCircle2, Circle, Clock, AlertCircle, Flag, User, Calendar,
  Link2, GitBranch, Target, Bug, Lightbulb, Package,
  CheckSquare, Copy, Check,
} from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { TaskData, TaskStatus, TaskPriority } from './types'
import { statusColors, priorityColors, statusLabels, taskTypeColors } from './types'

// --- Helper functions ---

function getTaskTypeIcon(type: string | undefined, size: number, color?: string) {
  if (!type) return null
  const lowerType = type.toLowerCase()
  const iconColor = color || taskTypeColors[lowerType] || '#6b7280'
  const props = { size, color: iconColor, strokeWidth: 2 }

  switch (lowerType) {
    case 'bug':
    case 'bugfix':
      return <Bug {...props} />
    case 'spike':
    case 'research':
      return <Lightbulb {...props} />
    case 'epic':
      return <Target {...props} />
    case 'story':
    case 'feature':
      return <Package {...props} />
    case 'subtask':
    case 'chore':
      return <CheckSquare {...props} />
    default:
      return <Circle {...props} />
  }
}

function getStatusIcon(status: TaskStatus, size: number, color?: string) {
  const iconColor = color || statusColors[status]
  const props = { size, color: iconColor, strokeWidth: 2 }

  switch (status) {
    case 'done':
      return <CheckCircle2 {...props} />
    case 'in-progress':
      return <Clock {...props} />
    case 'blocked':
      return <AlertCircle {...props} />
    case 'todo':
    default:
      return <Circle {...props} />
  }
}

/** Task card — renders a task block at different detail levels */
export const TaskCard = memo(function TaskCard({
  data,
  detail,
  theme,
  onEdit,
}: BlockRenderProps<TaskData>) {
  const [checklistExpanded, setChecklistExpanded] = useState(detail === 'full')
  const [copied, setCopied] = useState(false)

  const statusColor = statusColors[data.status]
  const completedCount = data.checklist.filter((c) => c.checked).length
  const totalCount = data.checklist.length

  const handleCopyId = () => {
    navigator.clipboard.writeText(data.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
        {data.taskType && (
          <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {getTaskTypeIcon(data.taskType, 11)}
          </span>
        )}
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
          {data.taskType && (
            <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {getTaskTypeIcon(data.taskType, 12)}
            </span>
          )}
          <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {getStatusIcon(data.status, 12)}
          </span>
          <StatusBadge status={data.status} />
          <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Flag size={10} color={priorityColors[data.priority]} strokeWidth={2} />
          </span>
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
        {data.taskType && (
          <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {getTaskTypeIcon(data.taskType, 14)}
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {getStatusIcon(data.status, 14)}
        </span>
        <StatusBadge status={data.status} />
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Flag size={12} color={priorityColors[data.priority]} strokeWidth={2} />
        </span>
        <span style={{
          fontSize: 12,
          color: theme.textPrimary,
          fontWeight: 600,
          flex: 1,
        }}>
          {data.title}
        </span>
        <button
          onClick={handleCopyId}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            color: copied ? theme.success : theme.textMuted,
            transition: 'color 0.2s',
          }}
          title="Copy task ID"
        >
          {copied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={2} />}
        </button>
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

      {/* Workflow */}
      {data.workflow && (
        <div style={{ marginBottom: 6 }}>
          <span style={{
            fontSize: 8,
            padding: '2px 6px',
            borderRadius: 3,
            background: `${theme.accent}15`,
            color: theme.accent,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {data.workflow}
          </span>
        </div>
      )}

      {/* Metadata row: owner, due date, effort */}
      {(data.owner || data.dueDate || data.estimatedEffort) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          {data.owner && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <User size={10} color={theme.textMuted} strokeWidth={2} />
              <span style={{ fontSize: 8, color: theme.textSecondary }}>{data.owner}</span>
            </div>
          )}
          {data.dueDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Calendar size={10} color={theme.textMuted} strokeWidth={2} />
              <span style={{ fontSize: 8, color: theme.textSecondary }}>{data.dueDate}</span>
            </div>
          )}
          {data.estimatedEffort && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={10} color={theme.textMuted} strokeWidth={2} />
              <span style={{ fontSize: 8, color: theme.textSecondary }}>{data.estimatedEffort}</span>
            </div>
          )}
        </div>
      )}

      {/* Entity Links */}
      {data.entityLinks && data.entityLinks.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 8, color: theme.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>
            Links
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {data.entityLinks.map((link, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Link2 size={9} color={theme.accent} strokeWidth={2} />
                <span style={{
                  fontSize: 8,
                  padding: '1px 4px',
                  borderRadius: 2,
                  background: `${theme.accent}15`,
                  color: theme.accent,
                }}>
                  {link.entityName || link.entityType}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dependencies */}
      {data.dependencies && data.dependencies.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 8, color: theme.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>
            Dependencies
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {data.dependencies.map((dep, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <GitBranch size={9} color={theme.textSecondary} strokeWidth={2} />
                <span style={{
                  fontSize: 8,
                  padding: '1px 4px',
                  borderRadius: 2,
                  background: theme.bgTertiary,
                  color: theme.textSecondary,
                }}>
                  {dep.taskName || dep.type}
                </span>
              </div>
            ))}
          </div>
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
