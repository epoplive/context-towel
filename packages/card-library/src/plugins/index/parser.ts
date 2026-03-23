// Entity Registry Parser — parses CodeIndexer-style index blocks
// Handles: FILE_PATHS, SYSTEMS, CRITICAL_INTERFACES, PROBLEM_AREAS,
// PIPELINE_FLOWS, CODE_SNIPPETS, DOCS_SECTIONS, CONTEXT_LINKS

import type {
  ContextLinkEntry,
  EntityEntry,
  EntityRegistryData,
  EntityType,
  FileEntry,
  IndexBlockData,
  IndexSection,
  PipelineEntry,
  PipelineStep,
} from './types'
import { parseEntityId, parseFileRef } from './types'

/** Section header → entity type mapping */
const SECTION_TYPES: Record<string, EntityType> = {
  FILE_PATHS: 'file',
  SYSTEMS: 'system',
  CRITICAL_INTERFACES: 'interface',
  INTERFACES: 'interface',
  PROBLEM_AREAS: 'problem',
  PROBLEMS: 'problem',
  PIPELINE_FLOWS: 'pipeline',
  PIPELINES: 'pipeline',
  CODE_SNIPPETS: 'snippet',
  SNIPPETS: 'snippet',
  DOCS_SECTIONS: 'doc',
  CONTEXT_LINKS: 'link',
  LINKS: 'link',
}

/**
 * Parse a full index block into an IndexBlockData.
 * The index block content is everything inside the ```index fence.
 */
export function parseIndexBlock(content: string): IndexBlockData {
  const sections = splitSections(content)
  const registry = buildRegistry(sections)
  return { registry, sections }
}

/**
 * Split index block content into sections by # HEADER lines.
 */
function splitSections(content: string): IndexSection[] {
  const sections: IndexSection[] = []
  let current: IndexSection | null = null

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    // Section header: # SECTION_NAME
    if (trimmed.startsWith('#') && !trimmed.startsWith('##')) {
      if (current) sections.push(current)
      const header = trimmed.replace(/^#+\s*/, '').trim()
      current = { header, lines: [] }
      continue
    }

    if (current && trimmed.length > 0) {
      current.lines.push(line)
    }
  }

  if (current) sections.push(current)
  return sections
}

/**
 * Build an EntityRegistryData from parsed sections.
 */
function buildRegistry(sections: IndexSection[]): EntityRegistryData {
  const entities = new Map<string, EntityEntry>()
  const files = new Map<string, string>()

  for (const section of sections) {
    const entityType = SECTION_TYPES[section.header]
    if (!entityType) continue

    switch (entityType) {
      case 'file':
        parseFilePaths(section.lines, entities, files)
        break
      case 'pipeline':
        parsePipelineFlows(section.lines, entities)
        break
      case 'link':
        parseContextLinks(section.lines, entities)
        break
      default:
        parseSectionEntries(section.lines, entityType, entities)
        break
    }
  }

  return { entities, files }
}

/**
 * Parse FILE_PATHS section.
 * Format: F1:/path/to/file.ts
 */
function parseFilePaths(
  lines: string[],
  entities: Map<string, EntityEntry>,
  files: Map<string, string>,
): void {
  for (const line of lines) {
    const trimmed = line.trim()
    // F1:/path/to/file.ts
    const match = trimmed.match(/^(F\d+):(.+)$/)
    if (!match) continue

    const [, id, path] = match
    const entry: FileEntry = {
      id,
      type: 'file',
      name: path.trim(),
      path: path.trim(),
      refs: [],
    }
    entities.set(id, entry)
    files.set(id, path.trim())
  }
}

/**
 * Parse generic section entries (SYSTEMS, INTERFACES, PROBLEM_AREAS, SNIPPETS, DOCS).
 * Format:
 *   S1:SYSTEM_NAME|description|
 *   F1>42-60:Description text
 *   F2>10-30:More description
 */
function parseSectionEntries(
  lines: string[],
  entityType: EntityType,
  entities: Map<string, EntityEntry>,
): void {
  let current: EntityEntry | null = null

  for (const line of lines) {
    const trimmed = line.trim()

    // Entity header: S1:NAME|desc| or S1:NAME
    const headerMatch = trimmed.match(/^([A-Z]+\d+):([^|]+)(?:\|([^|]*)\|)?$/)
    if (headerMatch) {
      if (current) entities.set(current.id, current)

      const [, id, name, description] = headerMatch
      const parsed = parseEntityId(id)
      current = {
        id,
        type: parsed?.type ?? entityType,
        name: name.trim(),
        description: description?.trim() || undefined,
        refs: [],
      }
      continue
    }

    // File reference line: F1>42-60:Description
    if (current) {
      const ref = parseFileRef(trimmed)
      if (ref) {
        current.refs.push(ref)
      }
    }
  }

  if (current) entities.set(current.id, current)
}

/**
 * Parse PIPELINE_FLOWS section.
 * Format: PF1:FLOW_NAME|F1>Step desc>F2>Step desc>F4>Step desc
 */
function parsePipelineFlows(
  lines: string[],
  entities: Map<string, EntityEntry>,
): void {
  for (const line of lines) {
    const trimmed = line.trim()

    // PF1:NAME|F1>Step>F2>Step>F4>Step
    const match = trimmed.match(/^(PF\d+):([^|]+)\|(.+)$/)
    if (!match) continue

    const [, id, name, flowDef] = match
    const steps = parsePipelineSteps(flowDef)

    const entry: PipelineEntry = {
      id,
      type: 'pipeline',
      name: name.trim(),
      refs: [],
      steps,
    }
    entities.set(id, entry)
  }
}

/**
 * Parse pipeline step chain: F1>Step desc>F2>Step desc>F4>Step desc
 * Returns alternating fileId/description pairs.
 */
function parsePipelineSteps(flowDef: string): PipelineStep[] {
  const steps: PipelineStep[] = []
  const parts = flowDef.split('>')

  let fileId: string | null = null
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    // Is this a file ID? (starts with F and followed by number)
    if (/^F\d+$/.test(trimmed)) {
      fileId = trimmed
    } else if (fileId) {
      steps.push({ fileId, description: trimmed })
      fileId = null
    }
  }

  // Trailing file ID with no description
  if (fileId) {
    steps.push({ fileId, description: '' })
  }

  return steps
}

/**
 * Parse CONTEXT_LINKS section.
 * Format:
 *   CL1:CONCEPT_NAME|
 *   S1:AUTH_SYSTEM
 *   I1:AUTH_REQUEST
 *   P1:TOKEN_EXPIRY
 */
function parseContextLinks(
  lines: string[],
  entities: Map<string, EntityEntry>,
): void {
  let current: ContextLinkEntry | null = null

  for (const line of lines) {
    const trimmed = line.trim()

    // Context link header: CL1:NAME| or CL1:NAME
    const headerMatch = trimmed.match(/^(CL\d+):([^|]+)\|?$/)
    if (headerMatch) {
      if (current) entities.set(current.id, current)

      const [, id, name] = headerMatch
      current = {
        id,
        type: 'link',
        name: name.trim(),
        refs: [],
        linkedIds: [],
      }
      continue
    }

    // Linked entity: S1:AUTH_SYSTEM or just S1
    if (current) {
      const linkedMatch = trimmed.match(/^([A-Z]+\d+)(?::.*)?$/)
      if (linkedMatch) {
        current.linkedIds.push(linkedMatch[1])
      }
    }
  }

  if (current) entities.set(current.id, current)
}

// --- Registry query operations ---

/**
 * Create an EntityRegistry with query methods from parsed data.
 */
export class EntityRegistry {
  readonly data: EntityRegistryData

  constructor(data: EntityRegistryData) {
    this.data = data
  }

  /** Get entity by ID */
  get(id: string): EntityEntry | undefined {
    return this.data.entities.get(id)
  }

  /** Check if entity exists */
  has(id: string): boolean {
    return this.data.entities.has(id)
  }

  /** Get file path for a file ID */
  filePath(fileId: string): string | undefined {
    return this.data.files.get(fileId)
  }

  /** Get all entities of a given type */
  byType(type: EntityType): EntityEntry[] {
    return Array.from(this.data.entities.values()).filter(e => e.type === type)
  }

  /** Get all entity IDs */
  ids(): string[] {
    return Array.from(this.data.entities.keys())
  }

  /** Total entity count */
  get size(): number {
    return this.data.entities.size
  }

  /**
   * CONTEXT query: find all entities linked to the given entity
   * through ContextLinks (CL entries).
   */
  context(id: string): EntityEntry[] {
    const results: EntityEntry[] = []
    const seen = new Set<string>()

    for (const entry of this.data.entities.values()) {
      if (entry.type !== 'link') continue
      const cl = entry as ContextLinkEntry
      if (!cl.linkedIds.includes(id)) continue

      for (const linkedId of cl.linkedIds) {
        if (linkedId === id || seen.has(linkedId)) continue
        seen.add(linkedId)
        const linked = this.data.entities.get(linkedId)
        if (linked) results.push(linked)
      }
    }

    return results
  }

  /**
   * FIND_REFS query: find all entities that reference a given file ID
   * (optionally at a specific line).
   */
  findRefs(fileId: string, line?: number): EntityEntry[] {
    const results: EntityEntry[] = []

    for (const entry of this.data.entities.values()) {
      if (entry.type === 'file') continue // Skip file entries themselves

      const hasRef = entry.refs.some(ref => {
        if (ref.fileId !== fileId) return false
        if (line === undefined) return true
        if (ref.startLine === undefined) return true
        const end = ref.endLine ?? ref.startLine
        return line >= ref.startLine && line <= end
      })

      if (hasRef) results.push(entry)

      // Also check pipeline steps
      if (entry.type === 'pipeline') {
        const pe = entry as PipelineEntry
        if (pe.steps.some(s => s.fileId === fileId)) {
          if (!results.includes(entry)) results.push(entry)
        }
      }
    }

    return results
  }

  /**
   * EXPAND query: return the entity with its full details.
   * For entities with expandable refs (@CODE@/@MARKDOWN@), this signals
   * that those refs should be resolved to actual content by the caller
   * (since expansion requires file I/O via FileRefResolver).
   */
  expand(id: string): { entity: EntityEntry; expandableRefs: import('./types').FileRef[] } | null {
    const entry = this.data.entities.get(id)
    if (!entry) return null

    const expandableRefs = entry.refs.filter(r => r.expandable)
    return { entity: entry, expandableRefs }
  }

  /**
   * DEEP_EXPAND query: for pipelines, return all steps with their file refs.
   * For context links, return all linked entities with their refs.
   */
  deepExpand(id: string): EntityEntry[] {
    const entry = this.data.entities.get(id)
    if (!entry) return []

    if (entry.type === 'link') {
      const cl = entry as ContextLinkEntry
      return cl.linkedIds
        .map(lid => this.data.entities.get(lid))
        .filter((e): e is EntityEntry => e !== undefined)
    }

    if (entry.type === 'pipeline') {
      const pe = entry as PipelineEntry
      const fileIds = new Set(pe.steps.map(s => s.fileId))
      // Gather all entities that reference the files in this pipeline
      const results: EntityEntry[] = [entry]
      for (const fid of fileIds) {
        const refs = this.findRefs(fid)
        for (const ref of refs) {
          if (!results.includes(ref)) results.push(ref)
        }
      }
      return results
    }

    // For other types, return the entry itself + its context
    return [entry, ...this.context(id)]
  }
}

/**
 * Serialize an IndexBlockData back to the index block format.
 */
export function serializeIndexBlock(data: IndexBlockData): string {
  // Use raw sections for round-trip fidelity
  return data.sections
    .map(s => `# ${s.header}\n${s.lines.join('\n')}`)
    .join('\n\n')
}
