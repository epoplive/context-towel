// ============================================================================
// Built-in Parser Plugins
// ============================================================================
//
// Re-exports all 7 built-in parser plugins and provides registerBuiltinParsers()
// which wires them all into a FileParserService instance.
//
// Usage:
//   import { FileParserService } from '@context-towel/parser'
//   import { registerBuiltinParsers } from '@context-towel/parser/plugins'
//
//   const service = new FileParserService(myFileSystem)
//   registerBuiltinParsers(service)

import type { FileParserService } from '../service'
import type { ParserPlugin } from '../types'
import { taskParserPlugin } from './task'
import { checklistParserPlugin } from './checklist'
import { diagramParserPlugin } from './diagram'
import { tocParserPlugin } from './toc'
import { logParserPlugin } from './log'
import { linkParserPlugin } from './link'
import { blockParserPlugin } from './block'

// Re-export individual plugins for consumers that want to cherry-pick
export { taskParserPlugin, detectTasks, parseTasks } from './task'
export { checklistParserPlugin, detectChecklists, parseChecklists } from './checklist'
export { diagramParserPlugin, detectDiagrams, parseDiagrams } from './diagram'
export { tocParserPlugin, detectToc, parseToc } from './toc'
export { logParserPlugin, detectLogs, parseLogs } from './log'
export { linkParserPlugin, detectLinks, parseLinks } from './link'
export { blockParserPlugin, detectBlocks, parseBlocks } from './block'

// Re-export item types from plugin modules
export type { TaskItem } from './task'
export type { ChecklistGroup } from './checklist'
export type { DiagramItem } from './diagram'
export type { TocSection } from './toc'
export type { LogSection } from './log'
export type { LinkItem } from './link'
export type { BlockItem } from './block'

const ALL_PLUGINS: ParserPlugin[] = [
  taskParserPlugin as ParserPlugin,
  checklistParserPlugin as ParserPlugin,
  diagramParserPlugin as ParserPlugin,
  tocParserPlugin as ParserPlugin,
  logParserPlugin as ParserPlugin,
  linkParserPlugin as ParserPlugin,
  blockParserPlugin as ParserPlugin,
]

/**
 * Register all 7 built-in parser plugins with a FileParserService.
 * Already-registered plugins are skipped to make this safe to call multiple times.
 *
 * @param service  The FileParserService instance to register parsers with.
 */
export function registerBuiltinParsers(service: FileParserService): void {
  const registered = new Set(service.getParserIds())
  for (const plugin of ALL_PLUGINS) {
    if (!registered.has(plugin.id)) {
      service.registerParser(plugin)
    }
  }
}
