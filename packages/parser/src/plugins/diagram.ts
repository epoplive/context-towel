// ============================================================================
// Diagram Parser Plugin
// ============================================================================
//
// Parses mermaid code blocks from markdown.
// Extracted from context-graph's plugins/diagram/parser.ts.

import type { ParseResult } from '../types'
import type { DiagramItem } from '../types'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { visit } from 'unist-util-visit'
import type { Code, Heading, Root } from 'mdast'

// -------------------------------------------------------------------------- //
// Internal helpers
// -------------------------------------------------------------------------- //

function extractInlineText(node: unknown, depth = 0): string {
  if (!node || depth > 20) return ''
  const n = node as { value?: unknown; children?: unknown[] }
  if (typeof n.value === 'string') return n.value
  if (Array.isArray(n.children)) return n.children.map((c) => extractInlineText(c, depth + 1)).join('')
  return ''
}

function headingToText(node: Heading): string {
  const text = extractInlineText(node).trim()
  return text.length > 0 ? text : 'Untitled'
}

// -------------------------------------------------------------------------- //
// Public API
// -------------------------------------------------------------------------- //

export function detectDiagrams(content: string): boolean {
  return /(?:`{3,}|~{3,})\s*mermaid\b/im.test(content)
}

export function parseDiagrams(content: string, sourceFile: string): ParseResult<DiagramItem> {
  const items: DiagramItem[] = []
  const rawMatches: ParseResult['rawMatches'] = []

  let tree: Root
  try {
    tree = unified().use(remarkParse).parse(content) as Root
  } catch {
    return { pluginId: 'diagram', items, rawMatches }
  }

  let currentTitle = 'Diagram'
  let diagramIndex = 0

  const sliceRawBlock = (node: Code): string => {
    const start = node.position?.start?.offset
    const end = node.position?.end?.offset
    if (typeof start === 'number' && typeof end === 'number') {
      return content.slice(start, end)
    }
    return node.value ?? ''
  }

  visit(tree as Parameters<typeof visit>[0], (node: unknown) => {
    const n = node as { type?: string }
    if (n?.type === 'heading') {
      const heading = node as Heading
      if (heading.depth <= 3) {
        currentTitle = headingToText(heading)
      }
      return
    }

    if (n?.type !== 'code') return
    const codeNode = node as Code
    const lang = codeNode.lang?.trim().toLowerCase()
    if (lang !== 'mermaid') return

    const code = (codeNode.value ?? '').trim()
    if (!code) return

    const startLine = codeNode.position?.start?.line ?? 1
    const endLine = codeNode.position?.end?.line ?? startLine
    const raw = sliceRawBlock(codeNode)

    const firstLine = code.split('\n')[0]?.trim() ?? ''
    const diagramType = firstLine.split(/[\s\[{]/)[0] ?? 'mermaid'

    items.push({
      id: `diagram-${diagramIndex++}`,
      sourceFile,
      sourceLine: startLine + 1,
      sourceEndLine: endLine,
      title: currentTitle,
      code,
      diagramType,
    })

    const startOffset = codeNode.position?.start?.offset
    const endOffset = codeNode.position?.end?.offset

    rawMatches!.push({
      start: typeof startOffset === 'number' ? startOffset : 0,
      end: typeof endOffset === 'number' ? endOffset : 0,
      startLine,
      endLine,
      content: raw,
    })
  })

  return { pluginId: 'diagram', items, rawMatches }
}

/** ParserPlugin descriptor for FileParserService registration */
export const diagramParserPlugin = {
  id: 'diagram',
  extensions: ['.md', '.markdown'],
  detect: detectDiagrams,
  parse: parseDiagrams,
}

export type { DiagramItem }
