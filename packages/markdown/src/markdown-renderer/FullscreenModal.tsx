import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { getMermaid } from '../lazy-deps'
import { defaultTheme, type ThemeTokens } from '@context-towel/card-library'

import { layoutPrimitives } from '../layoutPrimitives'
import { useMermaidThemeTokens } from './mermaid'
import { deriveUiColors, resolveIsDark } from './theme'
import type { CodeViewerComponent, FullscreenModalState, MarkdownRendererProps } from './types'

const DefaultCodeViewer: CodeViewerComponent = ({ value, style }) => {
  return (
    <pre
      style={{
        margin: 0,
        padding: 12,
        overflow: 'auto',
        background: 'transparent',
        color: 'inherit',
        fontFamily: 'var(--color-font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)',
        fontSize: 12,
        lineHeight: 1.4,
        ...style,
      }}
    >
      <code>{value}</code>
    </pre>
  )
}

// Fullscreen Modal Component - exported so it can be rendered at app level
export function FullscreenModal({
  state,
  onClose,
  theme = defaultTheme,
  isDark,
  mermaidConfig,
  CodeViewer = DefaultCodeViewer,
  uiColors,
}: {
  state: FullscreenModalState
  onClose: () => void
  theme?: ThemeTokens
  isDark?: boolean
  mermaidConfig?: MarkdownRendererProps['mermaidConfig']
  CodeViewer?: CodeViewerComponent
  uiColors?: MarkdownRendererProps['uiColors']
}) {
  const resolvedTheme = theme ?? defaultTheme
  const resolvedIsDark = resolveIsDark(isDark, resolvedTheme)
  useMermaidThemeTokens(resolvedTheme, resolvedIsDark, mermaidConfig)
  const colors = useMemo(
    () => deriveUiColors(resolvedTheme, resolvedIsDark, uiColors),
    [resolvedTheme, resolvedIsDark, uiColors],
  )
  const modalRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)

  // Reset zoom whenever new content opens
  useEffect(() => {
    if (state.open) setZoom(1)
  }, [state.open, state.content])

  // Render mermaid in fullscreen
  useEffect(() => {
    if (!state.open || state.type !== 'mermaid' || !contentRef.current) return

    const renderMermaid = async () => {
      try {
        const mermaidModule = await getMermaid()
        const { svg } = await mermaidModule.render(`fullscreen-mermaid-${Date.now()}`, state.content)
        if (contentRef.current) {
          contentRef.current.innerHTML = svg
        }
      } catch (err) {
        if (contentRef.current) {
          contentRef.current.innerHTML = `<div style="color: ${colors.error};">Error: ${err instanceof Error ? err.message : 'Failed to render'}</div>`
        }
      }
    }
    renderMermaid()
  }, [state.open, state.type, state.content])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (state.open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [state.open, onClose])

  // Ctrl+wheel zoom in the fullscreen modal
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(z => Math.min(4, Math.max(0.25, Math.round((z + delta) * 100) / 100)))
  }, [])

  if (!state.open) return null

  const zoomBtnStyle: CSSProperties = {
    background: colors.buttonBg,
    border: `1px solid ${colors.borderPrimary}`,
    color: colors.textSecondary,
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  }

  return (
    <div
      ref={modalRef}
      onClick={(e) => e.target === modalRef.current && onClose()}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: colors.bgOverlay,
        zIndex: 10000,
        ...layoutPrimitives.column,
        padding: '20px',
      }}
    >
      {/* Header */}
      <div style={{ ...layoutPrimitives.row, justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ ...layoutPrimitives.row, gap: '10px', alignItems: 'center' }}>
          <span style={{ color: colors.textMuted, fontSize: '12px', textTransform: 'uppercase' }}>
            {state.type === 'mermaid' ? 'Diagram' : state.lang || 'Code'}
          </span>
          {state.type === 'mermaid' && (
            <div style={{ ...layoutPrimitives.row, gap: '5px' }}>
              <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} style={zoomBtnStyle}>−</button>
              <span style={{ color: colors.textSecondary, fontSize: '12px', width: '50px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} style={zoomBtnStyle}>+</button>
              <button onClick={() => setZoom(1)} style={zoomBtnStyle}>Reset</button>
            </div>
          )}
        </div>
        <button onClick={onClose} style={{ ...zoomBtnStyle, fontSize: '18px', width: '32px', height: '32px' }}>×</button>
      </div>

      {/* Content */}
      <div
        onWheel={state.type === 'mermaid' ? handleWheel : undefined}
        style={{
          ...layoutPrimitives.fillColumn,
          overflow: state.type === 'code' ? 'hidden' : 'auto',
          background: state.type === 'code' ? colors.bgPrimary : 'transparent',
          borderRadius: '8px',
          ...layoutPrimitives.column,
          alignItems: state.type === 'mermaid' ? 'flex-start' : 'stretch',
          justifyContent: 'flex-start',
        }}
      >
        {state.type === 'code' ? (
          <CodeViewer
            value={state.content}
            language={state.lang}
            readOnly
            lineNumbers
            wordWrap
            minimap={false}
            height="100%"
            style={{ ...layoutPrimitives.fill }}
          />
        ) : (
          /* Wrap the SVG content in a scaler so the outer div can scroll */
          <div
            style={{
              display: 'inline-block',
              transformOrigin: 'top left',
              transform: zoom !== 1 ? `scale(${zoom})` : undefined,
              minWidth: 'min-content',
            }}
          >
            <div ref={contentRef} />
          </div>
        )}
      </div>
    </div>
  )
}

