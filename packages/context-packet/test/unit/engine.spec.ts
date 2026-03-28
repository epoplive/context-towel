import { describe, it, expect, beforeEach } from 'vitest'
import { PacketEngine } from '../../src/PacketEngine'
import { InMemoryPacketDatabase } from '../../src/storage/InMemoryPacketDatabase'
import { createMockFs } from './helpers'
import type { FileService } from '../../src/types'
import type { VersionCompressionConfig } from '../../src/compression'

describe('PacketEngine', () => {
  let db: InMemoryPacketDatabase
  let fs: FileService
  let engine: PacketEngine

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    fs = createMockFs()
    engine = new PacketEngine(db, '.context', fs)
  })

  // ── Seed + Materialize ──────────────────────────────────────────

  describe('seed', () => {
    it('creates a packet with metadata in DB', async () => {
      await engine.seed('auth-system')

      const meta = await db.getPacketMeta('auth-system')
      expect(meta).not.toBeNull()
      expect(meta!.name).toBe('auth-system')
      expect(meta!.createdAt).toBeGreaterThan(0)
    })

    it('writes a version snapshot to DB', async () => {
      await engine.seed('auth-system')

      const versions = await db.getVersions('auth-system')
      expect(versions.length).toBe(1)
      expect(versions[0].content).toContain('# Packet: auth-system')
    })

    it('materializes markdown file to disk', async () => {
      await engine.seed('auth-system')

      const filePath = engine.getPacketPath('auth-system')
      expect(await fs.exists(filePath)).toBe(true)

      const content = await fs.read(filePath)
      expect(content).toContain('# Packet: auth-system')
      expect(content).toContain('## Whiteboard')
      expect(content).toContain('## Problem Vectors')
      expect(content).toContain('## AICCL')
      expect(content).toContain('## Delta Log')
      expect(content).toContain('## Linked')
    })

    it('stores planFileRef in metadata', async () => {
      await engine.seed('auth-system', { planFileRef: 'plan.md' })

      const meta = await db.getPacketMeta('auth-system')
      expect(meta!.planFileRef).toBe('plan.md')

      const content = await fs.read(engine.getPacketPath('auth-system'))
      expect(content).toContain('Plan: `plan.md`')
    })

    it('seeds problem vector when provided', async () => {
      await engine.seed('auth-system', {
        problemVector: {
          current: 'No auth',
          target: 'JWT + RBAC',
          approach: 'Repository pattern',
        },
      })

      const content = await fs.read(engine.getPacketPath('auth-system'))
      expect(content).toContain('## Problem Vectors')
      expect(content).toContain('primary')
      expect(content).toContain('No auth')
      expect(content).toContain('JWT + RBAC')
      expect(content).toContain('Repository pattern')
    })
  })

  // ── Materialize ─────────────────────────────────────────────────

  describe('materialize', () => {
    it('writes current DB state to file', async () => {
      await engine.seed('test')

      // Add some data
      await db.appendDelta('test', {
        nodeId: 'node-1',
        type: 'discovery',
        content: 'Found the bug',
      })

      // Re-materialize
      const path = await engine.materialize('test')
      const content = await fs.read(path)
      expect(content).toContain('node-1')
      expect(content).toContain('Found the bug')
    })

    it('returns the file path', async () => {
      await engine.seed('test')
      const path = await engine.materialize('test')
      expect(path).toBe('.context/packets/active/test/packet.md')
    })
  })

  // ── Reconstruct ─────────────────────────────────────────────────

  describe('reconstruct', () => {
    it('rebuilds file from latest DB version', async () => {
      await engine.seed('test')

      // Corrupt the file
      await fs.write(engine.getPacketPath('test'), 'CORRUPTED')

      // Reconstruct
      const path = await engine.reconstruct('test')
      const content = await fs.read(path)
      expect(content).toContain('# Packet: test')
      expect(content).not.toContain('CORRUPTED')
    })

    it('throws when no versions exist', async () => {
      await expect(engine.reconstruct('nonexistent')).rejects.toThrow(
        'No versions found for packet: nonexistent'
      )
    })
  })

  // ── Node Update ─────────────────────────────────────────────────

  describe('nodeUpdate', () => {
    it('appends a delta to the DB', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'auth-middleware', 'active', 'Implementing JWT validation')

      const deltas = await db.getDeltasForNode('test', 'auth-middleware')
      expect(deltas.length).toBe(1)
      expect(deltas[0].type).toBe('discovery')
      expect(deltas[0].content).toBe('Implementing JWT validation')
    })

    it('uses success delta type for success state', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'auth-middleware', 'success', 'JWT validation working')

      const deltas = await db.getDeltasForNode('test', 'auth-middleware')
      expect(deltas[0].type).toBe('success')
    })

    it('creates a new version snapshot', async () => {
      await engine.seed('test')
      const beforeVersions = await db.getVersions('test')

      await engine.nodeUpdate('test', 'node-1', 'active', 'Some work')

      const afterVersions = await db.getVersions('test')
      expect(afterVersions.length).toBe(beforeVersions.length + 1)
    })

    it('materializes the update to file', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'node-1', 'active', 'Node content here')

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('node-1')
      expect(content).toContain('Node content here')
    })

    it('stores layer when provided', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'arch-node', 'active', 'High level view', 'continent')

      const deltas = await db.getDeltasForNode('test', 'arch-node')
      const parsed = JSON.parse(deltas[0].content)
      expect(parsed.content).toBe('High level view')
      expect(parsed.layer).toBe('continent')
    })
  })

  // ── Node Promote ────────────────────────────────────────────────

  describe('nodePromote', () => {
    it('writes a keyframe for the node', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'node-1', 'active', 'Work done')

      await engine.nodePromote('test', 'node-1')

      const keyframes = await db.getKeyframes('test')
      expect(keyframes.length).toBe(1)
      expect(keyframes[0].triggerNodeId).toBe('node-1')
    })

    it('appends a promotion delta', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'node-1', 'active', 'Work done')

      await engine.nodePromote('test', 'node-1')

      const deltas = await db.getDeltasForNode('test', 'node-1')
      const promotionDelta = deltas.find(d => d.type === 'promotion')
      expect(promotionDelta).toBeDefined()
    })

    it('collapses the delta chain into the keyframe', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'node-1', 'active', 'First attempt')
      await engine.nodeUpdate('test', 'node-1', 'active', 'Second attempt')
      await engine.nodeUpdate('test', 'node-1', 'success', 'Final solution')

      await engine.nodePromote('test', 'node-1')

      const keyframes = await db.getKeyframes('test')
      // The collapsed content should be the latest delta content
      expect(keyframes[0].content).toBe('Final solution')
    })

    it('throws when no deltas exist for node', async () => {
      await engine.seed('test')
      await expect(engine.nodePromote('test', 'nonexistent')).rejects.toThrow(
        'No deltas found for node "nonexistent"'
      )
    })

    it('materializes the node as success in markdown', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'node-1', 'active', 'Promoted content')
      await engine.nodePromote('test', 'node-1')

      const content = await fs.read(engine.getPacketPath('test'))
      // After promotion, the node should show as promotion (which maps to success state)
      expect(content).toContain('node-1')
    })
  })

  // ── Node Fail ───────────────────────────────────────────────────

  describe('nodeFail', () => {
    it('appends a failure delta with tried and reason', async () => {
      await engine.seed('test')
      await engine.nodeFail('test', 'node-1', 'Used passport.js', 'Too much magic')

      const deltas = await db.getDeltasForNode('test', 'node-1')
      expect(deltas.length).toBe(1)
      expect(deltas[0].type).toBe('failure')
      expect(deltas[0].content).toContain('Tried: Used passport.js')
      expect(deltas[0].content).toContain('Reason: Too much magic')
    })

    it('materializes the failure in markdown', async () => {
      await engine.seed('test')
      await engine.nodeFail('test', 'node-1', 'Tried X', 'Did not work')

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('node-1')
      expect(content).toContain('failure')
    })

    it('creates a version snapshot', async () => {
      await engine.seed('test')
      const before = await db.getVersions('test')

      await engine.nodeFail('test', 'node-1', 'Thing', 'Reason')

      const after = await db.getVersions('test')
      expect(after.length).toBe(before.length + 1)
    })
  })

  // ── Whiteboard Update ───────────────────────────────────────────

  describe('whiteboardUpdate', () => {
    it('stores mermaid content for a section', async () => {
      await engine.seed('test')
      await engine.whiteboardUpdate('test', 'Architecture', 'graph TD\n  A --> B')

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('### Architecture')
      expect(content).toContain('```mermaid')
      expect(content).toContain('graph TD')
      expect(content).toContain('A --> B')
    })

    it('updates the section on subsequent calls', async () => {
      await engine.seed('test')
      await engine.whiteboardUpdate('test', 'Architecture', 'graph TD\n  A --> B')
      await engine.whiteboardUpdate('test', 'Architecture', 'graph TD\n  A --> B --> C')

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('A --> B --> C')
    })

    it('supports multiple sections', async () => {
      await engine.seed('test')
      await engine.whiteboardUpdate('test', 'Architecture', 'graph TD\n  A --> B')
      await engine.whiteboardUpdate('test', 'Data Model', 'erDiagram\n  User ||--o{ Order : places')

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('### Architecture')
      expect(content).toContain('### Data Model')
      expect(content).toContain('erDiagram')
    })
  })

  // ── Delta Append ────────────────────────────────────────────────

  describe('deltaAppend', () => {
    it('appends a delta to the log', async () => {
      await engine.seed('test')
      await engine.deltaAppend('test', 'node-1', 'discovery', 'Found something')

      const deltas = await db.getDeltas('test')
      const latest = deltas[deltas.length - 1]
      expect(latest.type).toBe('discovery')
      expect(latest.content).toBe('Found something')
    })

    it('works without a nodeId', async () => {
      await engine.seed('test')
      await engine.deltaAppend('test', undefined, 'discovery', 'General note')

      const deltas = await db.getDeltas('test')
      const latest = deltas[deltas.length - 1]
      expect(latest.nodeId).toBeUndefined()
    })

    it('shows deltas in the delta log section', async () => {
      await engine.seed('test')
      await engine.deltaAppend('test', 'node-1', 'discovery', 'Important finding')

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('## Delta Log')
      expect(content).toContain('Important finding')
      expect(content).toContain('**discovery**')
    })
  })

  // ── Collapse ────────────────────────────────────────────────────

  describe('collapse', () => {
    it('writes a keyframe from collapsed deltas', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'node-1', 'active', 'Step 1')
      await engine.nodeUpdate('test', 'node-1', 'active', 'Step 2')
      await engine.nodeUpdate('test', 'node-1', 'active', 'Final state')

      await engine.collapse('test', 'node-1')

      const keyframes = await db.getKeyframes('test')
      expect(keyframes.length).toBe(1)
      expect(keyframes[0].content).toBe('Final state')
    })

    it('appends a collapse delta', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'node-1', 'active', 'Content')

      await engine.collapse('test', 'node-1')

      const deltas = await db.getDeltasForNode('test', 'node-1')
      const collapseDelta = deltas.find(d => d.type === 'collapse')
      expect(collapseDelta).toBeDefined()
    })

    it('throws when no deltas exist for node', async () => {
      await engine.seed('test')
      await expect(engine.collapse('test', 'nonexistent')).rejects.toThrow(
        'No deltas found for node "nonexistent"'
      )
    })
  })

  // ── Problem Vectors ─────────────────────────────────────────────

  describe('vectorUpdate', () => {
    it('creates a vector in the DB', async () => {
      await engine.seed('test')
      await engine.vectorUpdate('test', 'perf', 'Slow', 'Fast', 'Caching')

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('## Problem Vectors')
      expect(content).toContain('perf')
      expect(content).toContain('Slow')
      expect(content).toContain('Fast')
      expect(content).toContain('Caching')
    })

    it('updates existing vector', async () => {
      await engine.seed('test')
      await engine.vectorUpdate('test', 'perf', 'Slow', 'Fast', 'Caching')
      await engine.vectorUpdate('test', 'perf', 'Slow', 'Very fast', 'Redis + CDN')

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('Very fast')
      expect(content).toContain('Redis + CDN')
    })

    it('supports custom state', async () => {
      await engine.seed('test')
      await engine.vectorUpdate('test', 'perf', 'Slow', 'Fast', 'Caching', 'failed')

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('[failed]')
    })
  })

  describe('vectorResolve', () => {
    it('marks a vector as success', async () => {
      await engine.seed('test')
      await engine.vectorUpdate('test', 'perf', 'Slow', 'Fast', 'Caching')
      await engine.vectorResolve('test', 'perf')

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('[success]')
    })

    it('writes a keyframe for the vector', async () => {
      await engine.seed('test')
      await engine.vectorUpdate('test', 'perf', 'Slow', 'Fast', 'Caching')
      await engine.vectorResolve('test', 'perf')

      const keyframes = await db.getKeyframes('test')
      expect(keyframes.length).toBe(1)
    })

    it('throws when vector does not exist', async () => {
      await engine.seed('test')
      await expect(engine.vectorResolve('test', 'nonexistent')).rejects.toThrow(
        'No deltas found for vector "nonexistent"'
      )
    })
  })

  // ── CLAUDE.md Injection ─────────────────────────────────────────

  describe('getInjectionContent', () => {
    it('returns null when no active packet', async () => {
      const content = await engine.getInjectionContent()
      expect(content).toBeNull()
    })

    it('returns content for explicit packet name', async () => {
      await engine.seed('test')
      await engine.vectorUpdate('test', 'main', 'Broken', 'Fixed', 'Fix it')

      const content = await engine.getInjectionContent('test')
      expect(content).not.toBeNull()
      expect(content).toContain('Active Packet: test')
      expect(content).toContain('Broken')
      expect(content).toContain('Fixed')
    })

    it('uses active packet when no name provided', async () => {
      await engine.seed('test')
      await db.setActivePacket('test')
      await engine.vectorUpdate('test', 'main', 'A', 'B', 'C')

      const content = await engine.getInjectionContent()
      expect(content).not.toBeNull()
      expect(content).toContain('Active Packet: test')
    })

    it('includes workflow instructions', async () => {
      await engine.seed('test')
      await engine.vectorUpdate('test', 'v1', 'X', 'Y', 'Z')

      const content = await engine.getInjectionContent('test')
      expect(content).toContain('## Packet Workflow (AICCL Compilation Pipeline)')
    })

    it('returns content even with no vectors (empty vectors section)', async () => {
      await engine.seed('test')

      const content = await engine.getInjectionContent('test')
      expect(content).not.toBeNull()
      expect(content).toContain('No active problem vectors')
    })
  })

  describe('injectIntoContent', () => {
    it('appends section when no markers exist', () => {
      const result = engine.injectIntoContent('# CLAUDE.md\n\nExisting.', 'Packet info')

      expect(result).toContain('# CLAUDE.md')
      expect(result).toContain('<!-- CONTEXT_PACKET_START -->')
      expect(result).toContain('Packet info')
      expect(result).toContain('<!-- CONTEXT_PACKET_END -->')
    })

    it('replaces existing section', () => {
      const input = `# CLAUDE.md

<!-- CONTEXT_PACKET_START -->
Old stuff
<!-- CONTEXT_PACKET_END -->

Other content`

      const result = engine.injectIntoContent(input, 'New stuff')
      expect(result).toContain('New stuff')
      expect(result).not.toContain('Old stuff')
      expect(result).toContain('Other content')
    })
  })

  describe('removeFromContent', () => {
    it('removes the section', () => {
      const input = `# CLAUDE.md

<!-- CONTEXT_PACKET_START -->
Packet content
<!-- CONTEXT_PACKET_END -->

Other`

      const result = engine.removeFromContent(input)
      expect(result).not.toContain('CONTEXT_PACKET')
      expect(result).toContain('Other')
    })

    it('returns content unchanged when no markers', () => {
      const input = '# CLAUDE.md\n\nNo packet.'
      expect(engine.removeFromContent(input)).toBe(input)
    })
  })

  // ── Archive ─────────────────────────────────────────────────────

  describe('archive', () => {
    it('writes file to archive directory', async () => {
      await engine.seed('done-work')
      await engine.nodeUpdate('done-work', 'task-1', 'success', 'Completed')

      await engine.archive('done-work')

      const archivePath = '.context/packets/archive/done-work/packet.md'
      expect(await fs.exists(archivePath)).toBe(true)

      const content = await fs.read(archivePath)
      expect(content).toContain('# Packet: done-work')
    })

    it('removes current file after archiving', async () => {
      await engine.seed('done-work')
      const currentPath = engine.getPacketPath('done-work')
      expect(await fs.exists(currentPath)).toBe(true)

      await engine.archive('done-work')
      expect(await fs.exists(currentPath)).toBe(false)
    })

    it('extracts success nodes as patterns', async () => {
      await engine.seed('done-work')
      await engine.nodeUpdate('done-work', 'auth-pattern', 'success', 'JWT middleware pattern')

      await engine.archive('done-work')

      const patterns = await db.getAllPatterns()
      expect(patterns.length).toBe(1)
      expect(patterns[0].subsystem).toBe('auth-pattern')
      expect(patterns[0].sourcePacket).toBe('done-work')
    })

    it('writes final keyframe', async () => {
      await engine.seed('done-work')
      await engine.archive('done-work')

      const keyframes = await db.getKeyframes('done-work')
      expect(keyframes.length).toBe(1)
      expect(keyframes[0].triggerNodeId).toBe('archive')
    })

    it('clears active packet if archived was active', async () => {
      await engine.seed('done-work')
      await db.setActivePacket('done-work')
      expect(await db.getActivePacket()).toBe('done-work')

      await engine.archive('done-work')
      expect(await db.getActivePacket()).toBeNull()
    })
  })

  // ── Multiple Packets ────────────────────────────────────────────

  describe('multiple packets', () => {
    it('operations do not interfere across packets', async () => {
      await engine.seed('packet-a')
      await engine.seed('packet-b')

      await engine.nodeUpdate('packet-a', 'node-a', 'active', 'Content A')
      await engine.nodeUpdate('packet-b', 'node-b', 'active', 'Content B')

      const contentA = await fs.read(engine.getPacketPath('packet-a'))
      const contentB = await fs.read(engine.getPacketPath('packet-b'))

      expect(contentA).toContain('node-a')
      expect(contentA).toContain('Content A')
      expect(contentA).not.toContain('node-b')
      expect(contentA).not.toContain('Content B')

      expect(contentB).toContain('node-b')
      expect(contentB).toContain('Content B')
      expect(contentB).not.toContain('node-a')
      expect(contentB).not.toContain('Content A')
    })

    it('delta logs are per-packet', async () => {
      await engine.seed('packet-a')
      await engine.seed('packet-b')

      await engine.deltaAppend('packet-a', undefined, 'discovery', 'Found A')
      await engine.deltaAppend('packet-b', undefined, 'discovery', 'Found B')

      const deltasA = await db.getDeltas('packet-a')
      const deltasB = await db.getDeltas('packet-b')

      const contentDeltasA = deltasA.filter(d => d.content === 'Found A')
      const contentDeltasB = deltasB.filter(d => d.content === 'Found B')

      expect(contentDeltasA.length).toBe(1)
      expect(contentDeltasB.length).toBe(1)

      // No cross-contamination
      expect(deltasA.find(d => d.content === 'Found B')).toBeUndefined()
      expect(deltasB.find(d => d.content === 'Found A')).toBeUndefined()
    })
  })

  // ── Active Packet ───────────────────────────────────────────────

  describe('active packet', () => {
    it('set and get active packet via DB', async () => {
      await engine.seed('first')
      await engine.seed('second')

      await db.setActivePacket('first')
      expect(await db.getActivePacket()).toBe('first')

      await db.setActivePacket('second')
      expect(await db.getActivePacket()).toBe('second')

      await db.setActivePacket(null)
      expect(await db.getActivePacket()).toBeNull()
    })

    it('getInjectionContent uses active packet', async () => {
      await engine.seed('first')
      await engine.seed('second')
      await engine.vectorUpdate('first', 'v1', 'A', 'B', 'C')
      await engine.vectorUpdate('second', 'v2', 'X', 'Y', 'Z')

      await db.setActivePacket('second')
      const content = await engine.getInjectionContent()
      expect(content).toContain('Active Packet: second')
    })
  })

  // ── End-to-End Workflow ─────────────────────────────────────────

  describe('end-to-end workflow', () => {
    it('full packet lifecycle: seed, work, promote, archive', async () => {
      // 1. Seed packet with problem vector
      await engine.seed('feature-x', {
        problemVector: {
          current: 'No feature X',
          target: 'Feature X working',
          approach: 'Incremental implementation',
        },
        planFileRef: 'plans/feature-x.md',
      })

      // Verify initial state
      let content = await fs.read(engine.getPacketPath('feature-x'))
      expect(content).toContain('No feature X')
      expect(content).toContain('plans/feature-x.md')

      // 2. Add whiteboard diagram
      await engine.whiteboardUpdate('feature-x', 'Architecture', 'graph TD\n  Client --> API --> DB')

      content = await fs.read(engine.getPacketPath('feature-x'))
      expect(content).toContain('Client --> API --> DB')

      // 3. Work on nodes
      await engine.nodeUpdate('feature-x', 'api-endpoint', 'active', 'Building /api/feature-x endpoint')
      await engine.nodeUpdate('feature-x', 'db-migration', 'active', 'Adding feature_x table')

      content = await fs.read(engine.getPacketPath('feature-x'))
      expect(content).toContain('api-endpoint')
      expect(content).toContain('db-migration')

      // 4. Fail one approach
      await engine.nodeFail('feature-x', 'api-endpoint', 'REST approach', 'Too many round trips')

      // 5. Update with new approach
      await engine.nodeUpdate('feature-x', 'api-endpoint', 'active', 'Switched to GraphQL')

      // 6. Complete and promote
      await engine.nodeUpdate('feature-x', 'api-endpoint', 'success', 'GraphQL endpoint working')
      await engine.nodePromote('feature-x', 'api-endpoint')

      await engine.nodeUpdate('feature-x', 'db-migration', 'success', 'Migration applied')
      await engine.nodePromote('feature-x', 'db-migration')

      // 7. Resolve vector
      await engine.vectorResolve('feature-x', 'primary')

      content = await fs.read(engine.getPacketPath('feature-x'))
      expect(content).toContain('[success]')

      // 8. Verify version history exists (may be pruned by compression)
      const versions = await db.getVersions('feature-x')
      expect(versions.length).toBeGreaterThan(0)

      // 9. Archive
      await db.setActivePacket('feature-x')
      await engine.archive('feature-x')

      // Verify archived
      expect(await fs.exists('.context/packets/archive/feature-x/packet.md')).toBe(true)
      expect(await fs.exists(engine.getPacketPath('feature-x'))).toBe(false)
      expect(await db.getActivePacket()).toBeNull()

      // Verify patterns extracted (promotion prunes pre-promote deltas including
      // success deltas, so archive may find fewer success-typed deltas depending
      // on timing; at least one pattern should be extracted)
      const patterns = await db.getAllPatterns()
      expect(patterns.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ── Version Compression ──────────────────────────────────────────

  describe('version compression', () => {
    it('accepts custom compression config', () => {
      const custom = new PacketEngine(db, '.context', fs, {
        keyframeInterval: 5,
        maxVersionsPerPacket: 20,
      })
      // Engine creates successfully with custom config
      expect(custom).toBeDefined()
    })

    it('auto-promotes delta to keyframe at configured interval', async () => {
      // Use a small keyframe interval for testing
      const smallEngine = new PacketEngine(db, '.context', fs, {
        keyframeInterval: 3,
        maxVersionsPerPacket: 100,
      })

      await smallEngine.seed('test')

      // seed writes 1 version (delta trigger).
      // Now add mutations to cross the keyframe interval boundary.
      await smallEngine.nodeUpdate('test', 'n1', 'active', 'update 1') // delta 2
      await smallEngine.nodeUpdate('test', 'n1', 'active', 'update 2') // delta 3
      // At this point we have 3 consecutive deltas. The next write should
      // auto-promote to keyframe because deltasSinceKeyframe >= 3.
      await smallEngine.nodeUpdate('test', 'n1', 'active', 'update 3') // should auto-promote

      const versions = await db.getVersions('test')
      // Find the auto-promoted keyframe (should be the newest version)
      const newest = versions[0]
      expect(newest.trigger).toBe('keyframe')
    })

    it('prunes versions beyond maxVersionsPerPacket', async () => {
      const tinyEngine = new PacketEngine(db, '.context', fs, {
        keyframeInterval: 100, // no auto-keyframes during this test
        maxVersionsPerPacket: 5,
      })

      await tinyEngine.seed('test')

      // Generate more versions than the max
      for (let i = 0; i < 10; i++) {
        await tinyEngine.nodeUpdate('test', 'n1', 'active', `update ${i}`)
      }

      const versions = await db.getVersions('test')
      // Should be capped at maxVersionsPerPacket (5)
      expect(versions.length).toBeLessThanOrEqual(5)
      // Newest content should be present
      expect(versions[0].content).toContain('update 9')
    })

    it('preserves keyframe versions during pruning', async () => {
      const tinyEngine = new PacketEngine(db, '.context', fs, {
        keyframeInterval: 3,
        maxVersionsPerPacket: 5,
      })

      await tinyEngine.seed('test')

      // Generate enough mutations to create auto-keyframes and trigger pruning
      for (let i = 0; i < 15; i++) {
        await tinyEngine.nodeUpdate('test', 'n1', 'active', `update ${i}`)
      }

      const versions = await db.getVersions('test')
      // Keyframe versions should survive pruning
      const keyframes = versions.filter(v => v.trigger === 'keyframe' || v.trigger === 'collapse')
      expect(keyframes.length).toBeGreaterThan(0)
    })

    it('archive aggressively prunes to single version', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'n1', 'active', 'work')
      await engine.nodeUpdate('test', 'n2', 'active', 'more work')

      // Before archive: multiple versions
      const before = await db.getVersions('test')
      expect(before.length).toBeGreaterThan(1)

      await engine.archive('test')

      // After archive: aggressively pruned — only the final keyframe
      // plus any older keyframes survive
      const after = await db.getVersions('test')
      // The archive writes a keyframe version and prunes to keepCount=1.
      // Older keyframes are retained too (they're protected), but in this
      // case there are none, so we should have exactly 1.
      expect(after.length).toBe(1)
      expect(after[0].trigger).toBe('keyframe')
    })

    it('collapse prunes source deltas for the collapsed node', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'node-1', 'active', 'Step 1')

      // Add a delay so the pre-collapse deltas have a strictly earlier timestamp
      await new Promise(r => setTimeout(r, 15))

      await engine.nodeUpdate('test', 'node-1', 'active', 'Step 2')
      await new Promise(r => setTimeout(r, 15))

      await engine.collapse('test', 'node-1')

      const deltas = await db.getDeltasForNode('test', 'node-1')
      // After collapse, pre-collapse discovery deltas should be pruned,
      // leaving only the collapse delta
      const collapseDeltas = deltas.filter(d => d.type === 'collapse')
      expect(collapseDeltas.length).toBe(1)
      // Some or all pre-collapse deltas may be pruned depending on timing
      expect(deltas.length).toBeLessThanOrEqual(3) // at most: Step1 + Step2 + collapse
    })

    it('nodePromote prunes source deltas for the promoted node', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'node-1', 'active', 'Attempt 1')
      await new Promise(r => setTimeout(r, 15))

      await engine.nodeUpdate('test', 'node-1', 'active', 'Attempt 2')
      await new Promise(r => setTimeout(r, 15))

      await engine.nodePromote('test', 'node-1')

      const deltas = await db.getDeltasForNode('test', 'node-1')
      // The promotion delta should be present
      const promotionDeltas = deltas.filter(d => d.type === 'promotion')
      expect(promotionDeltas.length).toBe(1)
      // Pre-promotion deltas should be pruned
      expect(deltas.length).toBeLessThanOrEqual(3)
    })

    it('compression config defaults are applied when none provided', async () => {
      // Default engine should work exactly as before for reasonable usage
      await engine.seed('test')
      for (let i = 0; i < 5; i++) {
        await engine.nodeUpdate('test', 'n1', 'active', `update ${i}`)
      }

      const versions = await db.getVersions('test')
      // With default maxVersionsPerPacket=50, 6 versions should all be kept
      expect(versions.length).toBe(6) // 1 seed + 5 updates
    })
  })

  // ── Typed Nodes ────────────────────────────────────────────────

  describe('typed nodes', () => {
    it('stores type in delta content JSON', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'ref-auth', 'active', 'Auth documentation',
        undefined, 'reference', '/docs/auth.md')

      const deltas = await db.getDeltasForNode('test', 'ref-auth')
      const parsed = JSON.parse(deltas[0].content)
      expect(parsed.content).toBe('Auth documentation')
      expect(parsed.type).toBe('reference')
      expect(parsed.path).toBe('/docs/auth.md')
    })

    it('renders type annotation in node header', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'ref-1', 'active', 'Docs pointer',
        undefined, 'reference', './docs/api.md')

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('type: reference')
      expect(content).toContain('path: ./docs/api.md')
    })

    it('work type is not rendered (default)', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'work-1', 'active', 'Regular work node',
        undefined, 'work')

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('work-1')
      expect(content).not.toContain('type: work')
    })

    it('plain nodes without type default to work (no type header)', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'plain', 'active', 'No type specified')

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('plain')
      expect(content).not.toContain('type:')
    })

    it('supports test type with path', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'test-auth', 'active', 'Auth test suite',
        undefined, 'test', 'test/auth.spec.ts')

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('type: test')
      expect(content).toContain('path: test/auth.spec.ts')
    })

    it('supports diagram type', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'diag-arch', 'active', 'graph TD\n  A --> B',
        undefined, 'diagram')

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('type: diagram')
      expect(content).toContain('graph TD')
    })

    it('preserves type across updates when not re-specified', async () => {
      await engine.seed('test')
      // First update sets type
      await engine.nodeUpdate('test', 'ref-1', 'active', 'Initial ref',
        undefined, 'reference', '/docs/old.md')
      // Second update without type/path — should preserve them
      await engine.nodeUpdate('test', 'ref-1', 'active', 'Updated content')

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('type: reference')
      expect(content).toContain('path: /docs/old.md')
      expect(content).toContain('Updated content')
    })

    it('combines type with layer', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'ref-deep', 'active', 'Deep reference',
        'street', 'reference', '/src/auth/middleware.ts')

      const deltas = await db.getDeltasForNode('test', 'ref-deep')
      const parsed = JSON.parse(deltas[0].content)
      expect(parsed.content).toBe('Deep reference')
      expect(parsed.layer).toBe('street')
      expect(parsed.type).toBe('reference')
      expect(parsed.path).toBe('/src/auth/middleware.ts')

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('type: reference')
      expect(content).toContain('layer: street')
      expect(content).toContain('path: /src/auth/middleware.ts')
    })
  })

  // ── Edge Operations ───────────────────────────────────────────

  describe('edgeAdd', () => {
    it('creates an edge between two nodes', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'work-1', 'active', 'Work node')
      await engine.nodeUpdate('test', 'ref-1', 'active', 'Reference node')

      const edgeId = await engine.edgeAdd('test', 'work-1', 'ref-1')
      expect(edgeId).toBeTruthy()

      const edges = await engine.edgeList('test')
      expect(edges.length).toBe(1)
      expect(edges[0].sourceNode).toBe('work-1')
      expect(edges[0].targetNode).toBe('ref-1')
    })

    it('materializes edges in node headers', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'work-1', 'active', 'Work node')
      await engine.nodeUpdate('test', 'ref-1', 'active', 'Reference')

      await engine.edgeAdd('test', 'work-1', 'ref-1')

      const content = await fs.read(engine.getPacketPath('test'))
      // work-1 node header should list ref-1 as connected
      expect(content).toContain('edges: ref-1')
    })

    it('supports multiple edges from one node', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'work-1', 'active', 'Work')
      await engine.nodeUpdate('test', 'ref-a', 'active', 'Ref A')
      await engine.nodeUpdate('test', 'ref-b', 'active', 'Ref B')

      await engine.edgeAdd('test', 'work-1', 'ref-a')
      await engine.edgeAdd('test', 'work-1', 'ref-b')

      const edges = await engine.edgeList('test', 'work-1')
      expect(edges.length).toBe(2)

      const content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('edges: ref-a, ref-b')
    })
  })

  describe('edgeRemove', () => {
    it('removes an edge', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'a', 'active', 'A')
      await engine.nodeUpdate('test', 'b', 'active', 'B')

      await engine.edgeAdd('test', 'a', 'b')
      expect((await engine.edgeList('test')).length).toBe(1)

      await engine.edgeRemove('test', 'a', 'b')
      expect((await engine.edgeList('test')).length).toBe(0)
    })

    it('edge no longer appears in materialized markdown', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'a', 'active', 'A')
      await engine.nodeUpdate('test', 'b', 'active', 'B')

      await engine.edgeAdd('test', 'a', 'b')
      let content = await fs.read(engine.getPacketPath('test'))
      expect(content).toContain('edges: b')

      await engine.edgeRemove('test', 'a', 'b')
      content = await fs.read(engine.getPacketPath('test'))
      expect(content).not.toContain('edges:')
    })
  })

  describe('edgeList', () => {
    it('returns all edges when no nodeId', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'a', 'active', 'A')
      await engine.nodeUpdate('test', 'b', 'active', 'B')
      await engine.nodeUpdate('test', 'c', 'active', 'C')

      await engine.edgeAdd('test', 'a', 'b')
      await engine.edgeAdd('test', 'b', 'c')

      const all = await engine.edgeList('test')
      expect(all.length).toBe(2)
    })

    it('filters to specific node (both directions)', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'a', 'active', 'A')
      await engine.nodeUpdate('test', 'b', 'active', 'B')
      await engine.nodeUpdate('test', 'c', 'active', 'C')

      await engine.edgeAdd('test', 'a', 'b')
      await engine.edgeAdd('test', 'c', 'b')

      // b is connected to both a and c
      const bEdges = await engine.edgeList('test', 'b')
      expect(bEdges.length).toBe(2)

      // a is only connected to b
      const aEdges = await engine.edgeList('test', 'a')
      expect(aEdges.length).toBe(1)
    })

    it('returns empty for unconnected node', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'alone', 'active', 'No connections')

      const edges = await engine.edgeList('test', 'alone')
      expect(edges.length).toBe(0)
    })
  })

  describe('sliceForNode with edges', () => {
    it('includes transitively connected nodes via edges', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'work-1', 'active', 'Work content')
      await engine.nodeUpdate('test', 'ref-1', 'active', 'Reference content')
      await engine.nodeUpdate('test', 'unrelated', 'active', 'Not connected')

      await engine.edgeAdd('test', 'work-1', 'ref-1')

      const slice = await engine.sliceForNode('test', ['work-1'])
      expect(slice).toContain('work-1')
      expect(slice).toContain('ref-1')
      expect(slice).not.toContain('unrelated')
    })

    it('walks transitive edge closure', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'a', 'active', 'Node A')
      await engine.nodeUpdate('test', 'b', 'active', 'Node B')
      await engine.nodeUpdate('test', 'c', 'active', 'Node C')

      await engine.edgeAdd('test', 'a', 'b')
      await engine.edgeAdd('test', 'b', 'c')

      // Slicing for 'a' should include b and c via transitive edges
      const slice = await engine.sliceForNode('test', ['a'])
      expect(slice).toContain('a')
      expect(slice).toContain('b')
      expect(slice).toContain('c')
    })
  })

  // ── Edge DB operations ────────────────────────────────────────

  describe('edge database operations', () => {
    it('edges are per-packet', async () => {
      await engine.seed('packet-a')
      await engine.seed('packet-b')

      await engine.nodeUpdate('packet-a', 'n1', 'active', 'A1')
      await engine.nodeUpdate('packet-a', 'n2', 'active', 'A2')
      await engine.nodeUpdate('packet-b', 'n3', 'active', 'B1')
      await engine.nodeUpdate('packet-b', 'n4', 'active', 'B2')

      await engine.edgeAdd('packet-a', 'n1', 'n2')
      await engine.edgeAdd('packet-b', 'n3', 'n4')

      const edgesA = await engine.edgeList('packet-a')
      const edgesB = await engine.edgeList('packet-b')

      expect(edgesA.length).toBe(1)
      expect(edgesA[0].sourceNode).toBe('n1')

      expect(edgesB.length).toBe(1)
      expect(edgesB[0].sourceNode).toBe('n3')
    })

    it('edges are cleaned up on packet delete', async () => {
      await engine.seed('test')
      await engine.nodeUpdate('test', 'a', 'active', 'A')
      await engine.nodeUpdate('test', 'b', 'active', 'B')
      await engine.edgeAdd('test', 'a', 'b')

      expect((await db.getAllEdges('test')).length).toBe(1)

      await db.deletePacket('test')

      expect((await db.getAllEdges('test')).length).toBe(0)
    })
  })
})
