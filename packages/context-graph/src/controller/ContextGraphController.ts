import type { TreeItem } from '../types'
import type { FileChangeListener, ParsedFileData } from '../compat/services'
import { fileService, fileParserService } from '../compat/services'
import { registerContextGraphParsers } from '../plugins/fileParserAdapter'

export type ContextGraphController = {
  ensureParsersRegistered: () => Promise<void>
  getFileTree: (rootPath: string) => Promise<TreeItem[]>
  watchParsedRoot: (rootPath: string, owner: string) => Promise<() => void>
  subscribeParsedRoot: (pathPattern: string | RegExp, handler: (filePath: string, data: ParsedFileData) => void) => () => void
  watchTreePaths: (paths: string[], owner: string, handler: FileChangeListener) => Promise<() => void>
  getCachedFile: (filePath: string) => ParsedFileData | undefined
  loadParsedFile: (filePath: string) => Promise<ParsedFileData | null>
  parseContent: (filePath: string, content: string) => Promise<ParsedFileData>
}

export type ContextGraphControllerDeps = {
  fileService: Pick<typeof fileService, 'getFileTree' | 'watch'>
  fileParserService: Pick<typeof fileParserService, 'watchAndParse' | 'subscribeAll' | 'getCachedFile' | 'parseFile' | 'parseContent'>
  registerParsers: () => Promise<void>
}

const defaultDeps: ContextGraphControllerDeps = {
  fileService,
  fileParserService,
  registerParsers: registerContextGraphParsers,
}

export const createContextGraphController = (
  deps: ContextGraphControllerDeps = defaultDeps
): ContextGraphController => {
  let parsersRegistered = false
  let parsersRegistrationPromise: Promise<void> | null = null

  const ensureParsersRegistered = async (): Promise<void> => {
    if (parsersRegistered) {
      await (parsersRegistrationPromise ?? Promise.resolve())
      return
    }
    // Set the flag and start registration. If it fails, reset so it
    // can be retried on the next call.
    parsersRegistered = true
    parsersRegistrationPromise = deps.registerParsers().catch((error) => {
      parsersRegistered = false
      parsersRegistrationPromise = null
      throw error
    })
    await parsersRegistrationPromise
  }

  const loadParsedFile = async (filePath: string): Promise<ParsedFileData | null> => {
    await ensureParsersRegistered()
    const cached = deps.fileParserService.getCachedFile(filePath)
    if (cached) return cached
    return deps.fileParserService.parseFile(filePath)
  }

  const parseContent = async (filePath: string, content: string): Promise<ParsedFileData> => {
    await ensureParsersRegistered()
    return deps.fileParserService.parseContent(filePath, content)
  }

  return {
    ensureParsersRegistered,
    getFileTree: (rootPath) => deps.fileService.getFileTree(rootPath),
    watchParsedRoot: async (rootPath, owner) => {
      await ensureParsersRegistered()
      return deps.fileParserService.watchAndParse(rootPath, undefined, owner)
    },
    subscribeParsedRoot: (pathPattern, handler) => deps.fileParserService.subscribeAll(pathPattern, handler),
    watchTreePaths: (paths, owner, handler) => deps.fileService.watch(paths, owner, handler),
    getCachedFile: (filePath) => deps.fileParserService.getCachedFile(filePath),
    loadParsedFile,
    parseContent,
  }
}
