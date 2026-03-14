// ============================================================================
// Node Plugin Components
// ============================================================================

import { memo, useMemo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { NodeItem, NodeState, getNodeStateColor } from './types'
import { useTheme } from '../../compat/design-system'
import { layoutPrimitives } from '../../compat/layoutPrimitives'

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
// State Badge
// ============================================================================

function StateBadge({ state }: { state: NodeState }) {
  const color = getNodeStateColor(state)
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      padding: '2px 6px',
      borderRadius: 4,
      background: `${color}22`,
      color,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        display: 'inline-block',
        flexShrink: 0,
      }} />
      {state}
    </span>
  )
}

// ============================================================================
// Body Line — dims dead paths, highlights proven paths
// ============================================================================

function BodyLine({ line, colors }: { line: string; colors: ReturnType<typeof useNodeColors> }) {
  const isDead = line.startsWith('\u{1F480}')   // skull emoji
  const isProven = line.startsWith('\u2713')     // check mark

  let color = colors.textSecondary
  let opacity = 1
  if (isDead) {
    color = colors.textMuted
    opacity = 0.6
  } else if (isProven) {
    color = colors.success
  }

  return (
    <div style={{ color, opacity }}>
      {line}
    </div>
  )
}

// ============================================================================
// NODE NODE — Graph node component for ~~~node blocks
// ============================================================================

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
  const bodyLines = node.body.split('\n').filter(l => l.length > 0)

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `2px solid ${selected ? stateColor : COLORS.border}`,
        borderLeft: `6px solid ${stateColor}`,
        borderRadius: '10px',
        padding: '14px',
        minWidth: '300px',
        maxWidth: '500px',
        cursor: 'default',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
    >
      <EdgeHandles color={stateColor} />

      {/* Header */}
      <div style={{
        ...layoutPrimitives.row,
        alignItems: 'center',
        gap: '8px',
        marginBottom: '10px',
        borderBottom: `1px solid ${COLORS.border}`,
        paddingBottom: '8px',
      }}>
        <StateBadge state={node.state} />
        <span style={{
          fontSize: '13px',
          fontWeight: 600,
          color: COLORS.text,
          fontFamily: 'monospace',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {node.nodeId}
        </span>
        {node.layer && (
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '2px 6px',
            borderRadius: 4,
            background: `${COLORS.accent}15`,
            color: COLORS.accent,
            whiteSpace: 'nowrap',
          }}>
            {node.layer}
          </span>
        )}
      </div>

      {/* Subsystem tag */}
      {node.subsystem && (
        <div style={{ marginBottom: 8 }}>
          <span style={{
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
            background: `${COLORS.accent}22`,
            color: COLORS.accent,
          }}>
            {node.subsystem}
          </span>
        </div>
      )}

      {/* Body */}
      {bodyLines.length > 0 && (
        <pre style={{
          fontSize: '11px',
          fontFamily: 'monospace',
          margin: 0,
          whiteSpace: 'pre-wrap',
          lineHeight: 1.5,
          background: COLORS.bgDark,
          borderRadius: '6px',
          padding: '10px',
          maxHeight: '200px',
          overflow: 'auto',
        }}>
          {bodyLines.map((line, i) => (
            <BodyLine key={i} line={line} colors={COLORS} />
          ))}
        </pre>
      )}
    </div>
  )
})
