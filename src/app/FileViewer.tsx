import { useEffect, useMemo, useState, useCallback, useRef, type CSSProperties } from 'react'
import { MarkdownEditor, type EditorHandle } from '@context-towel/editor'
import {
  registerCoreBlocks,
  registerAllCardPlugins,
  parseMarkdownBlocks,
  type BlockInstance,
  type ThemeTokens,
} from '@context-towel/card-library'
import { TaskBoardView, type TaskBoardPrefs } from '@context-towel/context-graph/graph'
import { ThemeProvider, useTheme } from '@context-towel/context-graph/compat/design-system'
import { useTypographyStore, initTypography } from './typography-store'
import { FontSettings } from './FontSettings'
import { useThemeStore } from './theme-store'

// Extracted sub-components
import { DependenciesView } from './file-viewer/DependenciesView'
import { DocumentTOC } from './file-viewer/DocumentTOC'
import { SlideContent } from './file-viewer/SlideContent'
import { PresentationMode } from './file-viewer/PresentationMode'
import { FileViewerToolbar } from './file-viewer/FileViewerToolbar'
import { useEmbeddedViewState } from './file-viewer/view-state'
import type { ViewMode } from './file-viewer/types'

// Extracted utilities
import { isPlanningFile, extractTaskData, toTaskItems, buildBlockRenderCard } from './file-viewer/utils'

// Extracted hooks
import { useFileWatcher } from './file-viewer/hooks/useFileWatcher'
import { useBlockEditor } from './file-viewer/hooks/useBlockEditor'
import { useSlidePagination } from './file-viewer/hooks/useSlidePagination'
import { usePresentationMode } from './file-viewer/hooks/usePresentationMode'
import { useSlideshowKeyboard } from './file-viewer/hooks/useSlideshowKeyboard'

// Ensure block types are registered so parseMarkdownBlocks can find task blocks
registerCoreBlocks()
registerAllCardPlugins()

// Initialize typography from persisted settings on module load
initTypography()

// Re-export for consumers
export { EmbeddedDocHeaderControls } from './file-viewer/EmbeddedDocHeaderControls'

// ============================================================================
// FileViewerInner — thin composition shell
// ============================================================================

export interface FileViewerInnerProps {
  filePath: string
  onBack?: () => void
  onToggleTheme?: () => void
  hideAppControls?: boolean
  hideToolbar?: boolean
}

export function FileViewerInner({ filePath, onBack, onToggleTheme, hideAppControls, hideToolbar }: FileViewerInnerProps) {
  const { colors, typography, radius, isDark } = useTheme()
  const fontSize = useTypographyStore((state) => state.fontSize)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // View mode: local state for standalone, shared store for embedded (accordion)
  const [localViewMode, setLocalViewMode] = useState<ViewMode>('document')
  const embeddedViewMode = useEmbeddedViewState(s => s.modes[filePath] ?? 'document')
  const setEmbeddedViewMode = useEmbeddedViewState(s => s.setMode)
  const viewMode = hideToolbar ? embeddedViewMode : localViewMode
  const setViewMode = useCallback(
    (m: ViewMode) => { hideToolbar ? setEmbeddedViewMode(filePath, m) : setLocalViewMode(m) },
    [hideToolbar, filePath, setEmbeddedViewMode],
  )

  const editorRef = useRef<EditorHandle>(null)
  const isEditingRef = useRef(false)
  const fileName = filePath.split('/').pop() ?? filePath

  // ── Hooks ────────────────────────────────────────────────────────
  const { content, setContent, contentRef } = useFileWatcher(filePath, editorRef, isEditingRef)
  const { handleEditBlock, handleEditorChange, cancelPendingSave } = useBlockEditor(filePath, contentRef, setContent, editorRef)
  const { slides, slide, currentPage, setCurrentPage, totalPages } = useSlidePagination(content)
  const { presentationMode, enterPresentation, exitPresentation } = usePresentationMode()
  useSlideshowKeyboard(viewMode, totalPages, setCurrentPage, presentationMode, exitPresentation)

  const isPlan = content !== null && isPlanningFile(content)

  // Resolve local image paths: read via Tauri fs plugin → blob URL
  const blobCache = useRef<Map<string, string>>(new Map())
  const resolveImageSrc = useCallback((src: string) => {
    // Already a URL — pass through
    if (/^(https?:|data:|blob:)/i.test(src)) return src

    // Resolve relative paths against the markdown file's directory
    let absolutePath = src
    if (!src.startsWith('/')) {
      const dir = filePath.substring(0, filePath.lastIndexOf('/'))
      absolutePath = `${dir}/${src}`
    }

    // Return cached blob URL if we already loaded this
    const cached = blobCache.current.get(absolutePath)
    if (cached) return cached

    // Kick off async read — return a placeholder, the MutationObserver
    // will pick up the change when we update the src later
    import('@tauri-apps/plugin-fs').then(({ readFile }) => {
      readFile(absolutePath).then((bytes) => {
        const ext = absolutePath.split('.').pop()?.toLowerCase() ?? 'png'
        const mimeTypes: Record<string, string> = {
          png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
          gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
        }
        const blob = new Blob([bytes], { type: mimeTypes[ext] ?? 'image/png' })
        const url = URL.createObjectURL(blob)
        blobCache.current.set(absolutePath, url)
        // Update all images still pointing to the original src
        for (const el of document.querySelectorAll<HTMLImageElement>(`img[src="${CSS.escape(src)}"]`)) {
          el.src = url
        }
      }).catch(() => {})
    }).catch(() => {})

    return src
  }, [filePath])

  // Revoke blob URLs when file changes
  useEffect(() => {
    return () => {
      for (const url of blobCache.current.values()) URL.revokeObjectURL(url)
      blobCache.current.clear()
    }
  }, [filePath])

  const markdownTheme = useMemo<ThemeTokens>(() => ({
    bgPrimary: colors.bgPrimary,
    bgSecondary: colors.bgSecondary,
    bgTertiary: colors.bgTertiary,
    borderPrimary: colors.borderPrimary,
    borderSecondary: colors.borderSecondary,
    textPrimary: colors.textPrimary,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    textInverse: colors.textInverse,
    accent: colors.accent,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    fontMono: typography.fontFamily.mono,
    fontSans: typography.fontFamily.sans,
    radius: radius.md,
  }), [colors, typography, radius])

  // Report isPlan to embedded store
  useEffect(() => {
    if (hideToolbar) useEmbeddedViewState.getState().setPlan(filePath, isPlan)
  }, [hideToolbar, filePath, isPlan])

  // Reset view mode when file changes
  useEffect(() => { setViewMode('document') }, [filePath, setViewMode])

  // Keep isEditingRef in sync with viewMode
  useEffect(() => {
    isEditingRef.current = viewMode === 'edit'
    if (viewMode !== 'edit') cancelPendingSave()
  }, [viewMode, cancelPendingSave])

  // Tasks extracted from planning files
  const planningTasks = useMemo(() => {
    if (!content || !isPlanningFile(content)) return []
    return extractTaskData(content, filePath)
  }, [content, filePath])

  const taskBlocks = useMemo<BlockInstance[]>(() => {
    if (!content || !isPlanningFile(content)) return []
    const { blocks } = parseMarkdownBlocks(content, filePath)
    return blocks.filter(b => b.type === 'task' && b.data !== null)
  }, [content, filePath])

  const taskItems = useMemo(() => toTaskItems(planningTasks, filePath), [planningTasks, filePath])
  const [boardPrefs, setBoardPrefs] = useState<TaskBoardPrefs>({ view: 'board', groupBy: 'status' })

  // ── Render ───────────────────────────────────────────────────────

  if (content === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: colors.textMuted, fontSize: 14 }}>
        Loading...
      </div>
    )
  }

  if (presentationMode && slide) {
    return (
      <PresentationMode
        slide={slide}
        currentPage={currentPage}
        totalPages={totalPages}
        setCurrentPage={setCurrentPage}
        onExit={exitPresentation}
        onEditBlock={handleEditBlock}
        theme={markdownTheme}
        isDark={isDark}
      />
    )
  }

  return (
    <div data-print-root style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: colors.bgPrimary,
      color: colors.textPrimary,
      position: 'relative',
    }}>
      {/* Toolbar */}
      {!hideToolbar && (
        <div data-print-hide>
          <FileViewerToolbar
            fileName={fileName}
            viewMode={viewMode}
            setViewMode={setViewMode}
            isPlan={isPlan}
            currentPage={currentPage}
            totalPages={totalPages}
            setCurrentPage={setCurrentPage}
            settingsOpen={settingsOpen}
            setSettingsOpen={setSettingsOpen}
            onBack={onBack}
            onToggleTheme={onToggleTheme}
            enterPresentation={enterPresentation}
            hideAppControls={hideAppControls}
            colors={colors}
            isDark={isDark}
          />
        </div>
      )}

      {/* Inline slideshow controls when toolbar is hidden */}
      {hideToolbar && viewMode === 'slideshow' && (
        <div data-print-hide style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 12px',
          borderBottom: `1px solid ${colors.borderPrimary}`,
          flexShrink: 0,
          fontSize: 11,
        }}>
          <button
            onClick={enterPresentation}
            style={{
              background: 'none',
              border: `1px solid ${colors.borderSecondary}`,
              borderRadius: 4,
              color: colors.textSecondary,
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 8px',
            }}
          >
            Present
          </button>
          {totalPages > 1 && (
            <span style={{ color: colors.textMuted, fontSize: 10 }}>
              {currentPage + 1}/{totalPages}
            </span>
          )}
        </div>
      )}

      {/* FontSettings slide-out panel */}
      {settingsOpen && (
        <div data-print-hide style={{
          position: 'absolute' as CSSProperties['position'],
          top: 0,
          right: 0,
          bottom: 0,
          width: 560,
          background: colors.bgSecondary,
          borderLeft: `1px solid ${colors.borderPrimary}`,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            borderBottom: `1px solid ${colors.borderPrimary}`,
            flexShrink: 0,
          }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Typography Settings</span>
            <button
              onClick={() => setSettingsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: colors.textMuted,
                cursor: 'pointer',
                fontSize: 18,
                padding: '2px 6px',
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <FontSettings />
          </div>
        </div>
      )}

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
        {viewMode === 'edit' ? (
          <div style={{ display: 'flex', gap: 0, flex: 1, minHeight: 0 }}>
            <DocumentTOC content={content} taskBlocks={taskBlocks} colors={colors} />
            <div style={{ flex: 1, fontSize: `${fontSize}px`, padding: '16px 24px', overflow: 'auto', minWidth: 0, minHeight: 0 }}>
              <MarkdownEditor
                ref={editorRef}
                content={content}
                onChange={handleEditorChange}
                resolveImageSrc={resolveImageSrc}
                theme={markdownTheme}
                isDark={isDark}
              />
            </div>
          </div>
        ) : viewMode === 'document' ? (
          <div style={{ display: 'flex', gap: 0, flex: 1, minHeight: 0 }}>
            <DocumentTOC content={content} taskBlocks={taskBlocks} colors={colors} />
            <div style={{ flex: 1, fontSize: `${fontSize}px`, padding: '16px 24px', overflow: 'auto', minWidth: 0, minHeight: 0 }}>
              <MarkdownEditor
                ref={editorRef}
                content={content}
                editable={false}
                onCardEdit={handleEditBlock}
                resolveImageSrc={resolveImageSrc}
                theme={markdownTheme}
                isDark={isDark}
              />
            </div>
          </div>
        ) : viewMode === 'board' ? (
          <TaskBoardView
            tasks={taskItems}
            parentDocId={filePath}
            taskListId="viewer"
            prefs={boardPrefs}
            onPrefsChange={(updates: Partial<TaskBoardPrefs>) => setBoardPrefs((p: TaskBoardPrefs) => ({ ...p, ...updates }))}
            renderCard={buildBlockRenderCard(taskBlocks, markdownTheme, handleEditBlock)}
          />
        ) : viewMode === 'dependencies' ? (
          <DependenciesView tasks={planningTasks} theme={markdownTheme} colors={colors} />
        ) : (
          /* Slideshow mode */
          slide ? (
            <div style={{ display: 'flex', gap: 0, flex: 1, minHeight: 0 }}>
              {/* Slide TOC */}
              <div style={{
                width: 220,
                flexShrink: 0,
                borderRight: `1px solid ${colors.borderPrimary}`,
                overflow: 'auto',
                padding: '8px 0',
                fontSize: 11,
              }}>
                {slides.map((s, idx) => (
                  <div
                    key={idx}
                    onClick={() => setCurrentPage(() => idx)}
                    style={{
                      padding: '6px 12px',
                      paddingLeft: `${12 + (s.level - 1) * 8}px`,
                      cursor: 'pointer',
                      background: idx === currentPage ? `${colors.accent}22` : 'transparent',
                      borderLeft: idx === currentPage ? `2px solid ${colors.accent}` : '2px solid transparent',
                      color: idx === currentPage ? colors.textPrimary : colors.textSecondary,
                      fontWeight: s.level <= 2 ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => { if (idx !== currentPage) (e.currentTarget as HTMLElement).style.background = colors.bgTertiary }}
                    onMouseLeave={(e) => { if (idx !== currentPage) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {s.title}
                  </div>
                ))}
              </div>

              {/* Slide content */}
              <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px', minWidth: 0 }}>
                {slide.content.trim() ? (
                  <SlideContent
                    content={slide.content}
                    filePath={filePath}
                    isPlan={isPlan}
                    theme={markdownTheme}
                    isDark={isDark}
                    onEditBlock={handleEditBlock}
                  />
                ) : (
                  <div style={{ color: colors.textMuted, fontSize: 12, fontStyle: 'italic', padding: 16, textAlign: 'center' }}>
                    This section has no content
                  </div>
                )}
              </div>
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}

// ============================================================================
// FileViewer — standalone wrapper with theme provider
// ============================================================================

export interface FileViewerProps {
  filePath: string
  onBack: () => void
}

export function FileViewer({ filePath, onBack }: FileViewerProps) {
  const theme = useThemeStore(s => s.resolved)
  const preference = useThemeStore(s => s.preference)
  const setPreference = useThemeStore(s => s.setPreference)

  const cycleTheme = useCallback(() => {
    const cycle: Array<'dark' | 'light' | 'system'> = ['dark', 'light', 'system']
    const idx = cycle.indexOf(preference)
    setPreference(cycle[(idx + 1) % cycle.length])
  }, [preference, setPreference])

  return (
    <ThemeProvider theme={theme}>
      <FileViewerInner
        filePath={filePath}
        onBack={onBack}
        onToggleTheme={cycleTheme}
      />
    </ThemeProvider>
  )
}
