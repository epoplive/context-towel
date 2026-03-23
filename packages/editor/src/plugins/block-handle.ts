import { block, BlockProvider } from '@milkdown/plugin-block'
import type { Ctx } from '@milkdown/ctx'

/**
 * Block drag-and-drop plugin.
 *
 * Shows a drag handle on the left side of any block-level element
 * (paragraphs, headings, card blocks, code blocks, etc.).
 * Users can drag blocks to reorder them.
 *
 * The BlockProvider binds to the BlockService (inside the block ProseMirror
 * plugin) which sends show/hide messages on pointermove. The provider
 * positions the handle via floating-ui and toggles data-show.
 */

export { block as blockPlugin }

/**
 * Initialize the BlockProvider after the editor mounts.
 * Call update() once to trigger the deferred init.
 * Returns a cleanup function.
 */
export function setupBlockHandle(ctx: Ctx): () => void {
  const handle = document.createElement('div')
  handle.classList.add('context-towel-block-handle')
  handle.innerHTML = '⠿'

  const provider = new BlockProvider({ ctx, content: handle })
  // update() uses rAF internally and only initializes once
  provider.update()

  return () => {
    provider.destroy()
  }
}
