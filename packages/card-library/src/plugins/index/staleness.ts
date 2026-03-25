// Reference Staleness Detection & Auto-Updating
// Checks index references against the actual codebase and reports/fixes stale refs.

import type { EntityEntry, EntityRegistryData, FileRef } from './types'
import type { FileReader } from './resolver'
import type { PipelineEntry } from './types'

/** Result of checking a single reference */
export interface RefCheck {
  /** The entity that contains this reference */
  entityId: string
  /** The file reference being checked */
  ref: FileRef
  /** Check result */
  status: 'valid' | 'file-missing' | 'range-invalid' | 'content-changed'
  /** Human-readable detail */
  detail: string
  /** Content hash of the referenced range (if valid) */
  contentHash?: string
}

/** Full staleness report for an index */
export interface StalenessReport {
  /** Total references checked */
  totalChecked: number
  /** Valid references */
  valid: number
  /** Stale references by type */
  fileMissing: RefCheck[]
  rangeInvalid: RefCheck[]
  contentChanged: RefCheck[]
  /** Overall health score 0.0-1.0 */
  healthScore: number
}

/** Content hash for a range — used to detect content changes */
export interface ContentSnapshot {
  /** Entity ID + ref key */
  key: string
  /** Simple hash of the content at snapshot time */
  hash: string
  /** First line of content (for fuzzy matching) */
  firstLine: string
  /** Last line of content (for fuzzy matching) */
  lastLine: string
}

/**
 * Simple FNV-1a hash for content comparison.
 */
function hashContent(content: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * Check all references in an entity registry for staleness.
 * Reads files through the provided FileReader to verify references.
 */
export async function checkStaleness(
  registry: EntityRegistryData,
  reader: FileReader,
  snapshots?: Map<string, ContentSnapshot>,
): Promise<StalenessReport> {
  const checks: RefCheck[] = []
  const fileCache = new Map<string, string | null>()

  // Helper to read file with caching
  async function readFile(path: string): Promise<string | null> {
    if (fileCache.has(path)) return fileCache.get(path)!
    try {
      const content = await reader.read(path)
      fileCache.set(path, content)
      return content
    } catch {
      fileCache.set(path, null)
      return null
    }
  }

  for (const entity of registry.entities.values()) {
    // Check file refs
    for (const ref of entity.refs) {
      const check = await checkRef(entity, ref, registry, readFile, snapshots)
      checks.push(check)
    }

    // Check pipeline step file refs
    if (entity.type === 'pipeline') {
      const pe = entity as PipelineEntry
      for (const step of pe.steps) {
        const path = registry.files.get(step.fileId)
        if (!path) {
          checks.push({
            entityId: entity.id,
            ref: { fileId: step.fileId },
            status: 'file-missing',
            detail: `Pipeline step references unknown file ${step.fileId}`,
          })
          continue
        }
        const content = await readFile(path)
        if (content === null) {
          checks.push({
            entityId: entity.id,
            ref: { fileId: step.fileId },
            status: 'file-missing',
            detail: `File ${path} does not exist`,
          })
        }
      }
    }
  }

  // Also check FILE_PATHS entries themselves
  for (const [fileId, path] of registry.files) {
    const content = await readFile(path)
    if (content === null) {
      checks.push({
        entityId: fileId,
        ref: { fileId },
        status: 'file-missing',
        detail: `File ${path} does not exist`,
      })
    }
  }

  const valid = checks.filter(c => c.status === 'valid')
  const fileMissing = checks.filter(c => c.status === 'file-missing')
  const rangeInvalid = checks.filter(c => c.status === 'range-invalid')
  const contentChanged = checks.filter(c => c.status === 'content-changed')
  const total = checks.length
  const healthScore = total > 0 ? valid.length / total : 1.0

  return {
    totalChecked: total,
    valid: valid.length,
    fileMissing,
    rangeInvalid,
    contentChanged,
    healthScore,
  }
}

async function checkRef(
  entity: EntityEntry,
  ref: FileRef,
  registry: EntityRegistryData,
  readFile: (path: string) => Promise<string | null>,
  snapshots?: Map<string, ContentSnapshot>,
): Promise<RefCheck> {
  const path = registry.files.get(ref.fileId)
  if (!path) {
    return {
      entityId: entity.id,
      ref,
      status: 'file-missing',
      detail: `Unknown file ID ${ref.fileId}`,
    }
  }

  const content = await readFile(path)
  if (content === null) {
    return {
      entityId: entity.id,
      ref,
      status: 'file-missing',
      detail: `File ${path} does not exist`,
    }
  }

  // If no line range, just check file exists (already passed)
  if (ref.startLine === undefined) {
    return { entityId: entity.id, ref, status: 'valid', detail: 'File exists' }
  }

  const lines = content.split('\n')
  const startLine = ref.startLine
  const endLine = ref.endLine ?? startLine

  // Check line range validity
  if (startLine > lines.length || endLine > lines.length) {
    return {
      entityId: entity.id,
      ref,
      status: 'range-invalid',
      detail: `Lines ${startLine}-${endLine} exceed file length (${lines.length} lines)`,
    }
  }

  // Extract the referenced content
  const extracted = lines.slice(startLine - 1, endLine).join('\n')
  const hash = hashContent(extracted)

  // If we have a previous snapshot, check for content changes
  const snapshotKey = `${entity.id}:${ref.fileId}>${startLine}-${endLine}`
  if (snapshots) {
    const prev = snapshots.get(snapshotKey)
    if (prev && prev.hash !== hash) {
      return {
        entityId: entity.id,
        ref,
        status: 'content-changed',
        detail: `Content at ${ref.fileId}>${startLine}-${endLine} has changed since last snapshot`,
        contentHash: hash,
      }
    }
  }

  return {
    entityId: entity.id,
    ref,
    status: 'valid',
    detail: 'Reference valid',
    contentHash: hash,
  }
}

/**
 * Generate content snapshots for all references in a registry.
 * Used as the baseline for future staleness detection.
 */
export async function generateSnapshots(
  registry: EntityRegistryData,
  reader: FileReader,
): Promise<Map<string, ContentSnapshot>> {
  const snapshots = new Map<string, ContentSnapshot>()
  const fileCache = new Map<string, string | null>()

  async function readFile(path: string): Promise<string | null> {
    if (fileCache.has(path)) return fileCache.get(path)!
    try {
      const content = await reader.read(path)
      fileCache.set(path, content)
      return content
    } catch {
      fileCache.set(path, null)
      return null
    }
  }

  for (const entity of registry.entities.values()) {
    for (const ref of entity.refs) {
      if (ref.startLine === undefined) continue
      const path = registry.files.get(ref.fileId)
      if (!path) continue
      const content = await readFile(path)
      if (!content) continue

      const lines = content.split('\n')
      const startLine = ref.startLine
      const endLine = ref.endLine ?? startLine
      if (startLine > lines.length) continue

      const clampedEnd = Math.min(endLine, lines.length)
      const extracted = lines.slice(startLine - 1, clampedEnd)
      const key = `${entity.id}:${ref.fileId}>${startLine}-${endLine}`

      snapshots.set(key, {
        key,
        hash: hashContent(extracted.join('\n')),
        firstLine: extracted[0]?.trim() || '',
        lastLine: extracted[extracted.length - 1]?.trim() || '',
      })
    }
  }

  return snapshots
}

/**
 * Format a staleness report as human-readable text.
 */
export function formatStalenessReport(report: StalenessReport): string {
  const lines: string[] = [
    `## Index Staleness Report`,
    '',
    `Health: ${(report.healthScore * 100).toFixed(0)}% (${report.valid}/${report.totalChecked} valid)`,
  ]

  if (report.fileMissing.length > 0) {
    lines.push('', `### Missing Files (${report.fileMissing.length})`)
    for (const check of report.fileMissing) {
      lines.push(`- ${check.entityId}: ${check.detail}`)
    }
  }

  if (report.rangeInvalid.length > 0) {
    lines.push('', `### Invalid Line Ranges (${report.rangeInvalid.length})`)
    for (const check of report.rangeInvalid) {
      lines.push(`- ${check.entityId}: ${check.detail}`)
    }
  }

  if (report.contentChanged.length > 0) {
    lines.push('', `### Content Changed (${report.contentChanged.length})`)
    for (const check of report.contentChanged) {
      lines.push(`- ${check.entityId}: ${check.detail}`)
    }
  }

  if (report.fileMissing.length === 0 && report.rangeInvalid.length === 0 && report.contentChanged.length === 0) {
    lines.push('', 'All references are valid.')
  }

  return lines.join('\n')
}
