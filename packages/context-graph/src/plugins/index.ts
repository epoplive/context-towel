// ============================================================================
// Plugin System - Main entry point
// ============================================================================

// Export types
export * from './types'
export { pluginRegistry } from './registry'

// Export individual plugins
export { taskPlugin } from './task'
export { checklistPlugin } from './checklist'
export { diagramPlugin } from './diagram'
export { nodePlugin } from './node'
export { tocPlugin } from './toc'
export { logPlugin } from './log'
export { linkPlugin } from './link'
export { blockPlugin } from './block'
export type { BlockItem } from './block/types'
export { entityIndexPlugin } from './entity-index'
export type { IndexEntityItem } from './entity-index'
export { IndexEntityNode } from './entity-index'
export type { IndexEntityNodeData } from './entity-index'

// Re-export plugin types for convenience
export type { TaskItem, TaskStatus, TaskPriority, ChecklistItem } from './task'
export { getStatusColor, getPriorityColor } from './task'
export type { ChecklistGroup } from './checklist'
export type { DiagramItem } from './diagram'
export { getDiagramTypeColor } from './diagram'
export type { NodeItem, NodeState } from './node'
export { getNodeStateColor } from './node'
export type { TocSection } from './toc'
export type { LogSection, LogEntry } from './log'
export type { LinkItem, LinkKind } from './link'

// Re-export components
export { InlineTaskCard, DetailedTaskCard, TaskNode, FullTaskNode, TaskListNode } from './task'
export type { TaskNodeData, FullTaskNodeData, TaskListNodeData } from './task'
export { ChecklistNode } from './checklist'
export type { ChecklistNodeData } from './checklist'
export { DiagramNode } from './diagram'
export type { DiagramNodeData } from './diagram'
export { NodeNode } from './node'
export type { NodeNodeData } from './node'
export { TOCNode } from './toc'
export type { TOCNodeData, TOCSectionItem } from './toc'

// Import registry and plugins for registration
import { pluginRegistry } from './registry'
import { taskPlugin } from './task'
import { checklistPlugin } from './checklist'
import { diagramPlugin } from './diagram'
import { nodePlugin } from './node'
import { tocPlugin } from './toc'
import { logPlugin } from './log'
import { linkPlugin } from './link'
import { blockPlugin } from './block'
import { entityIndexPlugin } from './entity-index'
import { registerCoreBlocks } from '@context-towel/card-library'

/**
 * Register all built-in plugins.
 * Call this once at app startup.
 */
export function registerBuiltinPlugins(): void {
  registerCoreBlocks()
  // Register in priority order (higher priority first)
  pluginRegistry.register(taskPlugin)
  pluginRegistry.register(tocPlugin)
  pluginRegistry.register(checklistPlugin)
  pluginRegistry.register(diagramPlugin)
  pluginRegistry.register(nodePlugin)
  pluginRegistry.register(logPlugin)
  pluginRegistry.register(linkPlugin)
  pluginRegistry.register(blockPlugin)
  pluginRegistry.register(entityIndexPlugin)
}

/**
 * Parse content through all registered plugins
 */
export function parseDocument(content: string, sourceFile: string) {
  return pluginRegistry.parseAll(content, sourceFile)
}

/**
 * Generate context markdown from parse results
 */
export function toContextMarkdown(
  results: ReturnType<typeof parseDocument>,
  options?: import('./types').ContextOptions
) {
  return pluginRegistry.toContextMarkdown(results, options)
}
