export type {
  CachedFile,
  FileCacheStats,
  FileChangeEvent,
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
} from './types.js'

export { FileCache } from './cache.js'
export { RecentFilesManager } from './recent.js'
export type { RecentFilesStorage } from './recent.js'
export { normalizePath, HomeDirResolver, ensureDirectoryForFile } from './path.js'
export { WatchManager } from './watch.js'
export type { WatchFn } from './watch.js'
