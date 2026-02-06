// ============================================================================
// Document Outline Components
// ============================================================================

import { memo, useMemo } from 'react'
import { Check, Square, CheckSquare, Circle, AlertTriangle, ListTodo } from 'lucide-react'
import type { OutlineSection, TaskOutlineItem } from './types'
import { layoutPrimitives } from '../../compat/layoutPrimitives'

// Colors type for theming
interface OutlineColors {
  text: string
  textSecondary: string
  textMuted: string
  success: string
  accent: string
  error: string
}

// Generic/noise headings to filter out - these appear under every task
const NOISE_HEADINGS = new Set([
  'description',
  'checklist',
  'notes',
  'context',
  'details',
  'summary',
  'overview',
])

// Check if a section title is a task heading (## Task: ...)
function isTaskSection(title: string): boolean {
  return title.toLowerCase().startsWith('task:')
}

// Section row component - renders a single section (no children, handled by parent)
const SectionRow = memo(({
  section,
  depth,
  colors,
}: {
  section: OutlineSection
  depth: number
  colors: OutlineColors
}) => {
  const hasCounts = section.counts && (section.counts.tasks > 0 || section.counts.checklists > 0)
  const isH1 = section.level === 1
  const counts = section.counts

  return (
    <div style={{
      ...layoutPrimitives.row,
      alignItems: 'center',
      gap: '4px',
      paddingLeft: `${Math.min(depth, 2) * 8}px`,
      marginBottom: '2px',
    }}>
      <span style={{
        color: isH1 ? colors.text : colors.textSecondary,
        fontSize: isH1 ? '10px' : '9px',
        fontWeight: isH1 ? 600 : 400,
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        lineHeight: 1.3,
      }}>
        {section.title}
      </span>

      {hasCounts && counts && (
        <span style={{
          ...layoutPrimitives.row,
          alignItems: 'center',
          gap: '4px',
          flexShrink: 0,
        }}>
          {counts.tasks > 0 && (
            <span style={{
              ...layoutPrimitives.row,
              alignItems: 'center',
              gap: '2px',
              color: counts.tasksCompleted === counts.tasks ? colors.success : colors.textMuted,
              fontSize: '8px',
            }}>
              {counts.tasksCompleted === counts.tasks ? (
                <CheckSquare size={9} />
              ) : (
                <ListTodo size={9} />
              )}
              {counts.tasksCompleted}/{counts.tasks}
            </span>
          )}
          {counts.checklists > 0 && (
            <span style={{
              ...layoutPrimitives.row,
              alignItems: 'center',
              gap: '2px',
              color: counts.checklistsCompleted === counts.checklists ? colors.success : colors.textMuted,
              fontSize: '8px',
            }}>
              {counts.checklistsCompleted === counts.checklists ? (
                <Check size={9} />
              ) : (
                <Square size={9} />
              )}
              {counts.checklistsCompleted}/{counts.checklists}
            </span>
          )}
        </span>
      )}
    </div>
  )
})

// Task row component - with status badge and strikethrough for done
const TaskRow = memo(({
  task,
  colors,
}: {
  task: TaskOutlineItem
  colors: OutlineColors
}) => {
  const isDone = task.status === 'done'
  const isBlocked = task.status === 'blocked'
  const isInProgress = task.status === 'in-progress'

  const statusColor = isDone ? colors.success
    : isBlocked ? colors.error
    : isInProgress ? colors.accent
    : colors.textMuted

  return (
    <div style={{
      ...layoutPrimitives.row,
      alignItems: 'center',
      gap: '5px',
      padding: '2px 0',
      fontSize: '9px',
    }}>
      {/* Status badge */}
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1px 4px',
        borderRadius: '3px',
        fontSize: '7px',
        fontWeight: 600,
        textTransform: 'uppercase',
        background: `${statusColor}20`,
        color: statusColor,
        flexShrink: 0,
        minWidth: '32px',
      }}>
        {isDone && <Check size={8} style={{ marginRight: 2 }} />}
        {isBlocked && <AlertTriangle size={8} style={{ marginRight: 2 }} />}
        {isInProgress && <Circle size={8} style={{ marginRight: 2, fill: statusColor }} />}
        {isDone ? 'done' : isBlocked ? 'blocked' : isInProgress ? 'active' : 'todo'}
      </span>

      {/* Task title - strikethrough if done */}
      <span style={{
        color: isDone ? colors.textMuted : colors.text,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 1,
        lineHeight: 1.3,
        textDecoration: isDone ? 'line-through' : 'none',
        textDecorationColor: colors.error,
      }}>
        {task.title}
      </span>

      {/* Checklist progress */}
      {task.checklistTotal > 0 && (
        <span style={{
          ...layoutPrimitives.row,
          alignItems: 'center',
          gap: '2px',
          color: task.checklistDone === task.checklistTotal ? colors.success : colors.textMuted,
          fontSize: '8px',
          flexShrink: 0,
        }}>
          {task.checklistDone}/{task.checklistTotal}
        </span>
      )}
    </div>
  )
})

// Main outline component props
export interface MiniDocOutlineProps {
  sections: OutlineSection[]
  tasks?: TaskOutlineItem[]
  colors: OutlineColors
  showTasksIfNoSections?: boolean
}

// Main mini doc outline component - shows sections AND tasks
export const MiniDocOutline = memo(({
  sections,
  tasks = [],
  colors,
  showTasksIfNoSections = false,
}: MiniDocOutlineProps) => {
  // Filter sections to show (remove noise headings, limit depth)
  const filteredSections = useMemo(() => {
    const filtered: OutlineSection[] = []
    const processSection = (section: OutlineSection, depth: number) => {
      if (NOISE_HEADINGS.has(section.title.toLowerCase().trim())) return
      if (isTaskSection(section.title)) return // Skip task headings, we show tasks separately
      if (depth <= 2) {
        filtered.push(section)
      }
      if (section.children) {
        section.children.forEach(child => processSection(child, depth + 1))
      }
    }
    sections.forEach(s => processSection(s, 0))
    return filtered
  }, [sections])

  // Show nothing if no content
  if (filteredSections.length === 0 && tasks.length === 0) {
    return null
  }

  // If no sections but we have tasks, show tasks directly
  if (filteredSections.length === 0 && showTasksIfNoSections && tasks.length > 0) {
    return (
      <div>
        {tasks.map((task, i) => (
          <TaskRow key={`task-${task.id || i}`} task={task} colors={colors} />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Show sections */}
      {filteredSections.map((section, i) => (
        <SectionRow
          key={`section-${i}`}
          section={section}
          depth={0}
          colors={colors}
        />
      ))}
      {/* Always show tasks at the end */}
      {tasks.length > 0 && (
        <div style={{ marginTop: filteredSections.length > 0 ? '4px' : '0', borderTop: filteredSections.length > 0 ? `1px solid ${colors.textMuted}30` : 'none', paddingTop: filteredSections.length > 0 ? '4px' : '0' }}>
          {tasks.map((task, i) => (
            <TaskRow key={`task-${task.id || i}`} task={task} colors={colors} />
          ))}
        </div>
      )}
    </div>
  )
})
