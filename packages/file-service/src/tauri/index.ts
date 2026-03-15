/**
 * TauriFileService — FileSystem implementation backed by @tauri-apps/plugin-fs,
 * @tauri-apps/plugin-dialog, @tauri-apps/plugin-shell, and @tauri-apps/api/core.
 *
 * Platform binding: Tauri desktop apps only.
 */

import { invoke } from '@tauri-apps/api/core'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'

// Lazy import — plugin-shell may not be installed in all Tauri apps
let shellOpen: ((path: string) => Promise<void>) | null = null
import('@tauri-apps/plugin-shell')
  .then(mod => { shellOpen = mod.open })
  .catch(() => { /* plugin-shell not available */ })
import {
  copyFile,
  exists,
  mkdir,
  readFile,
  readDir,
  readTextFile,
  remove,
  rename,
  stat,
  watch as tauriWatch,
  writeTextFile,
} from '@tauri-apps/plugin-fs'
import type { WatchEvent } from '@tauri-apps/plugin-fs'
import { FileCache } from '../cache.js'
import { WatchManager } from '../watch.js'
import { RecentFilesManager } from '../recent.js'
import type { RecentFilesStorage } from '../recent.js'
import { normalizePath, HomeDirResolver, ensureDirectoryForFile } from '../path.js'
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
// TauriFileService
// ============================================================================

export class TauriFileService implements FileSystem {
  private readonly pathResolver = new HomeDirResolver()
  private readonly recentFilesManager: RecentFilesManager
  private readonly cache: FileCache
  private readonly watchManager: WatchManager

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
      resolvePath: (path) => this.pathResolver.resolvePath(path),
      resolvePathSync: (path) => this.pathResolver.resolvePathSync(path),
      resolveHomeDirSync: () => this.pathResolver.resolveSync(),
      read: (path) => this.read(path),
      stat: (path) => this.stat(path),
    })

    this.watchManager = new WatchManager({
      watch: (path, callback, opts) =>
        tauriWatch(path, (event: WatchEvent) => callback({ paths: event.paths, type: event.type as string }), opts),
      resolvePath: (path) => this.pathResolver.resolvePath(path),
      normalizePath,
      exists: (path) => this.exists(path),
      invalidateCache: (path) => this.cache.invalidateCache(path),
    })
  }

  // ============================================================================
  // Recent Files
  // ============================================================================

  addRecentFile(path: string, projectPath?: string): void {
    this.recentFilesManager.addRecentFile(path, projectPath)
  }

  getRecentFiles(projectPath?: string): RecentFile[] {
    return this.recentFilesManager.getRecentFiles(projectPath)
  }

  clearRecentFiles(): void {
    this.recentFilesManager.clearRecentFiles()
  }

  removeRecentFile(path: string): void {
    this.recentFilesManager.removeRecentFile(path)
  }

  onRecentFilesChange(listener: () => void): () => void {
    return this.recentFilesManager.onChange(listener)
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  async read(path: string): Promise<string> {
    const resolvedPath = await this.pathResolver.resolvePath(path)
    return await readTextFile(resolvedPath)
  }

  async readBinary(path: string): Promise<Uint8Array> {
    const resolvedPath = await this.pathResolver.resolvePath(path)
    return await readFile(resolvedPath)
  }

  async write(
    path: string,
    content: string,
    options?: { history?: boolean; historyKind?: string; projectPath?: string }
  ): Promise<void> {
    const resolvedPath = await this.pathResolver.resolvePath(path)
    await ensureDirectoryForFile(resolvedPath, (dir) => mkdir(dir, { recursive: true }))
    await writeTextFile(resolvedPath, content, { create: true })
    this.cache.invalidateCache(resolvedPath)

    if (options?.history === false) return

    try {
      await this.createSnapshot(
        resolvedPath,
        content,
        options?.historyKind ?? 'save',
        options?.projectPath
      )
    } catch (e) {
      console.error('[FileService] Failed to create history snapshot:', e)
    }
  }

  async append(
    path: string,
    content: string,
    options?: { history?: boolean; historyKind?: string; projectPath?: string }
  ): Promise<void> {
    const resolvedPath = await this.pathResolver.resolvePath(path)
    await ensureDirectoryForFile(resolvedPath, (dir) => mkdir(dir, { recursive: true }))
    await writeTextFile(resolvedPath, content, { append: true, create: true })
    this.cache.invalidateCache(resolvedPath)

    if (!options?.history) return

    try {
      const fullContent = await this.read(resolvedPath)
      await this.createSnapshot(
        resolvedPath,
        fullContent,
        options?.historyKind ?? 'append',
        options?.projectPath
      )
    } catch (e) {
      console.error('[FileService] Failed to create history snapshot:', e)
    }
  }

  async list(path: string): Promise<FileInfo[]> {
    let entries: Awaited<ReturnType<typeof readDir>> = []
    const resolvedPath = await this.pathResolver.resolvePath(path)
    try {
      entries = await readDir(resolvedPath)
    } catch {
      return []
    }
    const ignore = new Set(['node_modules', 'target', 'dist', 'build', '__pycache__', '.git', 'vendor'])
    const result = entries
      .filter((entry) => !ignore.has(entry.name))
      .map((entry) => ({
        name: entry.name,
        path: normalizePath(`${resolvedPath}/${entry.name}`),
        is_dir: entry.isDirectory,
      }))

    result.sort((a, b) => {
      if (a.is_dir !== b.is_dir) {
        return a.is_dir ? -1 : 1
      }
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    })

    return result
  }

  async exists(path: string): Promise<boolean> {
    const resolvedPath = await this.pathResolver.resolvePath(path)
    return await exists(resolvedPath)
  }

  async stat(path: string): Promise<FileStat | null> {
    const resolvedPath = await this.pathResolver.resolvePath(path)
    try {
      const info = await stat(resolvedPath)
      return {
        is_dir: info.isDirectory,
        is_file: info.isFile,
        size: info.size,
        readonly: info.readonly,
        mtimeMs: info.mtime ? info.mtime.getTime() : null,
      }
    } catch {
      return null
    }
  }

  async mkdir(path: string): Promise<void> {
    const resolvedPath = await this.pathResolver.resolvePath(path)
    await mkdir(resolvedPath, { recursive: true })
  }

  async remove(path: string): Promise<void> {
    const resolvedPath = await this.pathResolver.resolvePath(path)
    await remove(resolvedPath, { recursive: true })
    this.cache.invalidateCache(resolvedPath)
  }

  async rename(from: string, to: string): Promise<void> {
    const resolvedFrom = await this.pathResolver.resolvePath(from)
    const resolvedTo = await this.pathResolver.resolvePath(to)
    await rename(resolvedFrom, resolvedTo)
    this.cache.invalidateCache(resolvedFrom)
    this.cache.invalidateCache(resolvedTo)
  }

  async copy(from: string, to: string): Promise<void> {
    const resolvedFrom = await this.pathResolver.resolvePath(from)
    const resolvedTo = await this.pathResolver.resolvePath(to)
    await ensureDirectoryForFile(resolvedTo, (dir) => mkdir(dir, { recursive: true }))
    await copyFile(resolvedFrom, resolvedTo)
  }

  async createFile(path: string, content = ''): Promise<void> {
    await this.write(path, content)
  }

  // ============================================================================
  // Recursive Operations
  // ============================================================================

  async listAllFiles(path: string, excludes: string[] = []): Promise<string[]> {
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

    await walk(path)
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

  async readCached(path: string, forceFresh = false): Promise<string> {
    return await this.cache.readCached(path, forceFresh)
  }

  setCachedContent(path: string, content: string): void {
    this.cache.setCachedContent(path, content)
  }

  getCached(path: string): CachedFile | undefined {
    return this.cache.getCached(path)
  }

  invalidateCache(path: string): void {
    this.cache.invalidateCache(path)
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
  // File History (Tauri invoke)
  // ============================================================================

  setHistoryOptionsProvider(provider: FileHistoryOptionsProvider): void {
    this.historyOptionsProvider = provider
  }

  private getHistoryOptions() {
    return this.historyOptionsProvider()
  }

  async createSnapshot(path: string, content: string, kind = 'edit', projectPath?: string): Promise<void> {
    const options = this.getHistoryOptions()
    await invoke('history_create_snapshot', { request: { path, content, kind, projectPath, options } })
  }

  async listHistory(path: string, projectPath?: string): Promise<FileHistoryEntry[]> {
    const options = this.getHistoryOptions()
    return await invoke<FileHistoryEntry[]>('history_list', { request: { path, projectPath, options } })
  }

  async readHistoryEntry(path: string, id: string, projectPath?: string): Promise<string> {
    return await invoke<string>('history_read', { request: { path, id, projectPath } })
  }

  async deleteHistoryEntry(path: string, id: string, projectPath?: string): Promise<boolean> {
    return await invoke<boolean>('history_delete', { request: { path, id, projectPath } })
  }

  async clearHistory(path: string, projectPath?: string): Promise<number> {
    return await invoke<number>('history_clear', { request: { path, projectPath } })
  }

  // ============================================================================
  // Shell Operations
  // ============================================================================

  async open(path: string): Promise<void> {
    if (shellOpen) await shellOpen(path)
  }

  async reveal(path: string): Promise<void> {
    if (!shellOpen) return
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
    const parentDir = lastSlash > 0 ? path.substring(0, lastSlash) : path
    await shellOpen(parentDir)
  }

  // ============================================================================
  // Dialogs
  // ============================================================================

  async pickFile(options?: {
    title?: string
    defaultPath?: string
    filters?: Array<{ name: string; extensions: string[] }>
  }): Promise<string | null> {
    const result = await openDialog({
      title: options?.title,
      defaultPath: options?.defaultPath,
      filters: options?.filters,
      multiple: false,
      directory: false,
    })
    return result as string | null
  }

  async pickFolder(options?: {
    title?: string
    defaultPath?: string
  }): Promise<string | null> {
    const result = await openDialog({
      title: options?.title,
      defaultPath: options?.defaultPath,
      directory: true,
    })
    return result as string | null
  }

  async saveFileDialog(options?: {
    title?: string
    defaultPath?: string
    filters?: Array<{ name: string; extensions: string[] }>
  }): Promise<string | null> {
    return await saveDialog({
      title: options?.title,
      defaultPath: options?.defaultPath,
      filters: options?.filters,
    })
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  dispose(): void {
    this.watchManager.dispose()
    this.cache.clearCache()
  }
}
