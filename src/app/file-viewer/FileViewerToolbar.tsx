import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import type { ColorTokens } from '@context-towel/context-graph/compat/design-system'
import type { ViewMode } from './types'

function handlePrint() {
  // Stamp concrete font values onto ProseMirror before printing.
  // WKWebView's print engine doesn't resolve CSS variables set via JS,
  // so we read the computed style and set it as inline properties.
  const pm = document.querySelector('.ProseMirror') as HTMLElement | null
  if (!pm) return

  const computed = getComputedStyle(pm)
  const saved = pm.style.cssText

  pm.style.fontFamily = computed.fontFamily
  pm.style.fontSize = computed.fontSize
  pm.style.lineHeight = computed.lineHeight
  pm.style.letterSpacing = computed.letterSpacing
  pm.style.fontWeight = computed.fontWeight

  invoke('plugin:webview|print', { label: getCurrentWebview().label })
    .finally(() => { pm.style.cssText = saved })
}

interface FileViewerToolbarProps {
  fileName: string
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  isPlan: boolean
  currentPage: number
  totalPages: number
  setCurrentPage: (page: number) => void
  settingsOpen: boolean
  setSettingsOpen: (fn: (open: boolean) => boolean) => void
  onBack?: () => void
  onToggleTheme?: () => void
  enterPresentation: () => void
  hideAppControls?: boolean
  colors: ColorTokens
  isDark: boolean
}

export function FileViewerToolbar({
  fileName,
  viewMode,
  setViewMode,
  isPlan,
  currentPage,
  totalPages,
  setCurrentPage,
  settingsOpen,
  setSettingsOpen,
  onBack,
  onToggleTheme,
  enterPresentation,
  hideAppControls,
  colors,
  isDark,
}: FileViewerToolbarProps) {
  return (
    <div style={{
      padding: '8px 16px',
      borderBottom: `1px solid ${colors.borderPrimary}`,
      fontSize: 13,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      userSelect: 'none',
      flexShrink: 0,
    }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: colors.textMuted,
            cursor: 'pointer',
            fontSize: 14,
            padding: '2px 6px',
          }}
          title="Back"
        >
          ←
        </button>
      )}

      <strong style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {fileName}
      </strong>

      {/* Typography settings button */}
      {!hideAppControls && (
        <button
          onClick={() => setSettingsOpen(o => !o)}
          style={{
            background: settingsOpen ? colors.accent : 'none',
            border: `1px solid ${colors.borderSecondary}`,
            borderRadius: 6,
            color: settingsOpen ? colors.textInverse : colors.textSecondary,
            cursor: 'pointer',
            fontSize: 13,
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          title="Typography settings"
        >
          Aa
        </button>
      )}

      {!hideAppControls && onToggleTheme && (
        <button
          onClick={onToggleTheme}
          style={{
            background: 'none',
            border: `1px solid ${colors.borderSecondary}`,
            borderRadius: 6,
            color: colors.textSecondary,
            cursor: 'pointer',
            fontSize: 13,
            padding: '4px 10px',
          }}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? 'Light' : 'Dark'}
        </button>
      )}

      {/* View mode toggle */}
      <div style={{ display: 'flex', border: `1px solid ${colors.borderSecondary}`, borderRadius: 6, overflow: 'hidden' }}>
        {(['document', 'slideshow', 'edit'] as ViewMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              border: 'none',
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              background: viewMode === mode ? colors.accent : 'transparent',
              color: viewMode === mode ? colors.textInverse : colors.textSecondary,
            }}
          >
            {mode === 'document' ? 'Document' : mode === 'slideshow' ? 'Slideshow' : 'Edit'}
          </button>
        ))}
        {isPlan && (
          <button
            onClick={() => setViewMode('board')}
            style={{
              border: 'none',
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              background: viewMode === 'board' ? colors.accent : 'transparent',
              color: viewMode === 'board' ? colors.textInverse : colors.textSecondary,
            }}
          >
            Board
          </button>
        )}
        {isPlan && (
          <button
            onClick={() => setViewMode('dependencies')}
            style={{
              border: 'none',
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              background: viewMode === 'dependencies' ? colors.accent : 'transparent',
              color: viewMode === 'dependencies' ? colors.textInverse : colors.textSecondary,
            }}
          >
            Deps
          </button>
        )}
      </div>

      {/* Print button */}
      <button
        onClick={handlePrint}
        style={{
          background: 'none',
          border: `1px solid ${colors.borderSecondary}`,
          borderRadius: 6,
          color: colors.textSecondary,
          cursor: 'pointer',
          fontSize: 13,
          padding: '4px 10px',
        }}
        title="Print document"
      >
        Print
      </button>

      {/* Slideshow navigation */}
      {viewMode === 'slideshow' && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => setCurrentPage(Math.max(currentPage - 1, 0))}
            disabled={currentPage === 0}
            style={{
              background: 'none',
              border: `1px solid ${colors.borderSecondary}`,
              borderRadius: 6,
              color: currentPage === 0 ? colors.textMuted : colors.textSecondary,
              cursor: currentPage === 0 ? 'default' : 'pointer',
              fontSize: 13,
              padding: '4px 8px',
              lineHeight: 1,
            }}
            title="Previous slide"
          >
            ‹
          </button>

          <select
            value={currentPage}
            onChange={(e) => setCurrentPage(Number(e.target.value))}
            style={{
              background: colors.bgSecondary,
              border: `1px solid ${colors.borderSecondary}`,
              borderRadius: 6,
              color: colors.textSecondary,
              fontSize: 11,
              padding: '3px 4px',
              cursor: 'pointer',
              minWidth: 48,
              textAlign: 'center',
            }}
          >
            {Array.from({ length: totalPages }, (_, i) => (
              <option key={i} value={i}>{i + 1} / {totalPages}</option>
            ))}
          </select>

          <button
            onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages - 1))}
            disabled={currentPage === totalPages - 1}
            style={{
              background: 'none',
              border: `1px solid ${colors.borderSecondary}`,
              borderRadius: 6,
              color: currentPage === totalPages - 1 ? colors.textMuted : colors.textSecondary,
              cursor: currentPage === totalPages - 1 ? 'default' : 'pointer',
              fontSize: 13,
              padding: '4px 8px',
              lineHeight: 1,
            }}
            title="Next slide"
          >
            ›
          </button>
        </div>
      )}

      {/* Present button */}
      {viewMode === 'slideshow' && (
        <button
          onClick={enterPresentation}
          style={{
            background: 'none',
            border: `1px solid ${colors.borderSecondary}`,
            borderRadius: 6,
            color: colors.textSecondary,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            padding: '4px 10px',
          }}
          title="Enter presentation mode"
        >
          Present
        </button>
      )}
    </div>
  )
}
