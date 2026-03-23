import { useTheme } from '@context-towel/context-graph/compat/design-system'
import type { ViewMode } from './types'
import { useEmbeddedViewState } from './view-state'

/** View mode toggle buttons for the accordion header (reads from shared embedded store) */
export function EmbeddedDocHeaderControls({ filePath }: { filePath: string }) {
  const viewMode = useEmbeddedViewState(s => s.modes[filePath] ?? 'document')
  const setMode = useEmbeddedViewState(s => s.setMode)
  const isPlanFile = useEmbeddedViewState(s => s.plans[filePath] ?? false)
  const { colors } = useTheme()

  const modes: Array<{ key: ViewMode; label: string; planOnly?: boolean }> = [
    { key: 'document', label: 'Doc' },
    { key: 'slideshow', label: 'Slides' },
    { key: 'edit', label: 'Edit' },
    { key: 'board', label: 'Board', planOnly: true },
    { key: 'dependencies', label: 'Deps', planOnly: true },
  ]

  return (
    <div
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      style={{ display: 'flex', border: `1px solid ${colors.borderSecondary}`, borderRadius: 4, overflow: 'hidden' }}
    >
      {modes.filter(m => !m.planOnly || isPlanFile).map(m => (
        <button
          key={m.key}
          onClick={() => setMode(filePath, m.key)}
          style={{
            border: 'none',
            padding: '2px 8px',
            fontSize: 10,
            fontWeight: 600,
            cursor: 'pointer',
            background: viewMode === m.key ? colors.accent : 'transparent',
            color: viewMode === m.key ? colors.textInverse : colors.textSecondary,
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
