// ============================================================================
// Node Plugin Components
// ============================================================================

import { memo, useMemo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { NodeItem, NodeState, getNodeStateColor } from './types'
import { useTheme } from '../../compat/design-system'

// Hook to get colors from theme
function useNodeColors() {
  const { colors } = useTheme()
  return useMemo(() => ({
    bg: colors.bgSecondary,
    bgDark: colors.bgPrimary,
    border: colors.borderPrimary,
    text: colors.textPrimary,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    error: colors.error,
    success: '#22c55e',
    textInverse: colors.textInverse,
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
// NODE NODE — Human-readable work step card
//
// Active nodes: prominent, full description, blue accent — "what's happening now"
// Success nodes: compact, green accent — "done, here's what it did"
// Failed nodes: red accent with reason
// ============================================================================

/** Convert kebab-case-id to Title Case */
function humanizeId(id: string): string {
  return id
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** State icon SVGs */
function StateIcon({ state, size = 16 }: { state: NodeState; size?: number }) {
  const color = getNodeStateColor(state)
  if (state === 'success') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" fill={color} fillOpacity={0.15} stroke={color} strokeWidth="1.5" />
        <path d="M5 8l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (state === 'failed') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" fill={color} fillOpacity={0.15} stroke={color} strokeWidth="1.5" />
        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  // active
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill={color} fillOpacity={0.15} stroke={color} strokeWidth="1.5" />
      <circle cx="8" cy="8" r="3" fill={color}>
        <animate attributeName="r" values="2.5;3.5;2.5" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

export interface NodeNodeData {
  node: NodeItem
  parentDocId: string
  cardScale?: number
}

interface NodeNodeProps {
  data: NodeNodeData
  selected?: boolean
}

export const NodeNode = memo(({ data, selected }: NodeNodeProps) => {
  const COLORS = useNodeColors()
  const scale = getCardScale(data)
  const { node } = data
  const stateColor = getNodeStateColor(node.state)
  const isCompact = node.state === 'success'
  const title = humanizeId(node.nodeId)

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `2px solid ${selected ? stateColor : COLORS.border}`,
        borderLeft: `5px solid ${stateColor}`,
        borderRadius: 10,
        padding: isCompact ? '10px 12px' : '14px 16px',
        minWidth: isCompact ? 220 : 280,
        maxWidth: isCompact ? 320 : 380,
        cursor: 'default',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        opacity: isCompact ? 0.85 : 1,
      }}
    >
      <EdgeHandles color={stateColor} />

      {/* Header: icon + title + layer badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <StateIcon state={node.state} />
        <span style={{
          fontSize: isCompact ? 12 : 13,
          fontWeight: 700,
          color: COLORS.text,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {title}
        </span>
        {node.layer && (
          <span style={{
            fontSize: 9,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '2px 5px',
            borderRadius: 4,
            background: `${COLORS.accent}15`,
            color: COLORS.textMuted,
            whiteSpace: 'nowrap',
          }}>
            {node.layer}
          </span>
        )}
      </div>

      {/* Subsystem tag */}
      {node.subsystem && (
        <div style={{ marginTop: 6 }}>
          <span style={{
            fontSize: 9,
            padding: '2px 6px',
            borderRadius: 4,
            background: `${COLORS.accent}22`,
            color: COLORS.accent,
          }}>
            {node.subsystem}
          </span>
        </div>
      )}

      {/* Claim (proof step assertion) — shown for all states */}
      {node.claim && (
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: COLORS.text,
          padding: '6px 8px',
          marginTop: 8,
          background: `${stateColor}0a`,
          borderRadius: 6,
          borderLeft: `3px solid ${stateColor}`,
          lineHeight: 1.4,
        }}>
          {node.claim}
        </div>
      )}

      {/* Proof step references */}
      {(node.derivesFrom?.length || node.proves?.length) && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          marginTop: 6,
        }}>
          {node.derivesFrom?.map((ref, i) => (
            <span key={`df-${i}`} style={{
              fontSize: 9,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 4,
              background: '#3b82f618',
              color: '#3b82f6',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}>
              ← {ref}
            </span>
          ))}
          {node.proves?.map((ref, i) => (
            <span key={`pr-${i}`} style={{
              fontSize: 9,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 4,
              background: '#22c55e18',
              color: '#22c55e',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}>
              → {ref}
            </span>
          ))}
        </div>
      )}

      {/* Body — regular text for active/failed, one-liner for success */}
      {node.body && (
        <div style={{
          marginTop: 8,
          fontSize: 11,
          lineHeight: 1.6,
          color: isCompact ? COLORS.textMuted : COLORS.textSecondary,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: isCompact ? 2 : 6,
          WebkitBoxOrient: 'vertical' as const,
        }}>
          {node.body}
        </div>
      )}
    </div>
  )
})
