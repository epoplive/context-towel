import { describe, it, expect } from 'vitest'
import type { ParsedFileData } from '../types'
import {
  updateCache,
  invalidateCache,
  clearCache,
  clearCacheForPathPrefix,
  getCachedFile,
  getCachedFilesByPrefix,
  getCachedData,
  getAllItems,
  getCacheStats,
  hasCachedEntriesForFile,
  hasCachedEntriesForPath,
} from '../cache'

// -------------------------------------------------------------------------- //
// Helpers
// -------------------------------------------------------------------------- //

function makeData(path: string, parserId = 'task', items: unknown[] = []): ParsedFileData {
  const results = new Map<string, { pluginId: string; items: unknown[] }>()
  results.set(parserId, { pluginId: parserId, items })
  return { path, content: '', lastModified: Date.now(), results }
}

// -------------------------------------------------------------------------- //
// updateCache
// -------------------------------------------------------------------------- //

describe('updateCache', () => {
  it('adds a new entry', () => {
    const cache = new Map<string, ParsedFileData>()
    const order = updateCache(cache, [], 100, '/a.md', makeData('/a.md'))
    expect(cache.has('/a.md')).toBe(true)
    expect(order).toEqual(['/a.md'])
  })

  it('moves an existing entry to the end (most-recently-used)', () => {
    const cache = new Map<string, ParsedFileData>()
    let order: string[] = []
    order = updateCache(cache, order, 100, '/a.md', makeData('/a.md'))
    order = updateCache(cache, order, 100, '/b.md', makeData('/b.md'))
    // Re-access /a.md
    order = updateCache(cache, order, 100, '/a.md', makeData('/a.md'))
    expect(order).toEqual(['/b.md', '/a.md'])
  })

  it('evicts the oldest entry when over maxCacheSize', () => {
    const cache = new Map<string, ParsedFileData>()
    let order: string[] = []
    order = updateCache(cache, order, 2, '/a.md', makeData('/a.md'))
    order = updateCache(cache, order, 2, '/b.md', makeData('/b.md'))
    // Adding /c.md should evict /a.md
    order = updateCache(cache, order, 2, '/c.md', makeData('/c.md'))
    expect(cache.has('/a.md')).toBe(false)
    expect(cache.has('/b.md')).toBe(true)
    expect(cache.has('/c.md')).toBe(true)
    expect(order).toEqual(['/b.md', '/c.md'])
  })
})

// -------------------------------------------------------------------------- //
// invalidateCache
// -------------------------------------------------------------------------- //

describe('invalidateCache', () => {
  it('removes the entry and its position in cacheOrder', () => {
    const cache = new Map<string, ParsedFileData>()
    let order: string[] = []
    order = updateCache(cache, order, 100, '/a.md', makeData('/a.md'))
    order = updateCache(cache, order, 100, '/b.md', makeData('/b.md'))
    order = invalidateCache(cache, order, '/a.md')
    expect(cache.has('/a.md')).toBe(false)
    expect(order).toEqual(['/b.md'])
  })

  it('is a no-op for a path not in cache', () => {
    const cache = new Map<string, ParsedFileData>()
    const order = invalidateCache(cache, ['/a.md'], '/b.md')
    expect(order).toEqual(['/a.md'])
  })
})

// -------------------------------------------------------------------------- //
// clearCache
// -------------------------------------------------------------------------- //

describe('clearCache', () => {
  it('empties the cache', () => {
    const cache = new Map<string, ParsedFileData>()
    updateCache(cache, [], 100, '/a.md', makeData('/a.md'))
    clearCache(cache)
    expect(cache.size).toBe(0)
  })
})

// -------------------------------------------------------------------------- //
// clearCacheForPathPrefix
// -------------------------------------------------------------------------- //

describe('clearCacheForPathPrefix', () => {
  it('removes all paths under the given prefix', () => {
    const cache = new Map<string, ParsedFileData>()
    let order: string[] = []
    order = updateCache(cache, order, 100, '/project/.context/tasks.md', makeData('/project/.context/tasks.md'))
    order = updateCache(cache, order, 100, '/project/.context/notes.md', makeData('/project/.context/notes.md'))
    order = updateCache(cache, order, 100, '/other/file.md', makeData('/other/file.md'))

    order = clearCacheForPathPrefix(cache, order, '/project/.context')

    expect(cache.has('/project/.context/tasks.md')).toBe(false)
    expect(cache.has('/project/.context/notes.md')).toBe(false)
    expect(cache.has('/other/file.md')).toBe(true)
    expect(order).toEqual(['/other/file.md'])
  })

  it('removes an exact match', () => {
    const cache = new Map<string, ParsedFileData>()
    let order = updateCache(cache, [], 100, '/a.md', makeData('/a.md'))
    order = clearCacheForPathPrefix(cache, order, '/a.md')
    expect(cache.has('/a.md')).toBe(false)
  })
})

// -------------------------------------------------------------------------- //
// getCachedFile / getCachedFilesByPrefix
// -------------------------------------------------------------------------- //

describe('getCachedFile', () => {
  it('returns the cached data for a path', () => {
    const cache = new Map<string, ParsedFileData>()
    const data = makeData('/a.md')
    updateCache(cache, [], 100, '/a.md', data)
    expect(getCachedFile(cache, '/a.md')).toBe(data)
  })

  it('returns undefined for unknown path', () => {
    const cache = new Map<string, ParsedFileData>()
    expect(getCachedFile(cache, '/x.md')).toBeUndefined()
  })
})

describe('getCachedFilesByPrefix', () => {
  it('returns all files under prefix', () => {
    const cache = new Map<string, ParsedFileData>()
    let order: string[] = []
    order = updateCache(cache, order, 100, '/project/a.md', makeData('/project/a.md'))
    order = updateCache(cache, order, 100, '/project/b.md', makeData('/project/b.md'))
    order = updateCache(cache, order, 100, '/other/c.md', makeData('/other/c.md'))

    const result = getCachedFilesByPrefix(cache, '/project')
    expect(result).toHaveLength(2)
    const paths = result.map((d) => d.path).sort()
    expect(paths).toEqual(['/project/a.md', '/project/b.md'])
  })
})

// -------------------------------------------------------------------------- //
// getCachedData / getAllItems
// -------------------------------------------------------------------------- //

describe('getCachedData', () => {
  it('returns a map of path -> items for the given parser', () => {
    const cache = new Map<string, ParsedFileData>()
    let order: string[] = []
    order = updateCache(cache, order, 100, '/a.md', makeData('/a.md', 'task', [{ id: 'a1' }]))
    order = updateCache(cache, order, 100, '/b.md', makeData('/b.md', 'task', [{ id: 'b1' }, { id: 'b2' }]))

    const result = getCachedData(cache, 'task')
    expect(result.get('/a.md')).toEqual([{ id: 'a1' }])
    expect(result.get('/b.md')).toEqual([{ id: 'b1' }, { id: 'b2' }])
  })

  it('filters by path pattern (string prefix)', () => {
    const cache = new Map<string, ParsedFileData>()
    let order: string[] = []
    order = updateCache(cache, order, 100, '/project/a.md', makeData('/project/a.md', 'task', [1]))
    order = updateCache(cache, order, 100, '/other/b.md', makeData('/other/b.md', 'task', [2]))

    const result = getCachedData(cache, 'task', '/project')
    expect(result.size).toBe(1)
    expect(result.has('/project/a.md')).toBe(true)
  })

  it('filters by path pattern (RegExp)', () => {
    const cache = new Map<string, ParsedFileData>()
    let order: string[] = []
    order = updateCache(cache, order, 100, '/project/a.md', makeData('/project/a.md', 'task', [1]))
    order = updateCache(cache, order, 100, '/other/b.md', makeData('/other/b.md', 'task', [2]))

    const result = getCachedData(cache, 'task', /\/project\//)
    expect(result.size).toBe(1)
  })
})

describe('getAllItems', () => {
  it('returns all items flattened across all files', () => {
    const cache = new Map<string, ParsedFileData>()
    let order: string[] = []
    order = updateCache(cache, order, 100, '/a.md', makeData('/a.md', 'task', ['a', 'b']))
    order = updateCache(cache, order, 100, '/b.md', makeData('/b.md', 'task', ['c']))

    const items = getAllItems(cache, 'task')
    expect(items).toHaveLength(3)
    expect(items).toContain('a')
    expect(items).toContain('c')
  })

  it('returns empty array when no results', () => {
    const cache = new Map<string, ParsedFileData>()
    expect(getAllItems(cache, 'task')).toEqual([])
  })
})

// -------------------------------------------------------------------------- //
// getCacheStats
// -------------------------------------------------------------------------- //

describe('getCacheStats', () => {
  it('returns size, maxSize, and paths', () => {
    const cache = new Map<string, ParsedFileData>()
    let order: string[] = []
    order = updateCache(cache, order, 50, '/a.md', makeData('/a.md'))
    order = updateCache(cache, order, 50, '/b.md', makeData('/b.md'))

    const stats = getCacheStats(cache, 50)
    expect(stats.size).toBe(2)
    expect(stats.maxSize).toBe(50)
    expect(stats.paths).toContain('/a.md')
    expect(stats.paths).toContain('/b.md')
  })
})

// -------------------------------------------------------------------------- //
// hasCachedEntriesForFile / hasCachedEntriesForPath
// -------------------------------------------------------------------------- //

describe('hasCachedEntriesForFile', () => {
  it('returns true when file has cached entries for the given parsers', () => {
    const cache = new Map<string, ParsedFileData>()
    updateCache(cache, [], 100, '/a.md', makeData('/a.md', 'task', [1]))
    expect(hasCachedEntriesForFile(cache, '/a.md', ['task'])).toBe(true)
  })

  it('returns false when file is not cached', () => {
    const cache = new Map<string, ParsedFileData>()
    expect(hasCachedEntriesForFile(cache, '/a.md', ['task'])).toBe(false)
  })

  it('returns false when required parser results are missing', () => {
    const cache = new Map<string, ParsedFileData>()
    updateCache(cache, [], 100, '/a.md', makeData('/a.md', 'task', [1]))
    expect(hasCachedEntriesForFile(cache, '/a.md', ['task', 'toc'])).toBe(false)
  })

  it('returns true when no parsers are required (file exists)', () => {
    const cache = new Map<string, ParsedFileData>()
    updateCache(cache, [], 100, '/a.md', makeData('/a.md'))
    expect(hasCachedEntriesForFile(cache, '/a.md')).toBe(true)
  })
})

describe('hasCachedEntriesForPath', () => {
  it('returns true when any file under prefix is cached with required parsers', () => {
    const cache = new Map<string, ParsedFileData>()
    updateCache(cache, [], 100, '/project/a.md', makeData('/project/a.md', 'task', [1]))
    expect(hasCachedEntriesForPath(cache, '/project', ['task'])).toBe(true)
  })

  it('returns false when no files under prefix are cached', () => {
    const cache = new Map<string, ParsedFileData>()
    expect(hasCachedEntriesForPath(cache, '/project', ['task'])).toBe(false)
  })
})
