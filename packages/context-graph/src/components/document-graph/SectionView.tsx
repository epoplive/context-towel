import { useEffect, useMemo, useState } from 'react'

import { WidgetMarkdownRenderer, paginateMarkdown, type CodeViewerComponent, type FullscreenModalState } from '@context-towel/markdown'
import type { ThemeTokens } from '@context-towel/card-library'

import { useTheme, Editor } from '../../compat/design-system'
import { layoutPrimitives } from '../../compat/layoutPrimitives'
import type { TocSection } from '../../plugins/toc/types'

import { buildLegacySmartSlides, MAX_SLIDE_SIZE, type SmartSlide } from './slides'

// Full view - smart paginated slideshow
export interface SectionViewProps {
  content: string
  typeColor: string
  sections?: TocSection[]
  onFullscreen?: (state: FullscreenModalState) => void
  CodeViewer?: CodeViewerComponent
}

export function SectionView({ content, typeColor, sections: _sections, onFullscreen, CodeViewer }: SectionViewProps) {
  const { colors, typography, radius, isDark } = useTheme()
  const ResolvedCodeViewer = CodeViewer ?? Editor
  const [currentPage, setCurrentPage] = useState(0)
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

  // Build slides from the markdown AST using stable byte offsets. This avoids
  // string-regex heuristics and produces more consistent "page" chunks.
  const slides = useMemo<SmartSlide[]>(() => {
    try {
      const { pages, headings } = paginateMarkdown(content || '', {
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
    } catch (e) {
      console.error('paginateMarkdown error:', e)
      try {
        // Fallback to the legacy splitter to avoid breaking the viewer if the
        // AST pipeline fails unexpectedly.
        return buildLegacySmartSlides(_sections || [], [], [], [], content || '')
      } catch (fallbackError) {
        console.error('legacy slide build error:', fallbackError)
        return [{ title: 'Document', level: 1, content: content || '' }]
      }
    }
  }, [content, _sections])

  const slide = slides[currentPage] || slides[0]
  const totalPages = slides.length

  // Clamp page index when content changes.
  useEffect(() => {
    setCurrentPage(p => Math.min(p, Math.max(0, totalPages - 1)))
  }, [totalPages])

  const goNext = () => setCurrentPage(p => Math.min(p + 1, totalPages - 1))
  const goPrev = () => setCurrentPage(p => Math.max(p - 1, 0))

  // Keyboard nav
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [totalPages])

  if (!slide) return null

  return (
    <div style={{ ...layoutPrimitives.fillColumn, width: '100%', overflow: 'hidden' }}>
      {/* Header with title, level indicator, and pagination */}
      <div style={{
        ...layoutPrimitives.row,
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        background: colors.bgSecondary,
        borderRadius: '4px',
        marginBottom: '8px',
        flexShrink: 0,
      }}>
        {/* Level indicator */}
        <span style={{
          background: typeColor,
          color: colors.textInverse,
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '9px',
          fontWeight: 600,
          minWidth: '24px',
          textAlign: 'center',
        }}>
          H{slide.level}
        </span>
        <span style={{
          color: typeColor,
          fontWeight: 600,
          fontSize: '12px',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {slide.title}
        </span>
        {totalPages > 1 && (
          <div style={{ ...layoutPrimitives.row, alignItems: 'center', gap: '4px' }}>
            <select
              value={String(currentPage)}
              onChange={(e) => setCurrentPage(parseInt(e.target.value, 10) || 0)}
              style={{
                background: colors.bgTertiary,
                border: `1px solid ${colors.borderSecondary}`,
                color: colors.textPrimary,
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '10px',
                maxWidth: '220px',
              }}
              title="Jump to section"
            >
              {slides.map((s, idx) => (
                <option key={`toc-${idx}`} value={String(idx)}>
                  {`${'  '.repeat(Math.max(0, s.level - 1))}${s.title}`}
                </option>
              ))}
            </select>
            <button
              onClick={goPrev}
              disabled={currentPage === 0}
              style={{
                background: currentPage === 0 ? colors.bgTertiary : colors.buttonBg,
                border: 'none',
                color: currentPage === 0 ? colors.textMuted : colors.textPrimary,
                padding: '2px 6px',
                borderRadius: '3px',
                cursor: currentPage === 0 ? 'default' : 'pointer',
                fontSize: '10px',
              }}
            >
              ◀
            </button>
            <span style={{ color: colors.textMuted, fontSize: '10px', minWidth: '40px', textAlign: 'center' }}>
              {currentPage + 1}/{totalPages}
            </span>
            <button
              onClick={goNext}
              disabled={currentPage === totalPages - 1}
              style={{
                background: currentPage === totalPages - 1 ? colors.bgTertiary : colors.buttonBg,
                border: 'none',
                color: currentPage === totalPages - 1 ? colors.textMuted : colors.textPrimary,
                padding: '2px 6px',
                borderRadius: '3px',
                cursor: currentPage === totalPages - 1 ? 'default' : 'pointer',
                fontSize: '10px',
              }}
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {/* Content area - renderer handles task blocks, diagrams, etc. */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px', minWidth: 0, width: '100%' }}>
        {slide.content && slide.content.trim() ? (
          <WidgetMarkdownRenderer
            content={slide.content}
            onFullscreen={onFullscreen}
            theme={markdownTheme}
            isDark={isDark}
            CodeViewer={ResolvedCodeViewer}
            codeBlockMode="viewer"
            uiColors={{ bgOverlay: colors.bgOverlay, buttonBg: colors.buttonBg }}
          />
        ) : (
          <div style={{
            color: colors.textMuted,
            fontSize: '11px',
            fontStyle: 'italic',
            padding: '12px',
            textAlign: 'center',
          }}>
            This section has no content
          </div>
        )}
      </div>
    </div>
  )
}
