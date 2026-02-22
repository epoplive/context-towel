/**
 * Prompt block types.
 *
 * These types mirror the PromptManagementPort contract from @dm/felix-runtime
 * so that the implementation is structurally compatible without requiring the
 * peer dependency at compile time.
 */

/** Priority levels for prompt blocks, from highest to lowest. */
export type PromptBlockPriority = 'system' | 'high' | 'normal' | 'low'

/** Options that control how a block is stored and composed. */
export type BlockOptions = {
  /** Block priority. Defaults to 'normal'. */
  priority?: PromptBlockPriority
  /** When true, duplicate content is suppressed during composition. */
  deduplicate?: boolean
  /** Maximum token budget for this block (advisory; not enforced by the state manager). */
  maxTokens?: number
}

/** A single prompt block stored in the state manager. */
export type PromptBlock = {
  /** Unique identifier for this block. */
  id: string
  /** The textual content of the block. */
  content: string
  /** Resolved priority (always present after storage). */
  priority: PromptBlockPriority
  /** ISO-8601 timestamp of when the block was added or last refreshed. */
  addedAt: string
  /** Original options passed at load time. */
  options?: BlockOptions
}

/**
 * The port interface that matches @dm/felix-runtime PromptManagementPort.
 *
 * Any class implementing this interface is a drop-in replacement for the
 * felix-runtime port.
 */
export interface PromptManagementPort {
  loadBlock(id: string, content: string, options?: BlockOptions): void
  clearBlock(id: string): void
  refreshBlock(id: string, content: string): void
  getBlocks(): PromptBlock[]
  assembleSystemPrompt(): string
}

/**
 * Numeric weights used to sort blocks by priority.
 * Lower weight = earlier in the composed prompt.
 */
export const PRIORITY_WEIGHTS: Record<PromptBlockPriority, number> = {
  system: 0,
  high: 1,
  normal: 2,
  low: 3,
} as const
