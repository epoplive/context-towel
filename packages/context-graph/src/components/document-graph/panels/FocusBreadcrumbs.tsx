import { Panel } from '@xyflow/react'

import { useTheme } from '../../../compat/design-system'
import { layoutPrimitives } from '../../../compat/layoutPrimitives'

export interface FocusBreadcrumbsProps {
  focusedNode: string
  breadcrumbs: string[]
  customFocusCount?: number
  onExitFocus: () => void
  onFocusNode: (id: string) => void
}

export function FocusBreadcrumbs({
  focusedNode,
  breadcrumbs,
  customFocusCount,
  onExitFocus,
  onFocusNode,
}: FocusBreadcrumbsProps) {
  const { colors } = useTheme()
  return (
    <Panel position="top-left" style={{ zIndex: 10 }}>
      <div
        style={{
          ...layoutPrimitives.row,
          alignItems: 'center',
          gap: '4px',
          background: colors.bgSecondary,
          padding: '6px 10px',
          borderRadius: '4px',
          border: `1px solid ${colors.borderSecondary}`,
          position: 'relative',
          zIndex: 20,
        }}
      >
        <button
          onClick={onExitFocus}
          style={{
            background: colors.error,
            border: 'none',
            color: colors.textInverse,
            padding: '3px 8px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '10px',
            marginRight: '6px',
          }}
          title="Exit focus mode"
        >
          Exit Focus
        </button>
        {customFocusCount && customFocusCount > 0 ? (
          <span
            style={{
              color: colors.success,
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            Custom Selection ({customFocusCount} nodes)
          </span>
        ) : (
          breadcrumbs.map((id, i) => (
            <span key={id} style={{ ...layoutPrimitives.row, alignItems: 'center', gap: '4px' }}>
              {i > 0 && <span style={{ color: colors.textMuted }}>›</span>}
              <button
                onClick={() => onFocusNode(id)}
                style={{
                  background: id === focusedNode ? colors.success : 'transparent',
                  border: 'none',
                  color: id === focusedNode ? colors.textInverse : colors.textSecondary,
                  padding: '2px 6px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontWeight: id === focusedNode ? 600 : 400,
                }}
                title={id === 'CLAUDE.md' ? 'Return to full view' : `Focus on ${id}`}
              >
                {id === 'CLAUDE.md' ? 'CLAUDE' : id.split('/').pop()?.replace('.md', '')}
              </button>
            </span>
          ))
        )}
      </div>
    </Panel>
  )
}

