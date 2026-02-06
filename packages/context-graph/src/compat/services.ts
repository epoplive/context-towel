// Service interfaces — replace LG's fileService/fileParserService
// In the standalone graph, these are backed by the channel API

import type { TreeItem } from '../types'

// -- File change types (from LG's FileServiceCore) --
export interface FileChangeEvent {
  type: 'modified' | 'created' | 'removed' | 'renamed'
  path: string
  targetPath?: string
}
export type FileChangeListener = (event: FileChangeEvent) => void

/** File service interface — host provides implementation via channel */
export interface FileServiceInterface {
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
  getFileTree(rootPath: string): Promise<TreeItem[]>
  watch(paths: string[], owner: string, listener?: FileChangeListener): Promise<() => void>
  list(dirPath: string): Promise<{ name: string; path: string; is_dir: boolean }[]>
  mkdir(dirPath: string): Promise<void>
  remove(filePath: string): Promise<void>
  stat(filePath: string): Promise<{ size: number; modified: number } | null>
  listAllFiles(rootPath: string, extensions?: string[]): Promise<string[]>
}

/** File parser service interface — will be replaced by card library */
export interface FileParserServiceInterface {
  parse(path: string, content: string): Promise<ParsedContent>
  subscribe(path: string, callback: (parsed: ParsedContent) => void): () => void
  registerParser(plugin: ParserPlugin): void
  watchAndParse(rootPath: string, parserIds?: string[], owner?: string): Promise<() => void>
  subscribeAll(pathPattern: string | RegExp, handler: (filePath: string, data: ParsedFileData) => void): () => void
  getCachedFile(filePath: string): ParsedFileData | undefined
  parseFile(filePath: string): Promise<ParsedFileData | null>
  parseContent(filePath: string, content: string): Promise<ParsedFileData>
  getParserIds(): string[]
  unregisterParser(id: string): void
}

export interface ParsedContent {
  tasks: any[]
  sections: any[]
  checklists: any[]
  diagrams: any[]
  links: any[]
  toc: any[]
  blocks: any[]
}

// ParsedFileData — actual shape from LG's FileParserCore
export interface ParsedFileData {
  path: string
  content: string
  lastModified: number
  results: Map<string, ParseResult>
}

// Noop implementations for development/testing
const emptyParsed: ParsedContent = { tasks: [], sections: [], checklists: [], diagrams: [], links: [], toc: [], blocks: [] }

export const noopFileService: FileServiceInterface = {
  async read() { return '' },
  async write() {},
  async exists() { return false },
  async getFileTree() { return [] },
  async watch() { return () => {} },
  async list() { return [] },
  async mkdir() {},
  async remove() {},
  async stat() { return null },
  async listAllFiles() { return [] },
}

const emptyFileData: ParsedFileData = { path: '', content: '', lastModified: 0, results: new Map() }

export const noopFileParserService: FileParserServiceInterface = {
  async parse() { return emptyParsed },
  subscribe() { return () => {} },
  registerParser() {},
  async watchAndParse() { return () => {} },
  subscribeAll() { return () => {} },
  getCachedFile() { return undefined },
  async parseFile() { return null },
  async parseContent() { return emptyFileData },
  getParserIds() { return [] },
  unregisterParser() {},
}

// Default service instances — host should configure these.
// Use `configureCompatServices()` in the host app (Looking Glass / Felix / etc).
export let fileService: FileServiceInterface = noopFileService
export let fileParserService: FileParserServiceInterface = noopFileParserService

export function configureCompatServices(next: {
  fileService?: FileServiceInterface
  fileParserService?: FileParserServiceInterface
}): void {
  if (next.fileService) {
    fileService = next.fileService
  }
  if (next.fileParserService) {
    fileParserService = next.fileParserService
  }
}

export function resetCompatServices(): void {
  fileService = noopFileService
  fileParserService = noopFileParserService
}

// -- Parser plugin type (from LG's FileParserCore) --
export interface ParseResult<T = unknown> {
  pluginId: string
  items: T[]
  rawMatches?: Array<{
    start: number
    end: number
    startLine: number
    endLine: number
    content: string
  }>
}

export interface ParserPlugin<T = unknown> {
  id: string
  detect: (content: string) => boolean
  parse: (content: string, filePath: string) => ParseResult<T>
  extensions?: string[]
}
