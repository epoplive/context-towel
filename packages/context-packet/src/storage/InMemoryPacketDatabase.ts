// ============================================================================
// InMemoryPacketDatabase — In-memory implementation of PacketDatabase
// ============================================================================

import type {
  PacketVersion,
  DeltaEntry,
  KeyframeEntry,
  PatternEntry,
  PacketMeta,
  VersionTrigger,
} from '../types.js'
import type { PacketDatabase } from './PacketDatabase.js'

export class InMemoryPacketDatabase implements PacketDatabase {
  private versions = new Map<string, PacketVersion>()
  private versionsByPacket = new Map<string, string[]>()

  private deltas = new Map<string, DeltaEntry>()
  private deltasByPacket = new Map<string, string[]>()

  private keyframes = new Map<string, KeyframeEntry>()
  private keyframesByPacket = new Map<string, string[]>()

  private patterns = new Map<string, PatternEntry>()

  private packetMetas = new Map<string, PacketMeta>()
  private activePacketName: string | null = null

  // ── Version snapshots ──────────────────────────────────────────────────

  async writeVersion(
    packetName: string,
    trigger: VersionTrigger,
    content: string,
    delta?: string,
  ): Promise<string> {
    const id = crypto.randomUUID()
    const version: PacketVersion = {
      id,
      packetName,
      timestamp: Date.now(),
      trigger,
      content,
      deltaFromPrev: delta,
    }

    this.versions.set(id, version)

    const ids = this.versionsByPacket.get(packetName) ?? []
    ids.push(id)
    this.versionsByPacket.set(packetName, ids)

    return id
  }

  async getVersions(packetName: string, limit?: number): Promise<PacketVersion[]> {
    const ids = this.versionsByPacket.get(packetName) ?? []
    const versions: PacketVersion[] = []

    // Iterate in reverse for newest-first ordering
    for (let i = ids.length - 1; i >= 0; i--) {
      const v = this.versions.get(ids[i])
      if (v) versions.push(v)
    }

    if (limit !== undefined && limit > 0) {
      return versions.slice(0, limit)
    }
    return versions
  }

  async getVersion(id: string): Promise<PacketVersion | null> {
    return this.versions.get(id) ?? null
  }

  async getLatestVersion(packetName: string): Promise<PacketVersion | null> {
    const ids = this.versionsByPacket.get(packetName) ?? []
    if (ids.length === 0) return null
    return this.versions.get(ids[ids.length - 1]) ?? null
  }

  async deleteVersion(id: string): Promise<void> {
    const version = this.versions.get(id)
    if (!version) return

    this.versions.delete(id)

    const ids = this.versionsByPacket.get(version.packetName)
    if (ids) {
      const idx = ids.indexOf(id)
      if (idx !== -1) ids.splice(idx, 1)
    }
  }

  async pruneVersions(packetName: string, keepCount: number): Promise<number> {
    const ids = this.versionsByPacket.get(packetName) ?? []
    if (ids.length <= keepCount) return 0

    // Walk from newest to oldest, deciding what to keep
    // ids are stored oldest-first, so reverse for newest-first traversal
    const toKeep = new Set<string>()
    let keptCount = 0

    for (let i = ids.length - 1; i >= 0; i--) {
      const id = ids[i]
      const v = this.versions.get(id)
      if (!v) continue

      if (keptCount < keepCount) {
        toKeep.add(id)
        keptCount++
      } else if (v.trigger === 'keyframe' || v.trigger === 'collapse') {
        // Always keep keyframes and collapses — they anchor reconstruction
        toKeep.add(id)
      }
    }

    // Delete versions not in the keep set
    let deleted = 0
    const surviving: string[] = []
    for (const id of ids) {
      if (toKeep.has(id)) {
        surviving.push(id)
      } else {
        this.versions.delete(id)
        deleted++
      }
    }
    this.versionsByPacket.set(packetName, surviving)
    return deleted
  }

  // ── Delta log ──────────────────────────────────────────────────────────

  async appendDelta(
    packetName: string,
    entry: Omit<DeltaEntry, 'id' | 'packetName' | 'timestamp'>,
  ): Promise<string> {
    const id = crypto.randomUUID()
    const delta: DeltaEntry = {
      id,
      packetName,
      timestamp: Date.now(),
      ...entry,
    }

    this.deltas.set(id, delta)

    const ids = this.deltasByPacket.get(packetName) ?? []
    ids.push(id)
    this.deltasByPacket.set(packetName, ids)

    return id
  }

  async getDeltas(packetName: string, since?: number): Promise<DeltaEntry[]> {
    const ids = this.deltasByPacket.get(packetName) ?? []
    const deltas: DeltaEntry[] = []

    for (const id of ids) {
      const d = this.deltas.get(id)
      if (d) {
        if (since !== undefined && d.timestamp < since) continue
        deltas.push(d)
      }
    }

    return deltas
  }

  async getDeltasForNode(packetName: string, nodeId: string): Promise<DeltaEntry[]> {
    const ids = this.deltasByPacket.get(packetName) ?? []
    const deltas: DeltaEntry[] = []

    for (const id of ids) {
      const d = this.deltas.get(id)
      if (d && d.nodeId === nodeId) {
        deltas.push(d)
      }
    }

    return deltas
  }

  async deleteDeltasBeforeForNode(
    packetName: string,
    nodeId: string,
    beforeTimestamp: number,
  ): Promise<number> {
    const ids = this.deltasByPacket.get(packetName) ?? []
    const toDelete = new Set<string>()

    for (const id of ids) {
      const d = this.deltas.get(id)
      if (d && d.nodeId === nodeId && d.timestamp < beforeTimestamp) {
        toDelete.add(id)
      }
    }

    for (const id of toDelete) {
      this.deltas.delete(id)
    }

    if (toDelete.size > 0) {
      this.deltasByPacket.set(
        packetName,
        ids.filter(id => !toDelete.has(id)),
      )
    }

    return toDelete.size
  }

  // ── Keyframes ──────────────────────────────────────────────────────────

  async writeKeyframe(
    packetName: string,
    triggerNodeId: string,
    content: string,
  ): Promise<string> {
    const id = crypto.randomUUID()
    const keyframe: KeyframeEntry = {
      id,
      packetName,
      timestamp: Date.now(),
      triggerNodeId,
      content,
    }

    this.keyframes.set(id, keyframe)

    const ids = this.keyframesByPacket.get(packetName) ?? []
    ids.push(id)
    this.keyframesByPacket.set(packetName, ids)

    return id
  }

  async getKeyframes(packetName: string): Promise<KeyframeEntry[]> {
    const ids = this.keyframesByPacket.get(packetName) ?? []
    const keyframes: KeyframeEntry[] = []

    for (const id of ids) {
      const k = this.keyframes.get(id)
      if (k) keyframes.push(k)
    }

    return keyframes
  }

  async getLatestKeyframe(packetName: string): Promise<KeyframeEntry | null> {
    const ids = this.keyframesByPacket.get(packetName) ?? []
    if (ids.length === 0) return null
    return this.keyframes.get(ids[ids.length - 1]) ?? null
  }

  // ── Patterns ───────────────────────────────────────────────────────────

  async writePattern(
    pattern: Omit<PatternEntry, 'id' | 'createdAt' | 'updatedAt' | 'confidence'>,
  ): Promise<string> {
    const id = crypto.randomUUID()
    const now = Date.now()
    const entry: PatternEntry = {
      id,
      createdAt: now,
      updatedAt: now,
      confidence: 1,
      ...pattern,
    }

    this.patterns.set(id, entry)
    return id
  }

  async findPatterns(subsystem: string, codebase?: string): Promise<PatternEntry[]> {
    const results: PatternEntry[] = []

    for (const p of this.patterns.values()) {
      if (p.subsystem !== subsystem) continue
      if (codebase !== undefined && p.codebase !== codebase) continue
      results.push(p)
    }

    return results
  }

  async getAllPatterns(): Promise<PatternEntry[]> {
    return Array.from(this.patterns.values())
  }

  async incrementConfidence(patternId: string): Promise<void> {
    const pattern = this.patterns.get(patternId)
    if (!pattern) {
      throw new Error(`Pattern "${patternId}" not found`)
    }
    pattern.confidence += 1
    pattern.updatedAt = Date.now()
  }

  // ── Packet metadata ────────────────────────────────────────────────────

  async getPacketMeta(name: string): Promise<PacketMeta | null> {
    return this.packetMetas.get(name) ?? null
  }

  async setPacketMeta(name: string, meta: Partial<PacketMeta>): Promise<void> {
    const existing = this.packetMetas.get(name)
    if (existing) {
      Object.assign(existing, meta, { name, updatedAt: Date.now() })
    } else {
      const now = Date.now()
      this.packetMetas.set(name, {
        name,
        createdAt: now,
        updatedAt: now,
        ...meta,
      })
    }
  }

  async listPackets(): Promise<PacketMeta[]> {
    return Array.from(this.packetMetas.values())
  }

  async deletePacket(name: string): Promise<void> {
    this.packetMetas.delete(name)

    // Clean up versions
    const versionIds = this.versionsByPacket.get(name) ?? []
    for (const id of versionIds) {
      this.versions.delete(id)
    }
    this.versionsByPacket.delete(name)

    // Clean up deltas
    const deltaIds = this.deltasByPacket.get(name) ?? []
    for (const id of deltaIds) {
      this.deltas.delete(id)
    }
    this.deltasByPacket.delete(name)

    // Clean up keyframes
    const keyframeIds = this.keyframesByPacket.get(name) ?? []
    for (const id of keyframeIds) {
      this.keyframes.delete(id)
    }
    this.keyframesByPacket.delete(name)

    // Clear active if this was it
    if (this.activePacketName === name) {
      this.activePacketName = null
    }
  }

  async getActivePacket(): Promise<string | null> {
    return this.activePacketName
  }

  async setActivePacket(name: string | null): Promise<void> {
    if (name !== null && !this.packetMetas.has(name)) {
      throw new Error(`Packet "${name}" not found`)
    }
    this.activePacketName = name
  }
}
