/**
 * Bridge between context-graph plugins and card-library block definitions.
 *
 * The context-graph has its own plugin system (task, checklist, diagram, etc.)
 * with graph-specific components (React Flow nodes, boards, dependency views).
 *
 * The card-library has portable components (TaskCard, ChecklistCard, etc.)
 * that work anywhere.
 *
 * This bridge registers the card-library plugins and provides utilities
 * for graph nodes to delegate rendering when appropriate.
 */

import {
  registerAllCardPlugins,
  blockRegistry,
  type BlockInstance,
  type DetailLevel,
  type ThemeTokens,
} from '@context-towel/card-library'

let initialized = false

/**
 * Initialize card library plugins.
 * Safe to call multiple times.
 */
export function initCardLibrary(): void {
  if (initialized) return
  registerAllCardPlugins()
  initialized = true
}

/**
 * Check if a block type has a card-library renderer registered.
 */
export function hasCardRenderer(blockType: string): boolean {
  const def = blockRegistry.get(blockType)
  return def?.components != null
}

/**
 * Get the card-library component for a block type and context.
 */
export function getCardComponent(
  blockType: string,
  context: 'inline' | 'card' | 'node' = 'card'
) {
  const def = blockRegistry.get(blockType)
  if (!def?.components) return null
  return def.components[context] ?? def.components.card ?? def.components.inline ?? null
}

export { blockRegistry }
export type { BlockInstance, DetailLevel, ThemeTokens }
