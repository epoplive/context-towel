// ============================================================================
// Render — AICCL patterns to human-readable documentation
// ============================================================================

import type { PatternEntry } from '../types.js'

/**
 * Symbol map for AICCL notation to human-readable interpretation.
 */
const SYMBOL_MAP: Array<[RegExp, string]> = [
  [/\u2192/g, 'leads to'],       // →
  [/\u2200/g, 'for all'],        // ∀
  [/\u2203/g, 'there exists'],   // ∃
  [/\u2228/g, 'or'],             // ∨
  [/\u2227/g, 'and'],            // ∧
  [/\uD83D\uDC80/g, '[FAILED APPROACH]'],  // 💀
  [/\u2713/g, '[PROVEN APPROACH]'],         // ✓
  [/\u22A5/g, '[FAILURE/ERROR STATE]'],     // ⊥
]

/**
 * Render a single AICCL pattern into human-readable documentation.
 * This is a downstream view -- AICCL is the source, human docs are generated.
 */
export function renderPatternAsHuman(pattern: PatternEntry): string {
  const lines: string[] = []

  lines.push(`## ${pattern.subsystem}`)
  lines.push('')
  lines.push(`**Source:** ${pattern.sourcePacket}`)
  lines.push(`**Confidence:** ${pattern.confidence} validation${pattern.confidence === 1 ? '' : 's'}`)
  lines.push(`**Last updated:** ${new Date(pattern.updatedAt).toISOString().slice(0, 19).replace('T', ' ')}`)
  lines.push('')

  lines.push('### Logic')
  lines.push('')
  lines.push('```')
  lines.push(pattern.content)
  lines.push('```')
  lines.push('')

  lines.push('### Interpretation')
  lines.push('')
  const interpretation = interpretAICCL(pattern.content)
  lines.push(interpretation)

  return lines.join('\n')
}

/**
 * Render patterns for a subsystem in either AICCL or human format.
 */
export function renderSubsystemDocs(
  subsystem: string,
  patterns: PatternEntry[],
  format: 'aiccl' | 'human' = 'aiccl',
): string {
  if (patterns.length === 0) return ''

  if (format === 'human') {
    return patterns.map(renderPatternAsHuman).join('\n\n---\n\n')
  }

  // AICCL format: raw patterns in ~~~node blocks
  return patterns
    .map((p) => {
      return `~~~node\nid: ${p.id}\nsubsystem: ${subsystem}\n---\n${p.content}\n~~~`
    })
    .join('\n\n')
}

/**
 * Best-effort interpretation of AICCL content into plain English.
 * Replaces known symbols and describes relationships found in the content.
 */
function interpretAICCL(content: string): string {
  let interpreted = content

  for (const [pattern, replacement] of SYMBOL_MAP) {
    interpreted = interpreted.replace(pattern, replacement)
  }

  // Split into lines and describe each non-empty line
  const descriptions: string[] = []
  const contentLines = interpreted.split('\n').filter((l) => l.trim().length > 0)

  for (const line of contentLines) {
    descriptions.push(`- ${line.trim()}`)
  }

  if (descriptions.length === 0) {
    return '(empty pattern)'
  }

  return descriptions.join('\n')
}
