/**
 * FileParserService Adapter for Context Graph Plugins
 *
 * This adapter bridges the existing context-graph plugin system
 * to the centralized FileParserService, enabling:
 * - Centralized file watching (no duplicate watchers)
 * - LRU caching of parsed results
 * - Subscription-based reactive updates via useFileParsing hook
 *
 * IMPORTANT: This file uses DYNAMIC IMPORT for plugins/index.ts
 * to avoid circular dependencies. The cycle is:
 *   plugins/index.ts → task/index.ts → task/components.tsx → useGraphStore → store.ts
 *
 * By using dynamic import, we load the full plugins (with components) at runtime,
 * AFTER the store is already initialized, breaking the cycle.
 *
 * Usage:
 *   import { registerContextGraphParsers } from './fileParserAdapter'
 *   await registerContextGraphParsers() // Call once at app startup
 *
 *   // Then use the hook:
 *   const { items: tasks } = useFileParsing<TaskItem>('task', '/project/.context')
 */

import { fileParserService, type ParserPlugin as FileParserPlugin } from '../compat/services'

// Import parsers directly - these don't import components, so no cycle
import { detectTasks, parseTasks } from './task/parser'
import { detectChecklists, parseChecklists } from './checklist/parser'
import { detectDiagrams, parseDiagrams } from './diagram/parser'
import { detectToc, parseToc } from './toc/parser'
import { detectLogs as detectLog, parseLogs as parseLog } from './log/parser'
import { detectLinks, parseLinks } from './link/parser'
import { detectBlocks, parseBlocks } from './block/parser'
// Note: rich "block" parsing is handled via card-library's fenced YAML blocks.

let pluginsRegistered = false

/**
 * Register all context-graph parsers with FileParserService.
 * Also dynamically imports and registers full plugins with pluginRegistry
 * (including components for card rendering).
 *
 * Uses dynamic import to avoid circular dependency - the full plugins
 * are loaded at runtime after the store is initialized.
 */
export async function registerContextGraphParsers(): Promise<void> {
  // Register with FileParserService (for useFileParsing hook)
  const parsers: Array<FileParserPlugin<any>> = [
    {
      id: 'task',
      detect: detectTasks,
      parse: parseTasks,
      extensions: ['.md', '.markdown'],
    },
    {
      id: 'checklist',
      detect: detectChecklists,
      parse: parseChecklists,
      extensions: ['.md', '.markdown'],
    },
    {
      id: 'diagram',
      detect: detectDiagrams,
      parse: parseDiagrams,
      extensions: ['.md', '.markdown'],
    },
    {
      id: 'toc',
      detect: detectToc,
      parse: parseToc,
      extensions: ['.md', '.markdown'],
    },
    {
      id: 'log',
      detect: detectLog,
      parse: parseLog,
      extensions: ['.md', '.markdown'],
    },
    {
      id: 'link',
      detect: detectLinks,
      parse: parseLinks,
      extensions: ['.md', '.markdown', '.mdx'],
    },
    {
      id: 'block',
      detect: detectBlocks,
      parse: parseBlocks,
      extensions: ['.md', '.markdown', '.mdx'],
    },
  ]

  for (const parser of parsers) {
    if (!fileParserService.getParserIds().includes(parser.id)) {
      fileParserService.registerParser(parser)
    }
  }

  // Register full plugins with pluginRegistry (with components for card rendering)
  // Uses dynamic import to break the circular dependency
  if (!pluginsRegistered) {
    pluginsRegistered = true
    const { registerBuiltinPlugins } = await import('./index')
    registerBuiltinPlugins()
  }
}

/**
 * Unregister context-graph parsers from FileParserService
 * (mostly useful for testing)
 */
export async function unregisterContextGraphParsers(): Promise<void> {
  const { pluginRegistry } = await import('./registry')
  const plugins = pluginRegistry.all()

  for (const plugin of plugins) {
    if (fileParserService.getParserIds().includes(plugin.id)) {
      fileParserService.unregisterParser(plugin.id)
    }
  }
  pluginsRegistered = false
}

/**
 * Get all registered context-graph parser IDs
 */
export async function getContextGraphParserIds(): Promise<string[]> {
  const { pluginRegistry } = await import('./registry')
  return pluginRegistry.all().map((p) => p.id)
}
