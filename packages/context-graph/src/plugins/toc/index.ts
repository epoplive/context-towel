// ============================================================================
// TOC Plugin - Parses document structure into sections
// ============================================================================

import { ParserPlugin, ContextOptions, RenderContext } from '../types'
import { TocSection } from './types'
import { detectToc, parseToc } from './parser'
import { TOCNode } from './components'

export * from './types'
export { parseToc, detectToc } from './parser'
export { TOCNode } from './components'
export type { TOCNodeData, TOCSectionItem } from './components'

function renderTocSection(section: TocSection, depth: number = 0): string[] {
  const indent = '  '.repeat(depth)
  const lines: string[] = [`${indent}- ${section.title}`]

  for (const child of section.children) {
    lines.push(...renderTocSection(child, depth + 1))
  }

  return lines
}

export const tocPlugin: ParserPlugin<TocSection> = {
  id: 'toc',
  name: 'Table of Contents',
  version: '1.0.0',
  priority: 90,  // Parse before tasks (tasks are inside sections)

  detect: detectToc,
  parse: parseToc,

  supportedContexts: ['graph-node', 'panel', 'popover'],
  nodeType: 'toc',

  getComponent: (context: RenderContext) => {
    if (context === 'graph-node') {
      return TOCNode as any
    }
    return null
  },

  toContextMarkdown: (items: TocSection[], _options?: ContextOptions) => {
    if (items.length === 0) return ''

    const lines: string[] = ['### Document Structure']

    for (const section of items) {
      lines.push(...renderTocSection(section))
    }

    return lines.join('\n')
  }
}
