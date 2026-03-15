// ============================================================================
// Cache utilities for FileParserService
// ============================================================================
//
// Copied from LG's file-parser-core/cache.ts.
// Provides LRU cache helpers that operate on Map<string, ParsedFileData>.

import type { ParsedFileData } from './types'
import { matchesPathPattern, normalizePath } from './path'

export function getCachedFile(cache: Map<string, ParsedFileData>, filePath: string): ParsedFileData | undefined {
  return cache.get(filePath)
}

export function getCachedFilesByPrefix(cache: Map<string, ParsedFileData>, pathPrefix: string): ParsedFileData[] {
  const normalized = normalizePath(pathPrefix)
  const result: ParsedFileData[] = []
  for (const [path, data] of cache) {
    if (path === normalized || path.startsWith(`${normalized}/`)) {
      result.push(data)
    }
  }
  return result
}

export function getCachedData<T = unknown>(
  cache: Map<string, ParsedFileData>,
  parserId: string,
  pathPattern?: string | RegExp,
): Map<string, T[]> {
  const result = new Map<string, T[]>()

  for (const [path, data] of cache) {
    if (pathPattern && !matchesPathPattern(path, pathPattern)) {
      continue
    }

    const parserResult = data.results.get(parserId)
    if (parserResult) {
      result.set(path, parserResult.items as T[])
    }
  }

  return result
}

export function getAllItems<T = unknown>(
  cache: Map<string, ParsedFileData>,
  parserId: string,
  pathPattern?: string | RegExp,
): T[] {
  const cached = getCachedData<T>(cache, parserId, pathPattern)
  const items: T[] = []
  for (const fileItems of cached.values()) {
    items.push(...fileItems)
  }
  return items
}

export function invalidateCache(
  cache: Map<string, ParsedFileData>,
  cacheOrder: string[],
  filePath: string,
): string[] {
  cache.delete(filePath)
  return cacheOrder.filter((p) => p !== filePath)
}

export function clearCache(cache: Map<string, ParsedFileData>): void {
  cache.clear()
}

export function getCacheStats(
  cache: Map<string, ParsedFileData>,
  maxCacheSize: number,
): { size: number; maxSize: number; paths: string[] } {
  return {
    size: cache.size,
    maxSize: maxCacheSize,
    paths: Array.from(cache.keys()),
  }
}

export function updateCache(
  cache: Map<string, ParsedFileData>,
  cacheOrder: string[],
  maxCacheSize: number,
  filePath: string,
  data: ParsedFileData,
): string[] {
  // Remove from current position in order
  let nextOrder = cacheOrder.filter((p) => p !== filePath)

  // Add to end (most recently used)
  nextOrder.push(filePath)
  cache.set(filePath, data)

  // Evict oldest if over limit
  while (nextOrder.length > maxCacheSize) {
    const oldest = nextOrder.shift()
    if (oldest) cache.delete(oldest)
  }

  return nextOrder
}

export function clearCacheForPathPrefix(
  cache: Map<string, ParsedFileData>,
  cacheOrder: string[],
  pathPrefix: string,
): string[] {
  const normalized = normalizePath(pathPrefix)
  const nextOrder = cacheOrder.filter(
    (path) => !(path === normalized || path.startsWith(`${normalized}/`)),
  )
  for (const [path] of cache) {
    if (path === normalized || path.startsWith(`${normalized}/`)) {
      cache.delete(path)
    }
  }
  return nextOrder
}

export function hasCachedEntriesForFile(
  cache: Map<string, ParsedFileData>,
  filePath: string,
  parserIds?: string[],
  data?: ParsedFileData,
): boolean {
  const cached = data ?? cache.get(filePath)
  if (!cached) return false
  if (!parserIds || parserIds.length === 0) return true
  return parserIds.every((id) => cached.results.has(id))
}

export function hasCachedEntriesForPath(
  cache: Map<string, ParsedFileData>,
  pathPrefix: string,
  parserIds?: string[],
): boolean {
  const normalized = normalizePath(pathPrefix)
  for (const [path, data] of cache) {
    if (path === normalized || path.startsWith(`${normalized}/`)) {
      if (hasCachedEntriesForFile(cache, path, parserIds, data)) {
        return true
      }
    }
  }
  return false
}
