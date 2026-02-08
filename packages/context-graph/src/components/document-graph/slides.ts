import type { TocSection } from '../../plugins/toc/types'
import type { ChecklistGroup } from '../../plugins/checklist/types'
import type { DiagramItem } from '../../plugins/diagram/types'
import type { TaskItem } from '../../plugins/task/types'

export interface SmartSlide {
  title: string
  level: number
  content: string
}

// Size threshold for splitting (characters)
export const MAX_SLIDE_SIZE = 4000

// Build slides from TOC sections.
//
// This is the legacy splitter (regex / heuristics) and is kept as a fallback
// if the AST-based paginator throws. Keep this logic stable to avoid viewer
// regressions.
export function buildLegacySmartSlides(
  sections: TocSection[],
  _tasks: TaskItem[],        // Unused - MarkdownRenderer handles ```task blocks
  _checklists: ChecklistGroup[], // Unused - MarkdownRenderer handles checklists
  _diagrams: DiagramItem[],  // Unused - MarkdownRenderer handles ```mermaid
  rawContent: string
): SmartSlide[] {
  // Wrap everything in try-catch to prevent graph breaking
  try {
    // If no sections, split raw content
    if (!sections || sections.length === 0) {
      if (rawContent && rawContent.length > MAX_SLIDE_SIZE) {
        return splitContentIntoSlides('Document', 1, rawContent)
      }
      return [{ title: 'Document', level: 1, content: rawContent || '' }]
    }

  // Flatten all sections recursively
  const flattenSections = (secs: TocSection[]): TocSection[] => {
    const flat: TocSection[] = []
    for (const sec of secs) {
      flat.push(sec)
      if (sec.children && sec.children.length > 0) {
        flat.push(...flattenSections(sec.children))
      }
    }
    return flat
  }

  const allSections = flattenSections(sections)

  // Split large content into slides
  function splitContentIntoSlides(title: string, level: number, content: string): SmartSlide[] {
    const result: SmartSlide[] = []
    // Match fenced code blocks with any fence length (``` or ```` etc), not just triple fences.
    // This is required because docs often use ```` fences to *show* ```task examples.
    // A naive /```...```/ regex will split inside those examples and break markdown rendering.
    const parts: { content: string; isCodeBlock: boolean; isTaskBlock: boolean }[] = []

    type FenceChar = '`' | '~'
    type CodeBlockRange = { start: number; end: number; lang: string | null }

    const parseFenceOpener = (line: string): { fenceChar: FenceChar; fenceLen: number; lang: string | null } | null => {
      const match = line.match(/^\s{0,3}(`{3,}|~{3,})([^\n]*)$/)
      if (!match) return null
      const fence = match[1]
      const fenceChar = fence[0] as FenceChar
      const fenceLen = fence.length
      const info = (match[2] ?? '').trim()
      const lang = info ? info.split(/\s+/)[0]?.trim() || null : null
      return { fenceChar, fenceLen, lang }
    }

    const findFencedCodeBlocks = (text: string): CodeBlockRange[] => {
      const blocks: CodeBlockRange[] = []
      let lineStart = 0
      let open: { start: number; fenceChar: FenceChar; fenceLen: number; lang: string | null } | null = null

      while (lineStart <= text.length) {
        let lineEnd = text.indexOf('\n', lineStart)
        if (lineEnd === -1) lineEnd = text.length
        const line = text.slice(lineStart, lineEnd)

        if (!open) {
          const opener = parseFenceOpener(line)
          if (opener) {
            open = { start: lineStart, ...opener }
          }
        } else {
          const closeRe = new RegExp(`^\\s{0,3}${open.fenceChar}{${open.fenceLen},}\\s*$`)
          if (closeRe.test(line)) {
            const end = lineEnd < text.length ? lineEnd + 1 : lineEnd
            blocks.push({ start: open.start, end, lang: open.lang })
            open = null
          }
        }

        if (lineEnd === text.length) break
        lineStart = lineEnd + 1
      }

      // If a fence is left open, treat the remainder as a code block so we don't split inside it.
      if (open) {
        blocks.push({ start: open.start, end: text.length, lang: open.lang })
      }

      return blocks
    }

    const codeBlocks = findFencedCodeBlocks(content)
    let cursor = 0
    for (const block of codeBlocks) {
      if (block.start > cursor) {
        parts.push({ content: content.slice(cursor, block.start), isCodeBlock: false, isTaskBlock: false })
      }
      const raw = content.slice(block.start, block.end)
      const isTask = (block.lang ?? '').trim().toLowerCase() === 'task'
      parts.push({ content: raw, isCodeBlock: true, isTaskBlock: isTask })
      cursor = block.end
    }
    if (cursor < content.length) {
      parts.push({ content: content.slice(cursor), isCodeBlock: false, isTaskBlock: false })
    }

    let currentSlide: string[] = []
    let currentSize = 0
    let slideIndex = 0
    let taskCount = 0

    const flushSlide = () => {
      if (currentSlide.length > 0) {
        const joined = currentSlide.join('')
        // Avoid creating blank slides from whitespace-only paragraph splits.
        if (!joined.trim()) {
          currentSlide = []
          currentSize = 0
          taskCount = 0
          return
        }
        const slideTitle = slideIndex === 0 ? title : `${title} (cont.)`
        result.push({ title: slideTitle, level, content: joined })
        currentSlide = []
        currentSize = 0
        taskCount = 0
        slideIndex++
      }
    }

    for (const part of parts) {
      if (part.isCodeBlock) {
        // Keep code blocks intact - never split them
        if (part.isTaskBlock) {
          // Split after 5 tasks OR if exceeding size
          if ((taskCount >= 5 && currentSize > 2000) ||
              (currentSize > 0 && currentSize + part.content.length > MAX_SLIDE_SIZE)) {
            flushSlide()
          }
          taskCount++
        } else {
          // Regular code block - just check size
          if (currentSize > 0 && currentSize + part.content.length > MAX_SLIDE_SIZE) {
            flushSlide()
          }
        }
        currentSlide.push(part.content)
        currentSize += part.content.length
      } else {
        // Non-code content - safe to split by paragraphs
        const paragraphs = part.content.split(/\n\n+/)
        for (const para of paragraphs) {
          // Skip empty paragraphs; they only produce whitespace-only pages.
          if (!para.trim()) continue
          if (currentSize + para.length > MAX_SLIDE_SIZE && currentSize > 0) {
            flushSlide()
          }
          currentSlide.push(para + '\n\n')
          currentSize += para.length + 2
        }
      }
    }
    flushSlide()

    return result.length > 0 ? result : [{ title, level, content }]
  }

  // Build slides - combine small sections, split large ones
  const slides: SmartSlide[] = []
  const MIN_SLIDE_SIZE = 800 // Don't create slides smaller than this

  // Helper to create full markdown content with heading
  const makeHeading = (level: number, title: string) => '#'.repeat(level) + ' ' + title
  const sectionWithHeading = (sec: TocSection) => makeHeading(sec.level, sec.title) + '\n\n' + (sec.content || '')

  let pendingSection: { title: string; level: number; content: string } | null = null

  for (const section of allSections) {
    // Include the heading in content
    const fullContent = sectionWithHeading(section)
    // Only skip if truly empty (no content AND no heading worth showing)
    if (!section.content?.trim() && !section.title?.trim()) continue

    // Check if this is a "standalone" section (Notes, Summary, etc.)
    const isStandaloneSection = /^(notes|summary|conclusion|references|appendix)/i.test(section.title)

    if (isStandaloneSection && pendingSection) {
      // Flush pending before standalone section
      if (pendingSection.content.length > MAX_SLIDE_SIZE) {
        slides.push(...splitContentIntoSlides(pendingSection.title, pendingSection.level, pendingSection.content))
      } else {
        slides.push(pendingSection)
      }
      pendingSection = null
    }

    if (fullContent.length > MAX_SLIDE_SIZE) {
      // Large section - split it
      if (pendingSection) {
        slides.push(pendingSection)
        pendingSection = null
      }
      slides.push(...splitContentIntoSlides(section.title, section.level, fullContent))
    } else if (fullContent.length < MIN_SLIDE_SIZE && !isStandaloneSection && pendingSection) {
      // Small section - combine with pending (add full content with heading)
      pendingSection.content += '\n\n' + fullContent
      pendingSection.title = pendingSection.title.split(' & ')[0] + ' & more'
    } else if (fullContent.length < MIN_SLIDE_SIZE && !isStandaloneSection && !pendingSection) {
      // Start new pending
      pendingSection = { title: section.title, level: section.level, content: fullContent }
    } else {
      // Normal size - flush pending and add this
      if (pendingSection) {
        slides.push(pendingSection)
        pendingSection = null
      }
      slides.push({ title: section.title, level: section.level, content: fullContent })
    }
  }

  // Flush any remaining pending
  if (pendingSection) {
    if (pendingSection.content.length > MAX_SLIDE_SIZE) {
      slides.push(...splitContentIntoSlides(pendingSection.title, pendingSection.level, pendingSection.content))
    } else {
      slides.push(pendingSection)
    }
  }

  return slides.length > 0 ? slides : [{ title: 'Document', level: 1, content: rawContent || '' }]
  } catch (e) {
    console.error('buildSmartSlides error:', e)
    return [{ title: 'Document', level: 1, content: rawContent || '' }]
  }
}

