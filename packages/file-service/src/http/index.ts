/**
 * HttpFileService — FileSystem implementation that calls REST endpoints.
 *
 * Adapted from Felix's DaemonFileService. The current implementation is
 * read-oriented; write/mkdir/remove/rename/copy are stubs that do nothing.
 * History, dialog, and shell methods are also stubs — callers should not rely
 * on them until the backing REST API supports them.
 *
 * Platform binding: any environment with fetch (browser, Node 18+, Deno, etc.)
 */

import type {
  CachedFile,
  FileCacheStats,
  FileChangeListener,
  FileHistoryEntry,
  FileHistoryOptionsProvider,
  FileInfo,
  FileStat,
  FileSystem,
  FileWatchStat,
  RecentFile,
  TreeItem,
} from '../types.js'

// ============================================================================
// HttpFileService
// ============================================================================

export class HttpFileService implements FileSystem {
  constructor(
    /**
     * Base URL of the daemon REST API, e.g. "http://localhost:7100".
     * Trailing slashes are trimmed automatically.
     */
    private readonly baseUrl: string
  ) {}

  private url(path: string): string {
    const base = this.baseUrl.replace(/\/+$/, '')
    return `${base}${path}`
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(this.url(path))
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} — ${path}`)
    }
    return response.json() as Promise<T>
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  async read(filePath: string): Promise<string> {
    const { content } = await this.fetchJson<{ content: string }>(
      `/api/fs/read?path=${encodeURIComponent(filePath)}`
    )
    return content
  }

  async readBinary(filePath: string): Promise<Uint8Array> {
    const response = await fetch(this.url(`/api/fs/read-binary?path=${encodeURIComponent(filePath)}`))
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} — /api/fs/read-binary`)
    }
    const buf = await response.arrayBuffer()
    return new Uint8Array(buf)
  }

  async write(_path: string, _content: string): Promise<void> {
    // Not implemented — HTTP backend is currently read-oriented
  }

  async append(_path: string, _content: string): Promise<void> {
    // Not implemented — HTTP backend is currently read-oriented
  }

  async list(dirPath: string): Promise<FileInfo[]> {
    const { entries } = await this.fetchJson<{ entries: FileInfo[] }>(
      `/api/fs/list?path=${encodeURIComponent(dirPath)}`
    )
    return entries
  }

  async exists(filePath: string): Promise<boolean> {
    const { exists } = await this.fetchJson<{ exists: boolean }>(
      `/api/fs/exists?path=${encodeURIComponent(filePath)}`
    )
    return exists
  }

  async stat(filePath: string): Promise<FileStat | null> {
    const result = await this.fetchJson<{ is_dir: boolean; is_file: boolean; size: number; readonly: boolean; mtimeMs?: number | null } | null>(
      `/api/fs/stat?path=${encodeURIComponent(filePath)}`
    )
    return result
  }

  async mkdir(_dirPath: string): Promise<void> {
    // Not implemented — HTTP backend is currently read-oriented
  }

  async remove(_filePath: string): Promise<void> {
    // Not implemented — HTTP backend is currently read-oriented
  }

  async rename(_from: string, _to: string): Promise<void> {
    // Not implemented — HTTP backend is currently read-oriented
  }

  async copy(_from: string, _to: string): Promise<void> {
    // Not implemented — HTTP backend is currently read-oriented
  }

  async createFile(_path: string, _content?: string): Promise<void> {
    // Not implemented — HTTP backend is currently read-oriented
  }

  // ============================================================================
  // Recursive Operations
  // ============================================================================

  async listAllFiles(rootPath: string, excludes?: string[]): Promise<string[]> {
    let url = `/api/fs/list-all?root=${encodeURIComponent(rootPath)}`
    if (excludes && excludes.length > 0) {
      url += `&excludes=${encodeURIComponent(excludes.join(','))}`
    }
    const { files } = await this.fetchJson<{ files: string[] }>(url)
    return files
  }

  async getFileTree(rootPath: string, relativeTo?: string): Promise<TreeItem[]> {
    let url = `/api/fs/tree?root=${encodeURIComponent(rootPath)}`
    if (relativeTo) {
      url += `&relativeTo=${encodeURIComponent(relativeTo)}`
    }
    const { tree } = await this.fetchJson<{ tree: TreeItem[] }>(url)
    return tree
  }

  // ============================================================================
  // Cache — HTTP backend has no local cache
  // ============================================================================

  async readCached(filePath: string, _forceFresh?: boolean): Promise<string> {
    return this.read(filePath)
  }

  getCached(_path: string): CachedFile | undefined {
    return undefined
  }

  setCachedContent(_path: string, _content: string): void {
    // No local cache in HTTP backend
  }

  invalidateCache(_path: string): void {
    // No local cache in HTTP backend
  }

  getCacheStats(): FileCacheStats {
    return { size: 0, maxSize: 0, paths: [] }
  }

  // ============================================================================
  // File Watching — stubbed, watch is not supported over REST
  // ============================================================================

  async watch(
    _paths: string[],
    _ownerId: string,
    _listener?: FileChangeListener
  ): Promise<() => void> {
    return () => {}
  }

  subscribe(_listener: FileChangeListener): () => void {
    return () => {}
  }

  getWatchedPaths(): string[] {
    return []
  }

  getWatchStats(): FileWatchStat[] {
    return []
  }

  // ============================================================================
  // File History — not available in HTTP backend
  // ============================================================================

  setHistoryOptionsProvider(_provider: FileHistoryOptionsProvider): void {
    // No-op
  }

  async createSnapshot(_path: string, _content: string, _kind?: string, _projectPath?: string): Promise<void> {
    // Not implemented
  }

  async listHistory(_path: string, _projectPath?: string): Promise<FileHistoryEntry[]> {
    return []
  }

  async readHistoryEntry(_path: string, _id: string, _projectPath?: string): Promise<string> {
    throw new Error('File history is not available in HttpFileService')
  }

  async deleteHistoryEntry(_path: string, _id: string, _projectPath?: string): Promise<boolean> {
    return false
  }

  async clearHistory(_path: string, _projectPath?: string): Promise<number> {
    return 0
  }

  // ============================================================================
  // Recent Files — in-memory only (no persistence in HTTP backend)
  // ============================================================================

  private recentFiles: RecentFile[] = []
  private recentListeners = new Set<() => void>()

  addRecentFile(filePath: string, projectPath?: string): void {
    const name = filePath.split('/').pop() || filePath
    this.recentFiles = this.recentFiles.filter((f) => f.path !== filePath)
    this.recentFiles.unshift({ path: filePath, name, timestamp: Date.now(), projectPath })
    if (this.recentFiles.length > 20) {
      this.recentFiles = this.recentFiles.slice(0, 20)
    }
    for (const l of this.recentListeners) l()
  }

  getRecentFiles(projectPath?: string): RecentFile[] {
    if (projectPath) {
      return this.recentFiles.filter((f) => f.projectPath === projectPath)
    }
    return [...this.recentFiles]
  }

  clearRecentFiles(): void {
    this.recentFiles = []
    for (const l of this.recentListeners) l()
  }

  removeRecentFile(filePath: string): void {
    this.recentFiles = this.recentFiles.filter((f) => f.path !== filePath)
    for (const l of this.recentListeners) l()
  }

  onRecentFilesChange(listener: () => void): () => void {
    this.recentListeners.add(listener)
    return () => this.recentListeners.delete(listener)
  }

  // ============================================================================
  // Shell + Dialogs — not available in HTTP backend
  // ============================================================================

  async open(_path: string): Promise<void> {
    // No-op
  }

  async reveal(_path: string): Promise<void> {
    // No-op
  }

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
    this.recentListeners.clear()
    this.recentFiles = []
  }
}
