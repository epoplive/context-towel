import { memo, useMemo } from 'react'
import { Eye, FileText, Target } from 'lucide-react'

import { MiniDocOutline, type OutlineSection, type TaskOutlineItem } from '../../plugins/document-outline'
import type { TaskItem } from '../../plugins'
import { layoutPrimitives } from '../../compat/layoutPrimitives'
import { EdgeHandles } from './EdgeHandles'
import { getCardScale, useFlowColors } from './colors'

// Type alias for backwards compatibility
type ParsedTask = TaskItem

export interface DocumentNodeData {
  label: string
  path: string
  type: 'core' | 'research' | 'skill' | 'spike' | 'other'
  tasks: ParsedTask[]
  sections: OutlineSection[]
  checklists: { title: string; items: { text: string; checked: boolean }[] }[]
  loaded: boolean
  isFocused?: boolean
  detailLevel?: 'full' | 'summary' | 'title'
  cardScale?: number
  onPreview?: () => void
  onFocus?: () => void
}

interface DocumentNodeProps {
  data: DocumentNodeData
  selected?: boolean
}

// Type label mapping for nicer display
const typeLabels: Record<string, string> = {
  core: 'Core',
  research: 'Docs',
  skill: 'Skill',
  spike: 'Archive',
  other: 'File',
}

export const DocumentNode = memo(({ data, selected }: DocumentNodeProps) => {
  const COLORS = useFlowColors()
  const scale = getCardScale(data)
  const scaleStyle = scale === 1
    ? {}
    : { transform: `scale(${scale})`, transformOrigin: 'top left' }
  const typeColor = COLORS[data.type as keyof typeof COLORS] || COLORS.other
  const tasks = data.tasks || []
  const sections = data.sections || []
  const detailLevel = data.detailLevel ?? 'full'

  // Don't show details when focused (they're in breakout nodes)
  const showDetails = !data.isFocused && detailLevel === 'full'
  const showSummaryOnly = !data.isFocused && detailLevel === 'summary'
  const hasContent = sections.length > 0 || tasks.length > 0

  // Calculate totals
  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length
  const blockedTasks = tasks.filter(t => t.status === 'blocked').length

  // Convert tasks to outline format (with sourceLine for proper ordering in outline)
  const taskOutlines: TaskOutlineItem[] = useMemo(() =>
    tasks.map(t => ({
      id: t.id,
      title: t.title,
      status: t.status as TaskOutlineItem['status'],
      checklistTotal: t.checklist.length,
      checklistDone: t.checklist.filter(c => c.checked).length,
      sourceLine: t.sourceLine,
    })),
    [tasks]
  )

  // Colors for outline component
  const outlineColors = useMemo(() => ({
    text: COLORS.text,
    textSecondary: COLORS.textSecondary,
    textMuted: COLORS.textMuted,
    success: COLORS.success,
    accent: COLORS.accent,
    error: COLORS.error,
  }), [COLORS])

  const actionButtonStyle: React.CSSProperties = {
    border: 'none',
    background: `${typeColor}20`,
    color: typeColor,
    width: 18,
    height: 18,
    borderRadius: 4,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  }

  const actionGroupStyle: React.CSSProperties = {
    ...layoutPrimitives.row,
    alignItems: 'center',
    gap: '4px',
  }

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `2px solid ${selected ? typeColor : COLORS.border}`,
        borderLeft: `4px solid ${typeColor}`,
        borderRadius: '8px',
        padding: '8px',
        minWidth: hasContent && showDetails ? '220px' : '140px',
        maxWidth: '280px',
        opacity: data.loaded ? 1 : 0.6,
        cursor: 'pointer',
        ...scaleStyle,
        boxShadow: selected ? `0 0 0 1px ${typeColor}40` : 'none',
      }}
    >
      <EdgeHandles color={typeColor} />

      {/* Header */}
      <div style={{
        ...layoutPrimitives.row,
        alignItems: 'center',
        gap: '6px',
        marginBottom: hasContent && showDetails ? '6px' : '0',
        paddingBottom: hasContent && showDetails ? '6px' : '0',
        borderBottom: hasContent && showDetails ? `1px solid ${COLORS.border}` : 'none',
      }}>
        <FileText size={12} color={typeColor} style={{ flexShrink: 0 }} />
        <span style={{
          color: COLORS.text,
          fontWeight: 600,
          fontSize: '11px',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {data.label}
        </span>
        <span style={{
          background: `${typeColor}20`,
          color: typeColor,
          padding: '1px 5px',
          borderRadius: '3px',
          fontSize: '8px',
          fontWeight: 500,
          textTransform: 'uppercase',
        }}>
          {typeLabels[data.type] || data.type}
        </span>
        <div style={actionGroupStyle}>
          <button
            type="button"
            title="Preview"
            style={actionButtonStyle}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              data.onPreview?.()
            }}
          >
            <Eye size={10} />
          </button>
          <button
            type="button"
            title="Focus"
            style={actionButtonStyle}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              data.onFocus?.()
            }}
          >
            <Target size={10} />
          </button>
        </div>
      </div>

      {/* Summary badge - finished/unfinished counts */}
      {showDetails && totalTasks > 0 && (
        <div style={{
          ...layoutPrimitives.row,
          alignItems: 'center',
          gap: '8px',
          marginBottom: '6px',
          padding: '4px 6px',
          background: `${COLORS.border}30`,
          borderRadius: '4px',
        }}>
          <span style={{
            fontSize: '9px',
            fontWeight: 600,
            color: doneTasks === totalTasks ? COLORS.success : COLORS.text,
          }}>
            {doneTasks}/{totalTasks} done
          </span>
          {inProgressTasks > 0 && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              color: COLORS.accent,
              fontSize: '8px',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.accent }} />
              {inProgressTasks} active
            </span>
          )}
          {blockedTasks > 0 && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              color: COLORS.error,
              fontSize: '8px',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.error }} />
              {blockedTasks} blocked
            </span>
          )}
        </div>
      )}

      {showSummaryOnly && (
        <div style={{
          ...layoutPrimitives.row,
          alignItems: 'center',
          gap: '8px',
          marginBottom: '6px',
          padding: '4px 6px',
          background: `${COLORS.border}20`,
          borderRadius: '4px',
          color: COLORS.textSecondary,
          fontSize: '9px',
          fontWeight: 600,
        }}>
          {sections.length > 0 && (
            <span>{sections.length} sections</span>
          )}
          {totalTasks > 0 && (
            <span>{totalTasks} tasks</span>
          )}
          {data.checklists?.length > 0 && (
            <span>{data.checklists.length} checklists</span>
          )}
        </div>
      )}

      {/* Mini document outline using abstracted component */}
      {showDetails && (sections.length > 0 || tasks.length > 0) && (
        <MiniDocOutline
          sections={sections}
          tasks={taskOutlines}
          colors={outlineColors}
          showTasksIfNoSections={true}
        />
      )}
    </div>
  )
})

