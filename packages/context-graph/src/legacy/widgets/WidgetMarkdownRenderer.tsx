import { useMemo } from 'react'
import { MarkdownRenderer, type FullscreenModalState } from '../markdown'
import { parseWidgetMarkup } from '../core-widgets/parser'
import { renderWidgetTree } from './WidgetRenderer'

type WidgetMarkdownRendererProps = {
  content: string
  onFullscreen?: (state: FullscreenModalState) => void
}

type WidgetSegment = { type: 'markdown' | 'widget'; content: string }

const WIDGET_TAG_REGEX = /<\/?(Card|Grid|Text|List|Form|Table|Row|Column|Item|Field)\b[^>]*\/?>/g

const buildScanMask = (content: string): string => {
  const withoutBlocks = content.replace(/```[\s\S]*?```/g, (match) => ' '.repeat(match.length))
  return withoutBlocks.replace(/`[^`]*`/g, (match) => ' '.repeat(match.length))
}

const splitWidgetMarkupSegments = (content: string): WidgetSegment[] | null => {
  const mask = buildScanMask(content)
  const blocks: Array<{ start: number; end: number }> = []
  const stack: string[] = []
  let blockStart: number | null = null

  for (const match of mask.matchAll(WIDGET_TAG_REGEX)) {
    const raw = match[0]
    const tag = match[1]
    const index = match.index ?? 0
    const isClosing = raw.startsWith('</')
    const isSelfClosing = /\/>$/.test(raw.trim())

    if (isClosing) {
      if (stack.length === 0) return null
      const last = stack[stack.length - 1]
      if (last !== tag) return null
      stack.pop()
      if (stack.length === 0 && blockStart !== null) {
        blocks.push({ start: blockStart, end: index + raw.length })
        blockStart = null
      }
      continue
    }

    if (isSelfClosing) {
      if (stack.length === 0) {
        blocks.push({ start: index, end: index + raw.length })
      }
      continue
    }

    if (stack.length === 0) {
      blockStart = index
    }
    stack.push(tag)
  }

  if (stack.length > 0 || blockStart !== null || blocks.length === 0) return null

  const segments: WidgetSegment[] = []
  let cursor = 0
  for (const block of blocks) {
    if (block.start > cursor) {
      segments.push({ type: 'markdown', content: content.slice(cursor, block.start) })
    }
    segments.push({ type: 'widget', content: content.slice(block.start, block.end) })
    cursor = block.end
  }
  if (cursor < content.length) {
    segments.push({ type: 'markdown', content: content.slice(cursor) })
  }
  return segments
}

export function WidgetMarkdownRenderer({ content, onFullscreen }: WidgetMarkdownRendererProps) {
  const widgetSegments = useMemo(() => splitWidgetMarkupSegments(content), [content])

  if (widgetSegments) {
    return (
      <div className="widget-markdown-root">
        {widgetSegments.map((segment, index) => {
          if (segment.type === 'markdown') {
            return (
              <div key={`md-${index}`} className="widget-markdown-segment">
                <MarkdownRenderer content={segment.content} onFullscreen={onFullscreen} />
              </div>
            )
          }
          try {
            const widgetNodes = parseWidgetMarkup(segment.content, { enforceNesting: true })
            return (
              <div key={`widget-${index}`} className="widget-markdown-widget">
                {renderWidgetTree(widgetNodes)}
              </div>
            )
          } catch (error) {
            console.warn('Widget markup parse error, falling back to markdown:', error)
            return (
              <div key={`md-${index}-fallback`} className="widget-markdown-segment">
                <MarkdownRenderer content={segment.content} onFullscreen={onFullscreen} />
              </div>
            )
          }
        })}
      </div>
    )
  }

  return <MarkdownRenderer content={content} onFullscreen={onFullscreen} />
}
