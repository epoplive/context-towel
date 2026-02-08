// ============================================================================
// Link Parser (Markdown + Wiki Links)
// ============================================================================

import type { ParseResult, SourceMatch } from '../../types'
import type { LinkItem } from './types'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { visit } from 'unist-util-visit'
import type { Code, InlineCode, Root } from 'mdast'

const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g
const MD_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g

// Links inside code (inline or fenced) should not be treated as markdown/wiki links.
// This prevents false-positive link extraction from code samples and from our
// fenced block languages (e.g. ```task / ~~~task fields containing [[blocked-by]]).
function buildScanMask(content: string): string {
  // Build a character-for-character mask using markdown AST positions so we
  // reliably ignore:
  // - ``` fenced code blocks
  // - ~~~ fenced code blocks
  // - variable-length fences (````)
  // - inline code spans
  const chars = Array.from(content)

  const applyMask = (start: number, end: number) => {
    const safeStart = Math.max(0, Math.min(start, chars.length))
    const safeEnd = Math.max(safeStart, Math.min(end, chars.length))
    for (let i = safeStart; i < safeEnd; i++) {
      chars[i] = ' '
    }
  }

  try {
    const tree = unified().use(remarkParse).parse(content) as Root
    visit(tree, (node: any) => {
      if (node?.type !== 'code' && node?.type !== 'inlineCode') return
      const typed = node as Code | InlineCode
      const start = typed.position?.start?.offset
      const end = typed.position?.end?.offset
      if (typeof start === 'number' && typeof end === 'number') {
        applyMask(start, end)
      }
    })
  } catch {
    // Fallback: regex mask (less accurate, but preserves behavior).
    const withoutFenced = content.replace(/```[\s\S]*?```/g, (match) => ' '.repeat(match.length))
    return withoutFenced.replace(/`[^`]*`/g, (match) => ' '.repeat(match.length))
  }

  return chars.join('')
}

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
  const mask = buildScanMask(content)
  WIKI_LINK_REGEX.lastIndex = 0
  MD_LINK_REGEX.lastIndex = 0
  return WIKI_LINK_REGEX.test(mask) || MD_LINK_REGEX.test(mask)
}

export function parseLinks(content: string, sourceFile: string): ParseResult<LinkItem> {
  const mask = buildScanMask(content)
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
    if (mask[match.index ?? 0] === ' ') continue
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
    if (mask[match.index ?? 0] === ' ') continue
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
