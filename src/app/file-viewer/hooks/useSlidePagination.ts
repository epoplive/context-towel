import { useMemo, useState, useEffect } from 'react'
import { paginateMarkdown } from '@context-towel/markdown'
import type { SmartSlide } from '../types'

const MAX_SLIDE_SIZE = 4000

/** Build slides for slideshow mode, with page clamping on change. */
export function useSlidePagination(content: string | null) {
  const [currentPage, setCurrentPage] = useState(0)

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

  const slide = slides[currentPage] || slides[0]

  return { slides, slide, currentPage, setCurrentPage, totalPages: slides.length }
}
