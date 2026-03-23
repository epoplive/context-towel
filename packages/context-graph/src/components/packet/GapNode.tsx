// ============================================================================
// GapNode — Step card in the problem→target trajectory
//
// Visual states:
//   open        — dashed border, amber accent, empty progress ring
//   in-progress — dashed border, blue accent, animated ring, evidence timeline
//   resolved    — solid green fill, checkmark background, compact
//
// Cards are visually rich: large state icon, progress ring,
// colored evidence timeline with type dots. Not just text in a box.
// ============================================================================

import { memo, useState, useEffect, useRef } from 'react'
import { Handle, Position } from '@xyflow/react'
import mermaid from 'mermaid'
import { useTheme, useMermaidTheme } from '../../compat/design-system'

export type GapState = 'open' | 'in-progress' | 'resolved'

export interface GapNodeData {
  text: string
  label?: string
  state?: GapState
  relatedDeltas?: Array<{ type: string; content: string; timestamp: string }>
  /** Mermaid code for architecture impact mini-diagram */
  impactDiagram?: string
  /** File paths extracted from evidence */
  filePaths?: string[]
  /** Architecture component names affected by this gap */
  affectedSystems?: string[]
}

const STATE_CONFIG = {
  'open':        { accent: '#f59e0b', bg: 'transparent', borderStyle: 'dashed' as const },
  'in-progress': { accent: '#3b82f6', bg: 'transparent', borderStyle: 'dashed' as const },
  'resolved':    { accent: '#22c55e', bg: '#22c55e',     borderStyle: 'solid'  as const },
}

const DELTA_TYPE_COLORS: Record<string, string> = {
  discovery:  '#3b82f6',
  success:    '#22c55e',
  promotion:  '#22c55e',
  failure:    '#ef4444',
  collapse:   '#8b5cf6',
  reasoning:  '#8b5cf6',
  mutation:   '#f97316',
  observation:'#14b8a6',
}

function getDeltaColor(type: string): string {
  return DELTA_TYPE_COLORS[type] ?? '#6b7280'
}

/** Large state background icon — fills the card to give visual weight */
function StateBgIcon({ state, accent }: { state: GapState; accent: string }) {
  if (state === 'resolved') {
    return (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none"
        style={{ position: 'absolute', right: 8, top: 8, opacity: 0.12 }}>
        <circle cx="24" cy="24" r="22" fill={accent} />
        <path d="M14 24l7 7 13-13" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (state === 'in-progress') {
    return (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none"
        style={{ position: 'absolute', right: 8, top: 8, opacity: 0.08 }}>
        <circle cx="24" cy="24" r="22" stroke={accent} strokeWidth="2" strokeDasharray="6 4" fill="none">
          <animateTransform attributeName="transform" type="rotate" values="0 24 24;360 24 24" dur="8s" repeatCount="indefinite" />
        </circle>
        <circle cx="24" cy="24" r="8" fill={accent}>
          <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
    )
  }
  // open
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none"
      style={{ position: 'absolute', right: 8, top: 8, opacity: 0.06 }}>
      <circle cx="24" cy="24" r="22" stroke={accent} strokeWidth="2" strokeDasharray="6 4" fill="none" />
      <circle cx="24" cy="24" r="4" fill={accent} />
    </svg>
  )
}

/** Progress ring showing evidence coverage */
function ProgressRing({ count, accent, size = 32 }: { count: number; accent: string; size?: number }) {
  const r = (size - 4) / 2
  const circ = 2 * Math.PI * r
  // Visual fill: each delta = ~20% progress, caps at 100%
  const pct = Math.min(count * 20, 100)
  const filled = (pct / 100) * circ

  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={accent} strokeOpacity={0.12} strokeWidth={2.5} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={accent} strokeWidth={2.5}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        fill={accent} fontSize={9} fontWeight={700}
        fontFamily="monospace"
      >
        {count}
      </text>
    </svg>
  )
}

/** Visual evidence timeline — type-colored dots with content */
function EvidenceTimeline({ deltas, colors }: {
  deltas: Array<{ type: string; content: string; timestamp: string }>
  colors: { textMuted: string; textSecondary: string; bgPrimary: string; borderPrimary: string }
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? deltas : deltas.slice(0, 2)
  const hasMore = deltas.length > 2

  return (
    <div style={{
      marginTop: 10,
      background: colors.bgPrimary,
      borderRadius: 6,
      padding: '6px 0',
      border: `1px solid ${colors.borderPrimary}`,
    }}>
      {visible.map((d, i) => {
        const color = getDeltaColor(d.type)
        return (
          <div key={i} style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            padding: '6px 10px',
            borderBottom: i < visible.length - 1 ? `1px solid ${colors.borderPrimary}` : undefined,
          }}>
            {/* Timeline dot */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              paddingTop: 3, flexShrink: 0,
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: color,
                boxShadow: `0 0 6px ${color}40`,
              }} />
              {i < visible.length - 1 && (
                <div style={{
                  width: 2, height: 20, background: `${color}30`,
                  marginTop: 2,
                }} />
              )}
            </div>
            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2 }}>
                <span style={{
                  fontSize: 8, fontWeight: 800, textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '1px 5px', borderRadius: 3,
                  background: `${color}18`, color,
                }}>
                  {d.type}
                </span>
                <span style={{ fontSize: 8, color: colors.textMuted, fontFamily: 'monospace' }}>
                  {d.timestamp.match(/(\d{2}:\d{2})/)?.[1] ?? d.timestamp}
                </span>
              </div>
              <div style={{
                fontSize: 10, lineHeight: 1.5, color: colors.textSecondary,
              }}>
                {d.content}
              </div>
            </div>
          </div>
        )
      })}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 9, fontWeight: 600, color: colors.textMuted,
            padding: '4px 10px', textAlign: 'left', width: '100%',
          }}
        >
          {expanded ? '- Show less' : `+ ${deltas.length - 2} more`}
        </button>
      )}
    </div>
  )
}

// ── Impact diagram — mini mermaid showing affected architecture ──

function ImpactDiagram({ code, colors }: {
  code: string
  colors: { bgPrimary: string; borderPrimary: string; textPrimary: string; textMuted: string; accent: string; textSecondary: string; error: string }
}) {
  const themeKey = useMermaidTheme()
  const [svg, setSvg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const render = async () => {
      try {
        const id = `gap-impact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const result = await mermaid.render(id, code)
        if (!cancelled) { setSvg(result.svg); setError(null) }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    render()
    return () => { cancelled = true }
  }, [code, themeKey])

  return (
    <div style={{
      marginTop: 10,
      background: colors.bgPrimary,
      borderRadius: 6,
      border: `1px solid ${colors.borderPrimary}`,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px',
        borderBottom: `1px solid ${colors.borderPrimary}`,
      }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="3" cy="3" r="2" fill={colors.accent} fillOpacity={0.6} />
          <circle cx="9" cy="3" r="2" fill={colors.accent} fillOpacity={0.6} />
          <circle cx="6" cy="9" r="2" fill="#f59e0b" />
          <path d="M3 5v1l3 2M9 5v1l-3 2" stroke={colors.accent} strokeWidth="0.8" strokeOpacity={0.5} />
        </svg>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: colors.textSecondary }}>
          Impact Map
        </span>
      </div>
      <div
        ref={containerRef}
        style={{
          padding: 10,
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
          minHeight: 80, maxHeight: 200, overflow: 'auto',
        }}
      >
        {error ? (
          <div style={{ fontSize: 9, color: colors.error, textAlign: 'center', padding: 6 }}>
            Diagram error
          </div>
        ) : svg ? (
          <div dangerouslySetInnerHTML={{ __html: svg }} className="gap-impact-diagram" />
        ) : (
          <div style={{ fontSize: 9, color: colors.textMuted }}>Loading...</div>
        )}
      </div>
      <style>{`
        .gap-impact-diagram svg { max-width: 100%; height: auto; max-height: 180px; }
        .gap-impact-diagram .edgeLabel,
        .gap-impact-diagram .edgeLabel p,
        .gap-impact-diagram .edgeLabel span,
        .gap-impact-diagram .edgeLabel div,
        .gap-impact-diagram .edgeLabel foreignObject div,
        .gap-impact-diagram .edgeLabel foreignObject span,
        .gap-impact-diagram .label,
        .gap-impact-diagram .label div,
        .gap-impact-diagram .label span,
        .gap-impact-diagram .label text,
        .gap-impact-diagram .node .label div,
        .gap-impact-diagram .node .label span,
        .gap-impact-diagram .node text,
        .gap-impact-diagram .cluster text,
        .gap-impact-diagram tspan {
          fill: ${colors.textPrimary} !important;
          color: ${colors.textPrimary} !important;
        }
        .gap-impact-diagram .edgeLabel .label-container,
        .gap-impact-diagram .edgeLabel rect,
        .gap-impact-diagram .labelBkg {
          fill: ${colors.bgPrimary} !important;
          background: ${colors.bgPrimary} !important;
          stroke: none !important;
        }
        .gap-impact-diagram .edgePath path,
        .gap-impact-diagram .flowchart-link {
          stroke: ${colors.accent} !important;
        }
        .gap-impact-diagram marker path {
          fill: ${colors.accent} !important;
        }
      `}</style>
    </div>
  )
}

// ── File path tree — visual list of affected files grouped by directory ──

function FilePathTree({ paths, colors }: {
  paths: string[]
  colors: { bgPrimary: string; borderPrimary: string; textMuted: string; textSecondary: string; accent: string }
}) {
  // Group by first directory segment
  const groups = new Map<string, string[]>()
  for (const p of paths) {
    const parts = p.split('/')
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.'
    const file = parts[parts.length - 1]
    if (!groups.has(dir)) groups.set(dir, [])
    groups.get(dir)!.push(file)
  }

  return (
    <div style={{
      marginTop: 8,
      background: colors.bgPrimary,
      borderRadius: 6,
      border: `1px solid ${colors.borderPrimary}`,
      padding: '6px 10px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
      }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
          <path d="M1 3h4l1-1h5v8H1z" stroke={colors.accent} strokeWidth="1.2" fill={`${colors.accent}15`} />
        </svg>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: colors.textSecondary }}>
          Files ({paths.length})
        </span>
      </div>
      {Array.from(groups.entries()).map(([dir, files]) => (
        <div key={dir} style={{ marginBottom: 4 }}>
          <div style={{
            fontSize: 9, fontFamily: 'monospace', color: colors.textMuted,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0 }}>
              <path d="M1 2h2.5l.5-.5H7v5H1z" fill={colors.accent} fillOpacity={0.2} stroke={colors.accent} strokeWidth="0.7" />
            </svg>
            {dir}/
          </div>
          {files.map((file, i) => (
            <div key={i} style={{
              fontSize: 10, fontFamily: 'monospace', color: colors.textSecondary,
              paddingLeft: 16, display: 'flex', alignItems: 'center', gap: 4,
              lineHeight: 1.8,
            }}>
              <span style={{
                width: 1, height: 10,
                background: `${colors.accent}30`,
                display: 'inline-block',
                marginRight: 2,
              }} />
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0 }}>
                <rect x="1" y="0.5" width="6" height="7" rx="0.8" stroke={colors.textMuted} strokeWidth="0.7" fill="none" />
                <path d="M2.5 3h3M2.5 4.5h2" stroke={colors.textMuted} strokeWidth="0.5" />
              </svg>
              {file}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Affected systems — pills showing which architecture components are touched ──

function AffectedSystemsBadges({ systems, accent }: { systems: string[]; accent: string }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
      {systems.map((name, i) => (
        <span key={i} style={{
          fontSize: 9, fontWeight: 700,
          padding: '2px 8px', borderRadius: 4,
          background: `${accent}18`,
          color: accent,
          border: `1px solid ${accent}30`,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0 }}>
            <rect x="0.5" y="0.5" width="7" height="7" rx="1.5" stroke={accent} strokeWidth="0.8" fill={`${accent}20`} />
            <circle cx="4" cy="4" r="1.5" fill={accent} />
          </svg>
          {name}
        </span>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────

export const GapNode = memo(({ data, selected }: { data: GapNodeData; selected?: boolean }) => {
  const { colors } = useTheme()
  const state: GapState = data.state ?? 'open'
  const config = STATE_CONFIG[state]
  const accent = config.accent
  const deltaCount = data.relatedDeltas?.length ?? 0
  const hasEvidence = deltaCount > 0
  const hasImpactDiagram = !!data.impactDiagram && state !== 'resolved'
  const hasFilePaths = !!data.filePaths && data.filePaths.length > 0 && state !== 'resolved'
  const hasAffectedSystems = !!data.affectedSystems && data.affectedSystems.length > 0

  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      background: state === 'resolved'
        ? `${accent}0c`
        : colors.bgSecondary,
      border: `2px ${config.borderStyle} ${selected ? accent : (state === 'resolved' ? `${accent}80` : colors.borderPrimary)}`,
      borderLeft: `5px ${config.borderStyle} ${accent}`,
      borderRadius: 10,
      padding: '14px 16px',
      minWidth: 280,
      maxWidth: hasImpactDiagram ? 420 : 360,
      cursor: 'default',
      opacity: state === 'resolved' ? 0.8 : 1,
    }}>
      {/* Background state icon — visual weight */}
      <StateBgIcon state={state} accent={accent} />

      {/* Handles */}
      <Handle type="target" id="left" position={Position.Left} style={{ background: accent, width: 8, height: 8 }} />
      <Handle type="source" id="right" position={Position.Right} style={{ background: accent, width: 8, height: 8 }} />
      <Handle type="target" id="top" position={Position.Top} style={{ background: accent, width: 8, height: 8 }} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={{ background: accent, width: 8, height: 8 }} />

      {/* Header row: state label + progress ring */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
      }}>
        {/* Colored state bar */}
        <div style={{
          width: 4, height: 28, borderRadius: 2,
          background: accent,
          opacity: state === 'open' ? 0.4 : 1,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '1px', color: accent,
          }}>
            {state === 'resolved' ? 'Resolved' : (data.label ?? 'Gap')}
          </div>
          {state !== 'resolved' && (
            <div style={{
              fontSize: 9, color: colors.textMuted, marginTop: 1,
            }}>
              {hasEvidence ? `${deltaCount} evidence item${deltaCount > 1 ? 's' : ''}` : 'No evidence yet'}
            </div>
          )}
        </div>
        {/* Progress ring for active gaps */}
        {hasEvidence && state !== 'resolved' && (
          <ProgressRing count={deltaCount} accent={accent} />
        )}
      </div>

      {/* Description — with visual treatment per state */}
      <div style={{
        fontSize: 11, lineHeight: 1.6,
        color: state === 'resolved' ? colors.textMuted : colors.textPrimary,
        textDecoration: state === 'resolved' ? 'line-through' : 'none',
        padding: state === 'resolved' ? '4px 8px' : '6px 10px',
        background: state === 'resolved'
          ? `${accent}08`
          : state === 'in-progress'
            ? `${accent}06`
            : 'transparent',
        borderRadius: 6,
        position: 'relative',
      }}>
        {data.text}
      </div>

      {/* Affected systems — which architecture components this touches */}
      {hasAffectedSystems && (
        <AffectedSystemsBadges systems={data.affectedSystems!} accent={accent} />
      )}

      {/* Impact diagram — mini mermaid showing affected architecture */}
      {hasImpactDiagram && (
        <ImpactDiagram code={data.impactDiagram!} colors={colors} />
      )}

      {/* File paths — visual tree of affected files */}
      {hasFilePaths && (
        <FilePathTree paths={data.filePaths!} colors={colors} />
      )}

      {/* Evidence timeline — visual dots + type badges, not just text */}
      {hasEvidence && state !== 'resolved' && (
        <EvidenceTimeline deltas={data.relatedDeltas!} colors={colors} />
      )}
    </div>
  )
})
