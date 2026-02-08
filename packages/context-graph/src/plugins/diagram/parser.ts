// ============================================================================
// Diagram Plugin Parser
// ============================================================================

import { ParseResult, SourceMatch } from '../../types'
import { DiagramItem } from './types'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { visit } from 'unist-util-visit'
import type { Code, Heading, Root } from 'mdast'

/**
 * Detect if content contains mermaid diagrams
 */
export function detectDiagrams(content: string): boolean {
  // Be liberal: any fenced marker + "mermaid" info string.
  return /(?:`{3,}|~{3,})\s*mermaid\b/im.test(content)
}

/**
 * Parse mermaid diagrams from markdown
 */
export function parseDiagrams(content: string, sourceFile: string): ParseResult<DiagramItem> {
  const items: DiagramItem[] = []
  const rawMatches: SourceMatch[] = []

  const extractInlineText = (node: any): string => {
    if (!node) return ''
    if (typeof node.value === 'string') return node.value
    if (Array.isArray(node.children)) return node.children.map(extractInlineText).join('')
    return ''
  }

  const headingToText = (node: Heading): string => {
    const text = extractInlineText(node).trim()
    return text.length > 0 ? text : 'Untitled'
  }

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
    return (node.value ?? '')
  }

  visit(tree as any, (node: any) => {
    if (node?.type === 'heading') {
      const heading = node as Heading
      if (heading.depth <= 3) {
        currentTitle = headingToText(heading)
      }
      return
    }

    if (node?.type !== 'code') return
    const codeNode = node as Code
    const lang = codeNode.lang?.trim().toLowerCase()
    if (lang !== 'mermaid') return

    const code = (codeNode.value ?? '').trim()
    if (!code) return

    const startLine = codeNode.position?.start?.line ?? 1
    const endLine = codeNode.position?.end?.line ?? startLine
    const raw = sliceRawBlock(codeNode)

    // Extract diagram type from first line
    const firstLine = code.split('\n')[0]?.trim() ?? ''
    const diagramType = firstLine.split(/[\s\[{]/)[0] ?? 'mermaid'

    items.push({
      id: `diagram-${diagramIndex++}`,
      sourceFile,
      // Match previous behavior: point to the first line of diagram code, not the fence.
      sourceLine: startLine + 1,
      sourceEndLine: endLine,
      title: currentTitle,
      code,
      diagramType,
    })

    const startOffset = codeNode.position?.start?.offset
    const endOffset = codeNode.position?.end?.offset
    if (
      typeof startOffset === 'number' &&
      typeof endOffset === 'number' &&
      typeof startLine === 'number' &&
      typeof endLine === 'number'
    ) {
      rawMatches.push({
        start: startOffset,
        end: endOffset,
        startLine,
        endLine,
        content: raw,
      })
    } else {
      rawMatches.push({
        start: 0,
        end: 0,
        startLine,
        endLine,
        content: raw,
      })
    }
  })

  return {
    pluginId: 'diagram',
    items,
    rawMatches
  }
}
