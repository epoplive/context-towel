// ============================================================================
// FileParserService
// ============================================================================
//
// Adapted from LG's file-parser-core/FileParserService.ts.
//
// Key adaptations:
//   - FileSystem is taken as a constructor parameter (no default singleton).
//   - trackSubscription() calls removed (LG diagnostics not needed here).
//   - BackgroundParsingScheduler not included (callers manage scheduling).
//   - The FileSystem interface comes from @context-towel/file-service.
//
// Usage:
//   import { FileParserService } from '@context-towel/parser'
//   import type { FileSystem } from '@context-towel/file-service'
//
//   const service = new FileParserService(myFileSystem)
//   registerBuiltinParsers(service)
//   await service.watchAndParse('/project/.context')

import type { FileSystem, FileChangeEvent } from '@context-towel/file-service'
import {
  clearCache,
  clearCacheForPathPrefix,
  getAllItems,
  getCacheStats,
  getCachedData,
  getCachedFile,
  getCachedFilesByPrefix,
  hasCachedEntriesForFile,
  hasCachedEntriesForPath,
  invalidateCache,
  updateCache,
} from './cache'
import { matchesPathPattern, normalizePath } from './path'
import type {
  ParseAllSubscriber,
  ParseResult,
  ParseSubscriber,
  ParsedFileData,
  ParserPlugin,
} from './types'
import {
  type AllSubscription,
  type Subscription,
  notifySubscriber,
  notifySubscribers,
  notifySubscribersForRemoval,
} from './subscriptions'

// ============================================================================
// FileParserService
// ============================================================================

export class FileParserService {
  private parsers = new Map<string, ParserPlugin>()
  private cache = new Map<string, ParsedFileData>()
  private subscriptions = new Map<number, Subscription>()
  private subscriptionId = 0
  private allSubscriptions = new Map<number, AllSubscription>()
  private allSubscriptionId = 0
  // Key: path, Value: { parserIds, unwatch, refCount }
  private watchedPaths = new Map<string, { parserIds: string[]; unwatch: () => void; refCount: number }>()
  private parseDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly fileSystem: FileSystem
  private fileServiceUnsubscribe: (() => void) | null = null

  // LRU cache settings
  private maxCacheSize = 100
  private cacheOrder: string[] = []

  constructor(fileSystem: FileSystem) {
    this.fileSystem = fileSystem
    this.fileServiceUnsubscribe = this.fileSystem.subscribe((event) => {
      this.handleFileServiceEvent(event)
    })
  }

  // --------------------------------------------------------------------------
  // Parser Registration
  // --------------------------------------------------------------------------

  registerParser<T>(plugin: ParserPlugin<T>): void {
    this.parsers.set(plugin.id, plugin as ParserPlugin)
  }

  unregisterParser(parserId: string): void {
    this.parsers.delete(parserId)
  }

  getParserIds(): string[] {
    return Array.from(this.parsers.keys())
  }

  // --------------------------------------------------------------------------
  // Watching & Parsing
  // --------------------------------------------------------------------------

  /**
   * Watch a path and parse files with the specified parsers.
   * Uses ref counting — multiple callers can watch the same path.
   * @returns Unwatch function for this specific caller.
   */
  async watchAndParse(
    path: string,
    parserIds?: string[],
    owner = 'file-parser',
    options?: { skipInitialParse?: boolean },
  ): Promise<() => void> {
    const normalizedPath = normalizePath(path)
    const effectiveParserIds = parserIds ?? Array.from(this.parsers.keys())

    const existing = this.watchedPaths.get(normalizedPath)
    if (existing) {
      existing.refCount++
      for (const id of effectiveParserIds) {
        if (!existing.parserIds.includes(id)) {
          existing.parserIds.push(id)
        }
      }
      return () => this.decrementWatch(normalizedPath)
    }

    const unwatch = await this.fileSystem.watch([normalizedPath], `${owner}-${normalizedPath}`)

    this.watchedPaths.set(normalizedPath, { parserIds: effectiveParserIds, unwatch, refCount: 1 })

    const shouldParse =
      !options?.skipInitialParse || !hasCachedEntriesForPath(this.cache, normalizedPath, effectiveParserIds)
    if (shouldParse) {
      await this.parseDirectory(normalizedPath, effectiveParserIds, {
        skipCached: options?.skipInitialParse ?? false,
      })
    }

    return () => this.decrementWatch(normalizedPath)
  }

  private decrementWatch(path: string): void {
    const watchInfo = this.watchedPaths.get(normalizePath(path))
    if (!watchInfo) return

    watchInfo.refCount -= 1
    if (watchInfo.refCount < 0) {
      console.warn('[FileParserService] Watch refCount below zero for', path)
      watchInfo.refCount = 0
    }

    if (watchInfo.refCount <= 0) {
      watchInfo.unwatch()
      this.watchedPaths.delete(path)
      this.cacheOrder = clearCacheForPathPrefix(this.cache, this.cacheOrder, path)
    }
  }

  forceUnwatch(path: string): void {
    const normalizedPath = normalizePath(path)
    const watchInfo = this.watchedPaths.get(normalizedPath)
    if (!watchInfo) return

    watchInfo.unwatch()
    this.watchedPaths.delete(normalizedPath)
    this.cacheOrder = clearCacheForPathPrefix(this.cache, this.cacheOrder, normalizedPath)
  }

  isWatching(path: string): boolean {
    return this.watchedPaths.has(normalizePath(path))
  }

  private handleFileServiceEvent(event: FileChangeEvent): void {
    const normalizedPath = normalizePath(event.path)
    for (const [watchPath, info] of this.watchedPaths.entries()) {
      if (normalizedPath === watchPath || normalizedPath.startsWith(`${watchPath}/`)) {
        this.handleFileChange(watchPath, info.parserIds, event)
      }
    }
  }

  getWatchedPaths(): Array<{ path: string; refCount: number; parserIds: string[] }> {
    return Array.from(this.watchedPaths.entries()).map(([path, info]) => ({
      path,
      refCount: info.refCount,
      parserIds: info.parserIds,
    }))
  }

  private handleFileChange(_watchPath: string, parserIds: string[], event: FileChangeEvent): void {
    const { path, type } = event

    if (!path.endsWith('.md')) return

    if (type === 'removed') {
      this.invalidateCache(path)
      this.notifySubscribersForRemoval(path)
    } else {
      this.debounceParse(path, parserIds)
    }
  }

  /**
   * Parse a single file by reading from the file system.
   */
  async parseFile(filePath: string, parserIds?: string[]): Promise<ParsedFileData | null> {
    try {
      const content = await this.fileSystem.read(filePath)
      return this.parseContent(filePath, content, parserIds)
    } catch (err) {
      console.error(`[FileParserService] Failed to read ${filePath}:`, err)
      return null
    }
  }

  /**
   * Parse content directly (without reading from disk).
   */
  parseContent(filePath: string, content: string, parserIds?: string[]): ParsedFileData {
    const effectiveParserIds = parserIds ?? Array.from(this.parsers.keys())
    const results = new Map<string, ParseResult>()

    for (const parserId of effectiveParserIds) {
      const parser = this.parsers.get(parserId)
      if (!parser) continue

      if (parser.extensions) {
        const ext = '.' + filePath.split('.').pop()
        if (!parser.extensions.includes(ext)) continue
      }

      if (!parser.detect(content)) continue

      try {
        const result = parser.parse(content, filePath)
        if (result.items.length > 0) {
          results.set(parserId, result)
        }
      } catch (err) {
        console.error(`[FileParserService] Parser '${parserId}' failed on ${filePath}:`, err)
      }
    }

    const data: ParsedFileData = {
      path: filePath,
      content,
      lastModified: Date.now(),
      results,
    }

    this.ingestParsedFileData(data)

    return data
  }

  /**
   * Parse all files in a directory (recursively).
   */
  async parseDirectory(dirPath: string, parserIds?: string[], options?: { skipCached?: boolean }): Promise<void> {
    try {
      const stat = await this.fileSystem.stat(dirPath)
      if (stat?.is_file) {
        await this.parseFile(dirPath, parserIds)
        return
      }

      const effectiveParserIds = parserIds ?? Array.from(this.parsers.keys())
      if (effectiveParserIds.length === 0) return

      const allowedExtensions = new Set<string>()
      let parseAll = false
      for (const parserId of effectiveParserIds) {
        const parser = this.parsers.get(parserId)
        if (!parser) continue
        if (!parser.extensions || parser.extensions.length === 0) {
          parseAll = true
          break
        }
        parser.extensions.forEach((ext) => allowedExtensions.add(ext.toLowerCase()))
      }

      const files = await this.fileSystem.listAllFiles(dirPath)
      const getExtension = (filePath: string): string => {
        const name = filePath.split('/').pop() ?? filePath
        const dot = name.lastIndexOf('.')
        if (dot === -1) return ''
        return name.slice(dot).toLowerCase()
      }

      const candidateFiles = parseAll ? files : files.filter((fp) => allowedExtensions.has(getExtension(fp)))

      const filesToParse = options?.skipCached
        ? candidateFiles.filter((fp) => !hasCachedEntriesForFile(this.cache, fp, effectiveParserIds))
        : candidateFiles

      const batchSize = 5
      for (let i = 0; i < filesToParse.length; i += batchSize) {
        const batch = filesToParse.slice(i, i + batchSize)
        await Promise.all(batch.map((f) => this.parseFile(f, parserIds)))
      }
    } catch (err) {
      console.error(`[FileParserService] Failed to parse directory ${dirPath}:`, err)
    }
  }

  // --------------------------------------------------------------------------
  // Subscriptions
  // --------------------------------------------------------------------------

  /**
   * Subscribe to parsed data updates for a specific parser.
   * @param parserId  Parser ID to watch.
   * @param pathPattern  Path prefix string or RegExp.
   * @param callback  Called with items whenever a matching file is re-parsed.
   * @returns Unsubscribe function.
   */
  subscribe<T = unknown>(parserId: string, pathPattern: string | RegExp, callback: ParseSubscriber<T>): () => void {
    const id = ++this.subscriptionId
    this.subscriptions.set(id, {
      parserId,
      pathPattern,
      callback: callback as ParseSubscriber,
    })

    // Immediately seed with current cached data
    this.notifySubscriber(id)

    return () => {
      this.subscriptions.delete(id)
    }
  }

  /**
   * Subscribe to ALL parsed data for files matching a pattern.
   * Callback receives the full ParsedFileData (content + all parser results).
   * @returns Unsubscribe function.
   */
  subscribeAll(pathPattern: string | RegExp, callback: ParseAllSubscriber): () => void {
    const id = ++this.allSubscriptionId
    this.allSubscriptions.set(id, {
      pathPattern,
      callback,
    })

    // Immediately seed with all currently cached matching files
    for (const [filePath, data] of this.cache) {
      if (matchesPathPattern(filePath, pathPattern)) {
        try {
          callback(filePath, data)
        } catch (e) {
          console.error('[FileParserService] subscribeAll callback error:', e)
        }
      }
    }

    return () => {
      this.allSubscriptions.delete(id)
    }
  }

  // --------------------------------------------------------------------------
  // Cache Accessors
  // --------------------------------------------------------------------------

  getCachedFile(filePath: string): ParsedFileData | undefined {
    return getCachedFile(this.cache, filePath)
  }

  getCachedFilesByPrefix(pathPrefix: string): ParsedFileData[] {
    return getCachedFilesByPrefix(this.cache, pathPrefix)
  }

  getCachedData<T = unknown>(parserId: string, pathPattern?: string | RegExp): Map<string, T[]> {
    return getCachedData<T>(this.cache, parserId, pathPattern)
  }

  getAllItems<T = unknown>(parserId: string, pathPattern?: string | RegExp): T[] {
    return getAllItems<T>(this.cache, parserId, pathPattern)
  }

  // --------------------------------------------------------------------------
  // Cache Management
  // --------------------------------------------------------------------------

  invalidateCache(filePath: string): void {
    this.cacheOrder = invalidateCache(this.cache, this.cacheOrder, filePath)
  }

  clearCache(): void {
    clearCache(this.cache)
    this.cacheOrder = []
  }

  getCacheStats(): { size: number; maxSize: number; paths: string[] } {
    return getCacheStats(this.cache, this.maxCacheSize)
  }

  /**
   * Hydrate cache from pre-parsed entries (e.g. from persisted storage).
   */
  hydrateCacheEntries(entries: ParsedFileData[]): void {
    for (const entry of entries) {
      this.ingestParsedFileData(entry)
    }
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private debounceParse(filePath: string, parserIds: string[]): void {
    const existing = this.parseDebounceTimers.get(filePath)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(async () => {
      this.parseDebounceTimers.delete(filePath)
      await this.parseFile(filePath, parserIds)
    }, 300)

    this.parseDebounceTimers.set(filePath, timer)
  }

  private ingestParsedFileData(data: ParsedFileData): void {
    this.cacheOrder = updateCache(this.cache, this.cacheOrder, this.maxCacheSize, data.path, data)
    this.notifySubscribers(data.path, data)
  }

  private notifySubscribers(filePath: string, data: ParsedFileData): void {
    notifySubscribers({
      filePath,
      data,
      subscriptions: this.subscriptions,
      allSubscriptions: this.allSubscriptions,
      getCachedData: <T = unknown>(parserId: string, pathPattern?: string | RegExp) =>
        this.getCachedData<T>(parserId, pathPattern),
    })
  }

  private notifySubscriber(subscriptionId: number): void {
    notifySubscriber({
      subscriptionId,
      subscriptions: this.subscriptions,
      getCachedData: <T = unknown>(parserId: string, pathPattern?: string | RegExp) =>
        this.getCachedData<T>(parserId, pathPattern),
    })
  }

  private notifySubscribersForRemoval(filePath: string): void {
    notifySubscribersForRemoval({
      filePath,
      subscriptions: this.subscriptions,
      allSubscriptions: this.allSubscriptions,
      getCachedData: <T = unknown>(parserId: string, pathPattern?: string | RegExp) =>
        this.getCachedData<T>(parserId, pathPattern),
    })
  }

  /**
   * Clean up all watchers, timers, and subscriptions.
   */
  dispose(): void {
    if (this.fileServiceUnsubscribe) {
      this.fileServiceUnsubscribe()
      this.fileServiceUnsubscribe = null
    }
    for (const [, info] of this.watchedPaths) {
      info.unwatch()
    }
    this.watchedPaths.clear()

    for (const timer of this.parseDebounceTimers.values()) {
      clearTimeout(timer)
    }
    this.parseDebounceTimers.clear()

    this.subscriptions.clear()
    this.allSubscriptions.clear()
    this.cache.clear()
  }
}
