// File Reference Resolver — resolves F-ID references to actual file content
// Uses a pluggable file reader so it works with Tauri FS, Node FS, or HTTP

import type { FileRef, EntityRegistryData } from './types'

/** The resolved content from a file reference */
export interface ResolvedFileRef {
  /** Absolute file path */
  path: string
  /** Start line (1-based, inclusive) */
  startLine: number
  /** End line (1-based, inclusive) */
  endLine: number
  /** The extracted source lines */
  content: string
  /** Programming language (from file extension) */
  language: string
}

/** Minimal file-reading interface — matches FileSystem.read() */
export interface FileReader {
  read(path: string): Promise<string>
}

/** Extension → language mapping for syntax highlighting */
const EXT_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  rs: 'rust',
  go: 'go',
  py: 'python',
  rb: 'ruby',
  java: 'java',
  kt: 'kotlin',
  cs: 'csharp',
  cpp: 'cpp',
  c: 'c',
  h: 'c',
  hpp: 'cpp',
  swift: 'swift',
  sh: 'bash',
  zsh: 'bash',
  bash: 'bash',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  css: 'css',
  scss: 'scss',
  html: 'html',
  sql: 'sql',
  graphql: 'graphql',
  proto: 'protobuf',
  dockerfile: 'dockerfile',
  xml: 'xml',
}

function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  return EXT_LANG[ext] || 'text'
}

/**
 * File reference resolver with caching.
 * Reads files through the provided FileReader interface and extracts line ranges.
 */
export class FileRefResolver {
  private reader: FileReader
  private cache = new Map<string, string>()

  constructor(reader: FileReader) {
    this.reader = reader
  }

  /**
   * Resolve a file reference to its actual content.
   * Uses the entity registry to map F-IDs to file paths.
   */
  async resolve(
    ref: FileRef,
    registry: EntityRegistryData,
  ): Promise<ResolvedFileRef | null> {
    const path = registry.files.get(ref.fileId)
    if (!path) return null

    const content = await this.readFile(path)
    if (content === null) return null

    const lines = content.split('\n')
    const startLine = ref.startLine ?? 1
    const endLine = ref.endLine ?? lines.length

    // Clamp to valid range
    const clampedStart = Math.max(1, Math.min(startLine, lines.length))
    const clampedEnd = Math.max(clampedStart, Math.min(endLine, lines.length))

    // Extract lines (1-based to 0-based index)
    const extracted = lines.slice(clampedStart - 1, clampedEnd).join('\n')

    return {
      path,
      startLine: clampedStart,
      endLine: clampedEnd,
      content: extracted,
      language: detectLanguage(path),
    }
  }

  /**
   * Resolve multiple file references in batch, sharing the file cache.
   */
  async resolveAll(
    refs: FileRef[],
    registry: EntityRegistryData,
  ): Promise<Map<string, ResolvedFileRef | null>> {
    const results = new Map<string, ResolvedFileRef | null>()
    for (const ref of refs) {
      const key = formatRefKey(ref)
      results.set(key, await this.resolve(ref, registry))
    }
    return results
  }

  /** Clear the file content cache */
  clearCache(): void {
    this.cache.clear()
  }

  private async readFile(path: string): Promise<string | null> {
    const cached = this.cache.get(path)
    if (cached !== undefined) return cached

    try {
      const content = await this.reader.read(path)
      this.cache.set(path, content)
      return content
    } catch {
      return null
    }
  }
}

/** Format a FileRef as a human-readable key (e.g. "F1>42-60") */
function formatRefKey(ref: FileRef): string {
  let key = ref.fileId
  if (ref.startLine !== undefined) {
    key += `>${ref.startLine}`
    if (ref.endLine !== undefined) key += `-${ref.endLine}`
  }
  return key
}
