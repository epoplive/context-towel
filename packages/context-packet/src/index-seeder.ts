// ============================================================================
// Codebase Auto-Seeder — Scan a project directory and generate starter index
//
// Produces a ```index block with:
// - FILE_PATHS: source files with assigned F-IDs
// - SYSTEMS: detected module/package boundaries
// - CONTEXT_LINKS: auto-linked systems that share directories
// ============================================================================

// ── Configuration ───────────────────────────────────────────────────────

export interface SeedConfig {
  /** Glob patterns to exclude (default: node_modules, dist, etc.) */
  excludePatterns?: string[]
  /** Max files to include in FILE_PATHS (default: 50) */
  maxFiles?: number
  /** Max depth for system boundary detection (default: 3) */
  maxSystemDepth?: number
}

const DEFAULT_EXCLUDE = [
  'node_modules/**', 'dist/**', 'build/**', '.git/**',
  'coverage/**', '*.d.ts', '*.spec.*', '*.test.*',
  '__tests__/**', '__mocks__/**', '.next/**', '.cache/**',
]

// ── Types ───────────────────────────────────────────────────────────────

export interface SeededIndex {
  /** The generated ```index block content */
  indexContent: string
  /** Statistics about what was found */
  stats: SeedStats
}

export interface SeedStats {
  filesFound: number
  filesIncluded: number
  systemsDetected: number
  contextLinksCreated: number
}

interface DetectedSystem {
  id: string
  name: string
  description: string
  fileIds: string[]
}

// ── Seeder ──────────────────────────────────────────────────────────────

/**
 * Scan a list of discovered file paths and generate an index block.
 *
 * This is a pure function — file discovery is handled by the caller
 * (who knows whether to use Node fs, Tauri FS, or glob libraries).
 */
export function seedIndexFromFiles(
  files: string[],
  config: SeedConfig = {},
): SeededIndex {
  const maxFiles = config.maxFiles ?? 50
  const maxSystemDepth = config.maxSystemDepth ?? 3

  // Filter by include/exclude patterns (simple implementation using string matching)
  const filtered = filterFiles(files, config)
  const included = filtered.slice(0, maxFiles)

  // Assign F-IDs
  const fileMap = new Map<string, string>() // path → F-ID
  const fileIdMap = new Map<string, string>() // F-ID → path
  for (let i = 0; i < included.length; i++) {
    const fid = `F${i + 1}`
    fileMap.set(included[i], fid)
    fileIdMap.set(fid, included[i])
  }

  // Detect system boundaries from directory structure
  const systems = detectSystems(included, fileMap, maxSystemDepth)

  // Create context links for systems that share parent directories
  const contextLinks = createContextLinks(systems)

  // Generate the index block content
  const indexContent = generateIndexContent(fileIdMap, systems, contextLinks)

  return {
    indexContent,
    stats: {
      filesFound: files.length,
      filesIncluded: included.length,
      systemsDetected: systems.length,
      contextLinksCreated: contextLinks.length,
    },
  }
}

// ── Internal helpers ────────────────────────────────────────────────────

function filterFiles(files: string[], config: SeedConfig): string[] {
  const excludePatterns = config.excludePatterns ?? DEFAULT_EXCLUDE

  return files.filter(file => {
    // Check exclude patterns (simple string-based matching)
    for (const pattern of excludePatterns) {
      if (matchesSimpleGlob(file, pattern)) return false
    }
    return true
  })
}

/** Simple glob matching — supports ** and * wildcards */
function matchesSimpleGlob(path: string, pattern: string): boolean {
  // Convert glob to regex
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '§§') // temporary placeholder
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*')
  return new RegExp(`^${regexStr}$`).test(path) ||
    new RegExp(`(^|/)${regexStr}$`).test(path)
}

function detectSystems(
  files: string[],
  fileMap: Map<string, string>,
  maxDepth: number,
): DetectedSystem[] {
  // Group files by directory path segments
  const dirGroups = new Map<string, string[]>() // dir → file paths

  for (const file of files) {
    const parts = file.split('/')
    // Create groups for each level of the directory hierarchy
    for (let depth = 1; depth <= Math.min(parts.length - 1, maxDepth); depth++) {
      const dir = parts.slice(0, depth).join('/')
      if (!dirGroups.has(dir)) dirGroups.set(dir, [])
      dirGroups.get(dir)!.push(file)
    }
  }

  // Find directory groups that look like system boundaries:
  // - Have 2+ files
  // - Are at the right depth (not too shallow, not too deep)
  // - Names suggest module boundaries
  const systemDirs: { dir: string; files: string[] }[] = []
  const usedFiles = new Set<string>()

  // Sort by depth (deepest first) to prefer more specific boundaries
  const sortedDirs = [...dirGroups.entries()]
    .filter(([, files]) => files.length >= 2)
    .sort((a, b) => b[0].split('/').length - a[0].split('/').length)

  for (const [dir, dirFiles] of sortedDirs) {
    // Skip if most files in this dir are already claimed
    const unclaimed = dirFiles.filter(f => !usedFiles.has(f))
    if (unclaimed.length < 2) continue

    // Check if directory name suggests a system boundary
    const dirName = dir.split('/').pop() ?? dir
    if (isSystemBoundaryDir(dirName)) {
      systemDirs.push({ dir, files: unclaimed })
      for (const f of unclaimed) usedFiles.add(f)
    }
  }

  // Convert to DetectedSystem
  const systems: DetectedSystem[] = []
  let sysNum = 1

  for (const { dir, files: sysFiles } of systemDirs) {
    const dirName = dir.split('/').pop() ?? dir
    const name = dirName.toUpperCase().replace(/[^A-Z0-9]/g, '_')
    const fileIds = sysFiles
      .map(f => fileMap.get(f))
      .filter((id): id is string => id !== undefined)

    if (fileIds.length > 0) {
      systems.push({
        id: `S${sysNum}`,
        name: `${name}_SYSTEM`,
        description: `Module boundary: ${dir}/`,
        fileIds,
      })
      sysNum++
    }
  }

  return systems
}

/** Heuristic: directory names that suggest module/system boundaries */
function isSystemBoundaryDir(name: string): boolean {
  const boundaryNames = new Set([
    'src', 'lib', 'core', 'api', 'auth', 'services', 'modules',
    'components', 'hooks', 'utils', 'helpers', 'middleware',
    'routes', 'controllers', 'models', 'entities', 'types',
    'plugins', 'adapters', 'providers', 'stores', 'state',
    'context', 'config', 'cli', 'commands', 'handlers',
    'pages', 'views', 'layouts', 'features',
  ])
  return boundaryNames.has(name.toLowerCase())
}

function createContextLinks(
  systems: DetectedSystem[],
): { id: string; name: string; systemIds: string[] }[] {
  if (systems.length < 2) return []

  // Find systems that share files
  const fileToSystems = new Map<string, string[]>()
  for (const sys of systems) {
    for (const fid of sys.fileIds) {
      if (!fileToSystems.has(fid)) fileToSystems.set(fid, [])
      fileToSystems.get(fid)!.push(sys.id)
    }
  }

  // Group systems that share files into context links
  const linkGroups = new Map<string, Set<string>>()
  for (const [, sysIds] of fileToSystems) {
    if (sysIds.length < 2) continue
    const key = sysIds.sort().join(',')
    if (!linkGroups.has(key)) linkGroups.set(key, new Set())
    for (const id of sysIds) linkGroups.get(key)!.add(id)
  }

  const links: { id: string; name: string; systemIds: string[] }[] = []
  let linkNum = 1
  for (const [, sysIds] of linkGroups) {
    links.push({
      id: `CL${linkNum}`,
      name: `SHARED_${linkNum}`,
      systemIds: [...sysIds],
    })
    linkNum++
  }

  return links
}

function generateIndexContent(
  fileIdMap: Map<string, string>,
  systems: DetectedSystem[],
  contextLinks: { id: string; name: string; systemIds: string[] }[],
): string {
  const lines: string[] = []

  // FILE_PATHS
  lines.push('# FILE_PATHS')
  for (const [fid, path] of fileIdMap) {
    lines.push(`${fid}:${path}`)
  }

  // SYSTEMS
  if (systems.length > 0) {
    lines.push('')
    lines.push('# SYSTEMS')
    for (const sys of systems) {
      lines.push(`${sys.id}:${sys.name}|${sys.description}|`)
      for (const fid of sys.fileIds) {
        lines.push(`${fid}:Source file`)
      }
    }
  }

  // CONTEXT_LINKS
  if (contextLinks.length > 0) {
    lines.push('')
    lines.push('# CONTEXT_LINKS')
    for (const link of contextLinks) {
      lines.push(`${link.id}:${link.name}|`)
      for (const sysId of link.systemIds) {
        const sys = systems.find(s => s.id === sysId)
        if (sys) lines.push(`${sysId}:${sys.name}`)
      }
    }
  }

  return lines.join('\n')
}
