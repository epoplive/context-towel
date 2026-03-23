// ============================================================================
// Diagram Plugin Components
// ============================================================================

import { memo, useEffect, useRef, useState, useMemo } from 'react'
import { Handle, Position } from '@xyflow/react'
import mermaid from 'mermaid'
import { DiagramItem, getDiagramTypeColor } from './types'
import { useTheme, useMermaidTheme } from '../../compat/design-system'
import { layoutPrimitives } from '../../compat/layoutPrimitives'

// Hook to get colors from theme
function useDiagramColors() {
  const { colors } = useTheme()
  return useMemo(() => ({
    bg: colors.bgSecondary,
    bgDark: colors.bgPrimary,
    border: colors.borderPrimary,
    text: colors.textPrimary,
    textMuted: colors.textMuted,
    error: colors.error,
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
// DIAGRAM NODE - Mermaid diagram preview
// ============================================================================
export interface DiagramNodeData {
  diagram: DiagramItem
  parentDocId: string
  cardScale?: number
}

interface DiagramNodeProps {
  data: DiagramNodeData
  selected?: boolean
}

export const DiagramNode = memo(({ data, selected }: DiagramNodeProps) => {
  // Initialize mermaid with theme-aware config; themeKey changes on theme switch
  const themeKey = useMermaidTheme()
  const COLORS = useDiagramColors()
  const scale = getCardScale(data)
  const { diagram } = data
  const diagramColor = getDiagramTypeColor(diagram.diagramType)
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgContent, setSvgContent] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current) return

      try {
        const id = `mermaid-${diagram.id}-${Date.now()}`
        const { svg } = await mermaid.render(id, diagram.code)
        setSvgContent(svg)
        setError(null)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('Mermaid render error:', msg, '\nCode:', diagram.code)
        setError(msg)
      }
    }

    renderDiagram()
  }, [diagram.code, diagram.id, themeKey])

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `2px solid ${selected ? diagramColor : COLORS.border}`,
        borderLeft: `6px solid ${diagramColor}`,
        borderRadius: '10px',
        padding: '16px',
        minWidth: '550px',
        maxWidth: '900px',
        cursor: 'default',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
    >
      <EdgeHandles color={diagramColor} />

      {/* Header */}
      <div style={{
        ...layoutPrimitives.row,
        alignItems: 'center',
        gap: '10px',
        marginBottom: '14px',
        borderBottom: `1px solid ${COLORS.border}`,
        paddingBottom: '10px',
      }}>
        <span style={{
          color: diagramColor,
          fontSize: '14px',
          fontWeight: 600,
        }}>
          {diagram.title}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{
          background: diagramColor,
          color: COLORS.textInverse,
          padding: '3px 8px',
          borderRadius: '12px',
          fontSize: '10px',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}>
          {diagram.diagramType}
        </span>
      </div>

      {/* Diagram content */}
      <div
        ref={containerRef}
        style={{
          background: COLORS.bgDark,
          borderRadius: '6px',
          padding: '16px',
          overflow: 'auto',
          minHeight: '300px',
          maxHeight: '600px',
          ...layoutPrimitives.row,
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}
      >
        {error ? (
          <div style={{
            color: COLORS.error,
            fontSize: '12px',
            textAlign: 'center',
          }}>
            {error}
            <pre style={{
              marginTop: '10px',
              fontSize: '10px',
              color: COLORS.textMuted,
              whiteSpace: 'pre-wrap',
              maxHeight: '80px',
              overflow: 'hidden',
            }}>
              {diagram.code.slice(0, 100)}...
            </pre>
          </div>
        ) : svgContent ? (
          <div
            dangerouslySetInnerHTML={{ __html: svgContent }}
            className="mermaid-diagram-scaled"
            style={{ ...layoutPrimitives.row, justifyContent: 'center' }}
          />
        ) : (
          <div style={{ color: COLORS.textMuted, fontSize: '12px' }}>
            Loading diagram...
          </div>
        )}
      </div>

      <style>{`
        .mermaid-diagram-scaled svg {
          min-width: 500px;
          min-height: 250px;
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  )
})
