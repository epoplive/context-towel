import { $remark } from '@milkdown/utils'
import { visit } from 'unist-util-visit'
import type { Root, Code } from 'mdast'

/**
 * Remark plugin that transforms fenced code blocks with lang "mermaid" into
 * `mermaid-block` AST nodes, so they are picked up by the mermaid node schema
 * instead of the default code_block schema.
 *
 * Before: { type: 'code', lang: 'mermaid', value: 'graph TD...' }
 * After:  { type: 'mermaid-block', value: 'graph TD...', position: <preserved> }
 */
function remarkMermaidBlocks() {
  return (tree: Root) => {
    visit(tree, 'code', (node: Code, index, parent) => {
      if (node.lang?.trim().toLowerCase() !== 'mermaid' || index == null || !parent) return
      const mermaidNode = {
        type: 'mermaid-block',
        value: node.value,
        position: node.position,
      }
      parent.children.splice(index, 1, mermaidNode as any)
      // Return index so unist-util-visit re-visits this position (the new node won't match 'code')
      return index
    })
  }
}

export const remarkMermaidBlocksPlugin = $remark('remarkMermaidBlocks', () => remarkMermaidBlocks)
