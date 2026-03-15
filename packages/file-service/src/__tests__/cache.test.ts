import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileCache } from '../cache'

function createCache(overrides?: Partial<ConstructorParameters<typeof FileCache>[0]>) {
  const opts = {
    normalizePath: (p: string) => p.replace(/\\/g, '/'),
    resolvePath: vi.fn(async (p: string) => p),
    resolvePathSync: vi.fn((p: string) => p),
    resolveHomeDirSync: vi.fn(() => '/home/user'),
    read: vi.fn(async () => 'file content'),
    stat: vi.fn(async () => ({ is_dir: false, is_file: true, size: 100, readonly: false, mtimeMs: 1000 })),
    ...overrides,
  }
  return { cache: new FileCache(opts), opts }
}

describe('FileCache', () => {
  describe('readCached', () => {
    it('reads from disk on first access', async () => {
      const { cache, opts } = createCache()
      const content = await cache.readCached('/foo.md')
      expect(content).toBe('file content')
      expect(opts.read).toHaveBeenCalledWith('/foo.md')
    })

    it('returns cached content on second access', async () => {
      const { cache, opts } = createCache()
      await cache.readCached('/foo.md')
      opts.read.mockClear()

      const content = await cache.readCached('/foo.md')
      expect(content).toBe('file content')
      expect(opts.read).not.toHaveBeenCalled()
    })

    it('re-reads from disk when forceFresh is true', async () => {
      const { cache, opts } = createCache()
      await cache.readCached('/foo.md')
      opts.read.mockResolvedValue('updated content')

      const content = await cache.readCached('/foo.md', true)
      expect(content).toBe('updated content')
      expect(opts.read).toHaveBeenCalledTimes(2)
    })

    it('re-reads from disk when cached entry is dirty', async () => {
      const { cache, opts } = createCache()
      await cache.readCached('/foo.md')
      cache.setCachedContent('/foo.md', 'dirty content')
      opts.read.mockResolvedValue('fresh from disk')

      const content = await cache.readCached('/foo.md')
      expect(content).toBe('fresh from disk')
    })
  })

  describe('setCachedContent', () => {
    it('marks entry as dirty', () => {
      const { cache } = createCache()
      cache.setCachedContent('/foo.md', 'local edit')
      const entry = cache.getCached('/foo.md')
      expect(entry).toBeDefined()
      expect(entry!.content).toBe('local edit')
      expect(entry!.dirty).toBe(true)
    })
  })

  describe('getCached', () => {
    it('returns undefined for uncached paths', () => {
      const { cache } = createCache()
      expect(cache.getCached('/nope.md')).toBeUndefined()
    })
  })

  describe('invalidateCache', () => {
    it('removes the entry', async () => {
      const { cache } = createCache()
      await cache.readCached('/foo.md')
      expect(cache.getCached('/foo.md')).toBeDefined()

      cache.invalidateCache('/foo.md')
      expect(cache.getCached('/foo.md')).toBeUndefined()
    })

    it('also invalidates the tilde-prefixed variant', async () => {
      const { cache } = createCache({
        resolvePathSync: (p: string) => p.startsWith('~') ? p.replace('~', '/home/user') : p,
      })
      cache.setCachedContent('/home/user/foo.md', 'data')
      cache.invalidateCache('/home/user/foo.md')
      expect(cache.getCached('/home/user/foo.md')).toBeUndefined()
    })
  })

  describe('clearCache', () => {
    it('removes all entries', async () => {
      const { cache } = createCache()
      await cache.readCached('/a.md')
      await cache.readCached('/b.md')
      expect(cache.getCacheStats().size).toBe(2)

      cache.clearCache()
      expect(cache.getCacheStats().size).toBe(0)
    })
  })

  describe('LRU eviction', () => {
    it('evicts oldest non-dirty entries when over max size', async () => {
      const { cache, opts } = createCache({ cacheMaxSize: 3 })
      opts.read.mockImplementation(async (p: string) => `content of ${p}`)

      await cache.readCached('/a.md')
      await cache.readCached('/b.md')
      await cache.readCached('/c.md')
      await cache.readCached('/d.md') // should evict /a.md

      expect(cache.getCached('/a.md')).toBeUndefined()
      expect(cache.getCached('/b.md')).toBeDefined()
      expect(cache.getCached('/d.md')).toBeDefined()
    })

    it('does not evict dirty entries', async () => {
      const { cache, opts } = createCache({ cacheMaxSize: 2 })
      opts.read.mockImplementation(async (p: string) => `content of ${p}`)

      await cache.readCached('/a.md')
      cache.setCachedContent('/a.md', 'dirty') // mark dirty
      await cache.readCached('/b.md')
      await cache.readCached('/c.md') // would evict /a.md but it's dirty

      expect(cache.getCached('/a.md')).toBeDefined()
      expect(cache.getCached('/a.md')!.dirty).toBe(true)
    })
  })

  describe('getCacheStats', () => {
    it('returns correct size and paths', async () => {
      const { cache } = createCache()
      await cache.readCached('/a.md')
      await cache.readCached('/b.md')

      const stats = cache.getCacheStats()
      expect(stats.size).toBe(2)
      expect(stats.paths).toContain('/a.md')
      expect(stats.paths).toContain('/b.md')
      expect(stats.maxSize).toBe(100)
    })
  })
})
