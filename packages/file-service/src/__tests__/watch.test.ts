import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WatchManager, type WatchFn } from '../watch'

function createWatchManager(watchOverride?: WatchFn) {
  const unwatchFn = vi.fn()
  const watchFn: WatchFn = watchOverride ?? vi.fn(async () => unwatchFn)
  const opts = {
    watch: watchFn,
    resolvePath: vi.fn(async (p: string) => p),
    normalizePath: (p: string) => p.replace(/\\/g, '/'),
    exists: vi.fn(async () => true),
    invalidateCache: vi.fn(),
  }
  return { wm: new WatchManager(opts), opts, unwatchFn, watchFn }
}

describe('WatchManager', () => {
  describe('watch', () => {
    it('creates a watcher for a new path', async () => {
      const { wm, watchFn } = createWatchManager()
      await wm.watch(['/project'], 'owner1')

      expect(watchFn).toHaveBeenCalledWith('/project', expect.any(Function), { recursive: true })
      expect(wm.getWatchedPaths()).toEqual(['/project'])
    })

    it('increments ref count for duplicate path watches', async () => {
      const { wm, watchFn } = createWatchManager()
      await wm.watch(['/project'], 'owner1')
      await wm.watch(['/project'], 'owner2')

      // Only one actual watcher created
      expect(watchFn).toHaveBeenCalledTimes(1)
      const stats = wm.getWatchStats()
      expect(stats[0].refCount).toBe(2)
    })

    it('skips paths that dont exist', async () => {
      const { wm, opts, watchFn } = createWatchManager()
      opts.exists.mockResolvedValue(false)

      await wm.watch(['/nonexistent'], 'owner1')
      expect(watchFn).not.toHaveBeenCalled()
      expect(wm.getWatchedPaths()).toEqual([])
    })

    it('returns unsubscribe that decrements ref count', async () => {
      const { wm } = createWatchManager()
      const unsub1 = await wm.watch(['/project'], 'owner1')
      await wm.watch(['/project'], 'owner2')

      expect(wm.getWatchStats()[0].refCount).toBe(2)
      unsub1()
      expect(wm.getWatchStats()[0].refCount).toBe(1)
      expect(wm.getWatchedPaths()).toEqual(['/project']) // still watched
    })

    it('stops watcher when ref count hits zero', async () => {
      const { wm, unwatchFn } = createWatchManager()
      const unsub = await wm.watch(['/project'], 'owner1')

      unsub()
      expect(unwatchFn).toHaveBeenCalled()
      expect(wm.getWatchedPaths()).toEqual([])
    })
  })

  describe('subscriber notifications', () => {
    it('notifies path subscriber on file change', async () => {
      let capturedCallback: ((event: any) => void) | null = null
      const watchFn: WatchFn = vi.fn(async (_path, callback) => {
        capturedCallback = callback
        return () => {}
      })

      const { wm, opts } = createWatchManager(watchFn)
      const listener = vi.fn()
      await wm.watch(['/project'], 'owner1', listener)

      // Simulate a file change event
      capturedCallback!({ paths: ['/project/file.md'], type: 'modified' })

      expect(listener).toHaveBeenCalledWith({
        type: 'modified',
        path: '/project/file.md',
      })
      expect(opts.invalidateCache).toHaveBeenCalledWith('/project/file.md')
    })

    it('notifies global subscribers', async () => {
      let capturedCallback: ((event: any) => void) | null = null
      const watchFn: WatchFn = vi.fn(async (_path, callback) => {
        capturedCallback = callback
        return () => {}
      })

      const { wm } = createWatchManager(watchFn)
      const globalListener = vi.fn()
      wm.subscribe(globalListener)
      await wm.watch(['/project'], 'owner1')

      capturedCallback!({ paths: ['/project/file.md'], type: 'create' })

      expect(globalListener).toHaveBeenCalledWith({
        type: 'created',
        path: '/project/file.md',
      })
    })

    it('unsubscribe removes global listener', async () => {
      let capturedCallback: ((event: any) => void) | null = null
      const watchFn: WatchFn = vi.fn(async (_path, callback) => {
        capturedCallback = callback
        return () => {}
      })

      const { wm } = createWatchManager(watchFn)
      const listener = vi.fn()
      const unsub = wm.subscribe(listener)
      await wm.watch(['/project'], 'owner1')

      unsub()
      capturedCallback!({ paths: ['/project/file.md'], type: 'modified' })

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('event type conversion', () => {
    it('converts various event type formats', async () => {
      let capturedCallback: ((event: any) => void) | null = null
      const watchFn: WatchFn = vi.fn(async (_path, callback) => {
        capturedCallback = callback
        return () => {}
      })

      const { wm } = createWatchManager(watchFn)
      const listener = vi.fn()
      wm.subscribe(listener)
      await wm.watch(['/project'], 'owner1')

      capturedCallback!({ paths: ['/f'], type: 'create' })
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'created' }))

      capturedCallback!({ paths: ['/f'], type: 'remove' })
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'removed' }))

      capturedCallback!({ paths: ['/f'], type: 'rename' })
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'renamed' }))

      capturedCallback!({ paths: ['/f'], type: 'modify' })
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'modified' }))

      // Object format (Tauri style)
      capturedCallback!({ paths: ['/f'], type: { Create: {} } })
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'created' }))
    })
  })

  describe('dispose', () => {
    it('stops all watchers and clears listeners', async () => {
      const unwatchFns = [vi.fn(), vi.fn()]
      let callCount = 0
      const watchFn: WatchFn = vi.fn(async () => unwatchFns[callCount++])

      const { wm } = createWatchManager(watchFn)
      await wm.watch(['/a'], 'owner1')
      await wm.watch(['/b'], 'owner2')

      wm.dispose()

      expect(unwatchFns[0]).toHaveBeenCalled()
      expect(unwatchFns[1]).toHaveBeenCalled()
      expect(wm.getWatchedPaths()).toEqual([])
    })
  })

  describe('getWatchStats', () => {
    it('returns stats for all watched paths', async () => {
      const { wm } = createWatchManager()
      const listener = vi.fn()
      await wm.watch(['/a'], 'owner1', listener)
      await wm.watch(['/b'], 'owner2')

      const stats = wm.getWatchStats()
      expect(stats).toHaveLength(2)
      expect(stats.find(s => s.path === '/a')).toEqual({
        path: '/a',
        refCount: 1,
        subscriberCount: 1,
      })
      expect(stats.find(s => s.path === '/b')).toEqual({
        path: '/b',
        refCount: 1,
        subscriberCount: 0,
      })
    })
  })
})
