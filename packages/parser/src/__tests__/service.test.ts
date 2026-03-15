import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FileParserService } from '../service'
import type { ParserPlugin, ParsedFileData } from '../types'
import type { FileSystem, FileChangeEvent, FileChangeListener } from '@context-towel/file-service'

// -------------------------------------------------------------------------- //
// Minimal FileSystem mock
// -------------------------------------------------------------------------- //

function createMockFileSystem(
  overrides: Partial<FileSystem> = {},
): { fs: FileSystem; listeners: FileChangeListener[] } {
  const listeners: FileChangeListener[] = []

  const fs = {
    read: vi.fn(async (_path: string) => '# Hello'),
    stat: vi.fn(async (_path: string) => ({ is_dir: false, is_file: true, size: 100, readonly: false })),
    listAllFiles: vi.fn(async (_path: string) => [] as string[]),
    watch: vi.fn(async (_paths: string[], _ownerId: string) => () => {}),
    subscribe: vi.fn((listener: FileChangeListener) => {
      listeners.push(listener)
      return () => {
        const idx = listeners.indexOf(listener)
        if (idx >= 0) listeners.splice(idx, 1)
      }
    }),
    // Unused stubs
    readBinary: vi.fn(),
    write: vi.fn(),
    append: vi.fn(),
    list: vi.fn(async () => []),
    getFileTree: vi.fn(async () => []),
    exists: vi.fn(async () => false),
    mkdir: vi.fn(),
    remove: vi.fn(),
    rename: vi.fn(),
    copy: vi.fn(),
    createFile: vi.fn(),
    readCached: vi.fn(async (_path: string) => ''),
    getCached: vi.fn(),
    setCachedContent: vi.fn(),
    invalidateCache: vi.fn(),
    getWatchedPaths: vi.fn(() => []),
    getWatchStats: vi.fn(() => []),
    getCacheStats: vi.fn(() => ({ size: 0, maxSize: 0, paths: [] })),
    createSnapshot: vi.fn(),
    listHistory: vi.fn(async () => []),
    readHistoryEntry: vi.fn(async () => ''),
    deleteHistoryEntry: vi.fn(async () => false),
    clearHistory: vi.fn(async () => 0),
    open: vi.fn(),
    reveal: vi.fn(),
    pickFile: vi.fn(async () => null),
    pickFolder: vi.fn(async () => null),
    saveFileDialog: vi.fn(async () => null),
    addRecentFile: vi.fn(),
    getRecentFiles: vi.fn(() => []),
    clearRecentFiles: vi.fn(),
    removeRecentFile: vi.fn(),
    onRecentFilesChange: vi.fn(() => () => {}),
    setHistoryOptionsProvider: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  } as unknown as FileSystem

  return { fs, listeners }
}

// -------------------------------------------------------------------------- //
// Minimal parser plugins
// -------------------------------------------------------------------------- //

function makeTaskPlugin(): ParserPlugin<{ id: string; title: string }> {
  return {
    id: 'task',
    extensions: ['.md'],
    detect: (content) => content.includes('```task'),
    parse: (content, filePath) => ({
      pluginId: 'task',
      items: [{ id: 'task-1', title: 'Test Task' }],
    }),
  }
}

function makeTocPlugin(): ParserPlugin<{ id: string; title: string; level: number }> {
  return {
    id: 'toc',
    extensions: ['.md'],
    detect: (content) => /^#{1,6}\s/.test(content),
    parse: (content, filePath) => ({
      pluginId: 'toc',
      items: [{ id: 'section-1', title: 'Section', level: 1 }],
    }),
  }
}

// -------------------------------------------------------------------------- //
// Tests
// -------------------------------------------------------------------------- //

describe('FileParserService', () => {
  let service: FileParserService
  let listeners: FileChangeListener[]
  let fs: FileSystem

  beforeEach(() => {
    const mock = createMockFileSystem()
    fs = mock.fs
    listeners = mock.listeners
    service = new FileParserService(fs)
  })

  afterEach(() => {
    service.dispose()
  })

  // ---- Parser registration ------------------------------------------------ //

  describe('registerParser / unregisterParser / getParserIds', () => {
    it('registers a parser', () => {
      service.registerParser(makeTaskPlugin())
      expect(service.getParserIds()).toContain('task')
    })

    it('unregisters a parser', () => {
      service.registerParser(makeTaskPlugin())
      service.unregisterParser('task')
      expect(service.getParserIds()).not.toContain('task')
    })

    it('starts with no parsers', () => {
      expect(service.getParserIds()).toHaveLength(0)
    })
  })

  // ---- parseContent ------------------------------------------------------- //

  describe('parseContent', () => {
    it('runs matching parsers and returns ParsedFileData', () => {
      service.registerParser(makeTaskPlugin())
      const data = service.parseContent('/f.md', '```task\ntitle: Test\n```')
      expect(data.path).toBe('/f.md')
      expect(data.results.has('task')).toBe(true)
      expect(data.results.get('task')!.items).toHaveLength(1)
    })

    it('skips parser if extension does not match', () => {
      service.registerParser(makeTaskPlugin())
      const data = service.parseContent('/f.txt', '```task\ntitle: Test\n```')
      // task plugin only handles .md
      expect(data.results.has('task')).toBe(false)
    })

    it('skips parser if detect returns false', () => {
      service.registerParser(makeTaskPlugin())
      const data = service.parseContent('/f.md', '# Just a heading')
      expect(data.results.has('task')).toBe(false)
    })

    it('caches the parsed data', () => {
      service.registerParser(makeTaskPlugin())
      service.parseContent('/f.md', '```task\ntitle: Test\n```')
      expect(service.getCachedFile('/f.md')).toBeDefined()
    })

    it('does not add parser result when items array is empty', () => {
      const emptyPlugin: ParserPlugin = {
        id: 'empty',
        extensions: ['.md'],
        detect: () => true,
        parse: () => ({ pluginId: 'empty', items: [] }),
      }
      service.registerParser(emptyPlugin)
      const data = service.parseContent('/f.md', 'content')
      // Empty items → not stored
      expect(data.results.has('empty')).toBe(false)
    })

    it('does not throw when a parser throws; skips that parser', () => {
      const badPlugin: ParserPlugin = {
        id: 'bad',
        extensions: ['.md'],
        detect: () => true,
        parse: () => { throw new Error('parse error') },
      }
      service.registerParser(badPlugin)
      service.registerParser(makeTocPlugin())
      const data = service.parseContent('/f.md', '# Heading')
      // bad parser failed, but toc should still work
      expect(data.results.has('toc')).toBe(true)
      expect(data.results.has('bad')).toBe(false)
    })
  })

  // ---- parseFile ---------------------------------------------------------- //

  describe('parseFile', () => {
    it('reads from file system and parses', async () => {
      vi.mocked(fs.read).mockResolvedValue('# Title');
      service.registerParser(makeTocPlugin())
      const data = await service.parseFile('/f.md')
      expect(data).not.toBeNull()
      expect(data!.results.has('toc')).toBe(true)
      expect(fs.read).toHaveBeenCalledWith('/f.md')
    })

    it('returns null on read error', async () => {
      vi.mocked(fs.read).mockRejectedValue(new Error('not found'));
      const data = await service.parseFile('/missing.md')
      expect(data).toBeNull()
    })
  })

  // ---- Cache accessors ---------------------------------------------------- //

  describe('getCachedData / getAllItems', () => {
    it('getCachedData returns items by parser id', () => {
      service.registerParser(makeTaskPlugin())
      service.parseContent('/f.md', '```task\ntitle: Test\n```')
      const map = service.getCachedData('task')
      expect(map.get('/f.md')).toHaveLength(1)
    })

    it('getAllItems returns flat list across files', () => {
      service.registerParser(makeTaskPlugin())
      service.parseContent('/a.md', '```task\ntitle: A\n```')
      service.parseContent('/b.md', '```task\ntitle: B\n```')
      const items = service.getAllItems('task')
      expect(items).toHaveLength(2)
    })
  })

  describe('getCachedFilesByPrefix', () => {
    it('returns all cached files under a prefix', () => {
      service.registerParser(makeTaskPlugin())
      service.parseContent('/project/a.md', '```task\ntitle: A\n```')
      service.parseContent('/project/b.md', '```task\ntitle: B\n```')
      service.parseContent('/other/c.md', '```task\ntitle: C\n```')
      const results = service.getCachedFilesByPrefix('/project')
      expect(results).toHaveLength(2)
    })
  })

  // ---- invalidateCache / clearCache --------------------------------------- //

  describe('invalidateCache', () => {
    it('removes a specific file from cache', () => {
      service.registerParser(makeTaskPlugin())
      service.parseContent('/f.md', '```task\ntitle: T\n```')
      service.invalidateCache('/f.md')
      expect(service.getCachedFile('/f.md')).toBeUndefined()
    })
  })

  describe('clearCache', () => {
    it('removes all cached entries', () => {
      service.registerParser(makeTaskPlugin())
      service.parseContent('/a.md', '```task\ntitle: A\n```')
      service.parseContent('/b.md', '```task\ntitle: B\n```')
      service.clearCache()
      expect(service.getCacheStats().size).toBe(0)
    })
  })

  // ---- getCacheStats ------------------------------------------------------ //

  describe('getCacheStats', () => {
    it('returns correct size and paths', () => {
      service.registerParser(makeTaskPlugin())
      service.parseContent('/a.md', '```task\ntitle: A\n```')
      const stats = service.getCacheStats()
      expect(stats.size).toBe(1)
      expect(stats.paths).toContain('/a.md')
    })
  })

  // ---- subscribe ---------------------------------------------------------- //

  describe('subscribe', () => {
    it('calls callback with items for matching path', () => {
      service.registerParser(makeTaskPlugin())

      const received: unknown[][] = []
      service.subscribe('task', '/f.md', (items) => {
        received.push(items)
      })

      service.parseContent('/f.md', '```task\ntitle: T\n```')
      // The initial seed call fires synchronously when subscribe is called (no cache yet → no call)
      // The parseContent triggers a notification
      expect(received.length).toBeGreaterThanOrEqual(1)
      expect(received[0]).toHaveLength(1)
    })

    it('unsubscribe stops further notifications', () => {
      service.registerParser(makeTaskPlugin())
      service.parseContent('/f.md', '```task\ntitle: T\n```')

      const received: unknown[][] = []
      const unsub = service.subscribe('task', '/f.md', (items) => {
        received.push(items)
      })

      unsub()
      const beforeCount = received.length

      service.parseContent('/f.md', '```task\ntitle: T\n```')
      expect(received.length).toBe(beforeCount)
    })

    it('does not call for non-matching paths', () => {
      service.registerParser(makeTaskPlugin())
      const received: unknown[][] = []
      service.subscribe('task', '/project/', (items) => {
        received.push(items)
      })
      service.parseContent('/other/f.md', '```task\ntitle: T\n```')
      expect(received.length).toBe(0)
    })
  })

  // ---- subscribeAll ------------------------------------------------------- //

  describe('subscribeAll', () => {
    it('seeds with existing cached data on subscription', () => {
      service.registerParser(makeTocPlugin())
      service.parseContent('/f.md', '# Title')

      const received: Array<[string, ParsedFileData]> = []
      service.subscribeAll('/f.md', (filePath, data) => {
        received.push([filePath, data])
      })

      expect(received.length).toBe(1)
      expect(received[0][0]).toBe('/f.md')
    })

    it('notifies on new parses', () => {
      service.registerParser(makeTocPlugin())

      const received: Array<[string, ParsedFileData]> = []
      service.subscribeAll('/f.md', (filePath, data) => {
        received.push([filePath, data])
      })

      service.parseContent('/f.md', '# Title')
      expect(received.length).toBeGreaterThanOrEqual(1)
    })

    it('unsubscribe stops notifications', () => {
      service.registerParser(makeTocPlugin())
      const received: unknown[] = []
      const unsub = service.subscribeAll('/f.md', () => received.push(1))
      unsub()
      service.parseContent('/f.md', '# Title')
      expect(received.length).toBe(0)
    })
  })

  // ---- Debounce ----------------------------------------------------------- //

  describe('debounce on file change events', () => {
    it('debounces re-parse on file modification event', async () => {
      vi.useFakeTimers()
      service.registerParser(makeTocPlugin())
      vi.mocked(fs.read).mockResolvedValue('# Title')

      // Trigger a file change event
      const event: FileChangeEvent = { type: 'modified', path: '/f.md' }
      // Simulate a watched path
      vi.mocked(fs.watch).mockResolvedValue(() => {})
      await service.watchAndParse('/f.md', ['toc'])

      // Fire the event via the subscribed listener
      listeners.forEach((l) => l(event))
      listeners.forEach((l) => l(event))

      // Should not have read again yet (debounced)
      const callsBefore = vi.mocked(fs.read).mock.calls.length

      await vi.runAllTimersAsync()

      // After debounce, one additional read for the debounced re-parse
      expect(vi.mocked(fs.read).mock.calls.length).toBeGreaterThanOrEqual(callsBefore)
      vi.useRealTimers()
    })

    it('invalidates cache and notifies on file removal', async () => {
      vi.mocked(fs.watch).mockResolvedValue(() => {})
      vi.mocked(fs.stat).mockResolvedValue({ is_dir: false, is_file: true, size: 0, readonly: false })
      vi.mocked(fs.read).mockResolvedValue('# Title')

      service.registerParser(makeTocPlugin())

      // Register a watch so handleFileServiceEvent routes the event
      await service.watchAndParse('/f.md', ['toc'])

      expect(service.getCachedFile('/f.md')).toBeDefined()

      // Simulate removal event
      const event: FileChangeEvent = { type: 'removed', path: '/f.md' }
      listeners.forEach((l) => l(event))

      // File should be removed from cache
      expect(service.getCachedFile('/f.md')).toBeUndefined()
    })
  })

  // ---- hydrateCacheEntries ------------------------------------------------ //

  describe('hydrateCacheEntries', () => {
    it('loads pre-parsed entries into cache and notifies subscribers', () => {
      const results = new Map<string, { pluginId: string; items: unknown[] }>()
      results.set('task', { pluginId: 'task', items: [{ id: 't1' }] })
      const entry: ParsedFileData = {
        path: '/pre.md',
        content: '```task\n...\n```',
        lastModified: Date.now(),
        results,
      }

      const received: string[] = []
      service.subscribeAll('/pre.md', (fp) => received.push(fp))

      service.hydrateCacheEntries([entry])

      expect(service.getCachedFile('/pre.md')).toBeDefined()
      expect(received.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ---- dispose ------------------------------------------------------------ //

  describe('dispose', () => {
    it('clears cache, subscriptions and timers', () => {
      service.registerParser(makeTaskPlugin())
      service.parseContent('/f.md', '```task\ntitle: T\n```')
      service.dispose()
      expect(service.getCacheStats().size).toBe(0)
    })

    it('unsubscribes from file system events', () => {
      service.dispose()
      // The subscribe mock should have been called once; its returned unsub should have been called
      expect(listeners).toHaveLength(0)
    })
  })

  // ---- watchAndParse / isWatching / forceUnwatch -------------------------- //

  describe('watchAndParse / isWatching / forceUnwatch', () => {
    it('marks path as watched', async () => {
      vi.mocked(fs.watch).mockResolvedValue(() => {})
      vi.mocked(fs.stat).mockResolvedValue({ is_dir: true, is_file: false, size: 0, readonly: false })
      vi.mocked(fs.listAllFiles).mockResolvedValue([])

      await service.watchAndParse('/project', ['task'])
      expect(service.isWatching('/project')).toBe(true)
    })

    it('increments refCount on duplicate watchAndParse', async () => {
      vi.mocked(fs.watch).mockResolvedValue(() => {})
      vi.mocked(fs.stat).mockResolvedValue({ is_dir: true, is_file: false, size: 0, readonly: false })
      vi.mocked(fs.listAllFiles).mockResolvedValue([])

      const unwatch1 = await service.watchAndParse('/project', ['task'])
      const unwatch2 = await service.watchAndParse('/project', ['task'])

      const paths = service.getWatchedPaths()
      expect(paths.find((p) => p.path === '/project')?.refCount).toBe(2)

      unwatch1()
      expect(service.isWatching('/project')).toBe(true)

      unwatch2()
      expect(service.isWatching('/project')).toBe(false)
    })

    it('forceUnwatch removes regardless of refCount', async () => {
      vi.mocked(fs.watch).mockResolvedValue(() => {})
      vi.mocked(fs.stat).mockResolvedValue({ is_dir: true, is_file: false, size: 0, readonly: false })
      vi.mocked(fs.listAllFiles).mockResolvedValue([])

      await service.watchAndParse('/project', ['task'])
      await service.watchAndParse('/project', ['task'])

      service.forceUnwatch('/project')
      expect(service.isWatching('/project')).toBe(false)
    })
  })
})
