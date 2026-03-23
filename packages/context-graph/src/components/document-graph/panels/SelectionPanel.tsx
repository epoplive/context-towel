import { Panel } from '@xyflow/react'

import { useTheme } from '../../../compat/design-system'
import { layoutPrimitives } from '../../../compat/layoutPrimitives'

export interface SelectionPanelProps {
  selectedCount: number
  onFocusSelection: () => void
  onClearSelection: () => void
}

export function SelectionPanel({ selectedCount, onFocusSelection, onClearSelection }: SelectionPanelProps) {
  const { colors, shadows } = useTheme()
  if (selectedCount < 2) return null

  return (
    <Panel position="bottom-center" style={{ zIndex: 10 }}>
      <div
        style={{
          ...layoutPrimitives.row,
          alignItems: 'center',
          gap: '8px',
          background: colors.bgSecondary,
          padding: '8px 12px',
          borderRadius: '6px',
          border: `1px solid ${colors.borderSecondary}`,
          boxShadow: shadows.lg,
        }}
      >
        <span
          style={{
            color: colors.textSecondary,
            fontSize: '11px',
          }}
        >
          {selectedCount} nodes selected
        </span>
        <button
          onClick={onFocusSelection}
          style={{
            background: colors.success,
            border: 'none',
            color: colors.textInverse,
            padding: '5px 12px',
            borderRadius: '4px',
            fontSize: '11px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
          title="Create a focused view with only these nodes"
        >
          Focus Selection
        </button>
        <button
          onClick={onClearSelection}
          style={{
            background: colors.buttonBg,
            border: `1px solid ${colors.borderSecondary}`,
            color: colors.textSecondary,
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
          title="Clear selection"
        >
          Clear
        </button>
      </div>
    </Panel>
  )
}

