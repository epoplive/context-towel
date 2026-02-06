import { memo } from 'react'
import type { BlockRenderProps } from '../../blocks/types'
import type { DiagramData } from './types'
import { diagramTypeColors } from './types'

/**
 * Diagram card — shows mermaid diagram info.
 * Actual mermaid rendering is done by the host (context-graph or LG)
 * since mermaid.js is heavy and requires DOM setup.
 * This card shows the diagram metadata and code preview.
 */
export const DiagramCard = memo(function DiagramCard({
  data,
  detail,
  theme,
}: BlockRenderProps<DiagramData>) {
  const typeColor = diagramTypeColors[data.diagramType] || theme.accent

  if (detail === 'mini') {
    return (
      <div style={{
        padding: '4px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        borderLeft: `3px solid ${typeColor}`,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: theme.fontSans,
      }}>
        <span style={{ fontSize: 9, color: typeColor }}>&#9674;</span>
        <span style={{ fontSize: 11, color: theme.textPrimary }}>{data.title || data.diagramType}</span>
      </div>
    )
  }

  return (
    <div style={{
      padding: '8px 10px',
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      borderLeft: `3px solid ${typeColor}`,
      fontFamily: theme.fontSans,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: 8,
          padding: '1px 5px',
          borderRadius: 3,
          background: `${typeColor}22`,
          color: typeColor,
          textTransform: 'uppercase',
          fontWeight: 600,
        }}>
          {data.diagramType}
        </span>
        <span style={{ fontSize: 11, color: theme.textPrimary, fontWeight: 600 }}>
          {data.title}
        </span>
      </div>
      {detail === 'full' && (
        <pre style={{
          fontSize: 9,
          color: theme.textSecondary,
          background: theme.bgTertiary,
          padding: '6px 8px',
          borderRadius: 4,
          overflow: 'auto',
          maxHeight: 150,
          fontFamily: theme.fontMono,
          whiteSpace: 'pre-wrap',
          margin: 0,
        }}>
          {data.code.slice(0, 500)}
          {data.code.length > 500 && '...'}
        </pre>
      )}
    </div>
  )
})
