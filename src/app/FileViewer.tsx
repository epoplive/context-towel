import { useEffect, useMemo, useState, useRef } from 'react'
import { MarkdownRenderer, paginateMarkdown } from '@context-towel/markdown'
import type { CodeViewerComponent } from '@context-towel/markdown'
import type { ThemeTokens } from '@context-towel/card-library'
import { ThemeProvider, useTheme, Editor, darkTheme, lightTheme } from '@context-towel/context-graph/compat/design-system'
import type { Theme } from '@context-towel/context-graph/compat/design-system'
import { readFileContent, watchProject } from './tauriFileService'

type ViewMode = 'document' | 'slideshow'

interface SmartSlide {
  title: string
  level: number
  content: string
}

const MAX_SLIDE_SIZE = 4000

interface FileViewerInnerProps {
  filePath: string
  onBack: () => void
  onToggleTheme: () => void
}

function FileViewerInner({ filePath, onBack, onToggleTheme }: FileViewerInnerProps) {
  const { colors, typography, radius, isDark } = useTheme()
  const [content, setContent] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('document')
  const [currentPage, setCurrentPage] = useState(0)
  const unwatchRef = useRef<(() => void) | null>(null)

  const fileName = filePath.split('/').pop() ?? filePath

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

  // Load file content
  useEffect(() => {
    let cancelled = false
    readFileContent(filePath).then(text => {
      if (!cancelled && text !== null) setContent(text)
    })
    return () => { cancelled = true }
  }, [filePath])

  // Watch for file changes
  useEffect(() => {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'))
    if (!dir) return

    let unsub: (() => void) | null = null

    watchProject(dir, async (changedPaths) => {
      for (const p of changedPaths) {
        if (p === filePath || p.endsWith('/' + fileName)) {
          const text = await readFileContent(filePath)
          if (text !== null) setContent(text)
        }
      }
    }).then(fn => { unsub = fn })

    return () => { unsub?.() }
  }, [filePath, fileName])

  // Cleanup watcher on unmount
  useEffect(() => {
    return () => { unwatchRef.current?.() }
  }, [])

  // Build slides for slideshow mode
  const slides = useMemo<SmartSlide[]>(() => {
    if (!content) return [{ title: 'Loading...', level: 1, content: '' }]
    try {
      const { pages, headings } = paginateMarkdown(content, {
        maxChars: MAX_SLIDE_SIZE,
        targetChars: 2600,
        minChars: 900,
      })

      const resolveHeadingContext = (startOffset: number) => {
        let active: { text: string; level: number } | null = null
        for (const h of headings) {
          if (h.startOffset <= startOffset) active = { text: h.text, level: h.level }
          else break
        }
        return active
      }

      const firstHeadingInRange = (startOffset: number, endOffset: number) => {
        for (const h of headings) {
          if (h.startOffset >= startOffset && h.startOffset < endOffset) return { text: h.text, level: h.level }
        }
        return null
      }

      let prevBaseTitle = ''
      return pages.map((p, index) => {
        const ownHeading = firstHeadingInRange(p.startOffset, p.endOffset)
        const ctxHeading = ownHeading ?? resolveHeadingContext(p.startOffset)

        const baseTitle = ctxHeading?.text || 'Document'
        const level = ctxHeading?.level || 1
        const isContinuation = !ownHeading && index > 0 && baseTitle === prevBaseTitle
        prevBaseTitle = baseTitle

        return {
          title: isContinuation ? `${baseTitle} (cont.)` : baseTitle,
          level,
          content: p.content,
        }
      })
    } catch {
      return [{ title: 'Document', level: 1, content: content || '' }]
    }
  }, [content])

  // Clamp page when slides change
  useEffect(() => {
    setCurrentPage(p => Math.min(p, Math.max(0, slides.length - 1)))
  }, [slides.length])

  // Keyboard navigation for slideshow
  useEffect(() => {
    if (viewMode !== 'slideshow') return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setCurrentPage(p => Math.min(p + 1, slides.length - 1))
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setCurrentPage(p => Math.max(p - 1, 0))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [viewMode, slides.length])

  const slide = slides[currentPage] || slides[0]
  const totalPages = slides.length


  if (content === null) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: colors.textMuted,
        fontSize: 14,
      }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: colors.bgPrimary,
      color: colors.textPrimary,
    }}>
      {/* Toolbar */}
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

        <strong style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fileName}
        </strong>

        {/* Theme toggle */}
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

        {/* View mode toggle */}
        <div style={{ display: 'flex', border: `1px solid ${colors.borderSecondary}`, borderRadius: 6, overflow: 'hidden' }}>
          <button
            onClick={() => setViewMode('document')}
            style={{
              border: 'none',
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              background: viewMode === 'document' ? colors.accent : 'transparent',
              color: viewMode === 'document' ? colors.textInverse : colors.textSecondary,
            }}
          >
            Document
          </button>
          <button
            onClick={() => setViewMode('slideshow')}
            style={{
              border: 'none',
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              background: viewMode === 'slideshow' ? colors.accent : 'transparent',
              color: viewMode === 'slideshow' ? colors.textInverse : colors.textSecondary,
            }}
          >
            Slideshow
          </button>
        </div>

        {/* Slideshow pagination controls */}
        {viewMode === 'slideshow' && totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <select
              value={String(currentPage)}
              onChange={(e) => setCurrentPage(parseInt(e.target.value, 10) || 0)}
              style={{
                background: colors.bgTertiary,
                border: `1px solid ${colors.borderSecondary}`,
                color: colors.textPrimary,
                padding: '2px 6px',
                borderRadius: 3,
                fontSize: 10,
                maxWidth: 220,
              }}
              title="Jump to section"
            >
              {slides.map((s, idx) => (
                <option key={idx} value={String(idx)}>
                  {'  '.repeat(Math.max(0, s.level - 1))}{s.title}
                </option>
              ))}
            </select>
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 0))}
              disabled={currentPage === 0}
              style={{
                background: currentPage === 0 ? colors.bgTertiary : colors.bgSecondary,
                border: 'none',
                color: currentPage === 0 ? colors.textMuted : colors.textPrimary,
                padding: '2px 8px',
                borderRadius: 3,
                cursor: currentPage === 0 ? 'default' : 'pointer',
                fontSize: 11,
              }}
            >
              ◀
            </button>
            <span style={{ color: colors.textMuted, fontSize: 11, minWidth: 44, textAlign: 'center' }}>
              {currentPage + 1}/{totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages - 1))}
              disabled={currentPage === totalPages - 1}
              style={{
                background: currentPage === totalPages - 1 ? colors.bgTertiary : colors.bgSecondary,
                border: 'none',
                color: currentPage === totalPages - 1 ? colors.textMuted : colors.textPrimary,
                padding: '2px 8px',
                borderRadius: 3,
                cursor: currentPage === totalPages - 1 ? 'default' : 'pointer',
                fontSize: 11,
              }}
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: viewMode === 'document' ? '24px 48px' : '16px 24px',
      }}>
        {viewMode === 'document' ? (
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <MarkdownRenderer
              content={content}
              theme={markdownTheme}
              isDark={isDark}
              CodeViewer={Editor as CodeViewerComponent}
              codeBlockMode="viewer"
              uiColors={{ bgOverlay: colors.bgOverlay, buttonBg: colors.buttonBg }}
            />
          </div>
        ) : (
          /* Slideshow mode — single slide */
          slide && slide.content.trim() ? (
            <div style={{ maxWidth: 960, margin: '0 auto' }}>
              {/* Slide heading indicator */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}>
                <span style={{
                  background: colors.accent,
                  color: colors.textInverse,
                  padding: '2px 6px',
                  borderRadius: 3,
                  fontSize: 9,
                  fontWeight: 600,
                  minWidth: 24,
                  textAlign: 'center',
                }}>
                  H{slide.level}
                </span>
                <span style={{
                  color: colors.accent,
                  fontWeight: 600,
                  fontSize: 13,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {slide.title}
                </span>
              </div>
              <MarkdownRenderer
                content={slide.content}
                theme={markdownTheme}
                isDark={isDark}
                codeBlockMode="highlight"
                uiColors={{ bgOverlay: colors.bgOverlay, buttonBg: colors.buttonBg }}
              />
            </div>
          ) : (
            <div style={{
              color: colors.textMuted,
              fontSize: 12,
              fontStyle: 'italic',
              padding: 16,
              textAlign: 'center',
            }}>
              This section has no content
            </div>
          )
        )}
      </div>
    </div>
  )
}

export interface FileViewerProps {
  filePath: string
  onBack: () => void
}

export function FileViewer({ filePath, onBack }: FileViewerProps) {
  const [theme, setTheme] = useState<Theme>(darkTheme)
  const toggleTheme = () => setTheme(t => t.isDark ? lightTheme : darkTheme)

  return (
    <ThemeProvider theme={theme}>
      <FileViewerInner filePath={filePath} onBack={onBack} onToggleTheme={toggleTheme} />
    </ThemeProvider>
  )
}
