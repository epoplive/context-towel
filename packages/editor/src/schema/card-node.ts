import { $nodeSchema } from '@milkdown/utils'
import type { MarkdownNode } from '@milkdown/transformer'
import type { Node } from '@milkdown/prose/model'
import { validateBlockYaml } from '@context-towel/card-library'

/**
 * Generic card-block ProseMirror node schema.
 *
 * One node type handles ALL card block types (task, checklist, diagram, etc.).
 * The `blockType` attr determines which card component renders via CardRenderer.
 *
 * The node is `atom: true` — ProseMirror treats it as an opaque unit.
 * Our React NodeView handles all rendering and interaction.
 */
export const cardBlockSchema = $nodeSchema('card-block', () => ({
  group: 'block',
  atom: true,
  isolating: true,
  selectable: true,
  draggable: true,
  attrs: {
    blockType: { default: '' },
    value: { default: '' },
  },
  parseDOM: [{
    tag: 'div[data-card-block]',
    getAttrs: (dom) => {
      const el = dom as HTMLElement
      return {
        blockType: el.dataset.cardBlockType ?? '',
        value: el.dataset.cardBlockValue ?? '',
      }
    },
  }],
  toDOM: (node) => {
    return ['div', {
      'data-card-block': '',
      'data-card-block-type': node.attrs.blockType,
      'data-card-block-value': node.attrs.value,
    }, 0]
  },

  parseMarkdown: {
    match: (node: MarkdownNode) => node.type === 'card-block',
    runner: (state, node, proseType) => {
      const lang = (node as any).lang as string
      const value = (node as any).value as string ?? ''
      state.addNode(proseType, { blockType: lang, value })
    },
  },

  toMarkdown: {
    match: (node: Node) => node.type.name === 'card-block',
    runner: (state, node) => {
      state.addNode('code', undefined, node.attrs.value as string, {
        lang: node.attrs.blockType as string,
      })
    },
  },
}))

/**
 * Parse the value attr of a card-block PM node into typed block data.
 * Uses card-library's validateBlockYaml for parsing + validation.
 */
export function parseCardBlockAttrs(blockType: string, value: string) {
  return validateBlockYaml(blockType, value)
}
