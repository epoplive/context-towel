import { $view } from '@milkdown/utils'
import type { Ctx } from '@milkdown/ctx'
import type { NodeViewConstructor } from '@milkdown/prose/view'
import type { Node as PmNode } from '@milkdown/prose/model'
import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'
import {
  CardRenderer,
  CardThemeProvider,
  validateBlockYaml,
  type BlockInstance,
  type BlockEditEvent,
  type ThemeTokens,
} from '@context-towel/card-library'
import { cardBlockSchema } from './card-node'

export type CardBlockEditHandler = (event: BlockEditEvent) => void

/**
 * Module-level config that the editor component sets before creating the editor.
 * NodeViews read from here since Milkdown's ctx system uses typed slices
 * and we don't want to fight it for simple config passing.
 */
export const cardViewConfig = {
  theme: undefined as ThemeTokens | undefined,
  onEdit: undefined as CardBlockEditHandler | undefined,
}

/**
 * Set of active card NodeView re-render functions.
 * When the theme changes, call each to re-render with the new theme.
 */
export const activeCardRenders = new Set<() => void>()

function buildBlockInstance(node: PmNode): BlockInstance {
  const blockType = node.attrs.blockType as string
  const value = node.attrs.value as string
  const { data, errors } = validateBlockYaml(blockType, value)

  return {
    type: blockType,
    data,
    source: {
      filePath: '',
      range: { startOffset: null, endOffset: null, startLine: null, endLine: null },
      raw: '',
    },
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * React NodeView for card-block nodes.
 *
 * Renders our existing CardRenderer inside the ProseMirror editor.
 * The card is fully interactive — checkboxes, dropdowns, text fields
 * all work. Events propagate up via the onEdit handler.
 *
 * stopEvent: () => true prevents ProseMirror from intercepting
 * clicks and keypresses inside the card widget.
 */
export const cardBlockView = $view(cardBlockSchema.node, (_ctx: Ctx): NodeViewConstructor => {
  return (node, view, getPos) => {
    const dom = document.createElement('div')
    dom.classList.add('card-block-node-view')
    dom.setAttribute('data-card-type', node.attrs.blockType as string)

    let reactRoot: Root | null = null

    const render = (pmNode: PmNode) => {
      const block = buildBlockInstance(pmNode)
      const { theme, onEdit } = cardViewConfig

      // Wrap onEdit to inject block identity so the host can match the
      // correct block when multiple blocks of the same type exist.
      const blockDataId = (block.data as Record<string, unknown> | null)?.id
      const wrappedOnEdit = onEdit
        ? (event: BlockEditEvent) => {
            // Compute positional index: count how many card-block nodes
            // of this type appear before this one in the document.
            let blockIndex = 0
            const pos = typeof getPos === 'function' ? getPos() : undefined
            if (typeof pos === 'number') {
              view.state.doc.nodesBetween(0, pos, (n) => {
                if (n.type.name === 'card-block' && n.attrs.blockType === block.type) {
                  blockIndex++
                }
              })
            }
            onEdit({
              ...event,
              blockId: blockDataId != null ? String(blockDataId) : undefined,
              blockIndex,
            })
          }
        : undefined

      const cardEl = createElement(CardRenderer, {
        block,
        detail: 'full',
        context: 'card',
        onEdit: wrappedOnEdit,
      })
      const element = theme
        ? createElement(CardThemeProvider, { theme, children: cardEl })
        : cardEl

      if (!reactRoot) {
        reactRoot = createRoot(dom)
      }
      reactRoot.render(element)
    }

    let currentNode = node
    render(currentNode)

    // Track this NodeView so the editor can re-render all cards on theme change
    const rerender = () => render(currentNode)
    activeCardRenders.add(rerender)

    return {
      dom,
      update(updatedNode) {
        if (updatedNode.type.name !== 'card-block') return false
        currentNode = updatedNode
        render(updatedNode)
        return true
      },
      stopEvent: () => true,
      ignoreMutation: () => true,
      selectNode() {
        dom.classList.add('ProseMirror-selectednode')
      },
      deselectNode() {
        dom.classList.remove('ProseMirror-selectednode')
      },
      destroy() {
        activeCardRenders.delete(rerender)
        if (reactRoot) {
          const root = reactRoot
          reactRoot = null
          setTimeout(() => root.unmount(), 0)
        }
      },
    }
  }
})
