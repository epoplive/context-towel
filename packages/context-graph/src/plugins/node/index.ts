// ============================================================================
// Node Plugin - Parses ~~~node blocks from markdown
// ============================================================================

import { ParserPlugin, ContextOptions, RenderContext } from '../types'
import { NodeItem } from './types'
import { detectNodes, parseNodes } from './parser'
import { NodeNode } from './components'

export * from './types'
export { parseNodes, detectNodes } from './parser'
export { NodeNode } from './components'
export type { NodeNodeData } from './components'

export const nodePlugin: ParserPlugin<NodeItem> = {
  id: 'node',
  name: 'Context Node',
  version: '1.0.0',
  priority: 65,

  detect: detectNodes,
  parse: parseNodes,

  supportedContexts: ['graph-node', 'panel', 'popover', 'card'],
  nodeType: 'node',

  getComponent: (context: RenderContext) => {
    if (context === 'graph-node') {
      return NodeNode as any
    }
    return null
  },

  toContextMarkdown: (items: NodeItem[], options?: ContextOptions) => {
    if (items.length === 0) return ''

    const lines: string[] = ['### Nodes']

    for (const node of items) {
      const stateIcon = node.state === 'success' ? '[OK]' : node.state === 'failed' ? '[FAIL]' : '[...]'
      lines.push(`- **${node.nodeId}** ${stateIcon}${node.layer ? ` (${node.layer})` : ''}${node.subsystem ? ` [${node.subsystem}]` : ''}`)

      if (options?.includeSource && node.sourceLine) {
        lines.push(`  *Source: ${node.sourceFile}:${node.sourceLine}*`)
      }

      if (options?.format === 'full' && node.body) {
        lines.push(`  ${node.body.split('\n').join('\n  ')}`)
      }
    }

    return lines.join('\n')
  },
}
