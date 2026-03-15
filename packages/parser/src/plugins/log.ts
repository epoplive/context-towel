// ============================================================================
// Log Parser Plugin
// ============================================================================
//
// Parses ### Log sections containing timestamped work log entries.
// Extracted from context-graph's plugins/log/parser.ts.

import type { ParseResult } from '../types'
import type { LogSection } from '../types'

// -------------------------------------------------------------------------- //
// Public API
// -------------------------------------------------------------------------- //

export function detectLogs(content: string): boolean {
  return /###\s+Log\b/mi.test(content) || /^[-*]\s*\[\d{4}-\d{2}-\d{2}/m.test(content)
}

export function parseLogs(content: string, sourceFile: string): ParseResult<LogSection> {
  const items: LogSection[] = []
  const rawMatches: ParseResult['rawMatches'] = []

  // Find ### Log sections
  const logSectionRegex = /###\s+Log\s*\n([\s\S]*?)(?=\n##|\n###(?!\s+Log)|$)/gi
  let match: RegExpExecArray | null

  while ((match = logSectionRegex.exec(content)) !== null) {
    const sectionContent = match[1]
    const entries: LogSection['entries'] = []

    // Parse log entries: - [YYYY-MM-DD HH:MM] action text
    const entryRegex = /^[-*]\s*\[([^\]]+)\]\s*(.+)$/gm
    let entryMatch: RegExpExecArray | null

    while ((entryMatch = entryRegex.exec(sectionContent)) !== null) {
      const timestamp = entryMatch[1].trim()
      const entryText = entryMatch[2].trim()

      // Structured entry: action | result | next
      const parts = entryText.split('|').map((p) => p.trim())

      entries.push({
        timestamp,
        action: parts[0] || entryText,
        result: parts[1],
        next: parts[2],
      })
    }

    if (entries.length > 0) {
      const beforeMatch = content.slice(0, match.index)
      const startLine = beforeMatch.split('\n').length

      items.push({
        id: `log-${items.length}`,
        sourceFile,
        sourceLine: startLine,
        title: 'Log',
        entries,
      })

      rawMatches!.push({
        start: match.index,
        end: match.index + match[0].length,
        startLine,
        endLine: startLine + match[0].split('\n').length,
        content: match[0],
      })
    }
  }

  return { pluginId: 'log', items, rawMatches }
}

/** ParserPlugin descriptor for FileParserService registration */
export const logParserPlugin = {
  id: 'log',
  extensions: ['.md', '.markdown'],
  detect: detectLogs,
  parse: parseLogs,
}

export type { LogSection }
