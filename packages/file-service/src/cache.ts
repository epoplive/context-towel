import type { CachedFile, FileCacheStats, FileStat } from './types.js'

export class FileCache {
  private cache = new Map<string, CachedFile>()
  private cacheAccessOrder: string[] = [] // LRU tracking
  private cacheMaxSize: number

  constructor(
    private opts: {
      cacheMaxSize?: number
      normalizePath: (path: string) => string
      resolvePath: (path: string) => Promise<string>
      resolvePathSync: (path: string) => string
      resolveHomeDirSync: () => string | null
      read: (path: string) => Promise<string>
      stat: (path: string) => Promise<FileStat | null>
    }
  ) {
    this.cacheMaxSize = opts.cacheMaxSize ?? 100
  }

  async readCached(path: string, forceFresh = false): Promise<string> {
    const resolvedPath = await this.opts.resolvePath(path)
    const cached = this.cache.get(resolvedPath)

    if (cached && !forceFresh && !cached.dirty) {
      // Move to end of access order (LRU)
      this.touchCache(resolvedPath)
      return cached.content
    }

    const content = await this.opts.read(resolvedPath)
    const stat = await this.opts.stat(resolvedPath)

    this.setCache(resolvedPath, {
      content,
      mtime: stat?.size ?? Date.now(), // Use size as pseudo-mtime for now
      dirty: false,
    })

    return content
  }

  setCachedContent(path: string, content: string): void {
    const resolvedPath = this.opts.resolvePathSync(path)
    const existing = this.cache.get(resolvedPath)
    this.setCache(resolvedPath, {
      content,
      mtime: existing?.mtime ?? Date.now(),
      dirty: true,
    })
  }

  getCached(path: string): CachedFile | undefined {
    return this.cache.get(this.opts.resolvePathSync(path))
  }

  invalidateCache(path: string): void {
    const resolvedPath = this.opts.resolvePathSync(path)
    const candidates = new Set([path, resolvedPath, this.opts.normalizePath(path)])

    const home = this.opts.resolveHomeDirSync()
    if (home && resolvedPath.startsWith(this.opts.normalizePath(home))) {
      candidates.add(this.opts.normalizePath(resolvedPath.replace(this.opts.normalizePath(home), '~')))
    }

    for (const candidate of candidates) {
      this.cache.delete(candidate)
      const idx = this.cacheAccessOrder.indexOf(candidate)
      if (idx !== -1) {
        this.cacheAccessOrder.splice(idx, 1)
      }
    }
  }

  clearCache(): void {
    this.cache.clear()
    this.cacheAccessOrder = []
  }

  getCacheStats(): FileCacheStats {
    return {
      size: this.cache.size,
      maxSize: this.cacheMaxSize,
      paths: Array.from(this.cache.keys()),
    }
  }

  private setCache(path: string, file: CachedFile): void {
    this.cache.set(path, file)
    this.touchCache(path)
    this.evictOldCache()
  }

  private touchCache(path: string): void {
    const idx = this.cacheAccessOrder.indexOf(path)
    if (idx !== -1) {
      this.cacheAccessOrder.splice(idx, 1)
    }
    this.cacheAccessOrder.push(path)
  }

  private evictOldCache(): void {
    while (this.cache.size > this.cacheMaxSize) {
      const oldest = this.cacheAccessOrder.shift()
      if (oldest) {
        // Don't evict dirty files
        const cached = this.cache.get(oldest)
        if (cached?.dirty) {
          this.cacheAccessOrder.push(oldest)
          continue
        }
        this.cache.delete(oldest)
      }
    }
  }
}
