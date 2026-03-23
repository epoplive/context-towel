import { useMemo, useCallback, useRef } from 'react'
import { paginateMarkdown } from '@context-towel/markdown'
import { statusColors, type BlockInstance, type TaskData } from '@context-towel/card-library'
import type { ColorTokens } from '@context-towel/context-graph/compat/design-system'

interface TocEntry {
  type: 'heading' | 'task'
  text: string
  level: number
  offset: number
  status?: string
}

interface DocumentTOCProps {
  content: string
  taskBlocks: BlockInstance[]
  colors: ColorTokens
}

export function DocumentTOC({ content, taskBlocks, colors }: DocumentTOCProps) {
  const tocRef = useRef<HTMLDivElement>(null)

  /** Find the ProseMirror instance that's a sibling of this TOC (inside the same flex row) */
  const findScopedProseMirror = useCallback((): Element | null => {
    const tocEl = tocRef.current
    if (!tocEl) return null
    const row = tocEl.parentElement
    if (!row) return null
    return row.querySelector('.ProseMirror')
  }, [])

  const entries = useMemo<TocEntry[]>(() => {
    const { headings } = paginateMarkdown(content)
    const result: TocEntry[] = headings.map(h => ({
      type: 'heading' as const,
      text: h.text,
      level: h.level,
      offset: h.startOffset,
    }))

    for (const block of taskBlocks) {
      const data = block.data as TaskData | null
      if (!data) continue
      result.push({
        type: 'task',
        text: data.title,
        level: 3,
        offset: block.source.range.startOffset ?? 0,
        status: data.status,
      })
    }

    result.sort((a, b) => a.offset - b.offset)
    return result
  }, [content, taskBlocks])

  const scrollTo = useCallback((offset: number) => {
    const container = findScopedProseMirror()
    if (!container) return

    const entry = entries.find(e => e.offset === offset)
    if (entry && entry.type === 'heading') {
      const headingId = entry.text.toLowerCase().trim().replace(/\s+/g, '-')
      const target = container.querySelector(`[id="${CSS.escape(headingId)}"]`)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }

    const elements = container.querySelectorAll('h1, h2, h3, h4, h5, h6, .card-block-node-view')
    let closest: Element | null = null
    let closestDist = Infinity

    elements.forEach((el) => {
      const text = el.textContent?.slice(0, 50) || ''
      const match = entries.find(e => e.text.startsWith(text.slice(0, 20)) && Math.abs(e.offset - offset) < 100)
      if (match && Math.abs(match.offset - offset) < closestDist) {
        closest = el
        closestDist = Math.abs(match.offset - offset)
      }
    })

    if (closest) {
      (closest as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [entries, findScopedProseMirror])

  const statusDot = (status: string) => {
    const color = statusColors[status as keyof typeof statusColors] || '#666'
    return <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
  }

  return (
    <div ref={tocRef} className="doc-toc-sidebar" style={{
      width: 240,
      flexShrink: 0,
      borderRight: `1px solid ${colors.borderPrimary}`,
      overflow: 'auto',
      padding: '12px 0',
      fontSize: 12,
    }}>
      {entries.map((entry, i) => (
        <div
          key={i}
          onClick={() => scrollTo(entry.offset)}
          style={{
            padding: '3px 12px',
            paddingLeft: `${12 + (entry.level - 1) * 12}px`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: entry.type === 'heading' ? colors.textPrimary : colors.textSecondary,
            fontWeight: entry.level <= 2 ? 600 : 400,
            fontSize: entry.level === 1 ? 13 : entry.level === 2 ? 12 : 11,
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = colors.bgTertiary }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent' }}
        >
          {entry.type === 'task' && entry.status && statusDot(entry.status)}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.text}
          </span>
        </div>
      ))}
    </div>
  )
}
