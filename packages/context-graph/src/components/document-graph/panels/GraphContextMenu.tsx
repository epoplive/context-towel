import { useTheme } from '../../../compat/design-system'
import type { ContextMenuItem, ContextMenuState } from '../../../state/slices/types'

export interface GraphContextMenuProps {
  contextMenu: ContextMenuState | null
  items: ContextMenuItem[]
  onAction: (action: string, nodeId: string, nodeType: string) => void
}

export function GraphContextMenu({ contextMenu, items, onAction }: GraphContextMenuProps) {
  const { colors, shadows } = useTheme()

  if (!contextMenu || items.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: contextMenu.x,
        top: contextMenu.y,
        background: colors.bgTertiary,
        border: `1px solid ${colors.borderSecondary}`,
        borderRadius: '4px',
        boxShadow: shadows.lg,
        zIndex: 1000,
        minWidth: '160px',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => (
        item.divider ? (
          <div
            key={`divider-${i}`}
            style={{
              height: 1,
              background: colors.borderSecondary,
              margin: '4px 0',
            }}
          />
        ) : (
          <button
            key={`${item.action}-${i}`}
            onClick={item.disabled ? undefined : () => onAction(item.action, contextMenu.nodeId, contextMenu.nodeType)}
            disabled={item.disabled}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              color: item.disabled ? colors.textMuted : colors.textPrimary,
              textAlign: 'left',
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              fontSize: '12px',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) (e.target as HTMLElement).style.background = colors.buttonBgHover
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'transparent'
            }}
          >
            {item.label}
          </button>
        )
      ))}
    </div>
  )
}

