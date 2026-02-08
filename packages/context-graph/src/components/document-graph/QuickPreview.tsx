import { useEffect, useRef, useState } from 'react'

import type { CodeViewerComponent } from '@context-towel/markdown'
import type { FullscreenModalState } from '@context-towel/markdown'

import { useTheme, Icon, icons } from '../../compat/design-system'
import { layoutPrimitives } from '../../compat/layoutPrimitives'
import type { TaskItem } from '../../plugins/task/types'
import type { TocSection } from '../../plugins/toc/types'
import type { ChecklistGroup } from '../../plugins/checklist/types'
import type { DiagramItem } from '../../plugins/diagram/types'

import { SectionView } from './SectionView'

export interface QuickPreviewProps {
  name: string
  type: string
  isFile: boolean
  tasks?: TaskItem[]
  content?: string
  sections?: TocSection[]
  checklists?: ChecklistGroup[]
  diagrams?: DiagramItem[]
  sourceFile?: string
  onClose: () => void
  onOpenFull?: () => void
  onEdit?: () => void
  onFullscreen?: (state: FullscreenModalState) => void
  CodeViewer?: CodeViewerComponent
  onFocus?: () => void
  initialSectionIndex?: number
  position: { x: number; y: number }
  onPositionChange: (position: { x: number; y: number }) => void
}

export function QuickPreview({
  name,
  type,
  isFile,
  tasks: _tasks,
  content,
  sections,
  checklists: _checklists,
  diagrams: _diagrams,
  sourceFile: _sourceFile,
  onClose,
  onOpenFull,
  onEdit,
  onFocus,
  CodeViewer,
  position,
  onPositionChange,
}: QuickPreviewProps) {
  const { colors, shadows } = useTheme()
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null)

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    }

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      onPositionChange({
        x: Math.max(0, dragRef.current.startPosX + dx),
        y: Math.max(0, dragRef.current.startPosY + dy),
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragRef.current = null
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const typeColor =
    type === 'core' ? colors.graphCore :
    type === 'research' ? colors.graphResearch :
    type === 'skill' ? colors.graphSkill :
    type === 'spike' ? colors.graphSpike :
    colors.graphFolder

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 100,
      }}
    >
      <div style={{
        background: colors.bgSecondary,
        border: `1px solid ${colors.borderSecondary}`,
        borderRadius: '6px',
        padding: '10px',
        width: '420px',
        height: '500px',
        minWidth: '300px',
        minHeight: '200px',
        maxWidth: '80vw',
        maxHeight: '80vh',
        boxShadow: shadows.lg,
        ...layoutPrimitives.column,
        resize: 'both',
        overflow: 'hidden',
      }}>
        {/* Header - draggable */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            ...layoutPrimitives.row,
            alignItems: 'center',
            gap: '6px',
            marginBottom: '8px',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
        >
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: typeColor,
          }} />
          <span style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '12px', flex: 1 }}>
            {name.replace('.md', '')}
          </span>
          <span style={{
            background: colors.buttonBg,
            color: colors.textSecondary,
            padding: '1px 6px',
            borderRadius: '3px',
            fontSize: '9px',
            textTransform: 'uppercase',
          }}>
            {type}
          </span>
          <button
            onClick={onClose}
            style={{
              ...layoutPrimitives.row,
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: colors.textMuted,
              cursor: 'pointer',
              padding: '0 2px',
            }}
          >
            <Icon icon={icons.close} size="xs" />
          </button>
        </div>

        {/* Content - same as full view, just in preview container */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          background: colors.bgPrimary,
          borderRadius: '4px',
          padding: '8px',
          marginBottom: '8px',
          minWidth: 0,
          width: '100%',
        }}>
          <SectionView
            content={content || ''}
            typeColor={typeColor}
            sections={sections}
            CodeViewer={CodeViewer}
          />
        </div>

        {/* Actions */}
        <div style={{ ...layoutPrimitives.row, gap: '6px' }}>
          {isFile && onOpenFull && (
            <button
              onClick={onOpenFull}
              style={{
                flex: 1,
                background: colors.accent,
                border: 'none',
                color: colors.textInverse,
                padding: '5px 10px',
                borderRadius: '3px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              Open Full View
            </button>
          )}
          {onFocus && (
            <button
              onClick={onFocus}
              style={{
                background: colors.success,
                border: 'none',
                color: colors.textInverse,
                padding: '5px 10px',
                borderRadius: '3px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
              title="Focus on this node and its descendants"
            >
              Focus
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              style={{
                background: colors.buttonBg,
                border: `1px solid ${colors.borderSecondary}`,
                color: colors.textSecondary,
                padding: '5px 10px',
                borderRadius: '3px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
