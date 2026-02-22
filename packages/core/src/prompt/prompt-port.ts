/**
 * PromptManager - Implements PromptManagementPort.
 *
 * This is the main entry point for the prompt subsystem. It wraps
 * PromptBlockStateManager and PromptComposer behind the unified
 * PromptManagementPort interface defined in @dm/felix-runtime.
 *
 * Usage:
 *   const manager = new PromptManager()
 *   manager.loadBlock('identity', 'You are a helpful assistant.', { priority: 'system' })
 *   manager.loadBlock('tools', 'Available tools: search, calculator', { priority: 'high' })
 *   manager.loadBlock('rules', 'Always be concise.')
 *   const prompt = manager.assembleSystemPrompt()
 */

import type { BlockOptions, PromptBlock, PromptManagementPort } from './types.js'
import { PromptBlockStateManager } from './prompt-block-state.js'
import { PromptComposer } from './prompt-composition.js'

export class PromptManager implements PromptManagementPort {
  private readonly stateManager: PromptBlockStateManager
  private readonly composer: PromptComposer

  constructor() {
    this.stateManager = new PromptBlockStateManager()
    this.composer = new PromptComposer(this.stateManager)
  }

  /**
   * Add or replace a prompt block.
   *
   * If a block with the same id already exists, it is replaced entirely
   * (decorator pattern). The old content is discarded.
   */
  loadBlock(id: string, content: string, options?: BlockOptions): void {
    this.stateManager.loadBlock(id, content, options)
  }

  /**
   * Remove a block by id. No-op if the block does not exist.
   */
  clearBlock(id: string): void {
    this.stateManager.clearBlock(id)
  }

  /**
   * Update the content of an existing block without changing its options.
   *
   * No-op if the block has not been loaded yet.
   */
  refreshBlock(id: string, content: string): void {
    this.stateManager.refreshBlock(id, content)
  }

  /**
   * Return all blocks sorted by priority (system > high > normal > low).
   */
  getBlocks(): PromptBlock[] {
    return this.stateManager.getBlocks()
  }

  /**
   * Assemble all blocks into a single system prompt string.
   *
   * Blocks are sorted by priority, trimmed, and joined with double newlines.
   */
  assembleSystemPrompt(): string {
    return this.composer.assemble()
  }

  // ── Convenience accessors (not part of the port interface) ──

  /**
   * Look up a single block by id.
   */
  getBlock(id: string): PromptBlock | undefined {
    return this.stateManager.getBlock(id)
  }

  /**
   * Return the number of currently stored blocks.
   */
  get blockCount(): number {
    return this.stateManager.size
  }

  /**
   * Remove all blocks.
   */
  clearAll(): void {
    this.stateManager.clear()
  }
}
