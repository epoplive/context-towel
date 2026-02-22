/**
 * MemoryService -- Core memory CRUD and search operations.
 *
 * Extracted from Felix MemoryService. Uses StorageAdapter instead of
 * MikroORM for persistence. Supports hooks for extensibility.
 */

import type { MemoryEntry, MemorySearchQuery, TagFilter, MemoryHook, MemoryHookContext, MemoryHookEntry } from './types'
import type { StorageAdapter } from './storage-adapter'

// ─── Memory Hook Registry ────────────────────────────────────────────────────

export class MemoryHookRegistry {
  private hooks: Map<string, MemoryHook> = new Map()

  register(hook: MemoryHook): void {
    this.hooks.set(hook.id, hook)
  }

  unregister(hookId: string): void {
    this.hooks.delete(hookId)
  }

  getHook(hookId: string): MemoryHook | undefined {
    return this.hooks.get(hookId)
  }

  listHooks(): MemoryHook[] {
    return Array.from(this.hooks.values())
  }

  getAllTagTypes(): Array<{ prefix: string; description: string; hookId: string }> {
    const types: Array<{ prefix: string; description: string; hookId: string }> = []
    for (const hook of this.hooks.values()) {
      if (hook.tagTypes) {
        for (const tagType of hook.tagTypes) {
          types.push({ ...tagType, hookId: hook.id })
        }
      }
    }
    return types
  }

  async fireCreate(entry: MemoryHookEntry, ctx: MemoryHookContext): Promise<void> {
    for (const hook of this.hooks.values()) {
      if (hook.onMemoryCreate) {
        try {
          await hook.onMemoryCreate(entry, ctx)
        } catch (err) {
          // Hooks should not break the main flow
          console.error(`[MemoryHook:${hook.id}] onMemoryCreate error:`, err)
        }
      }
    }
  }

  async fireUpdate(entry: MemoryHookEntry, changes: Partial<MemoryHookEntry>, ctx: MemoryHookContext): Promise<void> {
    for (const hook of this.hooks.values()) {
      if (hook.onMemoryUpdate) {
        try {
          await hook.onMemoryUpdate(entry, changes, ctx)
        } catch (err) {
          console.error(`[MemoryHook:${hook.id}] onMemoryUpdate error:`, err)
        }
      }
    }
  }

  async fireConversationEnd(conversationId: string, summary: string, ctx: MemoryHookContext): Promise<void> {
    for (const hook of this.hooks.values()) {
      if (hook.onConversationEnd) {
        try {
          await hook.onConversationEnd(conversationId, summary, ctx)
        } catch (err) {
          console.error(`[MemoryHook:${hook.id}] onConversationEnd error:`, err)
        }
      }
    }
  }
}

// ─── MemoryService ───────────────────────────────────────────────────────────

export interface MemoryServiceConfig {
  /** Optional hook registry for extensibility */
  hooks?: MemoryHookRegistry
}

/**
 * Core memory service providing CRUD and search operations.
 * Uses a StorageAdapter for persistence (no direct database coupling).
 */
export class MemoryService {
  private readonly adapter: StorageAdapter
  private readonly hooks: MemoryHookRegistry

  constructor(adapter: StorageAdapter, config?: MemoryServiceConfig) {
    this.adapter = adapter
    this.hooks = config?.hooks ?? new MemoryHookRegistry()
  }

  /** Create a new memory entry */
  async create(entry: MemoryEntry): Promise<void> {
    await this.adapter.insert(entry)

    // Fire hooks asynchronously
    const hookEntry = toHookEntry(entry)
    this.hooks.fireCreate(hookEntry, {}).catch(err => {
      console.error('Memory create hook execution failed:', err)
    })
  }

  /** Get a memory entry by id */
  async get(id: string): Promise<MemoryEntry | undefined> {
    return this.adapter.findById(id)
  }

  /** Update a memory entry */
  async update(id: string, patch: Partial<Omit<MemoryEntry, 'id'>>): Promise<MemoryEntry | undefined> {
    const updated = await this.adapter.update(id, patch)
    if (!updated) return undefined

    // Fire hooks asynchronously
    const hookEntry = toHookEntry(updated)
    this.hooks.fireUpdate(hookEntry, patch as Partial<MemoryHookEntry>, {}).catch(err => {
      console.error('Memory update hook execution failed:', err)
    })

    return updated
  }

  /** Delete a memory entry */
  async delete(id: string): Promise<boolean> {
    return this.adapter.delete(id)
  }

  /** Search memory entries */
  async search(query: MemorySearchQuery): Promise<MemoryEntry[]> {
    return this.adapter.search({
      text: query.text,
      tags: query.tags,
      kind: query.kind,
      sessionId: query.sessionId,
      limit: query.limit,
      offset: query.offset,
    })
  }

  /** Vector similarity search */
  async vectorSearch(embedding: number[], limit: number): Promise<Array<{ entry: MemoryEntry; score: number }>> {
    return this.adapter.vectorSearch(embedding, limit)
  }

  /** Full-text search */
  async fullTextSearch(text: string, limit: number): Promise<MemoryEntry[]> {
    return this.adapter.fullTextSearch(text, limit)
  }

  /** Get entries by tags */
  async getByTags(tags: TagFilter): Promise<MemoryEntry[]> {
    return this.adapter.getByTags(tags)
  }

  /** Access the hook registry for registration */
  getHookRegistry(): MemoryHookRegistry {
    return this.hooks
  }
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

function toHookEntry(entry: MemoryEntry): MemoryHookEntry {
  return {
    id: entry.id,
    kind: entry.kind,
    content: entry.content,
    tags: entry.tags,
    metadata: entry.metadata,
    sessionId: entry.sessionId,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}
