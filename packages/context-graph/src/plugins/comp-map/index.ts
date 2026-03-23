// ============================================================================
// Comp Map Plugin — Parses <comp:map:NAME> blocks from markdown
// ============================================================================

import { ParserPlugin, ContextOptions, RenderContext } from '../types'
import { CompMapItem } from './types'
import { detectCompMaps, parseCompMaps } from './parser'
import { CompMapNode } from './components'

export * from './types'
export { parseCompMaps, detectCompMaps } from './parser'
export { CompMapNode } from './components'
export type { CompMapNodeData } from './components'

export const compMapPlugin: ParserPlugin<CompMapItem> = {
  id: 'comp-map',
  name: 'Compression Map',
  version: '1.0.0',
  priority: 66, // just above node (65)

  detect: detectCompMaps,
  parse: parseCompMaps,

  supportedContexts: ['graph-node', 'panel', 'card'],
  nodeType: 'comp-map',

  getComponent: (context: RenderContext) => {
    if (context === 'graph-node') {
      return CompMapNode as any
    }
    return null
  },

  toContextMarkdown: (items: CompMapItem[], _options?: ContextOptions) => {
    if (items.length === 0) return ''

    const lines: string[] = ['### Compression Maps']
    for (const map of items) {
      const symbolList = map.symbols.map(s => `${s.symbol}=${s.expansion}`).join(' ')
      const inherits = map.parentId ? ` (uses ${map.parentId})` : ''
      lines.push(`- **${map.mapId}**${inherits}: ${symbolList}`)
    }
    return lines.join('\n')
  },
}
