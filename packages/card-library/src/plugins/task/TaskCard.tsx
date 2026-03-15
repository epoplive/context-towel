import { memo, useState, useRef, useEffect } from 'react'
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
    case 'bug': case 'bugfix': return <Bug {...props} />
    case 'spike': case 'research': return <Lightbulb {...props} />
    case 'epic': return <Target {...props} />
    case 'story': case 'feature': return <Package {...props} />
    case 'subtask': case 'chore': return <CheckSquare {...props} />
    default: return <Circle {...props} />
  }
}

function getStatusIcon(status: TaskStatus, size: number, color?: string) {
  const iconColor = color || statusColors[status]
  const props = { size, color: iconColor, strokeWidth: 2 }
  switch (status) {
    case 'done': return <CheckCircle2 {...props} />
    case 'in-progress': return <Clock {...props} />
    case 'blocked': return <AlertCircle {...props} />
    case 'todo': default: return <Circle {...props} />
  }
}

const STATUS_OPTIONS: TaskStatus[] = ['todo', 'in-progress', 'done', 'blocked']
const PRIORITY_OPTIONS: TaskPriority[] = ['low', 'medium', 'high', 'critical']

// ============================================================================
// TaskCard — ONE render path, detail level controls visibility
// ============================================================================

export const TaskCard = memo(function TaskCard({
  data,
  detail,
  theme,
  onEdit,
}: BlockRenderProps<TaskData>) {
  const [checklistExpanded, setChecklistExpanded] = useState(true)
  const [descExpanded, setDescExpanded] = useState(false)
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [logExpanded, setLogExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')

  const statusColor = statusColors[data.status]
  const completedCount = data.checklist.filter((c) => c.checked).length
  const totalCount = data.checklist.length
  const isMini = detail === 'mini'
  const showBody = detail !== 'mini'

  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field)
    setEditingValue(currentValue)
  }
  const commitEdit = (field: string, value: string) => {
    if (onEdit) onEdit({ blockType: 'task', field, value })
    setEditingField(null)
    setEditingValue('')
  }
  const cancelEdit = () => {
    setEditingField(null)
    setEditingValue('')
  }
  const handleCopyId = () => {
    navigator.clipboard.writeText(data.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      borderLeft: `3px solid ${statusColor}`,
      padding: isMini ? '4px 8px' : '8px 10px',
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      fontFamily: theme.fontSans,
    }}>
      {/* Header — always shown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: showBody ? 6 : 0 }}>
        {data.taskType && (
          <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {getTaskTypeIcon(data.taskType, isMini ? 11 : 14)}
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {getStatusIcon(data.status, isMini ? 11 : 14)}
        </span>

        {/* Status — editable in non-mini */}
        {showBody && onEdit && editingField === 'status' ? (
          <StatusDropdown current={data.status} theme={theme}
            onSelect={(s) => commitEdit('status', s)} onDismiss={cancelEdit} />
        ) : (
          <span onClick={showBody && onEdit ? () => startEditing('status', data.status) : undefined}
            style={{ cursor: showBody && onEdit ? 'pointer' : 'default' }} data-edit-field="status">
            <StatusBadge status={data.status} />
          </span>
        )}

        {/* Priority flag */}
        {showBody && onEdit && editingField === 'priority' ? (
          <PriorityDropdown current={data.priority} theme={theme}
            onSelect={(p) => commitEdit('priority', p)} onDismiss={cancelEdit} />
        ) : (
          <span onClick={showBody && onEdit ? () => startEditing('priority', data.priority) : undefined}
            style={{ display: 'flex', alignItems: 'center', flexShrink: 0, cursor: showBody && onEdit ? 'pointer' : 'default' }}
            data-edit-field="priority">
            <Flag size={isMini ? 10 : 12} color={priorityColors[data.priority]} strokeWidth={2} />
          </span>
        )}

        {/* Title — editable in non-mini */}
        {showBody && onEdit && editingField === 'title' ? (
          <TitleInput value={editingValue} theme={theme}
            onChange={setEditingValue} onCommit={() => commitEdit('title', editingValue)} onCancel={cancelEdit} />
        ) : (
          <span
            onClick={showBody && onEdit ? () => startEditing('title', data.title) : undefined}
            style={{
              fontSize: '1em', color: theme.textPrimary, fontWeight: 600, flex: 1,
              cursor: showBody && onEdit ? 'text' : 'default',
              ...(isMini ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } : {}),
            }}
            data-edit-field="title">
            {data.title}
          </span>
        )}

        {/* Progress counter for mini */}
        {isMini && totalCount > 0 && (
          <span style={{ fontSize: '0.85em', color: theme.textMuted }}>{completedCount}/{totalCount}</span>
        )}

        {/* Copy ID button */}
        {showBody && (
          <button onClick={handleCopyId} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 2,
            display: 'flex', alignItems: 'center',
            color: copied ? theme.success : theme.textMuted, transition: 'color 0.2s',
          }} title="Copy task ID">
            {copied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={2} />}
          </button>
        )}
      </div>

      {/* Everything below header — hidden in mini */}
      {showBody && (
        <>
          {/* Tags */}
          {data.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              {data.tags.map((tag) => (
                <span key={tag} style={{ fontSize: '0.8em', padding: '1px 5px', borderRadius: 3, background: `${theme.accent}22`, color: theme.accent }}>{tag}</span>
              ))}
            </div>
          )}

          {/* Metadata */}
          {(data.owner || data.dueDate || data.estimatedEffort) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              {data.owner && <MetaItem icon={<User size={10} color={theme.textMuted} strokeWidth={2} />} text={data.owner} theme={theme} />}
              {data.dueDate && <MetaItem icon={<Calendar size={10} color={theme.textMuted} strokeWidth={2} />} text={data.dueDate} theme={theme} />}
              {data.estimatedEffort && <MetaItem icon={<Clock size={10} color={theme.textMuted} strokeWidth={2} />} text={data.estimatedEffort} theme={theme} />}
            </div>
          )}

          {/* Description */}
          {(data.description || (onEdit && editingField === 'description')) && (
            <ExpandableContent label="Description" content={data.description} expanded={descExpanded}
              onToggle={() => setDescExpanded(!descExpanded)} theme={theme} collapseThreshold={200}
              editingField={editingField} fieldName="description" editingValue={editingValue}
              onEditStart={onEdit ? () => startEditing('description', data.description) : undefined}
              onEditChange={setEditingValue} onEditCommit={() => commitEdit('description', editingValue)} onEditCancel={cancelEdit} />
          )}

          {/* Checklist */}
          {totalCount > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div onClick={() => setChecklistExpanded(!checklistExpanded)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginBottom: 4 }}>
                <span style={{ fontSize: '0.8em', color: theme.textMuted, transition: 'transform 0.15s',
                  transform: checklistExpanded ? 'rotate(90deg)' : 'rotate(0)', display: 'inline-block' }}>&#9654;</span>
                <ProgressBar completed={completedCount} total={totalCount} color={statusColor} bgColor={theme.bgTertiary} />
              </div>
              {checklistExpanded && data.checklist.map((item, i) => (
                <ChecklistRow key={i} index={i} item={item} theme={theme}
                  onToggle={onEdit ? () => onEdit({ blockType: 'task', field: `checklist.${i}.checked`, value: !item.checked }) : undefined} />
              ))}
            </div>
          )}

          {/* Blocked by */}
          {data.blockedBy.length > 0 && (
            <TagList label="Blocked by" items={data.blockedBy} color={theme.error} theme={theme} />
          )}

          {/* Blocks */}
          {data.blocks.length > 0 && (
            <TagList label="Blocks" items={data.blocks} color={theme.accent} theme={theme} />
          )}

          {/* Notes */}
          {(data.notes || (onEdit && editingField === 'notes')) && (
            <ExpandableContent label="Notes" content={data.notes} expanded={notesExpanded}
              onToggle={() => setNotesExpanded(!notesExpanded)} theme={theme} collapseThreshold={150} borderLeft
              editingField={editingField} fieldName="notes" editingValue={editingValue}
              onEditStart={onEdit ? () => startEditing('notes', data.notes) : undefined}
              onEditChange={setEditingValue} onEditCommit={() => commitEdit('notes', editingValue)} onEditCancel={cancelEdit} />
          )}

          {/* Log */}
          {data.log.length > 0 && (
            <div>
              <div onClick={() => setLogExpanded(!logExpanded)}
                style={{ fontSize: '0.8em', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ transition: 'transform 0.15s', transform: logExpanded ? 'rotate(90deg)' : 'rotate(0)', display: 'inline-block' }}>&#9654;</span>
                Log ({data.log.length})
              </div>
              {(logExpanded ? data.log : data.log.slice(-3)).map((entry, i) => (
                <div key={i} style={{ fontSize: '0.8em', color: theme.textSecondary, display: 'flex', gap: 6 }}>
                  <span style={{ color: theme.textMuted, fontFamily: theme.fontMono }}>{entry.timestamp}</span>
                  <span>{entry.entry}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
})

// ============================================================================
// Subcomponents
// ============================================================================

function MetaItem({ icon, text, theme }: { icon: React.ReactNode; text: string; theme: { textSecondary: string } }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {icon}
      <span style={{ fontSize: '0.8em', color: theme.textSecondary }}>{text}</span>
    </div>
  )
}

function TagList({ label, items, color, theme }: { label: string; items: string[]; color: string; theme: { textMuted: string } }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: '0.8em', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {items.map((id) => (
          <span key={id} style={{ fontSize: '0.8em', padding: '1px 5px', borderRadius: 3, background: `${color}22`, color }}>{id}</span>
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const color = statusColors[status]
  return (
    <span style={{
      fontSize: '0.75em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
      padding: '1px 5px', borderRadius: 3, background: `${color}22`, color, whiteSpace: 'nowrap',
    }}>{statusLabels[status]}</span>
  )
}

function ProgressBar({ completed, total, color, bgColor }: { completed: number; total: number; color: string; bgColor: string }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: bgColor, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.2s' }} />
      </div>
      <span style={{ fontSize: '0.8em', color, fontWeight: 600, whiteSpace: 'nowrap' }}>{completed}/{total}</span>
    </div>
  )
}

function ChecklistRow({ item, theme, onToggle, index }: {
  item: { text: string; checked: boolean }
  theme: { textPrimary: string; textMuted: string; accent: string; success: string }
  onToggle?: () => void
  index?: number
}) {
  return (
    <div onClick={onToggle} data-checklist-row={index} style={{
      display: 'flex', alignItems: 'flex-start', gap: 5, padding: '1px 0',
      cursor: onToggle ? 'pointer' : 'default', fontSize: '0.85em',
    }}>
      <span style={{ fontSize: '0.9em', lineHeight: '13px', color: item.checked ? theme.success : theme.textMuted, flexShrink: 0 }}>
        {item.checked ? '\u2611' : '\u2610'}
      </span>
      <span style={{ color: item.checked ? theme.textMuted : theme.textPrimary, textDecoration: item.checked ? 'line-through' : 'none', lineHeight: '13px' }}>
        {item.text}
      </span>
    </div>
  )
}

// --- Edit subcomponents ---

function TitleInput({ value, theme, onChange, onCommit, onCancel }: {
  value: string; theme: { textPrimary: string; bgSecondary: string; accent: string }
  onChange: (v: string) => void; onCommit: () => void; onCancel: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  return (
    <input ref={ref} type="text" value={value} onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCommit() } else if (e.key === 'Escape') { e.preventDefault(); onCancel() } }}
      style={{ flex: 1, fontSize: '1em', fontWeight: 600, color: theme.textPrimary, background: theme.bgSecondary,
        border: `1px solid ${theme.accent}`, borderRadius: 3, padding: '1px 4px', outline: 'none', fontFamily: 'inherit' }}
      data-edit-input="title" />
  )
}

function StatusDropdown({ current, theme, onSelect, onDismiss }: {
  current: TaskStatus; theme: { bgSecondary: string; borderPrimary: string }
  onSelect: (s: TaskStatus) => void; onDismiss: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onDismiss() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onDismiss])
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }} data-edit-dropdown="status">
      <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: theme.bgSecondary,
        border: `1px solid ${theme.borderPrimary}`, borderRadius: 4, minWidth: 120, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', marginTop: 2 }}>
        {STATUS_OPTIONS.map((status) => (
          <div key={status} onClick={() => onSelect(status)} data-status-option={status}
            style={{ padding: '4px 8px', cursor: 'pointer', background: status === current ? `${statusColors[status]}22` : 'transparent',
              display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusBadge status={status} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PriorityDropdown({ current, theme, onSelect, onDismiss }: {
  current: TaskPriority; theme: { bgSecondary: string; borderPrimary: string }
  onSelect: (p: TaskPriority) => void; onDismiss: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onDismiss() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onDismiss])
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }} data-edit-dropdown="priority">
      <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: theme.bgSecondary,
        border: `1px solid ${theme.borderPrimary}`, borderRadius: 4, minWidth: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', marginTop: 2 }}>
        {PRIORITY_OPTIONS.map((priority) => (
          <div key={priority} onClick={() => onSelect(priority)} data-priority-option={priority}
            style={{ padding: '4px 8px', cursor: 'pointer', background: priority === current ? `${priorityColors[priority]}22` : 'transparent',
              display: 'flex', alignItems: 'center', gap: 6 }}>
            <Flag size={10} color={priorityColors[priority]} strokeWidth={2} />
            <span style={{ fontSize: '0.85em', color: priorityColors[priority], fontWeight: 600, textTransform: 'capitalize' }}>{priority}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExpandableContent({ label, content, expanded, onToggle, theme, collapseThreshold = 200, borderLeft = false,
  editingField, fieldName, editingValue, onEditStart, onEditChange, onEditCommit, onEditCancel }: {
  label: string; content: string; expanded: boolean; onToggle: () => void
  theme: { textSecondary: string; textMuted: string; borderPrimary: string; bgSecondary: string; accent: string }
  collapseThreshold?: number; borderLeft?: boolean
  editingField?: string | null; fieldName?: string; editingValue?: string
  onEditStart?: () => void; onEditChange?: (v: string) => void; onEditCommit?: () => void; onEditCancel?: () => void
}) {
  const isEditing = editingField === fieldName && fieldName !== undefined
  const isLong = content.length > collapseThreshold
  const showFull = expanded || !isLong
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (isEditing) textareaRef.current?.focus() }, [isEditing])

  if (isEditing) {
    return (
      <div style={{ marginBottom: 6 }}>
        {isLong && <div style={{ fontSize: '0.8em', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>}
        <textarea ref={textareaRef} value={editingValue ?? content}
          onChange={(e) => onEditChange?.(e.target.value)} onBlur={() => onEditCommit?.()}
          onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); onEditCommit?.() } else if (e.key === 'Escape') { e.preventDefault(); onEditCancel?.() } }}
          rows={Math.max(6, ((editingValue ?? content).split('\n').length) + 2)}
          style={{ width: '100%', minHeight: '8em', fontSize: '0.9em', color: theme.textSecondary, background: theme.bgSecondary,
            border: `1px solid ${theme.accent}`, borderRadius: 6, padding: '8px 10px', outline: 'none',
            fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' }}
          data-edit-input={fieldName} />
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 6 }}>
      {isLong && (
        <div onClick={onToggle} style={{ fontSize: '0.8em', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 2,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0)', display: 'inline-block' }}>&#9654;</span>
          {label}
        </div>
      )}
      <div onClick={onEditStart} style={{
        fontSize: '0.9em', color: theme.textSecondary, lineHeight: 1.5, whiteSpace: 'pre-wrap',
        cursor: onEditStart ? 'text' : 'default',
        ...(borderLeft ? { padding: '4px 6px', borderLeft: `2px solid ${theme.borderPrimary}` } : {}),
        ...(!showFull ? { maxHeight: '4.5em', overflow: 'hidden' } : {}),
      }} data-edit-field={fieldName}>
        {content}
      </div>
    </div>
  )
}
