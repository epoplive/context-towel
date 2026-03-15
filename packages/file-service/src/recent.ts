import type { RecentFile } from './types.js'

export interface RecentFilesStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export class RecentFilesManager {
  private recentFiles: RecentFile[] = []
  private listeners = new Set<() => void>()

  constructor(private opts: { storageKey: string; max: number; storage?: RecentFilesStorage }) {
    this.load()
  }

  addRecentFile(path: string, projectPath?: string): void {
    const name = path.split('/').pop() || path

    // Remove if already exists (will re-add at top)
    this.recentFiles = this.recentFiles.filter((f) => f.path !== path)

    // Add to front
    this.recentFiles.unshift({
      path,
      name,
      timestamp: Date.now(),
      projectPath,
    })

    // Trim to max size
    if (this.recentFiles.length > this.opts.max) {
      this.recentFiles = this.recentFiles.slice(0, this.opts.max)
    }

    this.save()
    this.notify()
  }

  getRecentFiles(projectPath?: string): RecentFile[] {
    if (projectPath) {
      return this.recentFiles.filter((f) => f.projectPath === projectPath)
    }
    return [...this.recentFiles]
  }

  clearRecentFiles(): void {
    this.recentFiles = []
    this.save()
    this.notify()
  }

  removeRecentFile(path: string): void {
    this.recentFiles = this.recentFiles.filter((f) => f.path !== path)
    this.save()
    this.notify()
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private getStorage(): RecentFilesStorage | null {
    if (this.opts.storage) {
      return this.opts.storage
    }
    // Fallback to window.localStorage if available
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
    return null
  }

  private load(): void {
    try {
      const storage = this.getStorage()
      if (!storage) return
      const stored = storage.getItem(this.opts.storageKey)
      if (stored) {
        this.recentFiles = JSON.parse(stored) as RecentFile[]
      }
    } catch (e) {
      console.error('[FileService] Failed to load recent files:', e)
      this.recentFiles = []
    }
  }

  private save(): void {
    try {
      const storage = this.getStorage()
      if (!storage) return
      storage.setItem(this.opts.storageKey, JSON.stringify(this.recentFiles))
    } catch (e) {
      console.error('[FileService] Failed to save recent files:', e)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch (e) {
        console.error('[FileService] Recent files listener error:', e)
      }
    }
  }
}
