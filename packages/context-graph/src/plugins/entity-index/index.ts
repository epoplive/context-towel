import type { ParserPlugin, ContextOptions, RenderContext } from '../types'
import type { IndexEntityItem } from './types'
import { detectIndex, parseIndex } from './parser'
import { IndexEntityNode } from './components'

export * from './types'
export { detectIndex, parseIndex } from './parser'
export { IndexEntityNode } from './components'
export type { IndexEntityNodeData } from './components'

export const entityIndexPlugin: ParserPlugin<IndexEntityItem> = {
  id: 'entity-index',
  name: 'Entity Index',
  version: '1.0.0',
  priority: 50,

  detect: detectIndex,
  parse: parseIndex,

  supportedContexts: ['graph-node', 'panel', 'card'],
  nodeType: 'entity-index',

  getComponent: (context: RenderContext) => {
    if (context === 'graph-node') {
      return IndexEntityNode as any
    }
    return null
  },

  toContextMarkdown: (items: IndexEntityItem[], options?: ContextOptions) => {
    if (items.length === 0) return ''

    const lines: string[] = ['### Codebase Index']

    // Group by type
    const byType = new Map<string, IndexEntityItem[]>()
    for (const item of items) {
      const group = byType.get(item.entityType) || []
      group.push(item)
      byType.set(item.entityType, group)
    }

    for (const [type, typeItems] of byType) {
      lines.push(`**${type}s (${typeItems.length}):**`)
      for (const item of typeItems) {
        let line = `- ${item.entityId}: ${item.name}`
        if (item.description) line += ` — ${item.description}`
        if (item.refCount > 0) line += ` (${item.refCount} refs)`
        lines.push(line)

        if (options?.format === 'full' && item.linkedIds) {
          lines.push(`  Links: ${item.linkedIds.join(', ')}`)
        }
      }
    }

    return lines.join('\n')
  },
}
