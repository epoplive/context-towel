// ============================================================================
// Shared Packet Graph Primitives
//
// Extracted sub-components used across multiple packet node types.
// Keeps each node focused on its unique behavior instead of repeating
// handles, color maps, path shortening, and progress rings.
// ============================================================================

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'

// ── Color Palette ────────────────────────────────────────────────

/** Semantic color palette shared across all packet graph nodes */
export const PACKET_COLORS = {
  green:  '#22c55e',
  blue:   '#3b82f6',
  amber:  '#f59e0b',
  red:    '#ef4444',
  purple: '#8b5cf6',
  orange: '#f97316',
  teal:   '#14b8a6',
  pink:   '#ec4899',
  gray:   '#6b7280',
} as const

/** Delta type → color mapping used by timeline, gap evidence, and badges */
export const DELTA_TYPE_COLORS: Record<string, string> = {
  discovery:   PACKET_COLORS.blue,
  reasoning:   PACKET_COLORS.purple,
  mutation:    PACKET_COLORS.orange,
  promotion:   PACKET_COLORS.green,
  success:     PACKET_COLORS.green,
  failure:     PACKET_COLORS.red,
  collapse:    PACKET_COLORS.purple,
  log:         PACKET_COLORS.gray,
  observation: PACKET_COLORS.teal,
  decision:    PACKET_COLORS.pink,
}

export function getDeltaColor(type: string): string {
  return DELTA_TYPE_COLORS[type] ?? PACKET_COLORS.gray
}

// ── Handles ──────────────────────────────────────────────────────

/** Standard 4-handle layout for pill-sized nodes (ref, test, diagram) */
export function PillHandles({ color }: { color: string }) {
  const style = { background: color, width: 6, height: 6 }
  return (
    <>
      <Handle type="target" id="left" position={Position.Left} style={style} />
      <Handle type="source" id="right" position={Position.Right} style={style} />
      <Handle type="target" id="top" position={Position.Top} style={style} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={style} />
    </>
  )
}

/** Full 8-handle layout for large nodes (vector, gap, timeline) */
export const CardHandles = memo(({ color }: { color: string }) => {
  const style = { background: color, width: 8, height: 8 }
  return (
    <>
      <Handle type="target" id="top" position={Position.Top} style={style} />
      <Handle type="target" id="left" position={Position.Left} style={style} />
      <Handle type="source" id="right" position={Position.Right} style={style} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={style} />
      <Handle type="source" id="source-top" position={Position.Top} style={style} />
      <Handle type="source" id="source-left" position={Position.Left} style={style} />
      <Handle type="source" id="source-right" position={Position.Right} style={style} />
      <Handle type="source" id="source-bottom" position={Position.Bottom} style={style} />
    </>
  )
})

// ── Path Shortening ──────────────────────────────────────────────

/** Shorten a file path to its last 2 segments, or show hostname for URLs */
export function shortPath(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const url = new URL(path)
      return url.hostname + url.pathname
    } catch {
      return path
    }
  }
  const parts = path.split('/')
  return parts.length > 2 ? '.../' + parts.slice(-2).join('/') : path
}

/** Check if a path is a URL */
export function isUrl(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://')
}

// ── Progress Ring ────────────────────────────────────────────────

interface ProgressRingProps {
  /** Percentage (0-100) or count depending on mode */
  value: number
  color: string
  size?: number
  /** 'pct' shows N%, 'count' shows raw number */
  mode?: 'pct' | 'count'
  strokeWidth?: number
}

/**
 * SVG ring showing progress or count.
 *
 * Used by VectorNode (convergence %), GapNode (evidence count),
 * and SummaryRollupNode.
 */
export function ProgressRing({ value, color, size = 42, mode = 'pct', strokeWidth = 3 }: ProgressRingProps) {
  const r = (size - strokeWidth - 1) / 2
  const circ = 2 * Math.PI * r
  const pct = mode === 'count' ? Math.min(value * 20, 100) : value
  const filled = (pct / 100) * circ

  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.12} strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={size < 36 ? 9 : 12} fontWeight={700}
        fontFamily="monospace"
      >
        {mode === 'count' ? value : `${value}%`}
      </text>
    </svg>
  )
}

// ── Section Label ────────────────────────────────────────────────

/** Uppercase divider line with accent color — used in vector and gap cards */
export function SectionLabel({ label, color }: { label: string; color: string }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
      letterSpacing: '1px', color, marginTop: 14, marginBottom: 6,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span>{label}</span>
      <div style={{ flex: 1, height: 1, background: `${color}33` }} />
    </div>
  )
}

// ── Status Dot ───────────────────────────────────────────────────

/** Small colored circle with glow — used by TestNode, DeltaTimeline entries */
export function StatusDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      boxShadow: `0 0 4px ${color}50`,
      flexShrink: 0,
    }} />
  )
}
