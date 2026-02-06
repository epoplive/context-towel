// ============================================================================
// TOC Plugin Components
// ============================================================================

import { memo, useMemo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useTheme } from '../../compat/design-system'
import { layoutPrimitives } from '../../compat/layoutPrimitives'

// Hook to get colors from theme
function useTOCColors() {
  const { colors } = useTheme()
  return useMemo(() => ({
    bg: colors.bgSecondary,
    bgDark: colors.bgPrimary,
    border: colors.borderPrimary,
    text: colors.textPrimary,
    textMuted: colors.textMuted,
    accent: colors.accent,
  }), [colors])
}

const getCardScale = (data: any): number => data?.cardScale ?? 1.0

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
// TOC NODE - Table of Contents card
// ============================================================================
export interface TOCSectionItem {
  title: string
  level: number
  sectionIndex: number
  tasks?: number
  tasksCompleted?: number
}

export interface TOCNodeData {
  parentDocId: string
  docName: string
  sections: TOCSectionItem[]
  onSectionClick?: (sectionIndex: number) => void
  cardScale?: number
}

interface TOCNodeProps {
  data: TOCNodeData
  selected?: boolean
}

export const TOCNode = memo(({ data, selected }: TOCNodeProps) => {
  const COLORS = useTOCColors()
  const scale = getCardScale(data)
  const tocColor = COLORS.accent

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `2px solid ${selected ? tocColor : COLORS.border}`,
        borderRadius: '8px',
        padding: '10px',
        minWidth: '180px',
        maxWidth: '280px',
        cursor: 'default',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
    >
      <EdgeHandles color={tocColor} />

      {/* Header */}
      <div style={{
        ...layoutPrimitives.row,
        alignItems: 'center',
        gap: '6px',
        marginBottom: '8px',
        borderBottom: `1px solid ${COLORS.border}`,
        paddingBottom: '6px',
      }}>
        <span style={{ color: tocColor, fontSize: '12px' }}>Contents</span>
        <span style={{
          color: COLORS.textMuted,
          fontSize: '10px',
          flex: 1,
          textAlign: 'right',
        }}>
          {data.sections.length} sections
        </span>
      </div>

      {/* Section links */}
      <div>
        {data.sections.map((section, i) => {
          const hasTasks = section.tasks && section.tasks > 0
          const allComplete = hasTasks && section.tasksCompleted === section.tasks

          return (
            <div
              key={i}
              onClick={(e) => {
                e.stopPropagation()
                data.onSectionClick?.(section.sectionIndex)
              }}
              style={{
                ...layoutPrimitives.row,
                alignItems: 'center',
                gap: '6px',
                padding: '4px 6px',
                paddingLeft: `${6 + (section.level - 1) * 10}px`,
                cursor: 'pointer',
                borderRadius: '3px',
                marginBottom: '1px',
                background: 'transparent',
                transition: 'background 0.1s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = COLORS.border
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <span style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: section.level === 1 ? tocColor : COLORS.textMuted,
                flexShrink: 0,
              }} />
              <span style={{
                color: section.level === 1 ? COLORS.text : COLORS.textMuted,
                fontSize: section.level === 1 ? '11px' : '10px',
                fontWeight: section.level === 1 ? 600 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}>
                {section.title}
              </span>
              {hasTasks && (
                <span style={{
                  fontSize: '9px',
                  padding: '1px 4px',
                  borderRadius: '8px',
                  background: allComplete ? '#22c55e33' : COLORS.bgDark,
                  color: allComplete ? '#22c55e' : COLORS.textMuted,
                  fontWeight: 500,
                  flexShrink: 0,
                }}>
                  {section.tasksCompleted}/{section.tasks}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
})
