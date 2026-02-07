// React Flow custom node components
import { memo, useCallback, useState, useMemo } from 'react'
import { Handle, Position, useInternalNode, EdgeProps, getSmoothStepPath } from '@xyflow/react'
import {
  Folder,
  ChevronDown,
  ChevronRight,
  FileText,
  FileCode,
  FileJson,
  File,
  FileImage,
  Terminal,
  Globe,
  Palette,
  Cog,
  Eye,
  Target,
  LayoutGrid,
  Link,
} from 'lucide-react'
import {
  // Import plugin components
  TaskNode,
  FullTaskNode,
  TaskListNode,
  ChecklistNode,
  DiagramNode,
  TOCNode,
} from '../plugins'
import type {
  TaskItem,
  TaskNodeData,
  FullTaskNodeData,
  TaskListNodeData,
  ChecklistNodeData,
  DiagramNodeData,
  TOCNodeData,
  TOCSectionItem,
} from '../plugins'
import {
  MiniDocOutline,
  type OutlineSection,
  type TaskOutlineItem,
} from '../plugins/document-outline'
import type { ContextGraphTreeItemDTO } from '../dto/contextGraphDTO'
import { useTheme } from '../compat/design-system'
import { layoutPrimitives } from '../compat/layoutPrimitives'

// Type alias for backwards compatibility
type ParsedTask = TaskItem
type TreeItem = ContextGraphTreeItemDTO

// Re-export types for backwards compatibility
export type { TaskNodeData, FullTaskNodeData, TaskListNodeData, ChecklistNodeData, DiagramNodeData, TOCNodeData, TOCSectionItem }

// Hook to get colors palette from theme
function useFlowColors() {
  const { colors } = useTheme()
  return useMemo(() => ({
    folder: colors.graphFolder,
    core: colors.graphCore,
    research: colors.graphResearch,
    skill: colors.graphSkill,
    spike: colors.graphSpike,
    other: colors.textSecondary,
    bg: colors.bgSecondary,
    bgDark: colors.bgPrimary,
    border: colors.borderPrimary,
    text: colors.textPrimary,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    accent: colors.accent,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
  }), [colors])
}

// Note: Static fallback colors removed - using useFlowColors() hook for all components

// Helper to get cardScale from node data with default
const getCardScale = (data: any): number => {
  const raw = typeof data?.cardScale === 'number' ? data.cardScale : 1.0
  const rounded = Math.round(raw * 100) / 100
  return Math.abs(rounded - 1) < 0.01 ? 1 : rounded
}

// ============================================
// FLOATING EDGE - Dynamic connection points
// ============================================
// Get best connection side for a node relative to another node
function getBestConnectionSide(
  nodeRect: { x: number; y: number; width: number; height: number },
  targetCenter: { x: number; y: number }
): { point: { x: number; y: number }; position: Position } {
  const centerX = nodeRect.x + nodeRect.width / 2
  const centerY = nodeRect.y + nodeRect.height / 2

  const dx = targetCenter.x - centerX
  const dy = targetCenter.y - centerY
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  // Use aspect ratio to determine best connection side
  // For very horizontal relationships, prefer left/right
  // For very vertical relationships, prefer top/bottom
  const aspectRatio = nodeRect.width / nodeRect.height
  const directionRatio = absDx / (absDy || 1)

  // Calculate padding from edge (connect 10px inside the boundary for cleaner lines)
  const edgePadding = 0

  if (directionRatio > aspectRatio * 0.5) {
    // More horizontal - use left or right
    if (dx > 0) {
      return {
        point: { x: nodeRect.x + nodeRect.width - edgePadding, y: centerY },
        position: Position.Right,
      }
    } else {
      return {
        point: { x: nodeRect.x + edgePadding, y: centerY },
        position: Position.Left,
      }
    }
  } else {
    // More vertical - use top or bottom
    if (dy > 0) {
      return {
        point: { x: centerX, y: nodeRect.y + nodeRect.height - edgePadding },
        position: Position.Bottom,
      }
    } else {
      return {
        point: { x: centerX, y: nodeRect.y + edgePadding },
        position: Position.Top,
      }
    }
  }
}

// Custom floating edge component with improved connection point algorithm
export const FloatingEdge = memo(({
  id,
  source,
  target,
  style,
  markerEnd,
}: EdgeProps) => {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)

  // Defensive checks - nodes or their internals can be undefined during drag operations
  if (!sourceNode || !targetNode) {
    return null
  }

  // Check for valid position data - can be undefined during state transitions
  const sourcePos = sourceNode.internals?.positionAbsolute
  const targetPos = targetNode.internals?.positionAbsolute
  if (!sourcePos || !targetPos) {
    return null
  }

  // Get node dimensions - use measured dimensions from React Flow
  const sourceWidth = sourceNode.measured?.width ?? sourceNode.width ?? 100
  const sourceHeight = sourceNode.measured?.height ?? sourceNode.height ?? 40
  const targetWidth = targetNode.measured?.width ?? targetNode.width ?? 100
  const targetHeight = targetNode.measured?.height ?? targetNode.height ?? 40

  // Get cardScale from node data (applied via CSS transform)
  const sourceScale = (sourceNode.data as any)?.cardScale ?? 1.0
  const targetScale = (targetNode.data as any)?.cardScale ?? 1.0

  // Adjust dimensions for scale (CSS transform: scale affects visual size but not measured)
  const scaledSourceWidth = sourceWidth * sourceScale
  const scaledSourceHeight = sourceHeight * sourceScale
  const scaledTargetWidth = targetWidth * targetScale
  const scaledTargetHeight = targetHeight * targetScale

  const sourceRect = {
    x: sourcePos.x,
    y: sourcePos.y,
    width: scaledSourceWidth,
    height: scaledSourceHeight,
  }

  const targetRect = {
    x: targetPos.x,
    y: targetPos.y,
    width: scaledTargetWidth,
    height: scaledTargetHeight,
  }

  // Get center points (accounting for scaled size)
  const sourceCenter = {
    x: sourceRect.x + scaledSourceWidth / 2,
    y: sourceRect.y + scaledSourceHeight / 2,
  }
  const targetCenter = {
    x: targetRect.x + scaledTargetWidth / 2,
    y: targetRect.y + scaledTargetHeight / 2,
  }

  // Get best connection points on each node's boundary
  const sourceConnection = getBestConnectionSide(sourceRect, targetCenter)
  const targetConnection = getBestConnectionSide(targetRect, sourceCenter)

  // Generate smooth step path with better border radius
  const [edgePath] = getSmoothStepPath({
    sourceX: sourceConnection.point.x,
    sourceY: sourceConnection.point.y,
    sourcePosition: sourceConnection.position,
    targetX: targetConnection.point.x,
    targetY: targetConnection.point.y,
    targetPosition: targetConnection.position,
    borderRadius: 12,
  })

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={edgePath}
      style={style}
      markerEnd={markerEnd}
    />
  )
})

// All 4 edge handles - React Flow will pick the best one based on node positions
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

// ============================================
// FOLDER NODE
// ============================================
export interface FolderNodeData {
  label: string
  childCount: number
  type: 'core' | 'research' | 'skill' | 'spike' | 'other'
  isExpanded: boolean
  cardScale?: number
}

interface FolderNodeProps {
  data: FolderNodeData
  selected?: boolean
}

export const FolderNode = memo(({ data, selected }: FolderNodeProps) => {
  const COLORS = useFlowColors()
  const scale = getCardScale(data)
  const scaleStyle = scale === 1
    ? {}
    : { transform: `scale(${scale})`, transformOrigin: 'top left' }
  const typeColors: Record<string, string> = {
    core: COLORS.core,
    research: COLORS.research,
    skill: COLORS.skill,
    spike: COLORS.spike,
    other: COLORS.folder,
  }
  const typeColor = typeColors[data.type] || COLORS.folder

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `2px solid ${selected ? typeColor : COLORS.border}`,
        borderLeft: `4px solid ${typeColor}`,
        borderRadius: '8px',
        padding: '8px 12px 8px 10px',
        minWidth: '120px',
        cursor: 'pointer',
        ...scaleStyle,
        boxShadow: selected ? `0 0 0 1px ${typeColor}40` : 'none',
      }}
    >
      <EdgeHandles color={typeColor} />

      <div style={{ ...layoutPrimitives.row, alignItems: 'center', gap: '8px' }}>
        <span style={{ ...layoutPrimitives.row, alignItems: 'center', color: typeColor }}>
          {data.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <Folder size={14} color={typeColor} style={{ flexShrink: 0 }} />
        <span style={{ color: COLORS.text, fontWeight: 600, fontSize: '12px' }}>
          {data.label}
        </span>
        <span style={{
          background: `${typeColor}20`,
          color: typeColor,
          padding: '2px 8px',
          borderRadius: '10px',
          fontSize: '10px',
          fontWeight: 600,
        }}>
          {data.childCount}
        </span>
      </div>
    </div>
  )
})

// ============================================
// DOCUMENT NODE - Mini doc preview with outline
// ============================================

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

export type LinkCardStatus = 'internal' | 'external' | 'missing' | 'unresolved'

export interface LinkCardItem {
  id: string
  label: string
  target: string
  status: LinkCardStatus
  targetPath?: string
  targetId?: string
  sourceLine?: number
}

export type LinkCardAction = 'preview' | 'panel' | 'editor' | 'follow'

export interface LinkCardNodeData {
  parentDocId: string
  docName: string
  links: LinkCardItem[]
  cardScale?: number
  onLinkAction?: (link: LinkCardItem, action: LinkCardAction) => void
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

// ============================================
// LINK CARD NODE - Link summary + actions
// ============================================

interface LinkCardNodeProps {
  data: LinkCardNodeData
  selected?: boolean
}

export const LinkCardNode = memo(({ data, selected }: LinkCardNodeProps) => {
  const COLORS = useFlowColors()
  const scale = getCardScale(data)
  const scaleStyle = scale === 1 ? {} : { transform: `scale(${scale})`, transformOrigin: 'top left' }

  const links = data.links || []
  const internalLinks = links.filter(link => link.status === 'internal')
  const externalLinks = links.filter(link => link.status === 'external')
  const brokenLinks = links.filter(link => link.status === 'missing' || link.status === 'unresolved')

  const actionButtonStyle: React.CSSProperties = {
    border: 'none',
    background: `${COLORS.warning}20`,
    color: COLORS.warning,
    width: 18,
    height: 18,
    borderRadius: 4,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  }

  const renderLinkRow = (link: LinkCardItem, actions: LinkCardAction[]) => (
    <div key={link.id} style={{ ...layoutPrimitives.row, alignItems: 'center', gap: '6px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '10px',
          fontWeight: 600,
          color: COLORS.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {link.label || link.target}
        </div>
        <div style={{
          fontSize: '9px',
          color: COLORS.textMuted,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {link.targetPath || link.target}
        </div>
      </div>
      {data.onLinkAction && actions.length > 0 && (
        <div style={{ ...layoutPrimitives.row, gap: '4px' }}>
          {actions.includes('preview') && (
            <button
              type="button"
              title="Preview"
              style={actionButtonStyle}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                data.onLinkAction?.(link, 'preview')
              }}
            >
              <Eye size={10} />
            </button>
          )}
          {actions.includes('panel') && (
            <button
              type="button"
              title="Open Panel"
              style={actionButtonStyle}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                data.onLinkAction?.(link, 'panel')
              }}
            >
              <LayoutGrid size={10} />
            </button>
          )}
          {actions.includes('editor') && (
            <button
              type="button"
              title="Open Editor"
              style={actionButtonStyle}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                data.onLinkAction?.(link, 'editor')
              }}
            >
              <FileCode size={10} />
            </button>
          )}
          {actions.includes('follow') && (
            <button
              type="button"
              title="Add Root"
              style={actionButtonStyle}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                data.onLinkAction?.(link, 'follow')
              }}
            >
              <Link size={10} />
            </button>
          )}
        </div>
      )}
    </div>
  )

  const renderSection = (title: string, items: LinkCardItem[], actions: LinkCardAction[]) => {
    if (items.length === 0) return null
    return (
      <div style={{ marginBottom: '8px' }}>
        <div style={{
          fontSize: '9px',
          fontWeight: 600,
          textTransform: 'uppercase',
          color: COLORS.textMuted,
          marginBottom: '4px',
        }}>
          {title}
        </div>
        <div style={{ ...layoutPrimitives.column, gap: '6px' }}>
          {items.map(item => renderLinkRow(item, actions))}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `2px solid ${selected ? COLORS.warning : COLORS.border}`,
        borderLeft: `4px solid ${COLORS.warning}`,
        borderRadius: '8px',
        padding: '8px',
        minWidth: '220px',
        maxWidth: '320px',
        cursor: 'pointer',
        ...scaleStyle,
      }}
    >
      <EdgeHandles color={COLORS.warning} />
      <div style={{
        ...layoutPrimitives.row,
        alignItems: 'center',
        gap: '6px',
        marginBottom: '8px',
      }}>
        <Link size={12} color={COLORS.warning} />
        <span style={{ fontSize: '11px', fontWeight: 600, color: COLORS.text, flex: 1 }}>
          Links
        </span>
        <span style={{
          background: `${COLORS.warning}20`,
          color: COLORS.warning,
          padding: '1px 6px',
          borderRadius: '10px',
          fontSize: '9px',
          fontWeight: 600,
        }}>
          {links.length}
        </span>
      </div>
      {renderSection('In Project', internalLinks, ['preview', 'panel', 'editor'])}
      {renderSection('External', externalLinks, ['preview', 'panel', 'follow'])}
      {renderSection('Broken', brokenLinks, [])}
    </div>
  )
})

// NOTE: TaskNode, TOCNode, FullTaskNode, TaskListNode, ChecklistNode, DiagramNode
// are now imported from features/context-graph/plugins
// See the imports at the top of this file

// RE-EXPORT the plugin components for backwards compatibility
export { TaskNode, FullTaskNode, TaskListNode, ChecklistNode, DiagramNode, TOCNode }

// ============================================
// WORKING DOC NODE - Special card for documents in working folder
// ============================================
export interface WorkingDocNodeData {
  label: string
  path: string
  sections: { title: string; level: number }[]
  taskTitles: string[]
  checklistCount: number
  diagramCount: number
  loaded: boolean
  isFocused?: boolean
  cardScale?: number
  onPreview?: () => void
  onFocus?: () => void
}

interface WorkingDocNodeProps {
  data: WorkingDocNodeData
  selected?: boolean
}

export const WorkingDocNode = memo(({ data, selected }: WorkingDocNodeProps) => {
  const COLORS = useFlowColors()
  const scale = getCardScale(data)
  const scaleStyle = scale === 1
    ? {}
    : { transform: `scale(${scale})`, transformOrigin: 'top left' }
  const typeColor = COLORS.core

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
        borderRadius: '8px',
        padding: '10px',
        minWidth: '200px',
        maxWidth: '280px',
        opacity: data.loaded ? 1 : 0.6,
        cursor: 'pointer',
        ...scaleStyle,
      }}
    >
      <EdgeHandles color={typeColor} />

      {/* Header */}
      <div style={{
        ...layoutPrimitives.row,
        alignItems: 'center',
        gap: '6px',
        marginBottom: '8px',
        borderBottom: `1px solid ${COLORS.border}`,
        paddingBottom: '6px',
      }}>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: typeColor,
        }} />
        <span style={{
          color: COLORS.text,
          fontWeight: 600,
          fontSize: '12px',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {data.label}
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

      {/* Stats row */}
      <div style={{
        ...layoutPrimitives.row,
        gap: '8px',
        marginBottom: data.sections.length > 0 || data.taskTitles.length > 0 ? '8px' : 0,
        fontSize: '9px',
        color: COLORS.textMuted,
      }}>
        {data.taskTitles.length > 0 && (
          <span>📋 {data.taskTitles.length} tasks</span>
        )}
        {data.checklistCount > 0 && (
          <span>☑️ {data.checklistCount}</span>
        )}
        {data.diagramCount > 0 && (
          <span>📊 {data.diagramCount}</span>
        )}
      </div>

      {/* Outline - section titles */}
      {data.sections.length > 0 && (
        <div style={{ marginBottom: data.taskTitles.length > 0 ? '8px' : 0 }}>
          <div style={{
            fontSize: '8px',
            color: COLORS.textMuted,
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}>
            Outline
          </div>
          {data.sections.map((section, i) => (
            <div
              key={i}
              style={{
                fontSize: '10px',
                color: section.level === 1 ? COLORS.text : COLORS.textSecondary,
                paddingLeft: section.level > 1 ? '8px' : 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
              }}
            >
              {section.title}
            </div>
          ))}
        </div>
      )}

      {/* Task titles */}
      {data.taskTitles.length > 0 && (
        <div>
          <div style={{
            fontSize: '8px',
            color: COLORS.textMuted,
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}>
            Tasks
          </div>
          {data.taskTitles.map((title, i) => (
            <div
              key={i}
              style={{
                fontSize: '10px',
                color: COLORS.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
              }}
            >
              • {title}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

// ============================================
// FILE TREE NODE - Collapsed folder as tree widget
// ============================================
export interface FileTreeNodeData {
  label: string              // Folder name
  folderId: string           // Folder ID (workspace root or nested folder)
  basePath: string           // Full path to folder
  items: TreeItem[]          // All descendants
  onItemClick?: (item: TreeItem) => void
  onItemContextMenu?: (e: React.MouseEvent, item: TreeItem) => void
  onToggleView?: () => void
  cardScale?: number
}

interface FileTreeNodeProps {
  data: FileTreeNodeData
  selected?: boolean
}

// Get file icon based on extension
function getFileIcon(filename: string, color: string): React.ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase()
  const iconProps = { size: 12, color }
  switch (ext) {
    case 'md': return <FileText {...iconProps} />
    case 'json': return <FileJson {...iconProps} />
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'rs':
    case 'py':
    case 'go':
    case 'c':
    case 'cpp':
    case 'java': return <FileCode {...iconProps} />
    case 'html': return <Globe {...iconProps} />
    case 'css':
    case 'scss':
    case 'less': return <Palette {...iconProps} />
    case 'yaml':
    case 'yml':
    case 'toml': return <Cog {...iconProps} />
    case 'sh':
    case 'bash':
    case 'zsh': return <Terminal {...iconProps} />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp': return <FileImage {...iconProps} />
    default: return <File {...iconProps} />
  }
}

export const FileTreeNode = memo(({ data, selected }: FileTreeNodeProps) => {
  const COLORS = useFlowColors()
  const scale = getCardScale(data)
  const scaleStyle = scale === 1
    ? {}
    : { transform: `scale(${scale})`, transformOrigin: 'top left' }
  const treeColor = COLORS.textSecondary
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const actionButtonStyle: React.CSSProperties = {
    border: 'none',
    background: `${treeColor}20`,
    color: treeColor,
    width: 18,
    height: 18,
    borderRadius: 4,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  }

  // Build tree structure from flat items
  const getChildren = useCallback((parentId: string): TreeItem[] => {
    const prefix = parentId ? parentId + '/' : data.basePath + '/'
    return data.items.filter(item => {
      // Item must start with prefix and not have additional slashes (direct child)
      if (!item.id.startsWith(prefix)) return false
      const remainder = item.id.slice(prefix.length)
      return !remainder.includes('/')
    })
  }, [data.items, data.basePath])

  // Get top-level items (direct children of the base folder)
  const topLevelItems = useCallback((): TreeItem[] => {
    const basePrefix = data.folderId + '/'
    return data.items.filter(item => {
      if (!item.id.startsWith(basePrefix)) return false
      const remainder = item.id.slice(basePrefix.length)
      return !remainder.includes('/')
    })
  }, [data.items, data.folderId])

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }, [])

  const renderItem = useCallback((item: TreeItem, depth: number): React.ReactNode => {
    const isExpanded = expandedFolders.has(item.id)
    const children = item.is_dir ? getChildren(item.id) : []

    return (
      <div key={item.id}>
        <div
          style={{
            ...layoutPrimitives.row,
            alignItems: 'center',
            gap: '4px',
            padding: '3px 6px',
            paddingLeft: `${6 + depth * 14}px`,
            cursor: 'pointer',
            borderRadius: '3px',
            fontSize: '10px',
            color: COLORS.text,
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (item.is_dir) {
              toggleFolder(item.id)
            } else {
              data.onItemClick?.(item)
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            data.onItemContextMenu?.(e, item)
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = COLORS.border
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          {item.is_dir ? (
            <>
              <span style={{
                color: COLORS.textMuted,
                width: '10px',
                ...layoutPrimitives.row,
                alignItems: 'center',
              }}>
                {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </span>
              <span style={{ color: COLORS.folder }}>
                {item.name}
              </span>
              <span style={{
                fontSize: '8px',
                color: COLORS.textMuted,
                marginLeft: 'auto',
              }}>
                {children.length}
              </span>
            </>
          ) : (
            <>
              <span style={{
                width: '14px',
                ...layoutPrimitives.row,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {getFileIcon(item.name, COLORS.textMuted)}
              </span>
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {item.name}
              </span>
            </>
          )}
        </div>

        {/* Render children if folder is expanded */}
        {item.is_dir && isExpanded && children.length > 0 && (
          <div>
            {children.map(child => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }, [expandedFolders, getChildren, toggleFolder, data.onItemClick, data.onItemContextMenu])

  const fileCount = data.items.filter(i => !i.is_dir).length
  const folderCount = data.items.filter(i => i.is_dir).length

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `2px solid ${selected ? treeColor : COLORS.border}`,
        borderRadius: '8px',
        padding: '10px',
        minWidth: '180px',
        maxWidth: '280px',
        cursor: 'default',
        ...scaleStyle,
      }}
    >
      <EdgeHandles color={treeColor} />

      {/* Header */}
      <div style={{
        ...layoutPrimitives.row,
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
        borderBottom: `1px solid ${COLORS.border}`,
        paddingBottom: '6px',
      }}>
        <span style={{ fontSize: '12px', ...layoutPrimitives.row, alignItems: 'center' }}><Folder size={14} /></span>
        <span style={{
          color: COLORS.text,
          fontSize: '12px',
          fontWeight: 600,
        }}>
          {data.label}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{
          color: COLORS.textMuted,
          fontSize: '9px',
        }}>
          {fileCount} files{folderCount > 0 && `, ${folderCount} folders`}
        </span>
        {data.onToggleView && (
          <button
            type="button"
            title="Show as Folder"
            style={actionButtonStyle}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              data.onToggleView?.()
            }}
          >
            <LayoutGrid size={10} />
          </button>
        )}
      </div>

      {/* Tree content */}
      <div style={{
        maxHeight: '300px',
        overflowY: 'auto',
      }}>
        {topLevelItems().map(item => renderItem(item, 0))}
        {topLevelItems().length === 0 && (
          <div style={{
            color: COLORS.textMuted,
            fontSize: '10px',
            fontStyle: 'italic',
            padding: '8px',
            textAlign: 'center',
          }}>
            Empty folder
          </div>
        )}
      </div>
    </div>
  )
})

// Node type registry for React Flow
export const nodeTypes = {
  folder: FolderNode,
  document: DocumentNode,
  'link-card': LinkCardNode,
  workingdoc: WorkingDocNode,
  task: TaskNode,
  toc: TOCNode,
  tasklist: TaskListNode,
  checklist: ChecklistNode,
  diagram: DiagramNode,
  filetree: FileTreeNode,
}

// Edge type registry for React Flow
export const edgeTypes = {
  floating: FloatingEdge,
}
