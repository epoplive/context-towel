// ============================================================================
// Log Plugin Parser - Parses work log entries
// ============================================================================

import { ParseResult, SourceMatch } from '../../types'
import { LogSection, LogEntry } from './types'

/**
 * Detect if content contains log sections
 */
export function detectLogs(content: string): boolean {
  // Look for ### Log sections or timestamped entries
  return /###\s+Log\b/mi.test(content) || /^[-*]\s*\[\d{4}-\d{2}-\d{2}/m.test(content)
}

/**
 * Parse log sections from markdown
 */
export function parseLogs(content: string, sourceFile: string): ParseResult<LogSection> {
  const items: LogSection[] = []
  const rawMatches: SourceMatch[] = []

  // Find ### Log sections
  const logSectionRegex = /###\s+Log\s*\n([\s\S]*?)(?=\n##|\n###(?!\s+Log)|$)/gi
  let match

  while ((match = logSectionRegex.exec(content)) !== null) {
    const sectionContent = match[1]
    const entries: LogEntry[] = []

    // Parse log entries: - [YYYY-MM-DD HH:MM] action text
    const entryRegex = /^[-*]\s*\[([^\]]+)\]\s*(.+)$/gm
    let entryMatch

    while ((entryMatch = entryRegex.exec(sectionContent)) !== null) {
      const timestamp = entryMatch[1].trim()
      const entryText = entryMatch[2].trim()

      // Try to parse structured entry: action | result | next
      const parts = entryText.split('|').map(p => p.trim())

      entries.push({
        timestamp,
        action: parts[0] || entryText,
        result: parts[1],
        next: parts[2]
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
        entries
      })

      rawMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        startLine,
        endLine: startLine + match[0].split('\n').length,
        content: match[0]
      })
    }
  }

  return {
    pluginId: 'log',
    items,
    rawMatches
  }
}
