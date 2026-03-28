/**
 * MikroOrmPacketDatabase — MikroORM implementation of PacketDatabase.
 *
 * Works with any MikroORM-supported database (Postgres, SQLite, MySQL).
 * Uses proper entity manager operations — no raw SQL.
 *
 * Usage:
 *   const orm = await MikroORM.init({ entities: packetEntities, ... })
 *   const db = new MikroOrmPacketDatabase(orm.em)
 *   const engine = new PacketEngine(db, '.context', fs)
 */

import type { EntityManager } from '@mikro-orm/core'
import type {
  PacketVersion,
  DeltaEntry,
  KeyframeEntry,
  PatternEntry,
  PacketMeta,
  PacketEdge,
  VersionTrigger,
} from '../types.js'
import type { PacketDatabase } from './PacketDatabase.js'
import {
  PacketMetaEntity,
  PacketVersionEntity,
  PacketDeltaEntity,
  PacketKeyframeEntity,
  PacketEdgeEntity,
  PacketPatternEntity,
} from './entities.js'

let _counter = 0
function uid(): string {
  return crypto.randomUUID()
}

/** Monotonically increasing timestamp to avoid collisions in fast tests */
let _lastTs = 0
function monotonicNow(): number {
  const now = Date.now()
  _lastTs = now > _lastTs ? now : _lastTs + 1
  return _lastTs
}

export class MikroOrmPacketDatabase implements PacketDatabase {
  constructor(private em: EntityManager) {}

  private fork(): EntityManager {
    return this.em.fork()
  }

  // ── Versions ────────────────────────────────────────────────────────

  async writeVersion(packetName: string, trigger: VersionTrigger, content: string, delta?: string): Promise<string> {
    const em = this.fork()
    const id = uid()
    const entity = em.create(PacketVersionEntity, {
      id,
      packetName,
      timestamp: monotonicNow(),
      triggerType: trigger,
      content,
      deltaFromPrev: delta,
    })
    await em.persistAndFlush(entity)
    return id
  }

  async getVersions(packetName: string, limit?: number): Promise<PacketVersion[]> {
    const em = this.fork()
    const entities = await em.find(PacketVersionEntity,
      { packetName },
      { orderBy: { timestamp: 'DESC' }, limit },
    )
    return entities.map(e => ({
      id: e.id,
      packetName: e.packetName,
      timestamp: Number(e.timestamp),
      trigger: e.triggerType as VersionTrigger,
      content: e.content,
      deltaFromPrev: e.deltaFromPrev ?? undefined,
    }))
  }

  async getVersion(id: string): Promise<PacketVersion | null> {
    const em = this.fork()
    const e = await em.findOne(PacketVersionEntity, { id })
    if (!e) return null
    return {
      id: e.id,
      packetName: e.packetName,
      timestamp: Number(e.timestamp),
      trigger: e.triggerType as VersionTrigger,
      content: e.content,
      deltaFromPrev: e.deltaFromPrev ?? undefined,
    }
  }

  async getLatestVersion(packetName: string): Promise<PacketVersion | null> {
    const versions = await this.getVersions(packetName, 1)
    return versions[0] ?? null
  }

  async deleteVersion(id: string): Promise<void> {
    const em = this.fork()
    const entity = await em.findOne(PacketVersionEntity, { id })
    if (entity) {
      await em.removeAndFlush(entity)
    }
  }

  async pruneVersions(packetName: string, keepCount: number): Promise<number> {
    const em = this.fork()
    const all = await em.find(PacketVersionEntity,
      { packetName },
      { orderBy: { timestamp: 'DESC' } },
    )

    // Walk newest-first. First `keepCount` versions are always kept.
    // Beyond keepCount: keyframe/collapse are always retained, others deleted.
    const toDelete: PacketVersionEntity[] = []
    let keptCount = 0
    for (const v of all) {
      if (keptCount < keepCount) {
        keptCount++
        continue
      }
      const isProtected = v.triggerType === 'keyframe' || v.triggerType === 'collapse'
      if (isProtected) continue
      toDelete.push(v)
    }

    if (toDelete.length > 0) {
      for (const v of toDelete) em.remove(v)
      await em.flush()
    }
    return toDelete.length
  }

  // ── Deltas ──────────────────────────────────────────────────────────

  async appendDelta(packetName: string, entry: Omit<DeltaEntry, 'id' | 'packetName' | 'timestamp'>): Promise<string> {
    const em = this.fork()
    const id = uid()
    const entity = em.create(PacketDeltaEntity, {
      id,
      packetName,
      timestamp: monotonicNow(),
      nodeId: entry.nodeId,
      type: entry.type,
      content: entry.content,
    })
    await em.persistAndFlush(entity)
    return id
  }

  async getDeltas(packetName: string, since?: number): Promise<DeltaEntry[]> {
    const em = this.fork()
    const filter: Record<string, unknown> = { packetName }
    if (since !== undefined) {
      filter.timestamp = { $gte: since }
    }
    const entities = await em.find(PacketDeltaEntity, filter, {
      orderBy: { timestamp: 'ASC' },
    })
    return entities.map(e => ({
      id: e.id,
      packetName: e.packetName,
      timestamp: Number(e.timestamp),
      nodeId: e.nodeId,
      type: e.type as DeltaEntry['type'],
      content: e.content,
    }))
  }

  async getDeltasForNode(packetName: string, nodeId: string): Promise<DeltaEntry[]> {
    const em = this.fork()
    const entities = await em.find(PacketDeltaEntity,
      { packetName, nodeId },
      { orderBy: { timestamp: 'ASC' } },
    )
    return entities.map(e => ({
      id: e.id,
      packetName: e.packetName,
      timestamp: Number(e.timestamp),
      nodeId: e.nodeId,
      type: e.type as DeltaEntry['type'],
      content: e.content,
    }))
  }

  async deleteDeltasBeforeForNode(packetName: string, nodeId: string, beforeTimestamp: number): Promise<number> {
    const em = this.fork()
    const entities = await em.find(PacketDeltaEntity, {
      packetName,
      nodeId,
      timestamp: { $lt: beforeTimestamp },
    })
    const count = entities.length
    if (count > 0) {
      for (const e of entities) em.remove(e)
      await em.flush()
    }
    return count
  }

  // ── Keyframes ───────────────────────────────────────────────────────

  async writeKeyframe(packetName: string, triggerNodeId: string, content: string): Promise<string> {
    const em = this.fork()
    const id = uid()
    const entity = em.create(PacketKeyframeEntity, {
      id,
      packetName,
      timestamp: monotonicNow(),
      triggerNodeId,
      content,
    })
    await em.persistAndFlush(entity)
    return id
  }

  async getKeyframes(packetName: string): Promise<KeyframeEntry[]> {
    const em = this.fork()
    const entities = await em.find(PacketKeyframeEntity,
      { packetName },
      { orderBy: { timestamp: 'ASC' } },
    )
    return entities.map(e => ({
      id: e.id,
      packetName: e.packetName,
      timestamp: Number(e.timestamp),
      triggerNodeId: e.triggerNodeId,
      content: e.content,
    }))
  }

  async getLatestKeyframe(packetName: string): Promise<KeyframeEntry | null> {
    const kfs = await this.getKeyframes(packetName)
    return kfs.length > 0 ? kfs[kfs.length - 1]! : null
  }

  // ── Patterns ────────────────────────────────────────────────────────

  async writePattern(pattern: Omit<PatternEntry, 'id' | 'createdAt' | 'updatedAt' | 'confidence'>): Promise<string> {
    const em = this.fork()
    const id = uid()
    const now = Date.now()
    const entity = em.create(PacketPatternEntity, {
      id,
      subsystem: pattern.subsystem,
      codebase: pattern.codebase,
      content: pattern.content,
      sourcePacket: pattern.sourcePacket,
      createdAt: now,
      updatedAt: now,
      confidence: 1.0,
    })
    await em.persistAndFlush(entity)
    return id
  }

  async findPatterns(subsystem: string, codebase?: string): Promise<PatternEntry[]> {
    const em = this.fork()
    const filter: Record<string, unknown> = { subsystem }
    if (codebase) filter.codebase = codebase
    const entities = await em.find(PacketPatternEntity, filter)
    return entities.map(e => ({
      id: e.id,
      subsystem: e.subsystem,
      codebase: e.codebase,
      content: e.content,
      sourcePacket: e.sourcePacket,
      createdAt: Number(e.createdAt),
      updatedAt: Number(e.updatedAt),
      confidence: e.confidence,
    }))
  }

  async getAllPatterns(): Promise<PatternEntry[]> {
    const em = this.fork()
    const entities = await em.findAll(PacketPatternEntity)
    return entities.map(e => ({
      id: e.id,
      subsystem: e.subsystem,
      codebase: e.codebase,
      content: e.content,
      sourcePacket: e.sourcePacket,
      createdAt: Number(e.createdAt),
      updatedAt: Number(e.updatedAt),
      confidence: e.confidence,
    }))
  }

  async incrementConfidence(patternId: string): Promise<void> {
    const em = this.fork()
    const entity = await em.findOneOrFail(PacketPatternEntity, { id: patternId })
    entity.confidence += 1
    entity.updatedAt = Date.now()
    await em.flush()
  }

  // ── Edges ───────────────────────────────────────────────────────────

  async addEdge(packetName: string, sourceNode: string, targetNode: string): Promise<string> {
    const em = this.fork()
    const id = uid()
    const entity = em.create(PacketEdgeEntity, {
      id,
      packetName,
      sourceNode,
      targetNode,
      createdAt: Date.now(),
    })
    await em.persistAndFlush(entity)
    return id
  }

  async removeEdge(packetName: string, sourceNode: string, targetNode: string): Promise<void> {
    const em = this.fork()
    const entity = await em.findOne(PacketEdgeEntity, { packetName, sourceNode, targetNode })
    if (entity) {
      await em.removeAndFlush(entity)
    }
  }

  async getEdgesForNode(packetName: string, nodeId: string): Promise<PacketEdge[]> {
    const em = this.fork()
    const entities = await em.find(PacketEdgeEntity, {
      packetName,
      $or: [{ sourceNode: nodeId }, { targetNode: nodeId }],
    })
    return entities.map(e => ({
      id: e.id,
      packetName: e.packetName,
      sourceNode: e.sourceNode,
      targetNode: e.targetNode,
      createdAt: Number(e.createdAt),
    }))
  }

  async getAllEdges(packetName: string): Promise<PacketEdge[]> {
    const em = this.fork()
    const entities = await em.find(PacketEdgeEntity, { packetName })
    return entities.map(e => ({
      id: e.id,
      packetName: e.packetName,
      sourceNode: e.sourceNode,
      targetNode: e.targetNode,
      createdAt: Number(e.createdAt),
    }))
  }

  // ── Metadata ────────────────────────────────────────────────────────

  async getPacketMeta(name: string): Promise<PacketMeta | null> {
    const em = this.fork()
    const e = await em.findOne(PacketMetaEntity, { name })
    if (!e) return null
    return {
      name: e.name,
      createdAt: Number(e.createdAt),
      updatedAt: Number(e.updatedAt),
      activePacket: e.active,
      planFileRef: e.planFileRef,
      tags: e.tags,
    }
  }

  async setPacketMeta(name: string, meta: Partial<PacketMeta>): Promise<void> {
    const em = this.fork()
    let entity = await em.findOne(PacketMetaEntity, { name })
    if (!entity) {
      entity = em.create(PacketMetaEntity, {
        name,
        createdAt: meta.createdAt ?? Date.now(),
        updatedAt: meta.updatedAt ?? Date.now(),
        active: false,
        tags: meta.tags ?? [],
        planFileRef: meta.planFileRef,
      })
    } else {
      if (meta.updatedAt !== undefined) entity.updatedAt = meta.updatedAt
      if (meta.planFileRef !== undefined) entity.planFileRef = meta.planFileRef
      if (meta.tags !== undefined) entity.tags = meta.tags
    }
    await em.persistAndFlush(entity)
  }

  async listPackets(): Promise<PacketMeta[]> {
    const em = this.fork()
    const entities = await em.findAll(PacketMetaEntity)
    return entities.map(e => ({
      name: e.name,
      createdAt: Number(e.createdAt),
      updatedAt: Number(e.updatedAt),
      activePacket: e.active,
      planFileRef: e.planFileRef,
      tags: e.tags,
    }))
  }

  async deletePacket(name: string): Promise<void> {
    const em = this.fork()
    // Load and remove all related data through UoW
    const deltas = await em.find(PacketDeltaEntity, { packetName: name })
    const versions = await em.find(PacketVersionEntity, { packetName: name })
    const keyframes = await em.find(PacketKeyframeEntity, { packetName: name })
    const edges = await em.find(PacketEdgeEntity, { packetName: name })
    const meta = await em.findOne(PacketMetaEntity, { name })

    for (const e of [...deltas, ...versions, ...keyframes, ...edges]) em.remove(e)
    if (meta) em.remove(meta)
    await em.flush()
  }

  async getActivePacket(): Promise<string | null> {
    const em = this.fork()
    const entity = await em.findOne(PacketMetaEntity, { active: true })
    return entity?.name ?? null
  }

  async setActivePacket(name: string | null): Promise<void> {
    const em = this.fork()
    // Clear all active flags
    const allActive = await em.find(PacketMetaEntity, { active: true })
    for (const e of allActive) {
      e.active = false
    }
    // Set new active
    if (name) {
      const entity = await em.findOne(PacketMetaEntity, { name })
      if (!entity) {
        throw new Error(`Packet "${name}" not found`)
      }
      entity.active = true
    }
    await em.flush()
  }
}
