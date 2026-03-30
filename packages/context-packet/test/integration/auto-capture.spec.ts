import { describe, it, expect, beforeEach } from 'vitest'
import { PacketEngine } from '../../src/PacketEngine'
import { InMemoryPacketDatabase } from '../../src/storage/InMemoryPacketDatabase'
import { createMockFs } from '../unit/helpers'
import type { FileService } from '../../src/types'

/**
 * Integration test: automatic metadata capture routes file changes
 * to work nodes via reference edges. Uses real engine + DB, no mocks.
 */
describe('automatic metadata capture (integration)', () => {
  let db: InMemoryPacketDatabase
  let fs: FileService
  let engine: PacketEngine

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    fs = createMockFs()
    engine = new PacketEngine(db, '.context', fs)
  })

  it('routes file changes to work nodes via reference edges', async () => {
    await engine.seed('capture-test')
    await engine.nodeUpdate('capture-test', 'auth-work', 'active', 'Fix auth')
    await engine.nodeUpdate('capture-test', 'ref-middleware', 'active', 'Auth middleware',
      'reference', 'src/auth/middleware.ts')
    await engine.edgeAdd('capture-test', 'ref-middleware', 'auth-work')

    const count = await engine.routeFileChanges('capture-test', ['src/auth/middleware.ts'])
    expect(count).toBe(1)

    // Verify mutation delta recorded on auth-work
    const deltas = await db.getDeltas('capture-test')
    const mutation = deltas.find(d => d.nodeId === 'auth-work' && d.type === 'mutation')
    expect(mutation).toBeDefined()
    expect(mutation!.content).toContain('src/auth/middleware.ts')
  })

  it('routes commit info as evidence on work nodes', async () => {
    await engine.seed('commit-test')
    await engine.nodeUpdate('commit-test', 'fix-work', 'active', 'Fix bug')
    await engine.nodeUpdate('commit-test', 'ref-file', 'active', 'Source file',
      'reference', 'src/service.ts')
    await engine.edgeAdd('commit-test', 'ref-file', 'fix-work')

    const count = await engine.routeFileChanges('commit-test', ['src/service.ts'], {
      hash: 'abc123',
      message: 'fix: resolve token expiry',
    })
    expect(count).toBe(1)

    const deltas = await db.getDeltas('commit-test')
    const mutation = deltas.find(d => d.nodeId === 'fix-work' && d.type === 'mutation')
    expect(mutation!.content).toContain('abc123')
    expect(mutation!.content).toContain('fix: resolve token expiry')
  })

  it('matches files by suffix (reference path is relative, change is absolute)', async () => {
    await engine.seed('suffix-test')
    await engine.nodeUpdate('suffix-test', 'work-1', 'active', 'Work')
    await engine.nodeUpdate('suffix-test', 'ref-1', 'active', 'Ref',
      'reference', 'src/auth.ts')
    await engine.edgeAdd('suffix-test', 'ref-1', 'work-1')

    // Changed file has a longer path but ends with the reference path
    const count = await engine.routeFileChanges('suffix-test', ['/project/src/auth.ts'])
    expect(count).toBe(1)
  })

  it('routes same file change to multiple work nodes via separate refs', async () => {
    await engine.seed('multi-route')
    await engine.nodeUpdate('multi-route', 'work-a', 'active', 'Work A')
    await engine.nodeUpdate('multi-route', 'work-b', 'active', 'Work B')
    await engine.nodeUpdate('multi-route', 'ref-shared', 'active', 'Shared ref',
      'reference', 'src/shared.ts')
    await engine.edgeAdd('multi-route', 'ref-shared', 'work-a')
    await engine.edgeAdd('multi-route', 'ref-shared', 'work-b')

    const count = await engine.routeFileChanges('multi-route', ['src/shared.ts'])
    // Should record on both work nodes
    expect(count).toBe(2)

    const deltas = await db.getDeltas('multi-route')
    const mutations = deltas.filter(d => d.type === 'mutation')
    const nodeIds = mutations.map(d => d.nodeId)
    expect(nodeIds).toContain('work-a')
    expect(nodeIds).toContain('work-b')
  })

  it('ignores file changes that match no reference nodes', async () => {
    await engine.seed('no-match')
    await engine.nodeUpdate('no-match', 'work-1', 'active', 'Work')
    await engine.nodeUpdate('no-match', 'ref-1', 'active', 'Ref',
      'reference', 'src/specific.ts')
    await engine.edgeAdd('no-match', 'ref-1', 'work-1')

    const count = await engine.routeFileChanges('no-match', ['src/unrelated.ts'])
    expect(count).toBe(0)
  })

  it('returns 0 for empty file list', async () => {
    await engine.seed('empty-test')
    const count = await engine.routeFileChanges('empty-test', [])
    expect(count).toBe(0)
  })

  it('captureCommits routes multiple commits', async () => {
    await engine.seed('commits-test')
    await engine.nodeUpdate('commits-test', 'work-1', 'active', 'Work')
    await engine.nodeUpdate('commits-test', 'ref-1', 'active', 'Ref',
      'reference', 'src/app.ts')
    await engine.edgeAdd('commits-test', 'ref-1', 'work-1')

    const count = await engine.captureCommits('commits-test', [
      { hash: 'aaa', message: 'first commit', files: ['src/app.ts'] },
      { hash: 'bbb', message: 'second commit', files: ['src/app.ts'] },
    ])
    expect(count).toBe(2)

    const deltas = await db.getDeltas('commits-test')
    const mutations = deltas.filter(d => d.type === 'mutation' && d.nodeId === 'work-1')
    expect(mutations).toHaveLength(2)
    expect(mutations.some(m => m.content.includes('aaa'))).toBe(true)
    expect(mutations.some(m => m.content.includes('bbb'))).toBe(true)
  })
})
