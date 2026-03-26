// ============================================================================
// VectorNode — Rich composite panel for problem vectors
//
// These are the main "zone" cards in the x + y = z layout.
// Each card is a multi-section panel with embedded content:
//   - Text descriptions
//   - Inline fact/criterion lists with state indicators
//   - Embedded mermaid diagrams (slideshow when multiple)
//   - Progress indicators
//
// Modes:
//   'problem'  — Left zone: Current State + Approach + Facts + Diagrams
//   'target'   — Right zone: Target State + Criteria + Progress
//   undefined  — Full card (backward compat)
// ============================================================================

import { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react'
import mermaid from 'mermaid'
import { useTheme, useMermaidTheme } from '../../compat/design-system'
import { ProgressRing, CardHandles, SectionLabel } from './primitives'
import type {
  ProblemVectorEntry,
  VectorCriterionEntry,
  VectorFactEntry,
} from './parsePacketContent'

/** Progress stats for child nodes — passed in from PacketWorkspace */
export interface VectorProgress {
  active: number
  success: number
  failed: number
  total: number
}

/** A mermaid diagram to embed in the card */
export interface EmbeddedDiagram {
  title: string
  code: string
}

export interface VectorNodeData {
  vector: ProblemVectorEntry
  progress?: VectorProgress
  cardScale?: number
  mode?: 'problem' | 'target'
  /** Diagrams to embed in this card (whiteboard/architecture) */
  diagrams?: EmbeddedDiagram[]
}

// ── Shared sub-components (from primitives) ──────────────────────

/** Local alias: wraps ProgressRing in pct mode to match old ConvergenceRing API */
function ConvergenceRing({ pct, color, size = 42 }: { pct: number; color: string; size?: number }) {
  return <ProgressRing value={pct} color={color} size={size} mode="pct" />
}

// EdgeHandles → CardHandles from primitives (re-aliased for code readability)
const EdgeHandles = CardHandles

// ── Inline fact/criterion lists ────────────────────────────────

function FactList({ facts, colors }: { facts: VectorFactEntry[]; colors: { textSecondary: string; textMuted: string } }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {facts.map((f, i) => {
        const isGap = f.mark === 'gap'
        const dotColor = isGap ? '#f59e0b' : '#22c55e'
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '4px 8px',
            background: isGap ? '#f59e0b08' : 'transparent',
            borderRadius: 6,
            borderLeft: `3px solid ${dotColor}`,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0, marginTop: 2 }}>
              {isGap ? (
                <>
                  <circle cx="6" cy="6" r="5" stroke={dotColor} strokeWidth="1.5" fill="none" />
                  <circle cx="6" cy="6" r="2" fill={dotColor} />
                </>
              ) : (
                <>
                  <circle cx="6" cy="6" r="5" fill={dotColor} fillOpacity={0.15} stroke={dotColor} strokeWidth="1.5" />
                  <path d="M3.5 6l1.5 1.5 3-3" stroke={dotColor} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </>
              )}
            </svg>
            <div style={{
              fontSize: 11, lineHeight: 1.5, flex: 1,
              color: isGap ? '#f59e0b' : colors.textSecondary,
              fontWeight: isGap ? 500 : 400,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                color: dotColor, marginRight: 4,
              }}>
                {f.mark}
              </span>
              {f.text}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CriteriaList({ criteria, colors }: { criteria: VectorCriterionEntry[]; colors: { textPrimary: string; textMuted: string; borderPrimary: string } }) {
  const proven = criteria.filter(c => c.mark === 'proven').length
  const total = criteria.length

  return (
    <div>
      {/* Progress summary bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
      }}>
        <div style={{
          flex: 1, height: 6, borderRadius: 3,
          background: `${colors.borderPrimary}`,
          overflow: 'hidden',
        }}>
          <div style={{
            width: total > 0 ? `${(proven / total) * 100}%` : '0%',
            height: '100%', borderRadius: 3,
            background: '#22c55e',
            transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', whiteSpace: 'nowrap' }}>
          {proven}/{total}
        </span>
      </div>

      {/* Criterion items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {criteria.map((c, i) => {
          const isProven = c.mark === 'proven'
          const isFailed = c.mark === 'failed'
          const checkColor = isProven ? '#22c55e' : isFailed ? '#ef4444' : '#6b7280'
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '3px 6px',
              opacity: isProven ? 0.8 : 1,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0, marginTop: 1 }}>
                {isProven ? (
                  <>
                    <rect x="1" y="1" width="12" height="12" rx="3" fill={checkColor} fillOpacity={0.15} stroke={checkColor} strokeWidth="1.5" />
                    <path d="M4 7l2 2 4-4" stroke={checkColor} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                ) : isFailed ? (
                  <>
                    <rect x="1" y="1" width="12" height="12" rx="3" fill={checkColor} fillOpacity={0.15} stroke={checkColor} strokeWidth="1.5" />
                    <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke={checkColor} strokeWidth="1.5" strokeLinecap="round" />
                  </>
                ) : (
                  <rect x="1" y="1" width="12" height="12" rx="3" stroke={checkColor} strokeWidth="1.5" strokeOpacity={0.5} fill="none" />
                )}
              </svg>
              <div style={{
                fontSize: 11, lineHeight: 1.5, flex: 1,
                color: isProven ? colors.textMuted : colors.textPrimary,
                textDecoration: isProven ? 'line-through' : 'none',
              }}>
                {c.text}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Embedded mermaid diagram with slideshow ─────────────────────

function EmbeddedDiagramView({ diagrams }: { diagrams: EmbeddedDiagram[] }) {
  const { colors } = useTheme()
  const themeKey = useMermaidTheme()
  const [index, setIndex] = useState(0)
  const [svgContent, setSvgContent] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const current = diagrams[index]
  const hasMultiple = diagrams.length > 1

  const next = useCallback(() => setIndex(i => (i + 1) % diagrams.length), [diagrams.length])
  const prev = useCallback(() => setIndex(i => (i - 1 + diagrams.length) % diagrams.length), [diagrams.length])

  useEffect(() => {
    if (!current) return
    let cancelled = false

    const render = async () => {
      try {
        const id = `mermaid-embed-${index}-${Date.now()}`
        const { svg } = await mermaid.render(id, current.code)
        if (!cancelled) {
          setSvgContent(svg)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }

    render()
    return () => { cancelled = true }
  }, [current, index, themeKey])

  if (!current) return null

  return (
    <div style={{
      background: colors.bgPrimary,
      borderRadius: 8,
      overflow: 'hidden',
      border: `1px solid ${colors.borderPrimary}`,
    }}>
      {/* Diagram header with slideshow controls */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px',
        borderBottom: `1px solid ${colors.borderPrimary}`,
        background: `${colors.bgSecondary}`,
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <rect x="1" y="1" width="12" height="12" rx="2" stroke={colors.accent} strokeWidth="1.2" />
          <path d="M4 5l3 2-3 2z" fill={colors.accent} />
          <path d="M8 4v6" stroke={colors.accent} strokeWidth="1.2" />
        </svg>
        <span style={{ fontSize: 10, fontWeight: 600, color: colors.textSecondary, flex: 1 }}>
          {current.title}
        </span>
        {hasMultiple && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={prev}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: colors.textMuted, fontSize: 14, padding: '0 4px', lineHeight: 1,
              }}
            >
              ‹
            </button>
            <span style={{ fontSize: 9, color: colors.textMuted, fontWeight: 600 }}>
              {index + 1}/{diagrams.length}
            </span>
            <button
              onClick={next}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: colors.textMuted, fontSize: 14, padding: '0 4px', lineHeight: 1,
              }}
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* Rendered diagram */}
      <div
        ref={containerRef}
        style={{
          padding: 12,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          minHeight: 120,
          maxHeight: 300,
          overflow: 'auto',
        }}
      >
        {error ? (
          <div style={{ fontSize: 10, color: colors.error, textAlign: 'center', padding: 8 }}>
            Diagram render error
          </div>
        ) : svgContent ? (
          <div
            dangerouslySetInnerHTML={{ __html: svgContent }}
            className="vector-embedded-diagram"
          />
        ) : (
          <div style={{ fontSize: 10, color: colors.textMuted }}>Loading...</div>
        )}
      </div>

      <style>{`
        .vector-embedded-diagram svg {
          max-width: 100%;
          height: auto;
          max-height: 280px;
        }
        .vector-embedded-diagram .edgeLabel,
        .vector-embedded-diagram .edgeLabel p,
        .vector-embedded-diagram .edgeLabel span,
        .vector-embedded-diagram .edgeLabel div,
        .vector-embedded-diagram .edgeLabel foreignObject div,
        .vector-embedded-diagram .edgeLabel foreignObject span,
        .vector-embedded-diagram .label,
        .vector-embedded-diagram .label div,
        .vector-embedded-diagram .label span,
        .vector-embedded-diagram .label text,
        .vector-embedded-diagram .node .label div,
        .vector-embedded-diagram .node .label span,
        .vector-embedded-diagram .node text,
        .vector-embedded-diagram .cluster text,
        .vector-embedded-diagram text.actor,
        .vector-embedded-diagram .messageText,
        .vector-embedded-diagram .loopText,
        .vector-embedded-diagram tspan {
          fill: ${colors.textPrimary} !important;
          color: ${colors.textPrimary} !important;
        }
        .vector-embedded-diagram .edgeLabel .label-container,
        .vector-embedded-diagram .edgeLabel rect,
        .vector-embedded-diagram .labelBkg {
          fill: ${colors.bgPrimary} !important;
          background: ${colors.bgPrimary} !important;
          stroke: none !important;
        }
        .vector-embedded-diagram .edgePath path,
        .vector-embedded-diagram .flowchart-link {
          stroke: ${colors.graphEdge ?? colors.borderSecondary} !important;
        }
        .vector-embedded-diagram marker path {
          fill: ${colors.graphEdge ?? colors.borderSecondary} !important;
        }
      `}</style>
    </div>
  )
}

// ── Mode configs ───────────────────────────────────────────────

const MODE_CONFIG = {
  problem: { label: 'CURRENT STATE', accent: '#f59e0b', icon: '◉' },
  target:  { label: 'TARGET STATE',  accent: '#22c55e', icon: '◎' },
} as const

// ── Main component ─────────────────────────────────────────────

export const VectorNode = memo(({ data, selected }: { data: VectorNodeData; selected?: boolean }) => {
  const { colors } = useTheme()
  const scale = data.cardScale ?? 1.0
  const { vector, progress, mode, diagrams } = data
  const config = mode ? MODE_CONFIG[mode] : null
  const accentColor = config?.accent ?? '#3b82f6'

  const pct = useMemo(() => {
    if (!progress || progress.total === 0) return 0
    return Math.round((progress.success / progress.total) * 100)
  }, [progress])

  const bodyText = mode === 'problem' ? vector.current
    : mode === 'target' ? vector.target
    : null
  const showApproach = mode === 'problem' && vector.approach
  const showFacts = mode === 'problem' && vector.problemFacts && vector.problemFacts.length > 0
  const showCriteria = mode === 'target' && vector.solvedCriteria && vector.solvedCriteria.length > 0
  const showDiagrams = diagrams && diagrams.length > 0

  return (
    <div style={{
      background: colors.bgSecondary,
      border: `2px solid ${selected ? accentColor : colors.borderPrimary}`,
      borderLeft: `5px solid ${accentColor}`,
      borderRadius: 12,
      padding: '16px 18px',
      cursor: 'default',
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      minWidth: 340,
      maxWidth: 480,
    }}>
      <EdgeHandles color={accentColor} />

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        {/* Mode label + progress ring */}
        {mode === 'problem' && progress && progress.total > 0 && (
          <ConvergenceRing pct={pct} color={accentColor} />
        )}
        {mode === 'target' && vector.solvedCriteria && (
          <ConvergenceRing
            pct={Math.round(
              (vector.solvedCriteria.filter(c => c.mark === 'proven').length /
                Math.max(1, vector.solvedCriteria.length)) * 100,
            )}
            color={accentColor}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {config && (
            <div style={{
              fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '1.2px', color: accentColor,
            }}>
              {config.label}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: accentColor, display: 'inline-block',
            }} />
            <span style={{
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.5px', color: accentColor,
            }}>
              {vector.state}
            </span>
            {progress && progress.total > 0 && mode === 'problem' && (
              <span style={{ fontSize: 9, color: colors.textMuted, marginLeft: 4 }}>
                {progress.active} active · {progress.success} done · {progress.failed} failed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Description ── */}
      {bodyText && (
        <div style={{
          marginTop: 10, fontSize: 12, lineHeight: 1.7,
          color: colors.textSecondary,
        }}>
          {bodyText}
        </div>
      )}

      {/* ── Approach (problem mode) ── */}
      {showApproach && (
        <>
          <SectionLabel label="Approach" color="#3b82f6" />
          <div style={{
            fontSize: 11, lineHeight: 1.6, color: colors.textMuted,
            borderLeft: '3px solid #3b82f633', paddingLeft: 10,
          }}>
            {vector.approach}
          </div>
        </>
      )}

      {/* ── Problem Facts (problem mode) ── */}
      {showFacts && (
        <>
          <SectionLabel label="Problem Facts" color="#f59e0b" />
          <FactList facts={vector.problemFacts!} colors={colors} />
        </>
      )}

      {/* ── Solved Criteria (target mode) ── */}
      {showCriteria && (
        <>
          <SectionLabel label="Acceptance Criteria" color="#22c55e" />
          <CriteriaList criteria={vector.solvedCriteria!} colors={colors} />
        </>
      )}

      {/* ── Embedded Diagrams ── */}
      {showDiagrams && (
        <>
          <SectionLabel label={diagrams!.length > 1 ? 'Diagrams' : 'Architecture'} color={colors.accent} />
          <EmbeddedDiagramView diagrams={diagrams!} />
        </>
      )}

      {/* ── Full mode (backward compat) ── */}
      {!mode && (
        <>
          {vector.current && (
            <>
              <SectionLabel label="Current State" color="#f59e0b" />
              <div style={{ fontSize: 11, lineHeight: 1.6, color: colors.textSecondary, borderLeft: '3px solid #f59e0b33', paddingLeft: 8 }}>{vector.current}</div>
            </>
          )}
          {vector.target && (
            <>
              <SectionLabel label="Target State" color="#22c55e" />
              <div style={{ fontSize: 11, lineHeight: 1.6, color: colors.textSecondary, borderLeft: '3px solid #22c55e33', paddingLeft: 8 }}>{vector.target}</div>
            </>
          )}
          {vector.approach && (
            <>
              <SectionLabel label="Approach" color="#3b82f6" />
              <div style={{ fontSize: 11, lineHeight: 1.6, color: colors.textSecondary, borderLeft: '3px solid #3b82f633', paddingLeft: 8 }}>{vector.approach}</div>
            </>
          )}
        </>
      )}
    </div>
  )
})
