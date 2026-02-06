import { describe, expect, it, vi } from 'vitest'
import { createContextGraphController, type ContextGraphControllerDeps } from './ContextGraphController'
import type { ParsedFileData } from '../compat/services'

const createDeps = (): ContextGraphControllerDeps => ({
  fileService: {
    getFileTree: vi.fn(),
    watch: vi.fn(),
  },
  fileParserService: {
    watchAndParse: vi.fn(),
    subscribeAll: vi.fn(),
    getCachedFile: vi.fn(),
    parseFile: vi.fn(),
    parseContent: vi.fn(),
  },
  registerParsers: vi.fn().mockResolvedValue(undefined),
})

describe('ContextGraphController', () => {
  it('registers parsers only once', async () => {
    const deps = createDeps()
    const controller = createContextGraphController(deps)

    await controller.ensureParsersRegistered()
    await controller.ensureParsersRegistered()

    expect(deps.registerParsers).toHaveBeenCalledTimes(1)
  })

  it('prefers cached parsed files when available', async () => {
    const deps = createDeps()
    const cached: ParsedFileData = {
      path: '/doc.md',
      content: '# Doc',
      lastModified: 123,
      results: new Map(),
    }

    const getCachedFile = deps.fileParserService.getCachedFile as ReturnType<typeof vi.fn>
    const parseFile = deps.fileParserService.parseFile as ReturnType<typeof vi.fn>

    getCachedFile.mockReturnValue(cached)

    const controller = createContextGraphController(deps)
    const result = await controller.loadParsedFile('/doc.md')

    expect(result).toBe(cached)
    expect(parseFile).not.toHaveBeenCalled()
  })

  it('watches parsed roots after ensuring parsers are registered', async () => {
    const deps = createDeps()
    const unwatch = vi.fn()
    const watchAndParse = deps.fileParserService.watchAndParse as ReturnType<typeof vi.fn>
    watchAndParse.mockResolvedValue(unwatch)

    const controller = createContextGraphController(deps)
    const result = await controller.watchParsedRoot('/root', 'owner')

    expect(deps.registerParsers).toHaveBeenCalledTimes(1)
    expect(watchAndParse).toHaveBeenCalledWith('/root', undefined, 'owner')
    expect(result).toBe(unwatch)
  })
})
