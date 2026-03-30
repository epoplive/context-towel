// ============================================================================
// Render — Patterns to human-readable documentation
// ============================================================================

import type { PatternEntry } from '../types.js'

/**
 * Render a single pattern into human-readable documentation.
 */
export function renderPatternAsHuman(pattern: PatternEntry): string {
  const lines: string[] = []

  lines.push(`## ${pattern.subsystem}`)
  lines.push('')
  lines.push(`**Source:** ${pattern.sourcePacket}`)
  lines.push(`**Confidence:** ${pattern.confidence} validation${pattern.confidence === 1 ? '' : 's'}`)
  lines.push(`**Last updated:** ${new Date(pattern.updatedAt).toISOString().slice(0, 19).replace('T', ' ')}`)
  lines.push('')

  lines.push('### Content')
  lines.push('')
  lines.push('```')
  lines.push(pattern.content)
  lines.push('```')
  lines.push('')

  return lines.join('\n')
}

/**
 * Render patterns for a subsystem in raw or human format.
 */
export function renderSubsystemDocs(
  subsystem: string,
  patterns: PatternEntry[],
  format: 'raw' | 'human' = 'raw',
): string {
  if (patterns.length === 0) return ''

  if (format === 'human') {
    return patterns.map(renderPatternAsHuman).join('\n\n---\n\n')
  }

  // Raw format: patterns in ~~~node blocks
  return patterns
    .map((p) => {
      return `~~~node\nid: ${p.id}\nsubsystem: ${subsystem}\n---\n${p.content}\n~~~`
    })
    .join('\n\n')
}
