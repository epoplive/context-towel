// ============================================================================
// Link Parser (Markdown + Wiki Links)
// ============================================================================

import type { ParseResult, SourceMatch } from '../../types'
import type { LinkItem } from './types'

const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g
const MD_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

function getLineNumber(content: string, index: number): number {
  if (index <= 0) return 1
  return content.slice(0, index).split('\n').length
}

function getEndLine(startLine: number, matchText: string): number {
  const lines = matchText.split('\n').length
  return startLine + lines - 1
}

function normalizeTarget(raw: string): string {
  return raw.trim().replace(/^\.\/+/, '')
}

function isMarkdownDoc(target: string): boolean {
  const normalized = target.toLowerCase()
  return normalized.endsWith('.md') || normalized.endsWith('.markdown') || normalized.endsWith('.mdx')
}

export function detectLinks(content: string): boolean {
  WIKI_LINK_REGEX.lastIndex = 0
  MD_LINK_REGEX.lastIndex = 0
  return WIKI_LINK_REGEX.test(content) || MD_LINK_REGEX.test(content)
}

export function parseLinks(content: string, sourceFile: string): ParseResult<LinkItem> {
  WIKI_LINK_REGEX.lastIndex = 0
  MD_LINK_REGEX.lastIndex = 0
  const items: LinkItem[] = []
  const rawMatches: SourceMatch[] = []

  const pushMatch = (matchText: string, index: number, item: LinkItem) => {
    const startLine = getLineNumber(content, index)
    const endLine = getEndLine(startLine, matchText)
    item.sourceLine = startLine
    item.sourceEndLine = endLine
    rawMatches.push({
      start: index,
      end: index + matchText.length,
      startLine,
      endLine,
      content: matchText,
    })
    items.push(item)
  }

  let match: RegExpExecArray | null
  while ((match = WIKI_LINK_REGEX.exec(content)) !== null) {
    const raw = match[1]?.trim() ?? ''
    if (!raw) continue
    const [targetRaw, textRaw] = raw.split('|')
    const target = normalizeTarget(targetRaw ?? '')
    const text = textRaw?.trim()
    const id = `link-${slugify(target)}-${match.index}`
    pushMatch(match[0], match.index, {
      id,
      sourceFile,
      kind: 'wiki',
      target,
      text,
    })
  }

  while ((match = MD_LINK_REGEX.exec(content)) !== null) {
    const text = match[1]?.trim() ?? ''
    const targetRaw = match[2]?.trim() ?? ''
    if (!targetRaw) continue
    const target = normalizeTarget(targetRaw)
    if (!isMarkdownDoc(target)) continue
    const id = `link-${slugify(target)}-${match.index}`
    pushMatch(match[0], match.index, {
      id,
      sourceFile,
      kind: 'markdown',
      target,
      text,
    })
  }

  return {
    pluginId: 'link',
    items,
    rawMatches,
  }
}
