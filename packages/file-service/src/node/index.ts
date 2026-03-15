/**
 * NodeFileService — FileSystem implementation backed by Node.js fs/promises
 * and chokidar for file watching.
 *
 * Platform binding: Node.js environments (CLI tools, servers, Electron main process).
 *
 * Note: Dialog methods (pickFile, pickFolder, saveFileDialog) and shell methods
 * (open, reveal) return null/noop — those are UI concerns not available in Node.
 * History methods use Tauri invoke and are not available here; createSnapshot,
 * listHistory, readHistoryEntry, deleteHistoryEntry, clearHistory are all noops/stubs.
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { watch as chokidarWatch } from 'chokidar'
import { FileCache } from '../cache.js'
import { WatchManager } from '../watch.js'
import { RecentFilesManager } from '../recent.js'
import type { RecentFilesStorage } from '../recent.js'
import { normalizePath, HomeDirResolver } from '../path.js'
import type {
  CachedFile,
  FileCacheStats,
  FileChangeListener,
  FileHistoryEntry,
  FileHistoryOptions,
  FileHistoryOptionsProvider,
  FileInfo,
  FileStat,
  FileSystem,
  FileWatchStat,
  RecentFile,
  TreeItem,
} from '../types.js'

// ============================================================================
// Constants
// ============================================================================

const RECENT_FILES_KEY = 'file-service-recent-files'
const RECENT_FILES_MAX = 20

const DEFAULT_HISTORY_OPTIONS: FileHistoryOptions = {
  enabled: false,
  maxFileEntries: 25,
  maxFileSizeKb: 256,
  mergeWindowSeconds: 60,
  maxAgeDays: 30,
  exclude: [],
  excludeBinary: true,
}

// ============================================================================
// NodeHomeDirResolver — overrides resolve() to use os.homedir()
// ============================================================================

class NodeHomeDirResolver extends HomeDirResolver {
  override async resolve(): Promise<string | null> {
    const existing = this.resolveSync()
    if (existing) return existing
    return os.homedir() || null
  }
}

// ============================================================================
// NodeFileService
// ============================================================================

export class NodeFileService implements FileSystem {
  private readonly pathResolver = new NodeHomeDirResolver()
  private readonly recentFilesManager: RecentFilesManager
  private readonly cache: FileCache
  private readonly watchManager: WatchManager

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private historyOptionsProvider: FileHistoryOptionsProvider

  constructor(options?: {
    historyOptionsProvider?: FileHistoryOptionsProvider
    recentFilesStorageKey?: string
    recentFilesMax?: number
    recentFilesStorage?: RecentFilesStorage
  }) {
    this.historyOptionsProvider = options?.historyOptionsProvider ?? (() => DEFAULT_HISTORY_OPTIONS)

    this.recentFilesManager = new RecentFilesManager({
      storageKey: options?.recentFilesStorageKey ?? RECENT_FILES_KEY,
      max: options?.recentFilesMax ?? RECENT_FILES_MAX,
      storage: options?.recentFilesStorage,
    })

    this.cache = new FileCache({
      normalizePath,
      resolvePath: (p) => this.pathResolver.resolvePath(p),
      resolvePathSync: (p) => this.pathResolver.resolvePathSync(p),
      resolveHomeDirSync: () => this.pathResolver.resolveSync(),
      read: (p) => this.read(p),
      stat: (p) => this.stat(p),
    })

    this.watchManager = new WatchManager({
      watch: (watchPath, callback, opts) => {
        return new Promise((resolve) => {
          const watcher = chokidarWatch(watchPath, {
            persistent: true,
            ignoreInitial: true,
            // chokidar v4: use depth instead of recursive (depth: undefined = unlimited)
            depth: opts?.recursive ? undefined : 0,
          })

          watcher.on('all', (event, filePath) => {
            callback({ paths: [filePath], type: event })
          })

          watcher.on('ready', () => {
            resolve(() => {
              void watcher.close()
            })
          })
        })
      },
      resolvePath: (p) => this.pathResolver.resolvePath(p),
      normalizePath,
      exists: (p) => this.exists(p),
      invalidateCache: (p) => this.cache.invalidateCache(p),
    })
  }

  // ============================================================================
  // Recent Files
  // ============================================================================

  addRecentFile(filePath: string, projectPath?: string): void {
    this.recentFilesManager.addRecentFile(filePath, projectPath)
  }

  getRecentFiles(projectPath?: string): RecentFile[] {
    return this.recentFilesManager.getRecentFiles(projectPath)
  }

  clearRecentFiles(): void {
    this.recentFilesManager.clearRecentFiles()
  }

  removeRecentFile(filePath: string): void {
    this.recentFilesManager.removeRecentFile(filePath)
  }

  onRecentFilesChange(listener: () => void): () => void {
    return this.recentFilesManager.onChange(listener)
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  async read(filePath: string): Promise<string> {
    const resolved = await this.pathResolver.resolvePath(filePath)
    return await fs.readFile(resolved, 'utf8')
  }

  async readBinary(filePath: string): Promise<Uint8Array> {
    const resolved = await this.pathResolver.resolvePath(filePath)
    const buf = await fs.readFile(resolved)
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  }

  async write(
    filePath: string,
    content: string,
    options?: { history?: boolean; historyKind?: string; projectPath?: string }
  ): Promise<void> {
    const resolved = await this.pathResolver.resolvePath(filePath)
    const parent = path.dirname(resolved)
    await fs.mkdir(parent, { recursive: true })
    await fs.writeFile(resolved, content, 'utf8')
    this.cache.invalidateCache(resolved)
    // History not available in Node backend
    void options
  }

  async append(
    filePath: string,
    content: string,
    options?: { history?: boolean; historyKind?: string; projectPath?: string }
  ): Promise<void> {
    const resolved = await this.pathResolver.resolvePath(filePath)
    const parent = path.dirname(resolved)
    await fs.mkdir(parent, { recursive: true })
    await fs.appendFile(resolved, content, 'utf8')
    this.cache.invalidateCache(resolved)
    void options
  }

  async list(dirPath: string): Promise<FileInfo[]> {
    const resolved = await this.pathResolver.resolvePath(dirPath)
    let entries: { name: string; isDirectory(): boolean }[] = []
    try {
      entries = await fs.readdir(resolved, { withFileTypes: true })
    } catch {
      return []
    }
    const ignore = new Set(['node_modules', 'target', 'dist', 'build', '__pycache__', '.git', 'vendor'])
    const result = entries
      .filter((entry) => !ignore.has(entry.name))
      .map((entry) => ({
        name: entry.name,
        path: normalizePath(`${resolved}/${entry.name}`),
        is_dir: entry.isDirectory(),
      }))

    result.sort((a, b) => {
      if (a.is_dir !== b.is_dir) {
        return a.is_dir ? -1 : 1
      }
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    })

    return result
  }

  async exists(filePath: string): Promise<boolean> {
    const resolved = await this.pathResolver.resolvePath(filePath)
    try {
      await fs.access(resolved)
      return true
    } catch {
      return false
    }
  }

  async stat(filePath: string): Promise<FileStat | null> {
    const resolved = await this.pathResolver.resolvePath(filePath)
    try {
      const info = await fs.stat(resolved)
      return {
        is_dir: info.isDirectory(),
        is_file: info.isFile(),
        size: info.size,
        readonly: false, // Node stat doesn't expose readonly directly
        mtimeMs: info.mtimeMs,
      }
    } catch {
      return null
    }
  }

  async mkdir(dirPath: string): Promise<void> {
    const resolved = await this.pathResolver.resolvePath(dirPath)
    await fs.mkdir(resolved, { recursive: true })
  }

  async remove(filePath: string): Promise<void> {
    const resolved = await this.pathResolver.resolvePath(filePath)
    await fs.rm(resolved, { recursive: true, force: true })
    this.cache.invalidateCache(resolved)
  }

  async rename(from: string, to: string): Promise<void> {
    const resolvedFrom = await this.pathResolver.resolvePath(from)
    const resolvedTo = await this.pathResolver.resolvePath(to)
    await fs.rename(resolvedFrom, resolvedTo)
    this.cache.invalidateCache(resolvedFrom)
    this.cache.invalidateCache(resolvedTo)
  }

  async copy(from: string, to: string): Promise<void> {
    const resolvedFrom = await this.pathResolver.resolvePath(from)
    const resolvedTo = await this.pathResolver.resolvePath(to)
    const parent = path.dirname(resolvedTo)
    await fs.mkdir(parent, { recursive: true })
    await fs.copyFile(resolvedFrom, resolvedTo)
  }

  async createFile(filePath: string, content = ''): Promise<void> {
    await this.write(filePath, content)
  }

  // ============================================================================
  // Recursive Operations
  // ============================================================================

  async listAllFiles(dirPath: string, excludes: string[] = []): Promise<string[]> {
    const results: string[] = []

    const walk = async (dir: string): Promise<void> => {
      const entries = await this.list(dir)

      for (const entry of entries) {
        const shouldExclude = excludes.some(
          (pattern) =>
            entry.name === pattern ||
            entry.name.startsWith(pattern) ||
            entry.path.includes(`/${pattern}/`) ||
            entry.path.includes(`\\${pattern}\\`)
        )

        if (shouldExclude) continue

        if (entry.is_dir) {
          await walk(entry.path)
        } else {
          results.push(entry.path)
        }
      }
    }

    await walk(dirPath)
    return results
  }

  async getFileTree(rootPath: string, relativeTo?: string): Promise<TreeItem[]> {
    const results: TreeItem[] = []
    const resolvedRoot = await this.pathResolver.resolvePath(rootPath)
    const resolvedRelative = relativeTo ? await this.pathResolver.resolvePath(relativeTo) : resolvedRoot
    const baseForRelative = resolvedRelative || resolvedRoot

    const walk = async (dir: string): Promise<void> => {
      const entries = await this.list(dir)

      for (const entry of entries) {
        let relativePath = entry.path
        if (entry.path.startsWith(baseForRelative)) {
          relativePath = entry.path.slice(baseForRelative.length)
          if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
            relativePath = relativePath.slice(1)
          }
        }

        results.push({
          id: relativePath,
          name: entry.name,
          path: entry.path,
          is_dir: entry.is_dir,
        })

        if (entry.is_dir) {
          await walk(entry.path)
        }
      }
    }

    await walk(resolvedRoot)
    return results
  }

  // ============================================================================
  // Cache
  // ============================================================================

  async readCached(filePath: string, forceFresh = false): Promise<string> {
    return await this.cache.readCached(filePath, forceFresh)
  }

  setCachedContent(filePath: string, content: string): void {
    this.cache.setCachedContent(filePath, content)
  }

  getCached(filePath: string): CachedFile | undefined {
    return this.cache.getCached(filePath)
  }

  invalidateCache(filePath: string): void {
    this.cache.invalidateCache(filePath)
  }

  clearCache(): void {
    this.cache.clearCache()
  }

  // ============================================================================
  // File Watching
  // ============================================================================

  async watch(paths: string[], ownerId: string, listener?: FileChangeListener): Promise<() => void> {
    return await this.watchManager.watch(paths, ownerId, listener)
  }

  subscribe(listener: FileChangeListener): () => void {
    return this.watchManager.subscribe(listener)
  }

  getWatchedPaths(): string[] {
    return this.watchManager.getWatchedPaths()
  }

  getWatchStats(): FileWatchStat[] {
    return this.watchManager.getWatchStats()
  }

  getCacheStats(): FileCacheStats {
    return this.cache.getCacheStats()
  }

  // ============================================================================
  // File History — not available in Node backend
  // ============================================================================

  setHistoryOptionsProvider(_provider: FileHistoryOptionsProvider): void {
    // No-op: history requires Tauri invoke
  }

  async createSnapshot(_path: string, _content: string, _kind?: string, _projectPath?: string): Promise<void> {
    // No-op: history requires Tauri invoke
  }

  async listHistory(_path: string, _projectPath?: string): Promise<FileHistoryEntry[]> {
    return []
  }

  async readHistoryEntry(_path: string, _id: string, _projectPath?: string): Promise<string> {
    throw new Error('File history is not available in NodeFileService')
  }

  async deleteHistoryEntry(_path: string, _id: string, _projectPath?: string): Promise<boolean> {
    return false
  }

  async clearHistory(_path: string, _projectPath?: string): Promise<number> {
    return 0
  }

  // ============================================================================
  // Shell Operations — not available in Node backend
  // ============================================================================

  async open(_path: string): Promise<void> {
    // No-op: shell open is a UI concern
  }

  async reveal(_path: string): Promise<void> {
    // No-op: reveal in Finder/Explorer is a UI concern
  }

  // ============================================================================
  // Dialogs — not available in Node backend
  // ============================================================================

  async pickFile(_options?: {
    title?: string
    defaultPath?: string
    filters?: Array<{ name: string; extensions: string[] }>
  }): Promise<string | null> {
    return null
  }

  async pickFolder(_options?: {
    title?: string
    defaultPath?: string
  }): Promise<string | null> {
    return null
  }

  async saveFileDialog(_options?: {
    title?: string
    defaultPath?: string
    filters?: Array<{ name: string; extensions: string[] }>
  }): Promise<string | null> {
    return null
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  dispose(): void {
    this.watchManager.dispose()
    this.cache.clearCache()
  }
}
