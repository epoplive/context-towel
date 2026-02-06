import { blockRegistry, serializeBlockData, type BlockInstance } from '@context-towel/card-library'
import type { ParserPlugin, ContextOptions } from '../types'
import type { BlockItem } from './types'
import { detectBlocks, parseBlocks } from './parser'

const buildInstance = (item: BlockItem): BlockInstance => ({
  type: item.blockType,
  data: item.data,
  source: {
    filePath: item.sourceFile,
    range: item.range,
    raw: item.raw,
  },
  errors: item.errors,
})

const renderFallback = (type: string, items: BlockItem[], options?: ContextOptions): string => {
  const includeSource = options?.includeSource ?? false
  const maxItems = options?.maxItems ?? items.length
  const lines: string[] = [`### ${type} Blocks`]

  items.slice(0, maxItems).forEach(item => {
    const source = includeSource
      ? ` (${item.sourceFile}${item.sourceLine ? `:${item.sourceLine}` : ''})`
      : ''
    lines.push(`- Block${source}`)
    if (item.errors && item.errors.length > 0) {
      lines.push(`  - Errors: ${item.errors.map(err => err.message).join('; ')}`)
    }
    if (item.data) {
      const yaml = serializeBlockData(item.data)
      lines.push('```' + type)
      lines.push(yaml)
      lines.push('```')
    }
  })

  return lines.join('\n')
}

export const blockPlugin: ParserPlugin<BlockItem> = {
  id: 'block',
  name: 'Blocks',
  version: '0.1.0',
  detect: detectBlocks,
  parse: parseBlocks,
  supportedContexts: ['inline', 'card', 'panel'],
  nodeType: 'block',
  getComponent: () => null,
  toContextMarkdown: (items, options) => {
    if (!items || items.length === 0) return ''
    const grouped = new Map<string, BlockItem[]>()

    items.forEach(item => {
      const group = grouped.get(item.blockType) ?? []
      group.push(item)
      grouped.set(item.blockType, group)
    })

    const sections: string[] = []
    grouped.forEach((groupItems, type) => {
      const def = blockRegistry.get(type)
      const instances = groupItems.map(buildInstance)
      if (def?.toContextMarkdown) {
        sections.push(def.toContextMarkdown(instances as any))
      } else {
        sections.push(renderFallback(type, groupItems, options))
      }
    })

    return sections.join('\n\n')
  },
}
