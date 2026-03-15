import type { FileChangeEvent, FileChangeListener, FileWatchStat } from './types.js'

/**
 * Platform-provided watch function signature.
 * Takes a path and event callback, returns an unwatch function.
 */
export type WatchFn = (
  path: string,
  callback: (event: { paths: string[]; type: string | Record<string, unknown> }) => void,
  options?: { recursive?: boolean }
) => Promise<() => void>

export class WatchManager {
  private watchers = new Map<string, { unwatch: () => void; subscribers: Map<string, FileChangeListener>; refCount: number }>()
  private nextListenerId = 0
  private changeListeners = new Set<FileChangeListener>()

  constructor(
    private opts: {
      watch: WatchFn
      resolvePath: (path: string) => Promise<string>
      normalizePath: (path: string) => string
      exists: (path: string) => Promise<boolean>
      invalidateCache: (path: string) => void
    }
  ) {}

  async watch(paths: string[], ownerId: string, listener?: FileChangeListener): Promise<() => void> {
    const listenerId = listener ? `${ownerId}-${this.nextListenerId++}` : null
    const resolvedPaths = await Promise.all(paths.map((path) => this.opts.resolvePath(path)))
    const normalizedPaths = resolvedPaths.map((p) => this.opts.normalizePath(p))

    for (const path of normalizedPaths) {
      const existing = this.watchers.get(path)

      if (existing) {
        // Already watching this path, just add subscriber
        existing.refCount += 1
        if (listener && listenerId) {
          existing.subscribers.set(listenerId, listener)
        }
      } else {
        // New path to watch - set up platform watcher
        const subscribers = new Map<string, FileChangeListener>()
        if (listener && listenerId) {
          subscribers.set(listenerId, listener)
        }

        try {
          const existsOnDisk = await this.opts.exists(path)
          if (!existsOnDisk) {
            continue
          }
          const unwatch = await this.opts.watch(
            path,
            (event) => {
              this.handleWatchEvent(path, event)
            },
            { recursive: true }
          )

          this.watchers.set(path, { unwatch, subscribers, refCount: 1 })
        } catch (e) {
          console.error('[FileService] Failed to start watching:', path, e)
        }
      }
    }

    // Return unsubscribe function
    return () => {
      for (const path of normalizedPaths) {
        const watcher = this.watchers.get(path)
        if (watcher) {
          const nextCount = watcher.refCount - 1
          if (nextCount < 0) {
            console.warn('[FileService] Watch refCount below zero for', path)
          }
          watcher.refCount = Math.max(0, nextCount)
          if (listenerId) {
            watcher.subscribers.delete(listenerId)
          }

          // If no more refs, stop watching
          if (watcher.refCount <= 0) {
            watcher.unwatch()
            this.watchers.delete(path)
          }
        }
      }
    }
  }

  subscribe(listener: FileChangeListener): () => void {
    this.changeListeners.add(listener)
    return () => {
      this.changeListeners.delete(listener)
    }
  }

  getWatchedPaths(): string[] {
    return Array.from(this.watchers.keys())
  }

  getWatchStats(): FileWatchStat[] {
    return Array.from(this.watchers.entries()).map(([path, watcher]) => ({
      path,
      refCount: watcher.refCount,
      subscriberCount: watcher.subscribers.size,
    }))
  }

  dispose(): void {
    for (const watcher of this.watchers.values()) {
      watcher.unwatch()
    }
    this.watchers.clear()
    this.changeListeners.clear()
  }

  private handleWatchEvent(watchPath: string, event: { paths: string[]; type: string | Record<string, unknown> }): void {
    const eventPaths = event.paths || []
    const eventType = this.convertWatchEventType(event.type)

    for (const filePath of eventPaths) {
      const normalizedPath = this.opts.normalizePath(filePath)

      // Invalidate cache for changed files
      this.opts.invalidateCache(normalizedPath)

      const changeEvent: FileChangeEvent = {
        type: eventType,
        path: normalizedPath,
      }

      // Notify all subscribers for this watch path
      const watcher = this.watchers.get(watchPath)
      if (watcher) {
        for (const listener of watcher.subscribers.values()) {
          try {
            listener(changeEvent)
          } catch (e) {
            console.error('[FileService] Listener error:', e)
          }
        }
      }

      // Notify global subscribers
      for (const listener of this.changeListeners) {
        try {
          listener(changeEvent)
        } catch (e) {
          console.error('[FileService] Global listener error:', e)
        }
      }
    }
  }

  private convertWatchEventType(type: string | Record<string, unknown>): FileChangeEvent['type'] {
    // Watch event types can be strings or objects
    const typeStr = typeof type === 'string' ? type : Object.keys(type)[0] || 'modify'
    switch (typeStr.toLowerCase()) {
      case 'create':
      case 'created':
        return 'created'
      case 'remove':
      case 'removed':
        return 'removed'
      case 'rename':
      case 'renamed':
        return 'renamed'
      default:
        return 'modified'
    }
  }
}
