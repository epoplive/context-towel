// ============================================================================
// Task Plugin Components - React components for task rendering
// ============================================================================

import {
  memo,
  useCallback,
  useId,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import {
  Handle,
  Position,
  getSmoothStepPath,
} from '@xyflow/react'
import * as dagre from 'dagre'
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { TaskItem, ChecklistItem, getStatusColor, getPriorityColor } from './types'
import { buildTaskIndex, resolveTaskRefList } from './idUtils'
import { ButtonGroup, ButtonGroupItem, Select, useTheme } from '../../compat/design-system'
import { useGraphStore } from '../../state/store'
import { useContextGraphController } from '../../hooks/useContextGraphController'
import type { TaskBoardGroupBy, TaskBoardPrefs } from '../../state/slices'
import { fileService } from '../../compat/services'
import { layoutPrimitives } from '../../compat/layoutPrimitives'

// Hook to get colors from theme
function useTaskColors() {
  const { colors } = useTheme()
  return useMemo(() => ({
    bg: colors.bgSecondary,
    bgDark: colors.bgPrimary,
    border: colors.borderPrimary,
    text: colors.textPrimary,
    textPrimary: colors.textPrimary,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    success: colors.success,
    error: colors.error,
    info: colors.info,
    accent: colors.accent,
    textInverse: colors.textInverse,
  }), [colors])
}

// Helper to get cardScale from node data with default
const getCardScale = (data: any): number => data?.cardScale ?? 1.0

const STATUS_ORDER: TaskItem['status'][] = ['todo', 'in-progress', 'blocked', 'done']
const PRIORITY_ORDER: TaskItem['priority'][] = ['critical', 'high', 'medium', 'low']
const STATUS_LABELS: Record<TaskItem['status'], string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
}

function getTaskKey(task: TaskItem, parentDocId: string): string {
  const line = task.sourceLine ?? 0
  return `${parentDocId}:${task.id}:${line}`
}

function formatGroupLabel(groupBy: TaskBoardGroupBy, value: string): string {
  if (groupBy === 'status') {
    return STATUS_LABELS[value as TaskItem['status']] || value
  }
  if (groupBy === 'priority') {
    return value.charAt(0).toUpperCase() + value.slice(1)
  }
  return value
}

export function buildTaskBoardGroups(tasks: TaskItem[], groupBy: TaskBoardGroupBy) {
  if (groupBy === 'none') return null
  const groups = new Map<string, TaskItem[]>()
  tasks.forEach(task => {
    const key = groupBy === 'status' ? task.status : task.priority
    const bucket = groups.get(key) || []
    bucket.push(task)
    groups.set(key, bucket)
  })

  groups.forEach((items, key) => {
    items.sort((a, b) => (a.sourceLine ?? 0) - (b.sourceLine ?? 0))
    groups.set(key, items)
  })

  const orderedKeys = (groupBy === 'status' ? STATUS_ORDER : PRIORITY_ORDER)
    .filter(key => groups.has(key))
    .map(key => key as string)

  for (const key of groups.keys()) {
    if (!orderedKeys.includes(key)) {
      orderedKeys.push(key)
    }
  }

  return { groups, orderedKeys }
}

export function getTaskBoardDragUpdate(
  groupBy: TaskBoardGroupBy,
  task: TaskItem,
  nextGroupBy?: TaskBoardGroupBy,
  nextValue?: string
): { status?: TaskItem['status']; priority?: TaskItem['priority'] } | null {
  if (!nextGroupBy || !nextValue || nextGroupBy !== groupBy) return null
  if (groupBy === 'status' && task.status !== nextValue) {
    return { status: nextValue as TaskItem['status'] }
  }
  if (groupBy === 'priority' && task.priority !== nextValue) {
    return { priority: nextValue as TaskItem['priority'] }
  }
  return null
}

type TaskLayoutNode = {
  id: string
  task: TaskItem
  x: number
  y: number
  width: number
  height: number
}

const TaskDependencyCard = ({
  task,
  width,
  height,
}: {
  task: TaskItem
  width: number
  height: number
}) => {
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
    }}>
      <div style={{
        ...layoutPrimitives.row,
        alignItems: 'center',
        gap: '4px',
      }}>
        <span style={{
          background: statusColor,
          color: task.status === 'done' ? COLORS.textInverse : COLORS.bgDark,
          padding: '1px 5px',
          borderRadius: '3px',
          fontSize: `${metaSize}px`,
          fontWeight: 700,
          textTransform: 'uppercase',
          lineHeight: 1.2,
        }}>
          {task.status === 'in-progress' ? 'WIP' : task.status}
        </span>
        <span style={{
          width: `${Math.max(6, Math.round(6 * fontScale))}px`,
          height: `${Math.max(6, Math.round(6 * fontScale))}px`,
          borderRadius: '50%',
          background: priorityColor,
        }} />
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
      <div style={{
        color: COLORS.text,
        fontWeight: 600,
        fontSize: `${titleSize}px`,
        lineHeight: 1.25,
        maxHeight: `${Math.round(titleSize * 2.6)}px`,
        overflow: 'hidden',
      }}>
        {task.title}
      </div>
    </div>
  )
}

function findTaskBlockStart(lines: string[], sourceLine?: number): number {
  if (!sourceLine) return -1
  const startIndex = Math.max(sourceLine - 1, 0)
  for (let i = startIndex; i >= 0; i--) {
    if (lines[i].trim() === '```task') return i
  }
  for (let i = startIndex; i < lines.length; i++) {
    if (lines[i].trim() === '```task') return i
  }
  return -1
}

function findTaskBlockEnd(lines: string[], startIndex: number): number {
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].trim() === '```') return i
  }
  return -1
}

function updateTaskBlockLines(lines: string[], updates: { status?: TaskItem['status']; priority?: TaskItem['priority'] }): string[] {
  const next = [...lines]

  const findFieldIndex = (key: string) => next.findIndex(
    (line) => line.trimStart() === line && line.startsWith(`${key}:`)
  )

  const upsertField = (key: string, value: string | undefined) => {
    if (!value) return
    const index = findFieldIndex(key)
    if (index >= 0) {
      next[index] = `${key}: ${value}`
      return
    }
    const titleIndex = findFieldIndex('title')
    const insertAt = titleIndex >= 0 ? titleIndex + 1 : 0
    next.splice(insertAt, 0, `${key}: ${value}`)
  }

  upsertField('status', updates.status)
  upsertField('priority', updates.priority)

  return next
}

function updateTaskContent(
  content: string,
  task: TaskItem,
  updates: { status?: TaskItem['status']; priority?: TaskItem['priority'] }
): string | null {
  const normalized = content.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const startIndex = findTaskBlockStart(lines, task.sourceLine)
  if (startIndex === -1) return null
  const endIndex = findTaskBlockEnd(lines, startIndex)
  if (endIndex === -1) return null

  const bodyLines = lines.slice(startIndex + 1, endIndex)
  const updatedBody = updateTaskBlockLines(bodyLines, updates)
  if (updatedBody.join('\n') === bodyLines.join('\n')) {
    return null
  }

  const nextLines = [
    ...lines.slice(0, startIndex + 1),
    ...updatedBody,
    ...lines.slice(endIndex),
  ]

  return nextLines.join('\n')
}

// All 4 edge handles for React Flow
const EdgeHandles = memo(({ color }: { color: string }) => (
  <>
    <Handle type="target" id="top" position={Position.Top} style={{ background: color }} />
    <Handle type="target" id="left" position={Position.Left} style={{ background: color }} />
    <Handle type="target" id="right" position={Position.Right} style={{ background: color }} />
    <Handle type="target" id="bottom" position={Position.Bottom} style={{ background: color }} />
    <Handle type="source" id="source-top" position={Position.Top} style={{ background: color }} />
    <Handle type="source" id="source-left" position={Position.Left} style={{ background: color }} />
    <Handle type="source" id="source-right" position={Position.Right} style={{ background: color }} />
    <Handle type="source" id="source-bottom" position={Position.Bottom} style={{ background: color }} />
  </>
))

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
    <div style={{
      background: COLORS.bgDark,
      border: `1px solid ${COLORS.border}`,
      borderLeft: `3px solid ${statusColor}`,
      borderRadius: '4px',
      padding: '6px 8px',
      marginBottom: '6px',
    }}>
      {/* Task header */}
      <div style={{ ...layoutPrimitives.row, alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
        <span style={{
          background: statusColor,
          color: task.status === 'done' ? COLORS.textInverse : COLORS.bgDark,
          padding: '1px 4px',
          borderRadius: '3px',
          fontSize: '8px',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}>
          {task.status}
        </span>
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: priorityColor,
        }} title={task.priority} />
        <span style={{
          color: COLORS.text,
          fontSize: '10px',
          fontWeight: 600,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {task.title}
        </span>
      </div>

      {/* Progress bar if has checklist */}
      {totalCount > 0 && (
        <div style={{ marginBottom: '4px' }}>
          <div style={{
            height: '3px',
            background: COLORS.border,
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${task.progress}%`,
              background: task.progress === 100 ? COLORS.success : statusColor,
            }} />
          </div>
          <div style={{
            fontSize: '8px',
            color: COLORS.textMuted,
            textAlign: 'right',
            marginTop: '1px',
          }}>
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
              <span style={{
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
              }}>
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
    <div style={{
      background: COLORS.bgDark,
      border: `1px solid ${COLORS.border}`,
      borderLeft: `3px solid ${statusColor}`,
      borderRadius: '4px',
      padding: compact ? '6px 8px' : '8px 10px',
    }}>
      {/* Header: Status + Priority + Title + Tags */}
      <div style={{
        ...layoutPrimitives.row,
        alignItems: 'center',
        gap: '4px',
        marginBottom: '4px',
        flexWrap: 'wrap',
      }}>
        <span style={{
          background: statusColor,
          color: task.status === 'done' ? COLORS.textInverse : COLORS.bgDark,
          padding: '1px 5px',
          borderRadius: '3px',
          fontSize: '8px',
          fontWeight: 700,
          textTransform: 'uppercase',
        }}>
          {task.status === 'in-progress' ? 'WIP' : task.status}
        </span>
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: priorityColor,
        }} title={task.priority} />
        <span style={{
          color: COLORS.text,
          fontWeight: 600,
          fontSize: compact ? '10px' : '11px',
          flex: 1,
          lineHeight: 1.3,
        }}>
          {task.title}
        </span>
        {task.tags.slice(0, 2).map((tag: string) => (
          <span key={tag} style={{
            background: COLORS.bg,
            color: COLORS.textMuted,
            padding: '1px 4px',
            borderRadius: '2px',
            fontSize: '7px',
          }}>
            #{tag}
          </span>
        ))}
      </div>

      {/* Description */}
      {task.description && !compact && (
        <div style={{
          color: COLORS.textMuted,
          fontSize: '9px',
          lineHeight: 1.4,
          marginBottom: '6px',
          whiteSpace: 'pre-wrap',
        }}>
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
            <span style={{
              fontSize: '8px',
              color: COLORS.textMuted,
              transform: checklistExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
            }}>▶</span>
            <div style={{
              flex: 1,
              height: '3px',
              background: COLORS.border,
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${task.progress}%`,
                background: task.progress === 100 ? COLORS.success : statusColor,
              }} />
            </div>
            <span style={{
              fontSize: '8px',
              color: task.progress === 100 ? COLORS.success : COLORS.textMuted,
              fontWeight: 500,
            }}>
              {completedCount}/{totalCount}
            </span>
          </div>

          {/* Collapsible checklist */}
          {checklistExpanded && (
            <div style={{
              background: COLORS.bg,
              borderRadius: '3px',
              padding: '4px 6px',
            }}>
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
                    <span style={{
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
                    }}>
                      {item.checked ? '✓' : ''}
                    </span>
                    <span style={{
                      flex: 1,
                      textDecoration: item.checked ? 'line-through' : 'none',
                    }}>
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
        <div style={{
          ...layoutPrimitives.row,
          alignItems: 'center',
          gap: '4px',
          fontSize: '8px',
          color: COLORS.error,
          marginBottom: (task.notes || (task.log && task.log.length > 0)) && !compact ? '4px' : 0,
        }}>
          <span>Blocked:</span>
          {task.blockedBy.slice(0, 2).map((id: string) => (
            <span key={id} style={{
              background: `${COLORS.error}20`,
              padding: '1px 4px',
              borderRadius: '2px',
            }}>
              {id}
            </span>
          ))}
          {task.blockedBy.length > 2 && <span>+{task.blockedBy.length - 2}</span>}
        </div>
      )}

      {/* Notes */}
      {task.notes && !compact && (
        <div style={{ marginBottom: '4px' }}>
          <div style={{
            fontSize: '8px',
            fontWeight: 600,
            color: COLORS.textMuted,
            marginBottom: '2px',
            textTransform: 'uppercase',
          }}>
            Notes
          </div>
          <div style={{
            color: COLORS.text,
            fontSize: '9px',
            lineHeight: 1.4,
            padding: '4px 6px',
            background: COLORS.bg,
            borderRadius: '3px',
            whiteSpace: 'pre-wrap',
          }}>
            {task.notes}
          </div>
        </div>
      )}

      {/* Log entries */}
      {task.log && task.log.length > 0 && !compact && (
        <div style={{ marginBottom: '4px' }}>
          <div style={{
            fontSize: '8px',
            fontWeight: 600,
            color: COLORS.textMuted,
            marginBottom: '2px',
            textTransform: 'uppercase',
          }}>
            Log ({task.log.length})
          </div>
          <div style={{
            background: COLORS.bg,
            borderRadius: '3px',
            padding: '4px 6px',
          }}>
            {task.log.map((entry, i) => (
              <div key={i} style={{
                ...layoutPrimitives.row,
                gap: '4px',
                fontSize: '8px',
                marginBottom: i < task.log.length - 1 ? '2px' : 0,
              }}>
                <span style={{
                  color: COLORS.textMuted,
                  fontFamily: 'monospace',
                  fontSize: '7px',
                  flexShrink: 0,
                }}>
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
        <div style={{
          ...layoutPrimitives.row,
          alignItems: 'center',
          gap: '4px',
          fontSize: '7px',
          color: COLORS.textMuted,
          paddingTop: '4px',
          borderTop: `1px solid ${COLORS.border}`,
        }}>
          <span style={{ fontFamily: 'monospace' }}>
            {task.sourceFile}{task.sourceLine ? `:${task.sourceLine}` : ''}
          </span>
        </div>
      )}
    </div>
  )
})

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
        <span style={{
          background: statusColor,
          color: task.status === 'done' ? COLORS.textInverse : COLORS.bgDark,
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '9px',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}>
          {task.status}
        </span>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: priorityColor,
          border: task.priority === 'critical' ? `2px solid ${COLORS.textInverse}` : 'none',
        }} title={task.priority} />
        <span style={{ flex: 1 }} />
        {task.tags.slice(0, 2).map((tag: string) => (
          <span key={tag} style={{
            background: COLORS.bgDark,
            color: COLORS.textMuted,
            padding: '1px 4px',
            borderRadius: '3px',
            fontSize: '8px',
          }}>
            #{tag}
          </span>
        ))}
      </div>

      {/* Title */}
      <div style={{
        color: COLORS.text,
        fontWeight: 600,
        fontSize: '12px',
        marginBottom: '8px',
        lineHeight: 1.3,
      }}>
        {task.title}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{
            ...layoutPrimitives.row,
            justifyContent: 'space-between',
            fontSize: '9px',
            color: COLORS.textMuted,
            marginBottom: '2px',
          }}>
            <span>Progress</span>
            <span>{completedCount}/{totalCount}</span>
          </div>
          <div style={{
            height: '6px',
            background: COLORS.border,
            borderRadius: '3px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${task.progress}%`,
              background: task.progress === 100 ? COLORS.success : statusColor,
              transition: 'width 0.3s ease',
            }} />
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
              <span style={{
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
              }}>
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
        <div style={{
          ...layoutPrimitives.row,
          alignItems: 'center',
          gap: '4px',
          fontSize: '9px',
          color: COLORS.error,
          marginTop: '4px',
        }}>
          <span>Blocked by:</span>
          {task.blockedBy.map((id: string) => (
            <span key={id} style={{
              background: `${COLORS.error}33`,
              padding: '1px 4px',
              borderRadius: '3px',
            }}>
              {id}
            </span>
          ))}
        </div>
      )}
    </div>
  )
})

// ============================================================================
// TASK BOARD (grouped board + dependency view)
// ============================================================================

interface TaskBoardProps {
  tasks: TaskItem[]
  parentDocId: string
  taskListId: string
  view: 'focus' | 'normal'
}

const TaskBoardDraggableCard = ({ task, dragId }: { task: TaskItem; dragId: string }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { taskId: dragId },
  })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.6 : 1,
    cursor: 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      {...listeners}
      {...attributes}
    >
      <DetailedTaskCard task={task} compact />
    </div>
  )
}

const TaskBoardStaticCard = ({ task }: { task: TaskItem }) => (
  <div
    style={{ cursor: 'default' }}
    onPointerDown={(event) => event.stopPropagation()}
  >
    <DetailedTaskCard task={task} compact />
  </div>
)

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
        minWidth: '200px',
        maxWidth: '240px',
        borderRadius: '6px',
        border: `1px solid ${isOver || highlight ? COLORS.accent : COLORS.border}`,
        background: COLORS.bgDark,
        padding: '6px',
        ...layoutPrimitives.column,
        gap: '6px',
      }}
    >
      <div style={{
        fontSize: '9px',
        fontWeight: 700,
        color: COLORS.textSecondary,
        letterSpacing: '0.4px',
        textTransform: 'uppercase',
      }}>
        {title} ({tasks.length})
      </div>
      {children}
    </div>
  )
}

const TaskDependencyView = ({
  tasks,
  height,
  onHeightChange,
  cardWidth,
  onCardWidthChange,
  scrollX,
  scrollY,
  onScrollChange,
  width,
  onWidthChange,
}: {
  tasks: TaskItem[]
  height: number
  onHeightChange: (nextHeight: number) => void
  cardWidth: number
  onCardWidthChange: (nextWidth: number) => void
  scrollX: number
  scrollY: number
  onScrollChange: (nextX: number, nextY: number) => void
  width: number
  onWidthChange: (nextWidth: number) => void
}) => {
  const COLORS = useTaskColors()
  const markerId = useId()
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const panState = useRef({
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  })
  const resizeState = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startHeight: 0,
    startWidth: 0,
  })
  const scrollRaf = useRef<number | null>(null)
  const lastScroll = useRef({ x: scrollX, y: scrollY })

  const { nodes, edges, hasCycle, bounds, nodeMap } = useMemo(() => {
    const taskIndex = buildTaskIndex(tasks)
    const nodeIdsByTaskId = new Map<string, string[]>()
    const edges: Array<{ sourceId: string; targetId: string }> = []

    const normalizedDeps = new Map<string, string[]>()
    const levelCache = new Map<string, number>()
    const visiting = new Set<string>()
    let hasCycle = false

    tasks.forEach(task => {
      const deps = resolveTaskRefList(task.blockedBy ?? [], task, taskIndex)
      normalizedDeps.set(task.id, deps)
    })

    tasks.forEach(task => {
      const nodeId = `${task.id}:${task.sourceLine ?? 0}`
      const list = nodeIdsByTaskId.get(task.id) || []
      list.push(nodeId)
      nodeIdsByTaskId.set(task.id, list)
    })

    const computeLevel = (taskId: string): number => {
      if (levelCache.has(taskId)) return levelCache.get(taskId) as number
      if (visiting.has(taskId)) {
        hasCycle = true
        return 0
      }
      visiting.add(taskId)
      const deps = normalizedDeps.get(taskId) || []
      const level = deps.length === 0 ? 0 : Math.max(...deps.map(dep => computeLevel(dep))) + 1
      visiting.delete(taskId)
      levelCache.set(taskId, level)
      return level
    }

    tasks.forEach(task => {
      const deps = normalizedDeps.get(task.id) || []
      deps.forEach(depId => {
        const sourceIds = nodeIdsByTaskId.get(depId) || []
        const targetIds = nodeIdsByTaskId.get(task.id) || []
        sourceIds.forEach(sourceId => {
          targetIds.forEach(targetId => {
            edges.push({ sourceId, targetId })
          })
        })
      })
    })

    const NODE_WIDTH = Math.round(cardWidth)
    const estimateNodeHeight = (task: TaskItem): number => {
      const paddingY = 12
      const headerHeight = 12
      const gap = 3
      const lineHeight = 12
      const charsPerLine = Math.max(16, Math.floor((NODE_WIDTH - 24) / 6))
      const lines = Math.min(2, Math.max(1, Math.ceil(task.title.length / charsPerLine)))
      const height = paddingY + headerHeight + gap + (lines * lineHeight)
      return Math.max(40, height)
    }
    const graph = new dagre.graphlib.Graph({ multigraph: true })
    graph.setGraph({
      rankdir: 'TB',
      nodesep: 26,
      ranksep: 36,
      marginx: 16,
      marginy: 16,
    })
    graph.setDefaultEdgeLabel(() => ({}))

    const nodeTaskMap = new Map<string, TaskItem>()
    const nodeHeights = new Map<string, number>()
    tasks.forEach(task => {
      const nodeId = `${task.id}:${task.sourceLine ?? 0}`
      nodeTaskMap.set(nodeId, task)
      const nodeHeight = estimateNodeHeight(task)
      nodeHeights.set(nodeId, nodeHeight)
      graph.setNode(nodeId, { width: NODE_WIDTH, height: nodeHeight })
    })

    edges.forEach(edge => {
      graph.setEdge(edge.sourceId, edge.targetId)
    })

    dagre.layout(graph)

    const nodes: TaskLayoutNode[] = []
    const nodeMap = new Map<string, TaskLayoutNode>()
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = 0
    let maxY = 0

    graph.nodes().forEach(nodeId => {
      const layout = graph.node(nodeId) as { x: number; y: number; width: number; height: number }
      const task = nodeTaskMap.get(nodeId)
      if (!task) return
      const nodeHeight = nodeHeights.get(nodeId) ?? 52
      const node: TaskLayoutNode = {
        id: nodeId,
        task,
        x: layout.x - layout.width / 2,
        y: layout.y - layout.height / 2,
        width: layout.width,
        height: nodeHeight,
      }
      nodes.push(node)
      nodeMap.set(nodeId, node)
      minX = Math.min(minX, node.x)
      minY = Math.min(minY, node.y)
      maxX = Math.max(maxX, node.x + node.width)
      maxY = Math.max(maxY, node.y + node.height)
    })

    const padding = 12
    const bounds = {
      minX: Number.isFinite(minX) ? minX - padding : 0,
      minY: Number.isFinite(minY) ? minY - padding : 0,
      width: Number.isFinite(maxX) ? maxX - minX + padding * 2 : 240,
      height: Number.isFinite(maxY) ? maxY - minY + padding * 2 : 180,
    }

    return { nodes, edges, hasCycle, bounds, nodeMap }
  }, [cardWidth, tasks])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (resizeState.current.active) {
        const deltaX = event.clientX - resizeState.current.startX
        const delta = event.clientY - resizeState.current.startY
        const nextHeight = Math.max(220, Math.min(720, resizeState.current.startHeight + delta))
        onHeightChange(nextHeight)
        const nextWidth = Math.max(260, Math.min(1400, resizeState.current.startWidth + deltaX))
        onWidthChange(nextWidth)
        return
      }
      if (!panState.current.active) return
      const viewport = viewportRef.current
      if (!viewport) return
      viewport.scrollLeft = panState.current.scrollLeft - (event.clientX - panState.current.startX)
      viewport.scrollTop = panState.current.scrollTop - (event.clientY - panState.current.startY)
    }

    const handleMouseUp = () => {
      if (resizeState.current.active) {
        resizeState.current.active = false
        document.body.style.userSelect = ''
      }
      if (panState.current.active) {
        panState.current.active = false
        const viewport = viewportRef.current
        if (viewport) viewport.style.cursor = 'grab'
        document.body.style.userSelect = ''
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onHeightChange, onScrollChange])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    lastScroll.current = { x: scrollX, y: scrollY }
    const maxX = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    const maxY = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    const nextX = Math.min(maxX, Math.max(0, scrollX))
    const nextY = Math.min(maxY, Math.max(0, scrollY))
    if (Math.abs(viewport.scrollLeft - nextX) > 1 || Math.abs(viewport.scrollTop - nextY) > 1) {
      viewport.scrollLeft = nextX
      viewport.scrollTop = nextY
    }
  }, [bounds.height, bounds.width, cardWidth, height, scrollX, scrollY])

  const handleScroll = useCallback(() => {
    if (scrollRaf.current) return
    scrollRaf.current = window.requestAnimationFrame(() => {
      scrollRaf.current = null
      const viewport = viewportRef.current
      if (!viewport) return
      const nextX = viewport.scrollLeft
      const nextY = viewport.scrollTop
      if (nextX === lastScroll.current.x && nextY === lastScroll.current.y) return
      lastScroll.current = { x: nextX, y: nextY }
      onScrollChange(nextX, nextY)
    })
  }, [onScrollChange])

  const handlePanMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('[data-task-dep-card]')) return
    const viewport = viewportRef.current
    if (!viewport) return
    panState.current.active = true
    panState.current.startX = event.clientX
    panState.current.startY = event.clientY
    panState.current.scrollLeft = viewport.scrollLeft
    panState.current.scrollTop = viewport.scrollTop
    viewport.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    event.preventDefault()
  }, [])

  const handleResizeMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const viewport = viewportRef.current
    const currentWidth = width > 0
      ? width
      : (viewport?.getBoundingClientRect().width ?? 360)
    resizeState.current.active = true
    resizeState.current.startX = event.clientX
    resizeState.current.startY = event.clientY
    resizeState.current.startHeight = height
    resizeState.current.startWidth = currentWidth
    document.body.style.userSelect = 'none'
  }, [height, width])

  return (
    <div style={{ ...layoutPrimitives.column, gap: '6px' }}>
      {hasCycle && (
        <div style={{
          fontSize: '9px',
          color: COLORS.error,
          background: `${COLORS.error}22`,
          border: `1px solid ${COLORS.error}`,
          borderRadius: '4px',
          padding: '4px 6px',
        }}>
          Cycle detected in task dependencies.
        </div>
      )}
      <div style={{ ...layoutPrimitives.row, alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '9px', color: COLORS.textMuted }}>Dependency layout</span>
        <div style={{ ...layoutPrimitives.row, alignItems: 'center', gap: '6px' }}>
          <ButtonGroup>
            <ButtonGroupItem onClick={() => onCardWidthChange(Math.max(150, cardWidth - 20))}>−</ButtonGroupItem>
            <ButtonGroupItem onClick={() => onCardWidthChange(Math.min(260, cardWidth + 20))}>+</ButtonGroupItem>
          </ButtonGroup>
          <span style={{ fontSize: '9px', color: COLORS.textMuted }}>Width {cardWidth}px</span>
        </div>
      </div>
      <div
        style={{
          position: 'relative',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div
          ref={viewportRef}
          onMouseDown={handlePanMouseDown}
          onScroll={handleScroll}
          style={{
            position: 'relative',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '6px',
            background: COLORS.bgDark,
            padding: '6px',
            overflow: 'auto',
            height: `${height}px`,
            cursor: 'grab',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ minWidth: '100%', minHeight: '100%', ...layoutPrimitives.row, justifyContent: 'center' }}>
            <div
              style={{
                position: 'relative',
                width: `${bounds.width}px`,
                height: `${bounds.height}px`,
              }}
            >
            <svg
              width={bounds.width}
              height={bounds.height}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              <defs>
                {[
                  { key: 'default', color: COLORS.border },
                  { key: 'done', color: COLORS.success },
                  { key: 'blocked', color: COLORS.error },
                  { key: 'inprogress', color: COLORS.info },
                ].map(marker => (
                  <marker
                    key={marker.key}
                    id={`${markerId}-${marker.key}`}
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={marker.color} />
                  </marker>
                ))}
              </defs>
              {edges.map((edge, index) => {
                const source = nodeMap.get(edge.sourceId)
                const target = nodeMap.get(edge.targetId)
                if (!source || !target) return null
                const sourceStatus = source.task.status
                let edgeColor = COLORS.border
                let markerKey = 'default'
                if (sourceStatus === 'done') {
                  edgeColor = COLORS.success
                  markerKey = 'done'
                } else if (sourceStatus === 'blocked') {
                  edgeColor = COLORS.error
                  markerKey = 'blocked'
                } else if (sourceStatus === 'in-progress') {
                  edgeColor = COLORS.info
                  markerKey = 'inprogress'
                }
                const sourceX = source.x + source.width / 2 - bounds.minX
                const sourceY = source.y + source.height - bounds.minY
                const targetX = target.x + target.width / 2 - bounds.minX
                const targetY = target.y - bounds.minY
                const [edgePath] = getSmoothStepPath({
                  sourceX,
                  sourceY,
                  targetX,
                  targetY,
                  sourcePosition: Position.Bottom,
                  targetPosition: Position.Top,
                  borderRadius: 18,
                  offset: 22,
                })
                return (
                  <path
                    key={`${edge.sourceId}->${edge.targetId}-${index}`}
                    d={edgePath}
                    fill="none"
                    stroke={edgeColor}
                    strokeWidth={1.4}
                    opacity={target.task.status === 'done' ? 0.5 : 0.9}
                    markerEnd={`url(#${markerId}-${markerKey})`}
                  />
                )
              })}
            </svg>

            {nodes.map(node => (
              <div
                key={node.id}
                style={{
                  position: 'absolute',
                  left: node.x - bounds.minX,
                  top: node.y - bounds.minY,
                  width: node.width,
                  height: node.height,
                }}
              >
                <TaskDependencyCard
                  task={node.task}
                  width={node.width}
                  height={node.height}
                />
              </div>
            ))}
            </div>
          </div>
        </div>
        <div
          onMouseDown={handleResizeMouseDown}
          style={{
            position: 'absolute',
            right: 4,
            bottom: 4,
            width: 16,
            height: 16,
            cursor: 'nwse-resize',
            border: `1px solid ${COLORS.border}`,
            background: COLORS.bg,
            borderRadius: '3px',
            boxShadow: `0 0 0 1px ${COLORS.bgDark}`,
            opacity: 0.9,
            zIndex: 5,
            pointerEvents: 'auto',
          }}
          title="Resize"
        />
      </div>
    </div>
  )
}

const TaskBoard = ({ tasks, parentDocId, taskListId, view }: TaskBoardProps) => {
  const COLORS = useTaskColors()
  const taskBoardDefaults = useGraphStore(state => state.taskBoardDefaults)
  const taskBoardByList = useGraphStore(state => state.taskBoardByList)
  const setTaskBoardPrefs = useGraphStore(state => state.setTaskBoardPrefs)
  const docContents = useGraphStore(state => state.docContents)
  const treeItems = useGraphStore(state => state.treeItems)
  const setDocContentParsed = useGraphStore(state => state.setDocContentParsed)
  const controller = useContextGraphController()

  const defaults = taskBoardDefaults[view]
  const fallbackDefaults = taskBoardDefaults[view === 'focus' ? 'normal' : 'focus']
  const prefs = { ...defaults, ...taskBoardByList[taskListId] }
  const groupBy = prefs.groupBy
  const viewMode = prefs.view
  const columnCount = prefs.columnCount ?? fallbackDefaults.columnCount ?? 1
  const dependencyHeight = prefs.dependencyHeight ?? fallbackDefaults.dependencyHeight ?? 360
  const dependencyCardWidth = prefs.dependencyCardWidth ?? fallbackDefaults.dependencyCardWidth ?? 190
  const dependencyScrollX = prefs.dependencyScrollX ?? fallbackDefaults.dependencyScrollX ?? 0
  const dependencyScrollY = prefs.dependencyScrollY ?? fallbackDefaults.dependencyScrollY ?? 0
  const dependencyWidth = prefs.dependencyWidth ?? fallbackDefaults.dependencyWidth ?? 0

  const updateDependencyShared = (updates: Partial<TaskBoardPrefs>) => {
    setTaskBoardPrefs(taskListId, updates)
  }

  const taskByKey = useMemo(() => {
    const map = new Map<string, TaskItem>()
    tasks.forEach(task => map.set(getTaskKey(task, parentDocId), task))
    return map
  }, [tasks, parentDocId])

  const updateTaskField = useCallback(async (task: TaskItem, updates: { status?: TaskItem['status']; priority?: TaskItem['priority'] }) => {
    const doc = docContents.get(parentDocId)
    if (!doc) return
    const updated = updateTaskContent(doc.content, task, updates)
    if (!updated) return
    const item = treeItems.find(entry => entry.id === parentDocId)
    if (item) {
      try {
        await fileService.write(item.path, updated)
        const parsed = await controller.parseContent(item.path, updated)
        setDocContentParsed(parentDocId, parsed)
      } catch (err) {
        console.error('Failed to save task update:', err)
      }
    }
  }, [controller, docContents, parentDocId, setDocContentParsed, treeItems])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const orderedGroups = useMemo(() => buildTaskBoardGroups(tasks, groupBy), [groupBy, tasks])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    if (!event.over) return
    const activeTask = taskByKey.get(String(event.active.id))
    if (!activeTask) return
    const overData = event.over.data?.current
    const nextGroupBy = overData?.groupBy as TaskBoardGroupBy | undefined
    const nextValue = overData?.value as string | undefined
    const update = getTaskBoardDragUpdate(groupBy, activeTask, nextGroupBy, nextValue)
    if (!update) return
    updateTaskField(activeTask, update)
  }, [groupBy, taskByKey, updateTaskField])

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
      <div style={{
        ...layoutPrimitives.row,
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap',
      }}>
        <ButtonGroup style={{ borderRadius: 8, background: COLORS.bgDark }}>
          <ButtonGroupItem
            active={viewMode === 'list'}
            style={buttonStyle(viewMode === 'list')}
            onClick={() => setTaskBoardPrefs(taskListId, { view: 'list' })}
          >
            List
          </ButtonGroupItem>
          <ButtonGroupItem
            active={viewMode === 'board'}
            style={buttonStyle(viewMode === 'board')}
            onClick={() => setTaskBoardPrefs(taskListId, { view: 'board' })}
          >
            Board
          </ButtonGroupItem>
          <ButtonGroupItem
            active={viewMode === 'dependency'}
            style={buttonStyle(viewMode === 'dependency')}
            onClick={() => setTaskBoardPrefs(taskListId, { view: 'dependency' })}
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
              onChange={(event) => setTaskBoardPrefs(taskListId, { groupBy: event.target.value as TaskBoardGroupBy })}
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
                  onChange={(event) => setTaskBoardPrefs(taskListId, { columnCount: Number(event.target.value) })}
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
          onHeightChange={(nextHeight) => updateDependencyShared({ dependencyHeight: nextHeight })}
          cardWidth={dependencyCardWidth}
          onCardWidthChange={(nextWidth) => updateDependencyShared({ dependencyCardWidth: nextWidth })}
          scrollX={dependencyScrollX}
          scrollY={dependencyScrollY}
          onScrollChange={(nextX, nextY) => updateDependencyShared({
            dependencyScrollX: Math.round(nextX),
            dependencyScrollY: Math.round(nextY),
          })}
          width={dependencyWidth}
          onWidthChange={(nextWidth) => updateDependencyShared({ dependencyWidth: nextWidth })}
        />
      )}

      {viewMode === 'list' && (
        <div style={{ ...layoutPrimitives.column, gap: '6px' }}>
          {tasks
            .slice()
            .sort((a, b) => (a.sourceLine ?? 0) - (b.sourceLine ?? 0))
            .map(task => (
              <TaskBoardStaticCard key={getTaskKey(task, parentDocId)} task={task} />
            ))}
        </div>
      )}

      {viewMode === 'board' && groupBy === 'none' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(1, columnCount)}, minmax(0, 1fr))`,
          gap: '8px',
        }}>
          {tasks
            .slice()
            .sort((a, b) => (a.sourceLine ?? 0) - (b.sourceLine ?? 0))
            .map(task => (
            <TaskBoardStaticCard
              key={getTaskKey(task, parentDocId)}
              task={task}
            />
          ))}
        </div>
      )}

      {viewMode === 'board' && groupBy !== 'none' && orderedGroups && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div style={{
            ...layoutPrimitives.row,
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
          }}>
            {orderedGroups.orderedKeys.map((key) => {
              const columnId = `${groupBy}:${key}`
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
        <span style={{
          background: statusColor,
          color: task.status === 'done' ? COLORS.textInverse : COLORS.bgDark,
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '9px',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}>
          {task.status}
        </span>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: priorityColor,
        }} title={task.priority} />
        <span style={{ flex: 1 }} />
        {task.tags.slice(0, 2).map((tag: string) => (
          <span key={tag} style={{
            background: COLORS.bgDark,
            color: COLORS.textMuted,
            padding: '1px 4px',
            borderRadius: '3px',
            fontSize: '8px',
          }}>
            #{tag}
          </span>
        ))}
      </div>

      {/* Title */}
      <div style={{
        color: COLORS.text,
        fontWeight: 600,
        fontSize: '12px',
        marginBottom: '8px',
        lineHeight: 1.3,
      }}>
        {task.title}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{
            ...layoutPrimitives.row,
            justifyContent: 'space-between',
            fontSize: '9px',
            color: COLORS.textMuted,
            marginBottom: '2px',
          }}>
            <span>Progress</span>
            <span>{completedCount}/{totalCount} ({task.progress}%)</span>
          </div>
          <div style={{
            height: '6px',
            background: COLORS.border,
            borderRadius: '3px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${task.progress}%`,
              background: task.progress === 100 ? COLORS.success : statusColor,
              transition: 'width 0.3s ease',
            }} />
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
              <span style={{
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
              }}>
                {item.checked ? '✓' : ''}
              </span>
              <span style={{ flex: 1 }}>{item.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Blocked-by indicator */}
      {task.blockedBy.length > 0 && (
        <div style={{
          ...layoutPrimitives.row,
          alignItems: 'center',
          gap: '4px',
          fontSize: '9px',
          color: COLORS.error,
          marginTop: '8px',
          paddingTop: '6px',
          borderTop: `1px solid ${COLORS.border}`,
        }}>
          <span>Blocked by:</span>
          {task.blockedBy.map((id: string) => (
            <span key={id} style={{
              background: `${COLORS.error}33`,
              padding: '1px 4px',
              borderRadius: '3px',
            }}>
              {id}
            </span>
          ))}
        </div>
      )}
    </div>
  )
})

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
  const completedChecklist = tasks.reduce((acc, t) => acc + t.checklist.filter(c => c.checked).length, 0)
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
      <div style={{
        ...layoutPrimitives.row,
        alignItems: 'center',
        gap: '8px',
        marginBottom: '10px',
        borderBottom: `1px solid ${COLORS.border}`,
        paddingBottom: '8px',
      }}>
        <span style={{ color: taskColor, fontSize: '12px', fontWeight: 600 }}>
          {sectionTitle || 'Tasks'}
        </span>
        <span style={{
          background: taskColor,
          color: COLORS.textInverse,
          padding: '2px 6px',
          borderRadius: '10px',
          fontSize: '10px',
          fontWeight: 600,
        }}>
          {tasks.length}
        </span>
        <span style={{ flex: 1 }} />
        {statusCounts['in-progress'] > 0 && (
          <span style={{
            background: getStatusColor('in-progress'),
            color: COLORS.bgDark,
            padding: '1px 4px',
            borderRadius: '3px',
            fontSize: '8px',
            fontWeight: 600,
          }}>
            {statusCounts['in-progress']} active
          </span>
        )}
        {statusCounts.blocked > 0 && (
          <span style={{
            background: getStatusColor('blocked'),
            color: COLORS.textInverse,
            padding: '1px 4px',
            borderRadius: '3px',
            fontSize: '8px',
            fontWeight: 600,
          }}>
            {statusCounts.blocked} blocked
          </span>
        )}
      </div>

      {/* Overall progress */}
      {totalChecklist > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            ...layoutPrimitives.row,
            justifyContent: 'space-between',
            fontSize: '9px',
            color: COLORS.textMuted,
            marginBottom: '3px',
          }}>
            <span>Overall Progress</span>
            <span>{completedChecklist}/{totalChecklist} ({overallProgress}%)</span>
          </div>
          <div style={{
            height: '6px',
            background: COLORS.border,
            borderRadius: '3px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${overallProgress}%`,
              background: overallProgress === 100 ? COLORS.success : taskColor,
              transition: 'width 0.3s ease',
            }} />
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
