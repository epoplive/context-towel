/**
 * Tests for TauriFileService.
 *
 * Since Tauri APIs aren't available in test environment, we mock the
 * Tauri plugin imports and verify the service wires them correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all Tauri imports before importing TauriFileService
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  copyFile: vi.fn(),
  exists: vi.fn().mockResolvedValue(true),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  readDir: vi.fn().mockResolvedValue([]),
  readTextFile: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
  stat: vi.fn(),
  watch: vi.fn().mockResolvedValue(() => {}),
  writeTextFile: vi.fn(),
}))

vi.mock('@tauri-apps/api/path', () => ({
  homeDir: vi.fn().mockResolvedValue('/Users/test'),
}))

import { TauriFileService } from '../tauri/index'
import { readTextFile, writeTextFile, exists, readDir, stat, mkdir, remove, rename, copyFile, watch } from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'
import { open as openDialog } from '@tauri-apps/plugin-dialog'

describe('TauriFileService', () => {
  let fs: TauriFileService

  beforeEach(() => {
    vi.clearAllMocks()
    fs = new TauriFileService()
  })

  describe('read', () => {
    it('reads text file via Tauri plugin', async () => {
      vi.mocked(readTextFile).mockResolvedValue('hello world')
      const content = await fs.read('/test/file.md')
      expect(content).toBe('hello world')
      expect(readTextFile).toHaveBeenCalledWith('/test/file.md')
    })
  })

  describe('write', () => {
    it('writes text file via Tauri plugin', async () => {
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(writeTextFile).mockResolvedValue(undefined)

      await fs.write('/test/file.md', 'content')
      expect(writeTextFile).toHaveBeenCalled()
    })
  })

  describe('exists', () => {
    it('checks existence via Tauri plugin', async () => {
      vi.mocked(exists).mockResolvedValue(true)
      const result = await fs.exists('/test/file.md')
      expect(result).toBe(true)
    })

    it('returns false when file does not exist', async () => {
      vi.mocked(exists).mockResolvedValue(false)
      const result = await fs.exists('/nope')
      expect(result).toBe(false)
    })
  })

  describe('stat', () => {
    it('returns FileStat from Tauri stat', async () => {
      vi.mocked(stat).mockResolvedValue({
        isDirectory: false,
        isFile: true,
        isSymlink: false,
        size: 1024,
        readonly: false,
        mtime: new Date(1000),
        atime: null,
        birthtime: null,
        dev: 0,
        ino: 0,
        mode: 0,
        nlink: 0,
        uid: 0,
        gid: 0,
        rdev: 0,
        blksize: 0,
        blocks: 0,
        fileType: 0,
      } as any)

      const result = await fs.stat('/test/file.md')
      expect(result).toEqual({
        is_dir: false,
        is_file: true,
        size: 1024,
        readonly: false,
        mtimeMs: 1000,
      })
    })

    it('returns null when stat fails', async () => {
      vi.mocked(stat).mockRejectedValue(new Error('not found'))
      const result = await fs.stat('/nope')
      expect(result).toBeNull()
    })
  })

  describe('list', () => {
    it('lists directory entries', async () => {
      vi.mocked(readDir).mockResolvedValue([
        { name: 'docs', isDirectory: true, isFile: false, isSymlink: false },
        { name: 'readme.md', isDirectory: false, isFile: true, isSymlink: false },
      ] as any)

      const result = await fs.list('/test')
      expect(result).toHaveLength(2)
      // Dirs first
      expect(result[0].name).toBe('docs')
      expect(result[0].is_dir).toBe(true)
      expect(result[1].name).toBe('readme.md')
    })

    it('filters out node_modules and .git', async () => {
      vi.mocked(readDir).mockResolvedValue([
        { name: 'node_modules', isDirectory: true, isFile: false, isSymlink: false },
        { name: '.git', isDirectory: true, isFile: false, isSymlink: false },
        { name: 'src', isDirectory: true, isFile: false, isSymlink: false },
      ] as any)

      const result = await fs.list('/test')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('src')
    })

    it('returns empty array on error', async () => {
      vi.mocked(readDir).mockRejectedValue(new Error('not found'))
      const result = await fs.list('/nope')
      expect(result).toEqual([])
    })
  })

  describe('mkdir', () => {
    it('creates directory recursively', async () => {
      vi.mocked(mkdir).mockResolvedValue(undefined)
      await fs.mkdir('/test/deep/dir')
      expect(mkdir).toHaveBeenCalledWith('/test/deep/dir', { recursive: true })
    })
  })

  describe('remove', () => {
    it('removes file/dir recursively', async () => {
      vi.mocked(remove).mockResolvedValue(undefined)
      await fs.remove('/test/file.md')
      expect(remove).toHaveBeenCalled()
    })
  })

  describe('rename', () => {
    it('renames via Tauri plugin', async () => {
      vi.mocked(rename).mockResolvedValue(undefined)
      await fs.rename('/old', '/new')
      expect(rename).toHaveBeenCalledWith('/old', '/new')
    })
  })

  describe('copy', () => {
    it('copies via Tauri plugin', async () => {
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(copyFile).mockResolvedValue(undefined)
      await fs.copy('/src', '/dest')
      expect(copyFile).toHaveBeenCalledWith('/src', '/dest')
    })
  })

  describe('getFileTree', () => {
    it('walks directory recursively and returns tree items', async () => {
      // Root dir
      vi.mocked(readDir)
        .mockResolvedValueOnce([
          { name: 'docs', isDirectory: true, isFile: false, isSymlink: false },
          { name: 'readme.md', isDirectory: false, isFile: true, isSymlink: false },
        ] as any)
        // docs subdir
        .mockResolvedValueOnce([
          { name: 'guide.md', isDirectory: false, isFile: true, isSymlink: false },
        ] as any)

      const items = await fs.getFileTree('/project')
      expect(items.length).toBe(3)
      expect(items.find(i => i.id === 'docs')).toBeDefined()
      expect(items.find(i => i.id === 'readme.md')).toBeDefined()
      expect(items.find(i => i.id === 'docs/guide.md')).toBeDefined()
    })
  })

  describe('watch', () => {
    it('returns an unsubscribe function', async () => {
      // Full watch behavior is tested in watch.test.ts via WatchManager.
      // Here we just verify TauriFileService.watch() returns a callable unsub.
      const unsub = await fs.watch(['/project'], 'test-owner')
      expect(typeof unsub).toBe('function')
      unsub()
    })
  })

  describe('caching', () => {
    it('readCached returns cached content on second call', async () => {
      vi.mocked(readTextFile).mockResolvedValue('cached content')
      vi.mocked(stat).mockResolvedValue({
        isDirectory: false,
        isFile: true,
        isSymlink: false,
        size: 100,
        readonly: false,
        mtime: new Date(1000),
      } as any)

      await fs.readCached('/test.md')
      vi.mocked(readTextFile).mockClear()

      const result = await fs.readCached('/test.md')
      expect(result).toBe('cached content')
      expect(readTextFile).not.toHaveBeenCalled()
    })

    it('invalidateCache forces re-read', async () => {
      vi.mocked(readTextFile).mockResolvedValue('v1')
      vi.mocked(stat).mockResolvedValue({
        isDirectory: false, isFile: true, isSymlink: false,
        size: 100, readonly: false, mtime: new Date(1000),
      } as any)

      await fs.readCached('/test.md')
      fs.invalidateCache('/test.md')

      vi.mocked(readTextFile).mockResolvedValue('v2')
      const result = await fs.readCached('/test.md')
      expect(result).toBe('v2')
    })
  })

  describe('recent files', () => {
    it('tracks and retrieves recent files', () => {
      fs.addRecentFile('/a.md')
      fs.addRecentFile('/b.md')

      const recent = fs.getRecentFiles()
      expect(recent).toHaveLength(2)
      expect(recent[0].path).toBe('/b.md')
    })
  })

  describe('history', () => {
    it('createSnapshot calls Tauri invoke', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined)
      await fs.createSnapshot('/test.md', 'content', 'save')
      expect(invoke).toHaveBeenCalledWith('history_create_snapshot', expect.any(Object))
    })

    it('listHistory calls Tauri invoke', async () => {
      vi.mocked(invoke).mockResolvedValue([])
      const result = await fs.listHistory('/test.md')
      expect(result).toEqual([])
    })
  })

  describe('dispose', () => {
    it('cleans up without error', () => {
      expect(() => fs.dispose()).not.toThrow()
    })
  })
})
