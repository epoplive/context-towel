// ============================================================================
// Diagram Plugin Parser
// ============================================================================

import { ParseResult, SourceMatch } from '../../types'
import { DiagramItem } from './types'

/**
 * Detect if content contains mermaid diagrams
 */
export function detectDiagrams(content: string): boolean {
  return /```mermaid/m.test(content)
}

/**
 * Parse mermaid diagrams from markdown
 */
export function parseDiagrams(content: string, sourceFile: string): ParseResult<DiagramItem> {
  const items: DiagramItem[] = []
  const rawMatches: SourceMatch[] = []

  const lines = content.split('\n')
  let currentTitle = 'Diagram'
  let inMermaidBlock = false
  let currentCode: string[] = []
  let blockStartLine = 0
  let diagramIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Track headings to get diagram titles
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/)
    if (headingMatch && !inMermaidBlock) {
      currentTitle = headingMatch[1].trim()
      continue
    }

    // Start of mermaid block
    if (line.trim() === '```mermaid') {
      inMermaidBlock = true
      currentCode = []
      blockStartLine = i + 1
      continue
    }

    // End of mermaid block
    if (inMermaidBlock && line.trim() === '```') {
      inMermaidBlock = false
      const code = currentCode.join('\n').trim()

      if (code) {
        // Extract diagram type from first line
        const firstLine = code.split('\n')[0].trim()
        const diagramType = firstLine.split(/[\s\[{]/)[0]

        items.push({
          id: `diagram-${diagramIndex++}`,
          sourceFile,
          sourceLine: blockStartLine,
          sourceEndLine: i,
          title: currentTitle,
          code,
          diagramType
        })

        rawMatches.push({
          start: 0,
          end: 0,
          startLine: blockStartLine,
          endLine: i,
          content: code
        })
      }
      currentCode = []
      continue
    }

    // Inside mermaid block - collect code
    if (inMermaidBlock) {
      currentCode.push(line)
    }
  }

  return {
    pluginId: 'diagram',
    items,
    rawMatches
  }
}
