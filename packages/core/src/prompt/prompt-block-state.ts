/**
 * PromptBlockStateManager - Core block state management.
 *
 * Manages the lifecycle of prompt blocks: load, clear, refresh, and retrieval.
 * Blocks are stored in a Map keyed by their unique ID. When a block is loaded
 * with an ID that already exists, it replaces the previous block (decorator
 * pattern) - the old content is discarded so the context never bloats with
 * stale copies.
 */

import {
  type BlockOptions,
  type PromptBlock,
  type PromptBlockPriority,
  PRIORITY_WEIGHTS,
} from './types.js'

export class PromptBlockStateManager {
  private blocks: Map<string, PromptBlock> = new Map()

  /**
   * Add or replace a prompt block.
   *
   * If a block with the same ID already exists it is fully replaced (decorator
   * semantics). The old content is NOT preserved; callers that want to merge
   * should do so before calling loadBlock.
   *
   * @param id      Unique block identifier.
   * @param content Textual content of the block.
   * @param options Optional settings (priority, deduplicate, maxTokens).
   * @throws Error if id is empty or content is empty.
   */
  loadBlock(id: string, content: string, options?: BlockOptions): void {
    if (!id || !id.trim()) {
      throw new Error('Block id must be a non-empty string')
    }
    if (!content || !content.trim()) {
      throw new Error(`Block "${id}" content must be a non-empty string`)
    }

    const priority: PromptBlockPriority = options?.priority ?? 'normal'
    const block: PromptBlock = {
      id: id.trim(),
      content,
      priority,
      addedAt: new Date().toISOString(),
      options,
    }

    this.blocks.set(block.id, block)
  }

  /**
   * Remove a block by ID.
   *
   * No-op if the block does not exist. This is intentional: callers should
   * not need to guard against clearing a block that was never loaded.
   *
   * @param id Block identifier to remove.
   */
  clearBlock(id: string): void {
    this.blocks.delete(id)
  }

  /**
   * Update the content of an existing block without changing its options.
   *
   * If the block does not exist, this is a no-op (the block was never loaded
   * so there is nothing to refresh). This avoids forcing callers to track
   * which blocks have been loaded.
   *
   * The addedAt timestamp is updated to the current time.
   *
   * @param id      Block identifier.
   * @param content New content for the block.
   * @throws Error if content is empty.
   */
  refreshBlock(id: string, content: string): void {
    const existing = this.blocks.get(id)
    if (!existing) {
      return
    }

    if (!content || !content.trim()) {
      throw new Error(`Refresh content for block "${id}" must be a non-empty string`)
    }

    const updated: PromptBlock = {
      ...existing,
      content,
      addedAt: new Date().toISOString(),
    }

    this.blocks.set(id, updated)
  }

  /**
   * Return all blocks sorted by priority (system > high > normal > low).
   *
   * Within the same priority tier, blocks are returned in insertion order
   * (Map iteration order in ES2015+).
   */
  getBlocks(): PromptBlock[] {
    const all = Array.from(this.blocks.values())
    return all.sort(
      (a, b) => PRIORITY_WEIGHTS[a.priority] - PRIORITY_WEIGHTS[b.priority],
    )
  }

  /**
   * Look up a single block by ID.
   *
   * @returns The block, or undefined if not found.
   */
  getBlock(id: string): PromptBlock | undefined {
    return this.blocks.get(id)
  }

  /**
   * Return the number of currently stored blocks.
   */
  get size(): number {
    return this.blocks.size
  }

  /**
   * Remove all blocks.
   */
  clear(): void {
    this.blocks.clear()
  }
}
