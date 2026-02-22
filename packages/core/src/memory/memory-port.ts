/**
 * MemoryPort Implementation
 *
 * Wraps the extracted memory system and implements the MemoryPort interface.
 * This is the adapter that allows context-towel's memory system to be used
 * as a structurally compatible felix-runtime port.
 */

import type {
  MemoryPort,
  MemoryEntry,
  MemorySearchQuery,
  MemorySearchResult,
  TagFilter,
} from './types'
import { MemoryService } from './memory-service'
import type { StorageAdapter } from './storage-adapter'
import { InMemoryStorageAdapter } from './storage-adapter'

/**
 * MemoryPortAdapter -- implements MemoryPort from @dm/felix-runtime
 * by delegating to the extracted MemoryService + StorageAdapter.
 */
export class MemoryPortAdapter implements MemoryPort {
  private readonly service: MemoryService

  constructor(adapter?: StorageAdapter) {
    this.service = new MemoryService(adapter ?? new InMemoryStorageAdapter())
  }

  /** Create with a custom MemoryService (for shared hook registry, etc.) */
  static fromService(service: MemoryService): MemoryPortAdapter {
    const port = new MemoryPortAdapter()
    // Override the internal service reference
    Object.defineProperty(port, 'service', { value: service })
    return port
  }

  async search(query: MemorySearchQuery): Promise<MemoryEntry[]> {
    return this.service.search(query)
  }

  async vectorSearch(embedding: number[], limit: number): Promise<MemorySearchResult[]> {
    const results = await this.service.vectorSearch(embedding, limit)
    return results.map(r => ({
      entry: r.entry,
      score: r.score,
    }))
  }

  async fullTextSearch(text: string, limit: number): Promise<MemoryEntry[]> {
    return this.service.fullTextSearch(text, limit)
  }

  async getByTags(tags: TagFilter): Promise<MemoryEntry[]> {
    return this.service.getByTags(tags)
  }

  async create(entry: MemoryEntry): Promise<void> {
    return this.service.create(entry)
  }

  async update(id: string, patch: Partial<Omit<MemoryEntry, 'id'>>): Promise<void> {
    const result = await this.service.update(id, patch)
    if (!result) {
      throw new Error(`Memory entry with id '${id}' not found`)
    }
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.service.delete(id)
    if (!deleted) {
      throw new Error(`Memory entry with id '${id}' not found`)
    }
  }

  /** Access the underlying MemoryService for advanced operations */
  getService(): MemoryService {
    return this.service
  }
}
