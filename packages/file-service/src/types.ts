export interface FileInfo {
  name: string
  path: string
  is_dir: boolean
}

export interface TreeItem {
  id: string
  name: string
  path: string
  is_dir: boolean
}

export interface FileStat {
  is_dir: boolean
  is_file: boolean
  size: number
  readonly: boolean
  mtimeMs?: number | null
}

export interface FileChangeEvent {
  type: 'modified' | 'created' | 'removed' | 'renamed'
  path: string
  targetPath?: string // for rename events
}

export type FileChangeListener = (event: FileChangeEvent) => void

export interface FileWatchStat {
  path: string
  refCount: number
  subscriberCount: number
}

export interface FileCacheStats {
  size: number
  maxSize: number
  paths: string[]
}

export interface CachedFile {
  content: string
  mtime: number
  dirty: boolean
}

export interface FileHistoryEntry {
  id: string
  timestamp: number
  kind: string
  path: string
  size: number
  hash: string
  label?: string | null
  description?: string | null
}

export interface RecentFile {
  path: string
  name: string
  timestamp: number
  projectPath?: string
}

export interface FileHistoryOptions {
  enabled: boolean
  maxFileEntries: number
  maxFileSizeKb: number
  mergeWindowSeconds: number
  maxAgeDays: number
  exclude: string[]
  excludeBinary: boolean
}

export type FileHistoryOptionsProvider = () => FileHistoryOptions

export interface FileSystem {
  read(path: string): Promise<string>
  readBinary(path: string): Promise<Uint8Array>
  write(path: string, content: string, options?: { history?: boolean; historyKind?: string; projectPath?: string }): Promise<void>
  append(path: string, content: string, options?: { history?: boolean; historyKind?: string; projectPath?: string }): Promise<void>
  list(path: string): Promise<FileInfo[]>
  listAllFiles(path: string, excludes?: string[]): Promise<string[]>
  getFileTree(rootPath: string, relativeTo?: string): Promise<TreeItem[]>
  exists(path: string): Promise<boolean>
  stat(path: string): Promise<FileStat | null>
  mkdir(path: string): Promise<void>
  remove(path: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  copy(from: string, to: string): Promise<void>
  createFile(path: string, content?: string): Promise<void>
  readCached(path: string, forceFresh?: boolean): Promise<string>
  getCached(path: string): CachedFile | undefined
  setCachedContent(path: string, content: string): void
  invalidateCache(path: string): void
  watch(paths: string[], ownerId: string, listener?: FileChangeListener): Promise<() => void>
  subscribe(listener: FileChangeListener): () => void
  getWatchedPaths(): string[]
  getWatchStats(): FileWatchStat[]
  getCacheStats(): FileCacheStats
  createSnapshot(path: string, content: string, kind?: string, projectPath?: string): Promise<void>
  listHistory(path: string, projectPath?: string): Promise<FileHistoryEntry[]>
  readHistoryEntry(path: string, id: string, projectPath?: string): Promise<string>
  deleteHistoryEntry(path: string, id: string, projectPath?: string): Promise<boolean>
  clearHistory(path: string, projectPath?: string): Promise<number>
  open(path: string): Promise<void>
  reveal(path: string): Promise<void>
  pickFile(options?: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }): Promise<string | null>
  pickFolder(options?: { title?: string; defaultPath?: string }): Promise<string | null>
  saveFileDialog(options?: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }): Promise<string | null>
  addRecentFile(path: string, projectPath?: string): void
  getRecentFiles(projectPath?: string): RecentFile[]
  clearRecentFiles(): void
  removeRecentFile(path: string): void
  onRecentFilesChange(listener: () => void): () => void
  setHistoryOptionsProvider(provider: FileHistoryOptionsProvider): void
  dispose(): void
}
