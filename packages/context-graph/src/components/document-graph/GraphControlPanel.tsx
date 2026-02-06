import type { ReactNode } from 'react'
import { Panel } from '@xyflow/react'

import { useTheme } from '../../compat/design-system'
import { layoutPrimitives } from '../../compat/layoutPrimitives'

export interface GraphControlPanelProps {
  onRelayout: () => void
  onFitView: () => void
  nodeCount: number
  onToggleLegend: () => void
  onToggleFilters: () => void
  onToggleIgnored: () => void
  onTogglePinned: () => void
  isLegendOpen: boolean
  isFiltersOpen: boolean
  isPinnedOpen: boolean
  ignoredCount: number
  pinnedCount: number
  children?: ReactNode
}

export function GraphControlPanel({
  onRelayout,
  onFitView,
  nodeCount,
  onToggleLegend,
  onToggleFilters,
  onToggleIgnored,
  onTogglePinned,
  isLegendOpen,
  isFiltersOpen,
  isPinnedOpen,
  ignoredCount,
  pinnedCount,
  children,
}: GraphControlPanelProps) {
  const { colors } = useTheme()
  const buttonStyle = {
    background: colors.buttonBg,
    border: `1px solid ${colors.borderSecondary}`,
    color: colors.textPrimary,
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
  }

  return (
    <Panel position="top-right">
      <div style={{ position: 'relative' }}>
        <div style={{ ...layoutPrimitives.row, gap: '6px', alignItems: 'center' }}>
          <span
            style={{
              background: colors.buttonBg,
              border: `1px solid ${colors.borderSecondary}`,
              color: colors.textSecondary,
              padding: '2px 6px',
              borderRadius: '999px',
              fontSize: '10px',
            }}
          >
            {nodeCount} nodes
          </span>
          <button
            onClick={() => {
              onRelayout()
              // Fit view after relayout
              setTimeout(() => onFitView(), 100)
            }}
            style={buttonStyle}
            title="Re-apply mindmap layout (ignores saved positions)"
          >
            Re-layout
          </button>
          <button onClick={onFitView} style={buttonStyle} title="Fit all nodes in view">
            Fit View
          </button>
          <button
            onClick={onToggleFilters}
            style={{
              ...buttonStyle,
              background: isFiltersOpen ? colors.accent : colors.buttonBg,
              color: isFiltersOpen ? colors.textInverse : colors.textPrimary,
              borderColor: isFiltersOpen ? colors.accent : colors.borderSecondary,
            }}
            title="Filter document types"
          >
            Filters
          </button>
          <button
            onClick={onToggleLegend}
            style={{
              ...buttonStyle,
              background: isLegendOpen ? colors.accent : colors.buttonBg,
              color: isLegendOpen ? colors.textInverse : colors.textPrimary,
              borderColor: isLegendOpen ? colors.accent : colors.borderSecondary,
            }}
            title="Show legend"
          >
            Legend
          </button>
          <button
            onClick={onToggleIgnored}
            style={{
              ...buttonStyle,
              background: ignoredCount > 0 ? colors.bgSecondary : colors.buttonBg,
            }}
            title="Show ignored items"
          >
            Ignored{ignoredCount > 0 ? ` (${ignoredCount})` : ''}
          </button>
          <button
            onClick={onTogglePinned}
            style={{
              ...buttonStyle,
              background: pinnedCount > 0 ? (isPinnedOpen ? colors.accent : colors.bgSecondary) : colors.buttonBg,
              color: isPinnedOpen ? colors.textInverse : colors.textPrimary,
              borderColor: isPinnedOpen ? colors.accent : colors.borderSecondary,
            }}
            title="Show pinned items"
          >
            Pinned{pinnedCount > 0 ? ` (${pinnedCount})` : ''}
          </button>
        </div>
        {children}
      </div>
    </Panel>
  )
}

