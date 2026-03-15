/**
 * Initialize context-graph compat services with real implementations
 * from @context-towel/file-service and @context-towel/parser.
 *
 * This bridges the standalone Tauri app to the graph's service layer,
 * replacing the noop stubs so the graph actually loads and parses files.
 */

import { TauriFileService } from '@context-towel/file-service/tauri'
import { FileParserService, registerBuiltinParsers } from '@context-towel/parser'
import {
  configureCompatServices,
  type FileServiceInterface,
  type FileParserServiceInterface,
  type ParsedContent,
} from '@context-towel/context-graph/compat/services'
import type { ParsedFileData } from '@context-towel/parser'

// Create the real services
const tauriFs = new TauriFileService()

// Parser needs a FileSystem — TauriFileService implements it
const parser = new FileParserService(tauriFs)
registerBuiltinParsers(parser)

// -- Compat adapters --
// The compat interfaces are slightly different shapes than the real ones.
// These thin adapters bridge the gap until context-graph imports directly.

function toParsedContent(data: ParsedFileData): ParsedContent {
  const getItems = (pluginId: string) => data.results.get(pluginId)?.items ?? []
  return {
    tasks: getItems('task'),
    sections: getItems('toc'),
    checklists: getItems('checklist'),
    diagrams: getItems('diagram'),
    links: getItems('link'),
    toc: getItems('toc'),
    blocks: getItems('block'),
  }
}

const getExtension = (filePath: string): string => {
  const name = filePath.split('/').pop() ?? filePath
  const dot = name.lastIndexOf('.')
  if (dot === -1) return ''
  return name.slice(dot).toLowerCase()
}

const normalizeExt = (ext: string): string => {
  const trimmed = ext.trim().toLowerCase()
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`
}

const compatFileService: FileServiceInterface = {
  read: (path) => tauriFs.read(path),
  write: (path, content) => tauriFs.write(path, content),
  exists: (path) => tauriFs.exists(path),
  getFileTree: (rootPath) => tauriFs.getFileTree(rootPath),
  watch: (paths, owner, listener) => tauriFs.watch(paths, owner, listener),
  list: async (dirPath) => {
    const entries = await tauriFs.list(dirPath)
    return entries.map(e => ({ name: e.name, path: e.path, is_dir: e.is_dir }))
  },
  mkdir: (dirPath) => tauriFs.mkdir(dirPath),
  remove: (filePath) => tauriFs.remove(filePath),
  stat: async (filePath) => {
    const s = await tauriFs.stat(filePath)
    if (!s) return null
    return { size: s.size, modified: s.mtimeMs ?? 0 }
  },
  listAllFiles: async (rootPath, extensions) => {
    const files = await tauriFs.listAllFiles(rootPath)
    if (!extensions || extensions.length === 0) return files
    const allowed = new Set(extensions.map(normalizeExt))
    return files.filter((fp) => allowed.has(getExtension(fp)))
  },
}

const compatParserService: FileParserServiceInterface = {
  parse: async (path, content) => toParsedContent(parser.parseContent(path, content)),
  subscribe: (path, callback) => {
    return parser.subscribeAll(path, (_filePath, data) => {
      callback(toParsedContent(data))
    })
  },
  registerParser: (plugin) => parser.registerParser(plugin),
  watchAndParse: (rootPath, parserIds, owner) => parser.watchAndParse(rootPath, parserIds, owner),
  subscribeAll: (pathPattern, handler) => parser.subscribeAll(pathPattern, handler),
  getCachedFile: (filePath) => parser.getCachedFile(filePath),
  parseFile: (filePath) => parser.parseFile(filePath),
  parseContent: async (filePath, content) => parser.parseContent(filePath, content),
  getParserIds: () => parser.getParserIds(),
  unregisterParser: (id) => parser.unregisterParser(id),
}

export function initServices() {
  configureCompatServices({
    fileService: compatFileService,
    fileParserService: compatParserService,
  })
}
