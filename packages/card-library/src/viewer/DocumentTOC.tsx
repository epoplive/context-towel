/**
 * Document Table of Contents — reusable sidebar component.
 *
 * Renders a navigable TOC from markdown headings and task blocks.
 * Shows question block indicators for workflow integration.
 *
 * Extracted from the Tauri app's file-viewer.
 */

import { useMemo, useCallback, useRef, type CSSProperties } from 'react'
import type { ThemeTokens, BlockInstance } from '../blocks/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TocEntry {
  type: 'heading' | 'task' | 'question'
  text: string
  level: number
  offset: number
  status?: string
  /** For questions: whether answered */
  answered?: boolean
}

export interface DocumentTOCProps {
  /** Parsed TOC entries */
  entries: TocEntry[]
  /** Theme tokens */
  theme: ThemeTokens
  /** Callback when an entry is clicked */
  onEntryClick?: (entry: TocEntry) => void
  /** Status color map for task dots */
  statusColors?: Record<string, string>
  /** Width of the sidebar */
  width?: number
}

// ─── Default status colors ────────────────────────────────────────────────────

const DEFAULT_STATUS_COLORS: Record<string, string> = {
  todo: '#6b7280',
  'in-progress': '#3b82f6',
  done: '#22c55e',
  blocked: '#ef4444',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentTOC({
  entries,
  theme,
  onEntryClick,
  statusColors = DEFAULT_STATUS_COLORS,
  width = 240,
}: DocumentTOCProps) {
  const tocRef = useRef<HTMLDivElement>(null)

  const statusDot = (status: string, size = 6) => {
    const color = statusColors[status] ?? '#666'
    return (
      <span style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }} />
    )
  }

  const questionIcon = (answered: boolean) => (
    <span style={{
      display: 'inline-block',
      width: 14,
      height: 14,
      borderRadius: '50%',
      background: answered ? theme.success : theme.warning,
      color: '#fff',
      fontSize: 10,
      fontWeight: 700,
      textAlign: 'center',
      lineHeight: '14px',
      flexShrink: 0,
    }}>
      ?
    </span>
  )

  return (
    <div
      ref={tocRef}
      className="doc-toc-sidebar"
      style={{
        width,
        flexShrink: 0,
        borderRight: `1px solid ${theme.borderPrimary}`,
        overflow: 'auto',
        padding: '12px 0',
        fontSize: 12,
      }}
    >
      {entries.map((entry, i) => (
        <div
          key={i}
          onClick={() => onEntryClick?.(entry)}
          style={{
            padding: '3px 12px',
            paddingLeft: `${12 + (entry.level - 1) * 12}px`,
            cursor: onEntryClick ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: entry.type === 'heading'
              ? theme.textPrimary
              : entry.type === 'question'
                ? (entry.answered ? theme.textMuted : theme.warning)
                : theme.textSecondary,
            fontWeight: entry.level <= 2 ? 600 : 400,
            fontSize: entry.level === 1 ? 13 : entry.level === 2 ? 12 : 11,
          }}
        >
          {entry.type === 'task' && entry.status && statusDot(entry.status)}
          {entry.type === 'question' && questionIcon(entry.answered ?? false)}
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {entry.text}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── TOC Builder ──────────────────────────────────────────────────────────────

export interface TocBuilderOptions {
  /** Include task blocks in TOC */
  includeTasks?: boolean
  /** Include question blocks in TOC */
  includeQuestions?: boolean
}

/**
 * Build TOC entries from markdown content.
 * Parses headings and optionally task/question blocks.
 */
export function buildTocEntries(
  content: string,
  options: TocBuilderOptions = {},
): TocEntry[] {
  const { includeTasks = true, includeQuestions = true } = options
  const entries: TocEntry[] = []

  // Parse headings
  const headingPattern = /^(#{1,6})\s+(.+)/gm
  let match: RegExpExecArray | null
  while ((match = headingPattern.exec(content)) !== null) {
    entries.push({
      type: 'heading',
      text: match[2].trim(),
      level: match[1].length,
      offset: match.index,
    })
  }

  // Parse task blocks
  if (includeTasks) {
    const taskPattern = /~~~task\s*\n([\s\S]*?)~~~/g
    while ((match = taskPattern.exec(content)) !== null) {
      const block = match[1]
      const title = block.match(/^title:\s*(.+)/m)?.[1]?.trim() ?? 'Untitled task'
      const status = block.match(/^status:\s*(.+)/m)?.[1]?.trim()
      entries.push({
        type: 'task',
        text: title,
        level: 3,
        offset: match.index,
        status,
      })
    }
  }

  // Parse question blocks
  if (includeQuestions) {
    const questionPattern = /~~~question\s*\n([\s\S]*?)~~~/g
    while ((match = questionPattern.exec(content)) !== null) {
      const block = match[1]
      const id = block.match(/^id:\s*(.+)/m)?.[1]?.trim()
      const hasResponse = block.includes('response:') || block.includes('answer:')

      // Extract the question text from the body (after ---)
      const bodyStart = block.indexOf('---')
      const body = bodyStart >= 0 ? block.slice(bodyStart + 3).trim() : ''
      const questionText = body.split('\n')[0]?.trim() ?? id ?? 'Question'

      entries.push({
        type: 'question',
        text: questionText,
        level: 3,
        offset: match.index,
        answered: hasResponse,
      })
    }
  }

  // Sort by document position
  entries.sort((a, b) => a.offset - b.offset)
  return entries
}
