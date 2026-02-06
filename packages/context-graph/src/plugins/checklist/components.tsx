// ============================================================================
// Checklist Plugin Components
// ============================================================================

import { memo, useMemo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { ChecklistGroup, ChecklistItem } from './types'
import { useTheme } from '../../compat/design-system'
import { layoutPrimitives } from '../../compat/layoutPrimitives'

// Hook to get colors from theme
function useChecklistColors() {
  const { colors } = useTheme()
  return useMemo(() => ({
    bg: colors.bgSecondary,
    bgDark: colors.bgPrimary,
    border: colors.borderPrimary,
    text: colors.textPrimary,
    textMuted: colors.textMuted,
    accent: colors.accent,
    success: colors.success,
    textInverse: colors.textInverse,
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
// CHECKLIST NODE - Standalone checklist group
// ============================================================================
export interface ChecklistNodeData {
  group: ChecklistGroup
  parentDocId: string
  cardScale?: number
}

interface ChecklistNodeProps {
  data: ChecklistNodeData
  selected?: boolean
}

export const ChecklistNode = memo(({ data, selected }: ChecklistNodeProps) => {
  const COLORS = useChecklistColors()
  const scale = getCardScale(data)
  const { group } = data
  const checklistColor = COLORS.accent
  const completedCount = group.items.filter(i => i.checked).length

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `2px solid ${selected ? checklistColor : COLORS.border}`,
        borderLeft: `4px solid ${checklistColor}`,
        borderRadius: '8px',
        padding: '12px',
        minWidth: '200px',
        maxWidth: '280px',
        cursor: 'default',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
    >
      <EdgeHandles color={checklistColor} />

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
          color: checklistColor,
          fontSize: '11px',
          fontWeight: 600,
        }}>
          {group.title}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{
          color: COLORS.textMuted,
          fontSize: '9px',
        }}>
          {completedCount}/{group.items.length}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{
          height: '5px',
          background: COLORS.border,
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${group.progress}%`,
            background: group.progress === 100 ? COLORS.success : checklistColor,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* ALL checklist items */}
      <div>
        {group.items.map((item: ChecklistItem, i: number) => (
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
    </div>
  )
})
