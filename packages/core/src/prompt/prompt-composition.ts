/**
 * PromptComposer - Assembles system prompt from ordered blocks.
 *
 * Takes a PromptBlockStateManager and concatenates all blocks in priority
 * order into a single system prompt string.
 *
 * Features:
 *   - Blocks sorted by priority: system > high > normal > low
 *   - Optional deduplication: blocks with `deduplicate: true` suppress
 *     identical content that has already been emitted
 *   - Clean separator between blocks (double newline)
 *   - Empty blocks are silently skipped
 */

import type { PromptBlockStateManager } from './prompt-block-state.js'

export class PromptComposer {
  constructor(private readonly stateManager: PromptBlockStateManager) {}

  /**
   * Assemble all stored blocks into a single system prompt string.
   *
   * Blocks are sorted by priority, their content trimmed, and joined with
   * double newlines. Blocks whose trimmed content is empty are excluded.
   *
   * When a block has `deduplicate: true`, its content is compared against
   * all previously emitted content. If an exact match is found the block
   * is skipped.
   */
  assemble(): string {
    const blocks = this.stateManager.getBlocks()
    const seenContent = new Set<string>()
    const parts: string[] = []

    for (const block of blocks) {
      const trimmed = block.content.trim()
      if (!trimmed) {
        continue
      }

      if (block.options?.deduplicate) {
        if (seenContent.has(trimmed)) {
          continue
        }
      }

      seenContent.add(trimmed)
      parts.push(trimmed)
    }

    return parts.join('\n\n')
  }
}
