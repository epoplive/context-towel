// ============================================================================
// PacketDiagramNode — Compact card for diagram-type AICCL nodes
//
// Renders inline mermaid diagrams attached to work nodes. These show
// architecture, data flow, or state diagrams relevant to the work.
// ============================================================================

import { memo, useState, useEffect } from 'react'
import mermaid from 'mermaid'
import { useTheme, useMermaidTheme } from '../../compat/design-system'
import { PillHandles, PACKET_COLORS } from './primitives'

export interface PacketDiagramNodeData {
  body: string
  label?: string
  state?: string
}

export const PacketDiagramNode = memo(({ data, selected }: { data: PacketDiagramNodeData; selected?: boolean }) => {
  const { colors } = useTheme()
  const themeKey = useMermaidTheme()
  const [svg, setSvg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const accent = PACKET_COLORS.purple

  useEffect(() => {
    let cancelled = false
    const render = async () => {
      try {
        const id = `pkt-diag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const result = await mermaid.render(id, data.body)
        if (!cancelled) { setSvg(result.svg); setError(null) }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    if (data.body) render()
    return () => { cancelled = true }
  }, [data.body, themeKey])

  return (
    <div style={{
      background: colors.bgSecondary,
      border: `1.5px solid ${selected ? accent : colors.borderPrimary}`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 8,
      minWidth: 160,
      maxWidth: 320,
      overflow: 'hidden',
      cursor: 'default',
    }}>
      <PillHandles color={accent} />

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        borderBottom: `1px solid ${colors.borderPrimary}`,
      }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="3" cy="3" r="2" fill={accent} fillOpacity={0.6} />
          <circle cx="9" cy="3" r="2" fill={accent} fillOpacity={0.6} />
          <circle cx="6" cy="9" r="2" fill={accent} />
          <path d="M3 5v1l3 2M9 5v1l-3 2" stroke={accent} strokeWidth="0.8" strokeOpacity={0.5} />
        </svg>
        <span style={{
          fontSize: 8,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: accent,
        }}>
          {data.label ?? 'Diagram'}
        </span>
      </div>

      {/* Diagram body */}
      <div style={{
        padding: 8,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        minHeight: 60,
        maxHeight: 180,
        overflow: 'auto',
      }}>
        {error ? (
          <div style={{ fontSize: 9, color: colors.error, textAlign: 'center', padding: 4 }}>
            Diagram error
          </div>
        ) : svg ? (
          <div
            dangerouslySetInnerHTML={{ __html: svg }}
            className="pkt-diagram-inline"
            style={{ maxWidth: '100%' }}
          />
        ) : data.body ? (
          <div style={{ fontSize: 9, color: colors.textMuted }}>Loading...</div>
        ) : (
          <div style={{ fontSize: 9, color: colors.textMuted }}>No diagram content</div>
        )}
      </div>

      <style>{`
        .pkt-diagram-inline svg { max-width: 100%; height: auto; max-height: 160px; }
        .pkt-diagram-inline .edgeLabel,
        .pkt-diagram-inline .label,
        .pkt-diagram-inline .node text,
        .pkt-diagram-inline tspan {
          fill: ${colors.textPrimary} !important;
          color: ${colors.textPrimary} !important;
        }
        .pkt-diagram-inline .edgePath path,
        .pkt-diagram-inline .flowchart-link {
          stroke: ${accent} !important;
        }
      `}</style>
    </div>
  )
})
