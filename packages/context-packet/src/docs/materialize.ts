// ============================================================================
// Materialize — Generate .context/docs/ from collapsed AICCL patterns
// ============================================================================

import type { PacketDatabase } from '../storage/PacketDatabase.js'
import type { FileService, PatternEntry } from '../types.js'

/**
 * Materialize all patterns from the database into .context/docs/ as
 * AICCL-first documentation, layered by zoom level.
 *
 * Directory structure mirrors the zoom model:
 * .context/docs/
 *   index.md                  # System-level overview (all subsystems)
 *   auth/
 *     index.md                # Auth subsystem patterns
 *   api/
 *     index.md                # API subsystem patterns
 */
export async function materializeDocs(
  db: PacketDatabase,
  contextDir: string,
  fs: FileService,
): Promise<void> {
  const patterns = await db.getAllPatterns()
  if (patterns.length === 0) return

  const docsDir = `${contextDir}/docs`
  await fs.mkdir(docsDir)

  // Group patterns by subsystem
  const bySubsystem = new Map<string, PatternEntry[]>()
  for (const p of patterns) {
    const group = bySubsystem.get(p.subsystem) ?? []
    group.push(p)
    bySubsystem.set(p.subsystem, group)
  }

  // Write root index with all subsystems listed
  const rootIndex = generateRootIndex(bySubsystem)
  await fs.write(`${docsDir}/index.md`, rootIndex)

  // Write per-subsystem index files
  for (const [subsystem, subPatterns] of bySubsystem) {
    const subDir = `${docsDir}/${subsystem}`
    await fs.mkdir(subDir)
    const subIndex = generateSubsystemIndex(subsystem, subPatterns)
    await fs.write(`${subDir}/index.md`, subIndex)
  }
}

/**
 * Generate the root index.md listing all subsystems with summary stats.
 */
export function generateRootIndex(bySubsystem: Map<string, PatternEntry[]>): string {
  const lines: string[] = []

  lines.push('# System Documentation')
  lines.push('')
  lines.push('Generated from collapsed AICCL patterns.')
  lines.push('')

  lines.push('## Subsystems')
  lines.push('')

  // Sort subsystems alphabetically for stable output
  const sorted = Array.from(bySubsystem.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  )

  for (const [subsystem, patterns] of sorted) {
    const avgConfidence =
      patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
    lines.push(
      `- [${subsystem}](${subsystem}/) -- ${patterns.length} pattern${patterns.length === 1 ? '' : 's'}, avg confidence ${avgConfidence.toFixed(1)}`,
    )
  }

  lines.push('')

  return lines.join('\n')
}

/**
 * Generate a subsystem index.md with all patterns as ~~~node blocks,
 * sorted by confidence descending.
 */
export function generateSubsystemIndex(
  subsystem: string,
  patterns: PatternEntry[],
): string {
  const lines: string[] = []

  lines.push(`# ${subsystem}`)
  lines.push('')
  lines.push('## Patterns')
  lines.push('')

  // Sort by confidence descending
  const sorted = [...patterns].sort((a, b) => b.confidence - a.confidence)

  for (const p of sorted) {
    lines.push('~~~node')
    lines.push(`id: ${p.id}`)
    lines.push(`subsystem: ${subsystem}`)
    lines.push(`confidence: ${p.confidence}`)
    lines.push(`source: ${p.sourcePacket}`)
    lines.push('---')
    lines.push(p.content)
    lines.push('~~~')
    lines.push('')
  }

  return lines.join('\n')
}
