import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryPacketDatabase } from '../../../src/storage/InMemoryPacketDatabase'
import type { PacketDatabase } from '../../../src/storage/PacketDatabase'

// ============================================================================
// Conformance test suite — can be reused for ANY PacketDatabase implementation
// ============================================================================

export function runStorageConformanceTests(createDb: () => PacketDatabase): void {
  let db: PacketDatabase

  beforeEach(() => {
    db = createDb()
  })

  // ── Version snapshots ──────────────────────────────────────────────────

  describe('versions', () => {
    it('writes a version and returns an id', async () => {
      const id = await db.writeVersion('test-packet', 'delta', 'version content')
      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
    })

    it('gets a version by id', async () => {
      const id = await db.writeVersion('test-packet', 'delta', 'version content', 'some diff')
      const version = await db.getVersion(id)

      expect(version).not.toBeNull()
      expect(version!.id).toBe(id)
      expect(version!.packetName).toBe('test-packet')
      expect(version!.trigger).toBe('delta')
      expect(version!.content).toBe('version content')
      expect(version!.deltaFromPrev).toBe('some diff')
      expect(typeof version!.timestamp).toBe('number')
    })

    it('returns null for nonexistent version id', async () => {
      const version = await db.getVersion('nonexistent-id')
      expect(version).toBeNull()
    })

    it('gets latest version for a packet', async () => {
      await db.writeVersion('test-packet', 'delta', 'v1')
      await db.writeVersion('test-packet', 'keyframe', 'v2')
      await db.writeVersion('test-packet', 'collapse', 'v3')

      const latest = await db.getLatestVersion('test-packet')
      expect(latest).not.toBeNull()
      expect(latest!.content).toBe('v3')
      expect(latest!.trigger).toBe('collapse')
    })

    it('returns null for latest version of nonexistent packet', async () => {
      const latest = await db.getLatestVersion('nonexistent')
      expect(latest).toBeNull()
    })

    it('lists versions newest-first', async () => {
      await db.writeVersion('test-packet', 'delta', 'v1')
      await db.writeVersion('test-packet', 'keyframe', 'v2')
      await db.writeVersion('test-packet', 'collapse', 'v3')

      const versions = await db.getVersions('test-packet')
      expect(versions).toHaveLength(3)
      // Newest first
      expect(versions[0].content).toBe('v3')
      expect(versions[1].content).toBe('v2')
      expect(versions[2].content).toBe('v1')
    })

    it('lists versions with limit', async () => {
      await db.writeVersion('test-packet', 'delta', 'v1')
      await db.writeVersion('test-packet', 'keyframe', 'v2')
      await db.writeVersion('test-packet', 'collapse', 'v3')

      const versions = await db.getVersions('test-packet', 2)
      expect(versions).toHaveLength(2)
      expect(versions[0].content).toBe('v3')
      expect(versions[1].content).toBe('v2')
    })

    it('returns empty array for nonexistent packet versions', async () => {
      const versions = await db.getVersions('nonexistent')
      expect(versions).toEqual([])
    })

    it('stores deltaFromPrev as undefined when not provided', async () => {
      const id = await db.writeVersion('test-packet', 'delta', 'content')
      const version = await db.getVersion(id)
      expect(version!.deltaFromPrev).toBeUndefined()
    })

    it('deletes a version by id', async () => {
      const id1 = await db.writeVersion('test-packet', 'delta', 'v1')
      const id2 = await db.writeVersion('test-packet', 'delta', 'v2')

      await db.deleteVersion(id1)

      expect(await db.getVersion(id1)).toBeNull()
      expect(await db.getVersion(id2)).not.toBeNull()

      const versions = await db.getVersions('test-packet')
      expect(versions).toHaveLength(1)
      expect(versions[0].content).toBe('v2')
    })

    it('deleteVersion is a no-op for nonexistent id', async () => {
      // Should not throw
      await db.deleteVersion('nonexistent-id')
    })

    it('prunes old delta versions beyond keepCount', async () => {
      await db.writeVersion('test-packet', 'delta', 'v1')
      await db.writeVersion('test-packet', 'delta', 'v2')
      await db.writeVersion('test-packet', 'delta', 'v3')
      await db.writeVersion('test-packet', 'delta', 'v4')
      await db.writeVersion('test-packet', 'delta', 'v5')

      const deleted = await db.pruneVersions('test-packet', 3)
      expect(deleted).toBe(2)

      const remaining = await db.getVersions('test-packet')
      expect(remaining).toHaveLength(3)
      // Newest versions kept
      expect(remaining[0].content).toBe('v5')
      expect(remaining[1].content).toBe('v4')
      expect(remaining[2].content).toBe('v3')
    })

    it('pruneVersions keeps keyframe and collapse versions even beyond keepCount', async () => {
      await db.writeVersion('test-packet', 'keyframe', 'kf1')
      await db.writeVersion('test-packet', 'delta', 'v2')
      await db.writeVersion('test-packet', 'delta', 'v3')
      await db.writeVersion('test-packet', 'collapse', 'col4')
      await db.writeVersion('test-packet', 'delta', 'v5')

      // Keep only 2 newest, but keyframe/collapse are always retained.
      // Newest-first: v5, col4, v3, v2, kf1
      // Keep v5 + col4 (top 2). Beyond keepCount: v3 (delta, delete),
      // v2 (delta, delete), kf1 (keyframe, keep).
      const deleted = await db.pruneVersions('test-packet', 2)
      expect(deleted).toBe(2)

      const remaining = await db.getVersions('test-packet')
      expect(remaining).toHaveLength(3) // v5, col4, kf1
      expect(remaining.map(v => v.content)).toEqual(['v5', 'col4', 'kf1'])
    })

    it('pruneVersions returns 0 when under keepCount', async () => {
      await db.writeVersion('test-packet', 'delta', 'v1')
      await db.writeVersion('test-packet', 'delta', 'v2')

      const deleted = await db.pruneVersions('test-packet', 5)
      expect(deleted).toBe(0)

      const remaining = await db.getVersions('test-packet')
      expect(remaining).toHaveLength(2)
    })

    it('pruneVersions returns 0 for nonexistent packet', async () => {
      const deleted = await db.pruneVersions('nonexistent', 5)
      expect(deleted).toBe(0)
    })
  })

  // ── Delta log ──────────────────────────────────────────────────────────

  describe('deltas', () => {
    it('appends a delta and returns an id', async () => {
      const id = await db.appendDelta('test-packet', {
        type: 'discovery',
        content: 'found something',
        nodeId: 'node-1',
      })
      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
    })

    it('gets all deltas for a packet', async () => {
      await db.appendDelta('test-packet', { type: 'discovery', content: 'delta 1' })
      await db.appendDelta('test-packet', { type: 'failure', content: 'delta 2', nodeId: 'n1' })
      await db.appendDelta('test-packet', { type: 'success', content: 'delta 3' })

      const deltas = await db.getDeltas('test-packet')
      expect(deltas).toHaveLength(3)
      expect(deltas[0].content).toBe('delta 1')
      expect(deltas[0].type).toBe('discovery')
      expect(deltas[0].packetName).toBe('test-packet')
      expect(typeof deltas[0].timestamp).toBe('number')
    })

    it('gets deltas since a timestamp', async () => {
      await db.appendDelta('test-packet', { type: 'discovery', content: 'old delta' })

      // Small delay to ensure timestamp difference
      await new Promise(r => setTimeout(r, 10))

      // Record timestamp after first delta and after the delay
      const sinceTime = Date.now()

      // Another delay to ensure the next delta has a strictly greater timestamp
      await new Promise(r => setTimeout(r, 10))

      await db.appendDelta('test-packet', { type: 'success', content: 'new delta' })

      const deltas = await db.getDeltas('test-packet', sinceTime)
      expect(deltas).toHaveLength(1)
      expect(deltas[0].content).toBe('new delta')
    })

    it('gets deltas for a specific node', async () => {
      await db.appendDelta('test-packet', { type: 'discovery', content: 'node-1 delta', nodeId: 'node-1' })
      await db.appendDelta('test-packet', { type: 'failure', content: 'node-2 delta', nodeId: 'node-2' })
      await db.appendDelta('test-packet', { type: 'success', content: 'node-1 again', nodeId: 'node-1' })
      await db.appendDelta('test-packet', { type: 'promotion', content: 'no node' })

      const node1Deltas = await db.getDeltasForNode('test-packet', 'node-1')
      expect(node1Deltas).toHaveLength(2)
      expect(node1Deltas[0].content).toBe('node-1 delta')
      expect(node1Deltas[1].content).toBe('node-1 again')
    })

    it('returns empty array for nonexistent packet deltas', async () => {
      const deltas = await db.getDeltas('nonexistent')
      expect(deltas).toEqual([])
    })

    it('returns empty array for nonexistent node deltas', async () => {
      await db.appendDelta('test-packet', { type: 'discovery', content: 'exists', nodeId: 'node-1' })
      const deltas = await db.getDeltasForNode('test-packet', 'nonexistent-node')
      expect(deltas).toEqual([])
    })

    it('deletes deltas before a timestamp for a node', async () => {
      await db.appendDelta('test-packet', { type: 'discovery', content: 'old-1', nodeId: 'node-1' })
      await db.appendDelta('test-packet', { type: 'discovery', content: 'old-2', nodeId: 'node-1' })
      // Other node should not be affected
      await db.appendDelta('test-packet', { type: 'discovery', content: 'other', nodeId: 'node-2' })

      // Delay to create a clear timestamp boundary
      await new Promise(r => setTimeout(r, 10))
      const cutoff = Date.now()
      await new Promise(r => setTimeout(r, 10))

      await db.appendDelta('test-packet', { type: 'success', content: 'new-1', nodeId: 'node-1' })

      const deleted = await db.deleteDeltasBeforeForNode('test-packet', 'node-1', cutoff)
      expect(deleted).toBe(2)

      // Only the new delta for node-1 survives
      const node1Deltas = await db.getDeltasForNode('test-packet', 'node-1')
      expect(node1Deltas).toHaveLength(1)
      expect(node1Deltas[0].content).toBe('new-1')

      // node-2 deltas are untouched
      const node2Deltas = await db.getDeltasForNode('test-packet', 'node-2')
      expect(node2Deltas).toHaveLength(1)
      expect(node2Deltas[0].content).toBe('other')
    })

    it('deleteDeltasBeforeForNode returns 0 when no deltas match', async () => {
      await db.appendDelta('test-packet', { type: 'discovery', content: 'd1', nodeId: 'node-1' })
      // Use timestamp 0 so nothing is before it
      const deleted = await db.deleteDeltasBeforeForNode('test-packet', 'node-1', 0)
      expect(deleted).toBe(0)
    })
  })

  // ── Keyframes ──────────────────────────────────────────────────────────

  describe('keyframes', () => {
    it('writes a keyframe and returns an id', async () => {
      const id = await db.writeKeyframe('test-packet', 'trigger-node-1', 'keyframe content')
      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
    })

    it('gets all keyframes for a packet', async () => {
      await db.writeKeyframe('test-packet', 'node-1', 'kf1')
      await db.writeKeyframe('test-packet', 'node-2', 'kf2')

      const keyframes = await db.getKeyframes('test-packet')
      expect(keyframes).toHaveLength(2)
      expect(keyframes[0].content).toBe('kf1')
      expect(keyframes[0].triggerNodeId).toBe('node-1')
      expect(keyframes[0].packetName).toBe('test-packet')
      expect(typeof keyframes[0].timestamp).toBe('number')
    })

    it('gets latest keyframe', async () => {
      await db.writeKeyframe('test-packet', 'node-1', 'kf1')
      await db.writeKeyframe('test-packet', 'node-2', 'kf2')
      await db.writeKeyframe('test-packet', 'node-3', 'kf3')

      const latest = await db.getLatestKeyframe('test-packet')
      expect(latest).not.toBeNull()
      expect(latest!.content).toBe('kf3')
      expect(latest!.triggerNodeId).toBe('node-3')
    })

    it('returns null for latest keyframe of nonexistent packet', async () => {
      const latest = await db.getLatestKeyframe('nonexistent')
      expect(latest).toBeNull()
    })

    it('returns empty array for nonexistent packet keyframes', async () => {
      const keyframes = await db.getKeyframes('nonexistent')
      expect(keyframes).toEqual([])
    })
  })

  // ── Patterns ───────────────────────────────────────────────────────────

  describe('patterns', () => {
    it('writes a pattern and returns an id', async () => {
      const id = await db.writePattern({
        subsystem: 'auth',
        content: 'JWT pattern',
        sourcePacket: 'auth-packet',
      })
      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
    })

    it('finds patterns by subsystem', async () => {
      await db.writePattern({ subsystem: 'auth', content: 'jwt', sourcePacket: 'p1' })
      await db.writePattern({ subsystem: 'auth', content: 'oauth', sourcePacket: 'p2' })
      await db.writePattern({ subsystem: 'storage', content: 's3', sourcePacket: 'p3' })

      const authPatterns = await db.findPatterns('auth')
      expect(authPatterns).toHaveLength(2)
      expect(authPatterns.map(p => p.content).sort()).toEqual(['jwt', 'oauth'])
    })

    it('finds patterns by subsystem and codebase', async () => {
      await db.writePattern({ subsystem: 'auth', codebase: 'frontend', content: 'react-auth', sourcePacket: 'p1' })
      await db.writePattern({ subsystem: 'auth', codebase: 'backend', content: 'express-auth', sourcePacket: 'p2' })
      await db.writePattern({ subsystem: 'auth', content: 'generic-auth', sourcePacket: 'p3' })

      const frontendAuth = await db.findPatterns('auth', 'frontend')
      expect(frontendAuth).toHaveLength(1)
      expect(frontendAuth[0].content).toBe('react-auth')
    })

    it('gets all patterns', async () => {
      await db.writePattern({ subsystem: 'auth', content: 'jwt', sourcePacket: 'p1' })
      await db.writePattern({ subsystem: 'storage', content: 's3', sourcePacket: 'p2' })

      const all = await db.getAllPatterns()
      expect(all).toHaveLength(2)
    })

    it('returns empty array when no patterns match', async () => {
      const patterns = await db.findPatterns('nonexistent')
      expect(patterns).toEqual([])
    })

    it('increments confidence', async () => {
      const id = await db.writePattern({
        subsystem: 'auth',
        content: 'jwt',
        sourcePacket: 'p1',
      })

      // Initial confidence is 1
      let patterns = await db.findPatterns('auth')
      expect(patterns[0].confidence).toBe(1)

      await db.incrementConfidence(id)
      patterns = await db.findPatterns('auth')
      expect(patterns[0].confidence).toBe(2)

      await db.incrementConfidence(id)
      patterns = await db.findPatterns('auth')
      expect(patterns[0].confidence).toBe(3)
    })

    it('updates updatedAt on confidence increment', async () => {
      const id = await db.writePattern({
        subsystem: 'auth',
        content: 'jwt',
        sourcePacket: 'p1',
      })

      const before = (await db.findPatterns('auth'))[0]
      const originalUpdatedAt = before.updatedAt

      // Small delay to ensure timestamp difference
      await new Promise(r => setTimeout(r, 5))

      await db.incrementConfidence(id)
      const after = (await db.findPatterns('auth'))[0]
      expect(after.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })

    it('throws when incrementing confidence for nonexistent pattern', async () => {
      await expect(db.incrementConfidence('nonexistent')).rejects.toThrow()
    })

    it('sets createdAt and updatedAt on write', async () => {
      const beforeWrite = Date.now()
      const id = await db.writePattern({
        subsystem: 'auth',
        content: 'jwt',
        sourcePacket: 'p1',
      })

      const patterns = await db.findPatterns('auth')
      const pattern = patterns.find(p => p.id === id)!
      expect(pattern.createdAt).toBeGreaterThanOrEqual(beforeWrite)
      expect(pattern.updatedAt).toBeGreaterThanOrEqual(beforeWrite)
    })
  })

  // ── Packet metadata ────────────────────────────────────────────────────

  describe('packet metadata', () => {
    it('returns null for nonexistent packet meta', async () => {
      const meta = await db.getPacketMeta('nonexistent')
      expect(meta).toBeNull()
    })

    it('sets and gets packet meta', async () => {
      await db.setPacketMeta('test-packet', {
        planFileRef: 'plan.md',
        tags: ['auth', 'security'],
      })

      const meta = await db.getPacketMeta('test-packet')
      expect(meta).not.toBeNull()
      expect(meta!.name).toBe('test-packet')
      expect(meta!.planFileRef).toBe('plan.md')
      expect(meta!.tags).toEqual(['auth', 'security'])
      expect(typeof meta!.createdAt).toBe('number')
      expect(typeof meta!.updatedAt).toBe('number')
    })

    it('updates existing packet meta', async () => {
      await db.setPacketMeta('test-packet', { planFileRef: 'plan.md' })

      const original = await db.getPacketMeta('test-packet')
      const originalCreatedAt = original!.createdAt

      // Small delay
      await new Promise(r => setTimeout(r, 5))

      await db.setPacketMeta('test-packet', { tags: ['updated'] })

      const updated = await db.getPacketMeta('test-packet')
      expect(updated!.tags).toEqual(['updated'])
      expect(updated!.createdAt).toBe(originalCreatedAt) // createdAt should not change
      expect(updated!.updatedAt).toBeGreaterThanOrEqual(originalCreatedAt)
    })

    it('lists all packets', async () => {
      await db.setPacketMeta('packet-a', { planFileRef: 'a.md' })
      await db.setPacketMeta('packet-b', { planFileRef: 'b.md' })
      await db.setPacketMeta('packet-c', {})

      const packets = await db.listPackets()
      expect(packets).toHaveLength(3)
      const names = packets.map(p => p.name).sort()
      expect(names).toEqual(['packet-a', 'packet-b', 'packet-c'])
    })

    it('returns empty array when no packets exist', async () => {
      const packets = await db.listPackets()
      expect(packets).toEqual([])
    })

    it('deletes a packet and all associated data', async () => {
      await db.setPacketMeta('to-delete', {})
      await db.writeVersion('to-delete', 'delta', 'v1')
      await db.appendDelta('to-delete', { type: 'discovery', content: 'd1' })
      await db.writeKeyframe('to-delete', 'node-1', 'kf1')

      await db.deletePacket('to-delete')

      expect(await db.getPacketMeta('to-delete')).toBeNull()
      expect(await db.getVersions('to-delete')).toEqual([])
      expect(await db.getDeltas('to-delete')).toEqual([])
      expect(await db.getKeyframes('to-delete')).toEqual([])
    })

    it('clears active packet when deleting the active packet', async () => {
      await db.setPacketMeta('active-one', {})
      await db.setActivePacket('active-one')

      await db.deletePacket('active-one')

      const active = await db.getActivePacket()
      expect(active).toBeNull()
    })

    it('does not affect other packets when deleting one', async () => {
      await db.setPacketMeta('keep', {})
      await db.setPacketMeta('delete', {})
      await db.writeVersion('keep', 'delta', 'kept version')
      await db.writeVersion('delete', 'delta', 'deleted version')

      await db.deletePacket('delete')

      const kept = await db.getPacketMeta('keep')
      expect(kept).not.toBeNull()
      const keptVersions = await db.getVersions('keep')
      expect(keptVersions).toHaveLength(1)
    })
  })

  // ── Active packet ──────────────────────────────────────────────────────

  describe('active packet', () => {
    it('returns null when no active packet is set', async () => {
      const active = await db.getActivePacket()
      expect(active).toBeNull()
    })

    it('sets and gets active packet', async () => {
      await db.setPacketMeta('first', {})
      await db.setPacketMeta('second', {})

      await db.setActivePacket('first')
      expect(await db.getActivePacket()).toBe('first')

      await db.setActivePacket('second')
      expect(await db.getActivePacket()).toBe('second')
    })

    it('clears active packet with null', async () => {
      await db.setPacketMeta('test', {})
      await db.setActivePacket('test')
      expect(await db.getActivePacket()).toBe('test')

      await db.setActivePacket(null)
      expect(await db.getActivePacket()).toBeNull()
    })

    it('throws when setting active to nonexistent packet', async () => {
      await expect(db.setActivePacket('nonexistent')).rejects.toThrow()
    })
  })

  // ── Cross-packet isolation ─────────────────────────────────────────────

  describe('cross-packet isolation', () => {
    it('versions are scoped to their packet', async () => {
      await db.writeVersion('packet-a', 'delta', 'a-content')
      await db.writeVersion('packet-b', 'delta', 'b-content')

      const aVersions = await db.getVersions('packet-a')
      const bVersions = await db.getVersions('packet-b')

      expect(aVersions).toHaveLength(1)
      expect(aVersions[0].content).toBe('a-content')
      expect(bVersions).toHaveLength(1)
      expect(bVersions[0].content).toBe('b-content')
    })

    it('deltas are scoped to their packet', async () => {
      await db.appendDelta('packet-a', { type: 'discovery', content: 'a-delta' })
      await db.appendDelta('packet-b', { type: 'failure', content: 'b-delta' })

      const aDeltas = await db.getDeltas('packet-a')
      const bDeltas = await db.getDeltas('packet-b')

      expect(aDeltas).toHaveLength(1)
      expect(aDeltas[0].content).toBe('a-delta')
      expect(bDeltas).toHaveLength(1)
      expect(bDeltas[0].content).toBe('b-delta')
    })

    it('keyframes are scoped to their packet', async () => {
      await db.writeKeyframe('packet-a', 'node-1', 'a-kf')
      await db.writeKeyframe('packet-b', 'node-2', 'b-kf')

      const aKeyframes = await db.getKeyframes('packet-a')
      const bKeyframes = await db.getKeyframes('packet-b')

      expect(aKeyframes).toHaveLength(1)
      expect(aKeyframes[0].content).toBe('a-kf')
      expect(bKeyframes).toHaveLength(1)
      expect(bKeyframes[0].content).toBe('b-kf')
    })
  })
}

// ============================================================================
// Run conformance tests with InMemoryPacketDatabase
// ============================================================================

describe('InMemoryPacketDatabase', () => {
  runStorageConformanceTests(() => new InMemoryPacketDatabase())
})
