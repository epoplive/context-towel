import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Content, Heading, Root } from 'mdast'

import { stripInvisibleForPagination, stripWrapperTagsInline } from '../preprocess'

export type MarkdownHeading = {
  text: string
  level: number
  startOffset: number
}

export type MarkdownPage = {
  startOffset: number
  endOffset: number
  content: string
}

export type PaginateMarkdownOptions = {
  /** Minimum preferred page size (characters). Smaller pages will be merged when possible. */
  minChars?: number
  /** Target page size (characters). Headings can trigger soft breaks near this size. */
  targetChars?: number
  /** Hard maximum page size (characters). */
  maxChars?: number
}

export type PaginateMarkdownResult = {
  pages: MarkdownPage[]
  headings: MarkdownHeading[]
}

function isVisiblyMeaningful(markdown: string): boolean {
  return stripInvisibleForPagination(markdown).trim().length > 0
}

function computeVisibleWeight(node: Content): number {
  const typed = node as unknown as { type?: string; value?: unknown; children?: unknown }
  const type = typed?.type
  if (!type) return 0

  // react-markdown will not render raw HTML without rehype-raw, so treat it as invisible
  // for pagination sizing. We also treat reference definitions as invisible.
  if (type === 'html' || type === 'definition') return 0

  if (type === 'text' || type === 'inlineCode') {
    const value = typed.value
    if (typeof value !== 'string') return 0
    return stripWrapperTagsInline(value).trim().length
  }

  if (type === 'code') {
    const value = typed.value
    return typeof value === 'string' ? value.length : 0
  }

  // Visible even without text content.
  if (type === 'image') return 24
  if (type === 'thematicBreak') return 12

  const children = typed.children
  if (Array.isArray(children)) {
    let sum = 0
    for (const child of children) {
      // Children in mdast are also Content-ish; treat unknowns as 0.
      sum += computeVisibleWeight(child as Content)
    }
    return sum
  }

  return 0
}

function extractInlineText(node: any): string {
  if (!node) return ''
  if (typeof node.value === 'string') return node.value
  if (Array.isArray(node.children)) return node.children.map(extractInlineText).join('')
  return ''
}

function headingToText(node: Heading): string {
  const text = extractInlineText(node).trim()
  return text.length > 0 ? text : 'Untitled'
}

type Block = {
  start: number
  end: number
  sliceEnd: number
  node: Content
  isHeading: boolean
  heading?: MarkdownHeading
  /**
   * Approximate "visible" size for pagination decisions.
   * Some top-level nodes (e.g. link definitions, HTML comments) don't render,
   * but can be very large. Weighting them as 0 prevents blank/empty pages.
   */
  weight: number
}

function getOffset(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

export function paginateMarkdown(content: string, options: PaginateMarkdownOptions = {}): PaginateMarkdownResult {
  const maxChars = options.maxChars ?? 4000
  const targetChars = options.targetChars ?? Math.min(2600, maxChars)
  const minChars = options.minChars ?? Math.min(900, targetChars)
  const maxMergeChars = Math.max(maxChars, Math.floor(targetChars * 1.25))

  if (!content) {
    return { pages: [{ startOffset: 0, endOffset: 0, content: '' }], headings: [] }
  }

  let tree: Root
  try {
    tree = unified().use(remarkParse).use(remarkGfm).parse(content) as Root
  } catch {
    // If parsing fails, fall back to a single page (never break the viewer).
    return { pages: [{ startOffset: 0, endOffset: content.length, content }], headings: [] }
  }

  const children = (tree.children ?? []) as Content[]
  const rawBlocks: Block[] = []

  for (const node of children) {
    const start = getOffset(node.position?.start?.offset)
    const end = getOffset(node.position?.end?.offset)
    if (start === null || end === null) continue

    const isHeading = node.type === 'heading'
    const heading = isHeading
      ? ({
          text: headingToText(node as Heading),
          level: (node as Heading).depth,
          startOffset: start,
        } satisfies MarkdownHeading)
      : undefined

    const weight = computeVisibleWeight(node)

    rawBlocks.push({ start, end, sliceEnd: end, node, isHeading, heading, weight })
  }

  if (rawBlocks.length === 0) {
    return { pages: [{ startOffset: 0, endOffset: content.length, content }], headings: [] }
  }

  rawBlocks.sort((a, b) => a.start - b.start)

  // Preserve any leading prelude (front-matter-ish text, whitespace, etc.).
  if (rawBlocks[0].start > 0) {
    const prelude = content.slice(0, rawBlocks[0].start)
    const preludeVisible = stripInvisibleForPagination(prelude).trim()
    rawBlocks.unshift({
      start: 0,
      end: rawBlocks[0].start,
      sliceEnd: rawBlocks[0].start,
      node: { type: 'paragraph' } as unknown as Content,
      isHeading: false,
      weight: preludeVisible.length,
    })
  }

  // Extend each block to include the whitespace up to the next block, so pages
  // remain byte-for-byte identical when concatenated.
  const blocks: Block[] = rawBlocks.map((block, index) => {
    const nextStart = rawBlocks[index + 1]?.start
    return {
      ...block,
      sliceEnd: typeof nextStart === 'number' ? nextStart : content.length,
    }
  })

  const headings = blocks.flatMap(b => (b.heading ? [b.heading] : []))

  const pageRanges: Array<{ start: number; end: number; visibleChars: number }> = []

  let pageStart = blocks[0].start
  let pageEnd = blocks[0].sliceEnd
  let pageVisibleChars = blocks[0].weight

  for (let i = 1; i < blocks.length; i++) {
    const blk = blocks[i]
    const currentSize = pageVisibleChars
    const wouldSize = currentSize + blk.weight

    const hardBreak = wouldSize > maxChars && currentSize > 0
    const softBreak = blk.isHeading && currentSize >= targetChars && currentSize >= minChars

    // Avoid producing tiny "one-liner" pages. Even if the next block would exceed maxChars,
    // don't break unless we've accumulated at least minChars of visible content.
    // This is especially important for heading-only chunks separated by invisible HTML markers.
    const canBreak = currentSize >= minChars

    if ((hardBreak || softBreak) && canBreak) {
      pageRanges.push({ start: pageStart, end: pageEnd, visibleChars: pageVisibleChars })
      pageStart = blk.start
      pageEnd = blk.sliceEnd
      pageVisibleChars = blk.weight
      continue
    }

    pageEnd = blk.sliceEnd
    pageVisibleChars += blk.weight
  }

  pageRanges.push({ start: pageStart, end: pageEnd, visibleChars: pageVisibleChars })

  // Merge very small pages to avoid "1-line pages" and comment-only pages.
  //
  // We do this as a post-pass so the core break logic remains stable and we
  // only coalesce obviously bad pages.
  if (pageRanges.length > 1) {
    let i = 0
    while (i < pageRanges.length) {
      const range = pageRanges[i]
      const raw = content.slice(range.start, range.end)
      const size = range.visibleChars
      const invisible = size === 0 || !isVisiblyMeaningful(raw)

      if (i === 0) {
        // If the first page is tiny/invisible, merge forward when safe.
        if ((invisible || size < minChars) && pageRanges.length > 1) {
          const next = pageRanges[i + 1]
          const mergedVisible = range.visibleChars + next.visibleChars
          if (mergedVisible <= maxMergeChars) {
            next.start = range.start
            next.visibleChars = mergedVisible
            pageRanges.splice(i, 1)
            continue
          }
        }
        i += 1
        continue
      }

      if (invisible || size < minChars) {
        const prev = pageRanges[i - 1]
        const mergedVisible = prev.visibleChars + range.visibleChars
        if (mergedVisible <= maxMergeChars) {
          prev.end = range.end
          prev.visibleChars = mergedVisible
          pageRanges.splice(i, 1)
          continue
        }
      }

      i += 1
    }
  }

  const pages = pageRanges
    .map(r => ({
      startOffset: r.start,
      endOffset: r.end,
      content: content.slice(r.start, r.end),
    }))
    // Filter out pages that render as nothing (comment-only/definition-only/etc).
    .filter((p, index) => {
      const visibleChars = pageRanges[index]?.visibleChars ?? 0
      return visibleChars > 0 && isVisiblyMeaningful(p.content)
    })

  return {
    pages: pages.length > 0 ? pages : [{ startOffset: 0, endOffset: content.length, content }],
    headings,
  }
}
