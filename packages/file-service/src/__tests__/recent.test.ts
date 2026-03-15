import { describe, it, expect, vi } from 'vitest'
import { RecentFilesManager, type RecentFilesStorage } from '../recent'

function createStorage(): RecentFilesStorage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
  }
}

function createManager(opts?: { storage?: RecentFilesStorage; max?: number }) {
  const storage = opts?.storage ?? createStorage()
  return new RecentFilesManager({
    storageKey: 'test-recent',
    max: opts?.max ?? 5,
    storage,
  })
}

describe('RecentFilesManager', () => {
  describe('addRecentFile', () => {
    it('adds a file to the list', () => {
      const mgr = createManager()
      mgr.addRecentFile('/foo/bar.md')

      const files = mgr.getRecentFiles()
      expect(files).toHaveLength(1)
      expect(files[0].path).toBe('/foo/bar.md')
      expect(files[0].name).toBe('bar.md')
    })

    it('adds to front (most recent first)', () => {
      const mgr = createManager()
      mgr.addRecentFile('/a.md')
      mgr.addRecentFile('/b.md')

      const files = mgr.getRecentFiles()
      expect(files[0].path).toBe('/b.md')
      expect(files[1].path).toBe('/a.md')
    })

    it('deduplicates by moving to front', () => {
      const mgr = createManager()
      mgr.addRecentFile('/a.md')
      mgr.addRecentFile('/b.md')
      mgr.addRecentFile('/a.md')

      const files = mgr.getRecentFiles()
      expect(files).toHaveLength(2)
      expect(files[0].path).toBe('/a.md')
    })

    it('trims to max size', () => {
      const mgr = createManager({ max: 3 })
      mgr.addRecentFile('/a.md')
      mgr.addRecentFile('/b.md')
      mgr.addRecentFile('/c.md')
      mgr.addRecentFile('/d.md')

      const files = mgr.getRecentFiles()
      expect(files).toHaveLength(3)
      expect(files.map(f => f.path)).toEqual(['/d.md', '/c.md', '/b.md'])
    })

    it('stores projectPath', () => {
      const mgr = createManager()
      mgr.addRecentFile('/foo/bar.md', '/foo')

      const files = mgr.getRecentFiles()
      expect(files[0].projectPath).toBe('/foo')
    })
  })

  describe('getRecentFiles', () => {
    it('filters by projectPath when provided', () => {
      const mgr = createManager()
      mgr.addRecentFile('/a/file.md', '/a')
      mgr.addRecentFile('/b/file.md', '/b')
      mgr.addRecentFile('/a/other.md', '/a')

      const aFiles = mgr.getRecentFiles('/a')
      expect(aFiles).toHaveLength(2)
      expect(aFiles.every(f => f.projectPath === '/a')).toBe(true)
    })

    it('returns all files when no projectPath', () => {
      const mgr = createManager()
      mgr.addRecentFile('/a.md', '/a')
      mgr.addRecentFile('/b.md', '/b')

      expect(mgr.getRecentFiles()).toHaveLength(2)
    })

    it('returns a copy (not a reference)', () => {
      const mgr = createManager()
      mgr.addRecentFile('/a.md')
      const files1 = mgr.getRecentFiles()
      const files2 = mgr.getRecentFiles()
      expect(files1).not.toBe(files2)
    })
  })

  describe('removeRecentFile', () => {
    it('removes a specific file', () => {
      const mgr = createManager()
      mgr.addRecentFile('/a.md')
      mgr.addRecentFile('/b.md')

      mgr.removeRecentFile('/a.md')
      const files = mgr.getRecentFiles()
      expect(files).toHaveLength(1)
      expect(files[0].path).toBe('/b.md')
    })
  })

  describe('clearRecentFiles', () => {
    it('removes all files', () => {
      const mgr = createManager()
      mgr.addRecentFile('/a.md')
      mgr.addRecentFile('/b.md')

      mgr.clearRecentFiles()
      expect(mgr.getRecentFiles()).toHaveLength(0)
    })
  })

  describe('onChange', () => {
    it('fires listener on add', () => {
      const mgr = createManager()
      const listener = vi.fn()
      mgr.onChange(listener)

      mgr.addRecentFile('/a.md')
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('fires listener on remove', () => {
      const mgr = createManager()
      mgr.addRecentFile('/a.md')

      const listener = vi.fn()
      mgr.onChange(listener)
      mgr.removeRecentFile('/a.md')
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('fires listener on clear', () => {
      const mgr = createManager()
      const listener = vi.fn()
      mgr.onChange(listener)

      mgr.clearRecentFiles()
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('unsubscribe stops notifications', () => {
      const mgr = createManager()
      const listener = vi.fn()
      const unsub = mgr.onChange(listener)

      unsub()
      mgr.addRecentFile('/a.md')
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('persistence', () => {
    it('persists to storage and restores on new instance', () => {
      const storage = createStorage()
      const mgr1 = new RecentFilesManager({ storageKey: 'test', max: 5, storage })
      mgr1.addRecentFile('/a.md')
      mgr1.addRecentFile('/b.md')

      const mgr2 = new RecentFilesManager({ storageKey: 'test', max: 5, storage })
      const files = mgr2.getRecentFiles()
      expect(files).toHaveLength(2)
      expect(files[0].path).toBe('/b.md')
    })

    it('works without storage (no crash)', () => {
      const mgr = new RecentFilesManager({ storageKey: 'test', max: 5 })
      mgr.addRecentFile('/a.md')
      expect(mgr.getRecentFiles()).toHaveLength(1)
    })
  })
})
