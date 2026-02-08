// ============================================================================
// Diagram Plugin - Parses mermaid diagrams from markdown
// ============================================================================

import { ParserPlugin, ContextOptions, RenderContext } from '../types'
import { DiagramItem } from './types'
import { detectDiagrams, parseDiagrams } from './parser'
import { DiagramNode } from './components'
import { formatFencedCodeBlock } from '@context-towel/card-library'

export * from './types'
export { parseDiagrams, detectDiagrams } from './parser'
export { DiagramNode } from './components'
export type { DiagramNodeData } from './components'

export const diagramPlugin: ParserPlugin<DiagramItem> = {
  id: 'diagram',
  name: 'Mermaid Diagram',
  version: '1.0.0',
  priority: 70,

  detect: detectDiagrams,
  parse: parseDiagrams,

  supportedContexts: ['graph-node', 'panel', 'popover', 'card'],
  nodeType: 'diagram',

  getComponent: (context: RenderContext) => {
    if (context === 'graph-node') {
      return DiagramNode as any
    }
    return null
  },

  toContextMarkdown: (items: DiagramItem[], options?: ContextOptions) => {
    if (items.length === 0) return ''

    const lines: string[] = ['### Diagrams']

    for (const diagram of items) {
      lines.push(`- **${diagram.title}** (${diagram.diagramType})`)

      if (options?.includeSource && diagram.sourceLine) {
        lines.push(`  *Source: ${diagram.sourceFile}:${diagram.sourceLine}*`)
      }

      // In full format, include the diagram code
      if (options?.format === 'full') {
        lines.push(formatFencedCodeBlock('mermaid', diagram.code))
      }
    }

    return lines.join('\n')
  }
}
