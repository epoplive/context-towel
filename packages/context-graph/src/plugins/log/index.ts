// ============================================================================
// Log Plugin - Parses work log entries
// ============================================================================

import { ParserPlugin, ContextOptions } from '../types'
import { LogSection } from './types'
import { detectLogs, parseLogs } from './parser'

export * from './types'
export { parseLogs, detectLogs } from './parser'

export const logPlugin: ParserPlugin<LogSection> = {
  id: 'log',
  name: 'Work Log',
  version: '1.0.0',
  priority: 60,

  detect: detectLogs,
  parse: parseLogs,

  supportedContexts: ['graph-node', 'panel', 'popover', 'inline'],
  nodeType: 'log',

  getComponent: (_context) => {
    return null  // Components will be implemented later
  },

  toContextMarkdown: (items: LogSection[], options?: ContextOptions) => {
    if (items.length === 0) return ''

    const lines: string[] = ['### Recent Activity']

    for (const section of items) {
      // Show recent entries (last 5 by default)
      const maxEntries = options?.maxItems ?? 5
      const recentEntries = section.entries.slice(-maxEntries)

      for (const entry of recentEntries) {
        let line = `- [${entry.timestamp}] ${entry.action}`
        if (entry.result) line += ` → ${entry.result}`
        if (entry.next) line += ` (next: ${entry.next})`
        lines.push(line)
      }

      if (options?.includeSource && section.sourceLine) {
        lines.push(`*Source: ${section.sourceFile}:${section.sourceLine}*`)
      }
    }

    return lines.join('\n')
  }
}
