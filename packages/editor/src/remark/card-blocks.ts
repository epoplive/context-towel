import { $remark } from '@milkdown/utils'
import { blockRegistry } from '@context-towel/card-library'
import { visit } from 'unist-util-visit'
import type { Root, Code } from 'mdast'

/**
 * Remark plugin that transforms fenced code blocks with registered card-library
 * block types (task, checklist, diagram, etc.) into `card-block` AST nodes.
 *
 * Before: { type: 'code', lang: 'task', value: 'id: foo\ntitle: ...' }
 * After:  { type: 'card-block', lang: 'task', value: 'id: foo\ntitle: ...',
 *           position: <preserved from original> }
 *
 * Milkdown's parser then matches card-block nodes against our cardBlockSchema
 * instead of the default code_block schema.
 */
function remarkCardBlocks() {
  return (tree: Root) => {
    visit(tree, 'code', (node: Code, index, parent) => {
      const lang = node.lang?.trim()
      if (!lang || !blockRegistry.has(lang) || index == null || !parent) return

      // Replace the code node with our custom card-block node.
      // We preserve position so Milkdown's transformer can track source ranges.
      const cardNode = {
        type: 'card-block',
        lang,
        value: node.value,
        position: node.position,
        meta: node.meta,
      }

      parent.children.splice(index, 1, cardNode as any)

      // Return index to re-visit at this position (the new node won't match 'code')
      return index
    })
  }
}

export const remarkCardBlocksPlugin = $remark('remarkCardBlocks', () => remarkCardBlocks)
