import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { TocCard } from './TocCard'
import type { TocData } from './types'

export type { TocData, TocSectionData } from './types'
export { TocCard } from './TocCard'

export const tocBlockDefinition: BlockDefinition<TocData> = {
  type: 'toc',
  name: 'Table of Contents',
  components: {
    inline: TocCard,
    card: TocCard,
  },
  toContextMarkdown(blocks) {
    const docs = blocks.filter((b) => b.data !== null).map((b) => b.data!)
    if (docs.length === 0) return ''

    const lines: string[] = ['### Document Structure']
    for (const doc of docs) {
      lines.push(`- ${doc.docName}`)
      for (const section of doc.sections) {
        renderSection(section, 1, lines)
      }
    }
    return lines.join('\n')
  },
}

function renderSection(section: import('./types').TocSectionData, depth: number, lines: string[]) {
  const indent = '  '.repeat(depth)
  lines.push(`${indent}- ${section.title}`)
  for (const child of section.children) {
    renderSection(child, depth + 1, lines)
  }
}

export function registerTocBlock(): void {
  if (!blockRegistry.has('toc')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blockRegistry.register(tocBlockDefinition as any)
  }
}
