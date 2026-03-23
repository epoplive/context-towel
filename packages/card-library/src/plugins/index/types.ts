// Entity Registry — shared symbol table for codebase documentation
// Port of CodeIndexer ID mapping concept: short IDs form a linking namespace
// F1, S1, I1, PF1, CS1, DS1, CL1 etc.

/** Entity type determined by ID prefix */
export type EntityType =
  | 'file'       // F — file path mapping
  | 'system'     // S — system/module/service
  | 'interface'  // I — boundary between components
  | 'problem'    // P — known issue or problem area
  | 'pipeline'   // PF — execution/data flow path
  | 'snippet'    // CS — expandable code reference
  | 'doc'        // DS — expandable doc section reference
  | 'link'       // CL — context link connecting entities

/** Prefixes used in the index format */
export const ENTITY_PREFIXES: Record<EntityType, string> = {
  file: 'F',
  system: 'S',
  interface: 'I',
  problem: 'P',
  pipeline: 'PF',
  snippet: 'CS',
  doc: 'DS',
  link: 'CL',
}

/** Reverse lookup: prefix → type */
export const PREFIX_TO_TYPE: ReadonlyMap<string, EntityType> = new Map(
  (Object.entries(ENTITY_PREFIXES) as Array<[EntityType, string]>).map(
    ([type, prefix]) => [prefix, type],
  ),
)

/** Expandable marker type */
export type ExpandableMarker = '@CODE@' | '@MARKDOWN@'

/** A reference from an entity to a file location */
export interface FileRef {
  /** The file entity ID (e.g. "F1") */
  fileId: string
  /** Start line (inclusive) */
  startLine?: number
  /** End line (inclusive) */
  endLine?: number
  /** Human description of what's at this location */
  description?: string
  /** If present, content is expandable */
  expandable?: ExpandableMarker
}

/** A step in a pipeline flow */
export interface PipelineStep {
  /** File entity ID */
  fileId: string
  /** Description of what happens at this step */
  description: string
}

/** Base entity entry in the registry */
export interface EntityEntry {
  /** Short ID (F1, S1, I1, PF1, CS1, DS1, CL1) */
  id: string
  /** Entity type derived from prefix */
  type: EntityType
  /** Human name (e.g. "AUTH_SYSTEM", "Token validation logic") */
  name: string
  /** Description (text between pipes in the format: S1:NAME|desc|) */
  description?: string
  /** File references attached to this entity */
  refs: FileRef[]
}

/** File path entry — maps a short ID to an absolute/relative path */
export interface FileEntry extends EntityEntry {
  type: 'file'
  /** The file path this ID maps to */
  path: string
}

/** Pipeline flow entry — chains steps through file IDs */
export interface PipelineEntry extends EntityEntry {
  type: 'pipeline'
  /** Ordered steps: F1>Step>F2>Step chain */
  steps: PipelineStep[]
}

/** Context link entry — connects entities across types */
export interface ContextLinkEntry extends EntityEntry {
  type: 'link'
  /** IDs of all entities linked by this context link */
  linkedIds: string[]
}

/** The full entity registry parsed from an index block */
export interface EntityRegistryData {
  /** All entities keyed by ID */
  entities: Map<string, EntityEntry>

  /** File path mappings (F-IDs only, for quick lookup) */
  files: Map<string, string>
}

/** Index block data — wraps the registry for the card-library BlockInstance */
export interface IndexBlockData {
  /** The parsed entity registry */
  registry: EntityRegistryData
  /** Raw section content for serialization round-trip */
  sections: IndexSection[]
}

/** A parsed section from the index block */
export interface IndexSection {
  /** Section header (FILE_PATHS, SYSTEMS, etc.) */
  header: string
  /** Raw content lines under this header */
  lines: string[]
}

// --- Utility functions ---

/**
 * Parse an entity ID into its type and numeric part.
 * "F1" → { type: 'file', num: 1 }
 * "PF3" → { type: 'pipeline', num: 3 }
 * "CS12" → { type: 'snippet', num: 12 }
 */
export function parseEntityId(id: string): { type: EntityType; num: number } | null {
  // Try longest prefixes first (PF, CS, DS, CL before single-char)
  for (const [prefix, type] of PREFIX_TO_TYPE) {
    if (id.startsWith(prefix)) {
      const rest = id.slice(prefix.length)
      const num = parseInt(rest, 10)
      if (!isNaN(num)) return { type, num }
    }
  }
  return null
}

/**
 * Parse a file reference string.
 * "F1>42-60" → { fileId: "F1", startLine: 42, endLine: 60 }
 * "F1>42-60:Token validation" → { fileId: "F1", startLine: 42, endLine: 60, description: "Token validation" }
 * "F1>42-60:@CODE@" → { fileId: "F1", startLine: 42, endLine: 60, expandable: "@CODE@" }
 */
export function parseFileRef(ref: string): FileRef | null {
  // Pattern: F<N>><startLine>-<endLine>[:description|@MARKER@]
  const match = ref.match(/^((?:F|PF|CS|DS|CL|S|I|P)\d+)>(\d+)(?:-(\d+))?(?::(.+))?$/)
  if (!match) {
    // Could be just an ID without line range: F1
    const idMatch = ref.match(/^((?:F|PF|CS|DS|CL|S|I|P)\d+)$/)
    if (idMatch) return { fileId: idMatch[1] }
    return null
  }

  const [, fileId, startStr, endStr, tail] = match
  const result: FileRef = {
    fileId,
    startLine: parseInt(startStr, 10),
  }
  if (endStr) result.endLine = parseInt(endStr, 10)

  if (tail) {
    if (tail === '@CODE@' || tail === '@MARKDOWN@') {
      result.expandable = tail as ExpandableMarker
    } else {
      // Check if description ends with @CODE@ or @MARKDOWN@
      if (tail.endsWith('@CODE@')) {
        result.description = tail.slice(0, -6).trim()
        result.expandable = '@CODE@'
      } else if (tail.endsWith('@MARKDOWN@')) {
        result.description = tail.slice(0, -10).trim()
        result.expandable = '@MARKDOWN@'
      } else {
        result.description = tail
      }
    }
  }

  return result
}
