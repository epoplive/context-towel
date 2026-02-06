// ============================================================================
// Link Plugin - Parses wiki + markdown links from markdown
// ============================================================================

import type { ParserPlugin, ContextOptions, RenderContext } from '../types'
import type { LinkItem } from './types'
import { detectLinks, parseLinks } from './parser'

export * from './types'
export { detectLinks, parseLinks } from './parser'

export const linkPlugin: ParserPlugin<LinkItem> = {
  id: 'link',
  name: 'Links',
  version: '1.0.0',
  priority: 10,

  detect: detectLinks,
  parse: parseLinks,

  supportedContexts: ['graph-node', 'panel', 'popover', 'card'],
  nodeType: 'link',

  getComponent: (_context: RenderContext) => null,

  toContextMarkdown: (items: LinkItem[], options?: ContextOptions) => {
    if (items.length === 0) return ''

    const lines: string[] = ['### Links']
    const seen = new Set<string>()
    const limit = options?.maxItems ?? items.length
    let count = 0

    for (const item of items) {
      const key = `${item.kind}:${item.target}:${item.text ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      count += 1
      if (count > limit) break

      if (item.kind === 'markdown') {
        const label = item.text || item.target
        lines.push(`- [${label}](${item.target})`)
      } else {
        const textSuffix = item.text ? `|${item.text}` : ''
        lines.push(`- [[${item.target}${textSuffix}]]`)
      }

      if (options?.includeSource && item.sourceLine) {
        lines.push(`  *Source: ${item.sourceFile}:${item.sourceLine}*`)
      }
    }

    return lines.join('\n')
  },
}
