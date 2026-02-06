// ============================================================================
// Checklist Plugin - Parses standalone checklists from markdown
// ============================================================================

import { ParserPlugin, ContextOptions, RenderContext } from '../types'
import { ChecklistGroup } from './types'
import { detectChecklists, parseChecklists } from './parser'
import { ChecklistNode } from './components'

export * from './types'
export { parseChecklists, detectChecklists } from './parser'
export { ChecklistNode } from './components'
export type { ChecklistNodeData } from './components'

export const checklistPlugin: ParserPlugin<ChecklistGroup> = {
  id: 'checklist',
  name: 'Checklist',
  version: '1.0.0',
  priority: 80,

  detect: detectChecklists,
  parse: parseChecklists,

  supportedContexts: ['graph-node', 'panel', 'popover', 'card'],
  nodeType: 'checklist',

  getComponent: (context: RenderContext) => {
    if (context === 'graph-node' || context === 'card') {
      return ChecklistNode as any
    }
    return null
  },

  toContextMarkdown: (items: ChecklistGroup[], options?: ContextOptions) => {
    if (items.length === 0) return ''

    const lines: string[] = ['### Checklists']

    for (const group of items) {
      lines.push(`**${group.title}** (${group.progress}%)`)

      const toShow = options?.maxItems
        ? group.items.slice(0, options.maxItems)
        : group.items

      for (const item of toShow) {
        const check = item.checked ? '[x]' : '[ ]'
        lines.push(`- ${check} ${item.text}`)
      }

      if (options?.includeSource && group.sourceLine) {
        lines.push(`*Source: ${group.sourceFile}:${group.sourceLine}*`)
      }
    }

    return lines.join('\n')
  }
}
