// ============================================================================
// CriterionNode — Compact card for a single criterion/checklist item
//
// These decompose from vectors and nodes. Small, dense, state-aware.
// Leaf cards in the graph — high information density in tight space.
// ============================================================================

import { memo, useMemo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useTheme } from '../../compat/design-system'

export type CriterionState = 'done' | 'active' | 'pending' | 'gap'

export interface CriterionNodeData {
  text: string
  state: CriterionState
  /** Which side of the graph: solved criteria vs position/gap items */
  side: 'solved' | 'position'
  /** Number of sub-items if this card has children */
  childCount?: number
  /** Number of resolved children */
  childDone?: number
}

const STATE_COLORS: Record<CriterionState, { border: string; icon: string; bg: string }> = {
  done:    { border: '#22c55e', icon: '#22c55e', bg: '#22c55e0a' },
  active:  { border: '#3b82f6', icon: '#3b82f6', bg: '#3b82f60a' },
  pending: { border: '#6b7280', icon: '#6b7280', bg: 'transparent' },
  gap:     { border: '#f59e0b', icon: '#f59e0b', bg: '#f59e0b0a' },
}

function CheckIcon({ color, checked }: { color: string; checked: boolean }) {
  if (checked) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="12" height="12" rx="3" fill={color} fillOpacity={0.15} stroke={color} strokeWidth="1.5" />
        <path d="M4 7l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="12" height="12" rx="3" stroke={color} strokeWidth="1.5" strokeOpacity={0.5} />
    </svg>
  )
}

function GapIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.5" />
      <circle cx="7" cy="7" r="2" fill={color} />
    </svg>
  )
}

export const CriterionNode = memo(({ data, selected }: { data: CriterionNodeData; selected?: boolean }) => {
  const { colors } = useTheme()
  const sc = STATE_COLORS[data.state]

  const textColor = useMemo(() => {
    if (data.state === 'done') return colors.textPrimary
    if (data.state === 'gap') return '#f59e0b'
    if (data.state === 'active') return colors.textPrimary
    return colors.textMuted
  }, [data.state, colors])

  const hasChildren = (data.childCount ?? 0) > 0

  return (
    <div style={{
      background: sc.bg || colors.bgSecondary,
      border: `1.5px solid ${selected ? sc.border : colors.borderPrimary}`,
      borderLeft: `4px solid ${sc.border}`,
      borderRadius: 8,
      padding: '8px 10px',
      minWidth: 180,
      maxWidth: 260,
      cursor: 'default',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
    }}>
      <Handle type="target" id="left" position={Position.Left} style={{ background: sc.border, width: 6, height: 6 }} />
      <Handle type="source" id="right" position={Position.Right} style={{ background: sc.border, width: 6, height: 6 }} />
      <Handle type="target" id="top" position={Position.Top} style={{ background: sc.border, width: 6, height: 6 }} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={{ background: sc.border, width: 6, height: 6 }} />

      {/* State icon */}
      <div style={{ flexShrink: 0, marginTop: 1 }}>
        {data.side === 'position' ? (
          <GapIcon color={sc.icon} />
        ) : (
          <CheckIcon color={sc.icon} checked={data.state === 'done'} />
        )}
      </div>

      {/* Text + sub-count */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11,
          fontWeight: data.state === 'done' ? 500 : 400,
          color: textColor,
          lineHeight: 1.4,
          textDecoration: data.state === 'done' && data.side === 'solved' ? 'none' : 'none',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical' as const,
        }}>
          {data.text}
        </div>
        {hasChildren && (
          <div style={{
            fontSize: 9,
            fontWeight: 600,
            color: colors.textMuted,
            marginTop: 3,
          }}>
            {data.childDone ?? 0}/{data.childCount} resolved
          </div>
        )}
      </div>
    </div>
  )
})
