// ============================================================================
// SummaryRollupNode — Collapsed summary card for groups of proof steps
//
// At higher zoom levels, child proof steps collapse into summary cards:
// - Subsystem/group name
// - Child count with state breakdown
// - Miniature convergence indicator
// - Click to expand (change zoom level)
// ============================================================================

import { memo, useMemo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useTheme } from '../../compat/design-system'

export interface SummaryRollupData {
  label: string
  childCount: number
  activeCount: number
  successCount: number
  failedCount: number
  subsystem?: string
  /** Callback to drill into this group's zoom level */
  onExpand?: () => void
}

function MiniConvergence({ pct, color, size = 24 }: { pct: number; color: string; size?: number }) {
  const r = (size - 3) / 2
  const circ = 2 * Math.PI * r
  const filled = (pct / 100) * circ

  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={2} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={2}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
      />
    </svg>
  )
}

export const SummaryRollupNode = memo(({ data, selected }: { data: SummaryRollupData; selected?: boolean }) => {
  const { colors } = useTheme()
  const accent = '#8b5cf6' // indigo for rollups

  const pct = useMemo(() => {
    if (data.childCount === 0) return 0
    return Math.round((data.successCount / data.childCount) * 100)
  }, [data.childCount, data.successCount])

  return (
    <div
      style={{
        background: colors.bgSecondary,
        border: `2px solid ${selected ? accent : colors.borderPrimary}`,
        borderRadius: 10,
        padding: '10px 14px',
        cursor: data.onExpand ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 160,
        maxWidth: 240,
      }}
      onClick={data.onExpand}
    >
      <Handle type="target" id="left" position={Position.Left} style={{ background: accent, width: 6, height: 6 }} />
      <Handle type="source" id="right" position={Position.Right} style={{ background: accent, width: 6, height: 6 }} />
      <Handle type="target" id="top" position={Position.Top} style={{ background: accent, width: 6, height: 6 }} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={{ background: accent, width: 6, height: 6 }} />

      <MiniConvergence pct={pct} color={accent} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: colors.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {data.label}
        </div>
        <div style={{
          fontSize: 9,
          color: colors.textMuted,
          display: 'flex',
          gap: 6,
          marginTop: 2,
        }}>
          <span>{data.childCount} nodes</span>
          {data.activeCount > 0 && <span style={{ color: '#3b82f6' }}>{data.activeCount} active</span>}
          {data.successCount > 0 && <span style={{ color: '#22c55e' }}>{data.successCount} done</span>}
          {data.failedCount > 0 && <span style={{ color: '#ef4444' }}>{data.failedCount} failed</span>}
        </div>
        {data.subsystem && (
          <div style={{
            fontSize: 9,
            padding: '1px 4px',
            borderRadius: 3,
            background: `${accent}15`,
            color: accent,
            marginTop: 3,
            display: 'inline-block',
          }}>
            {data.subsystem}
          </div>
        )}
      </div>

      {data.onExpand && (
        <span style={{ fontSize: 10, color: colors.textMuted }}>▶</span>
      )}
    </div>
  )
})
