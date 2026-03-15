// ============================================================================
// @context-towel/parser — Public API
// ============================================================================
//
// The package provides:
//   - FileParserService  — pluggable, cacheable, reactive file parser
//   - registerBuiltinParsers() — registers all 7 built-in parsers
//   - All core types
//   - path / cache / subscription utilities (for advanced usage)
//
// Typical usage:
//   import { FileParserService, registerBuiltinParsers } from '@context-towel/parser'
//   import type { FileSystem } from '@context-towel/file-service'
//
//   const service = new FileParserService(myFileSystem)
//   registerBuiltinParsers(service)
//   const data = service.parseContent('/path/file.md', markdownString)

// Core types
export type {
  SourceMatch,
  ExtractedItem,
  ParseResult,
  ParserPlugin,
  ParsedFileData,
  SerializedParsedFileData,
  ParsedContent,
  ParseSubscriber,
  ParseAllSubscriber,
  // Item shapes
  TaskStatus,
  TaskPriority,
  ChecklistItem,
  LogEntry,
  TaskItem,
  SectionCounts,
  TocSection,
  ChecklistGroup,
  DiagramItem,
  LinkKind,
  LinkItem,
  LogSection,
  BlockItem,
} from './types'

// Service
export { FileParserService } from './service'

// Built-in plugin registration
export { registerBuiltinParsers } from './plugins/index'

// Path utilities
export { normalizePath, matchesPathPattern } from './path'

// Cache utilities (for advanced consumers, e.g. building custom service wrappers)
export {
  getCachedFile,
  getCachedFilesByPrefix,
  getCachedData,
  getAllItems,
  invalidateCache,
  clearCache,
  getCacheStats,
  updateCache,
  clearCacheForPathPrefix,
  hasCachedEntriesForFile,
  hasCachedEntriesForPath,
} from './cache'

// Subscription types (for consumers building custom notification logic)
export type { Subscription, AllSubscription } from './subscriptions'
export { notifySubscribers, notifySubscriber, notifySubscribersForRemoval } from './subscriptions'
