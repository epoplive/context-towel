import { describe, it, expect, beforeEach } from 'vitest'
import { PacketEngine } from '../../src/PacketEngine'
import { InMemoryPacketDatabase } from '../../src/storage/InMemoryPacketDatabase'
import { createMockFs } from './helpers'
import type { FileService } from '../../src/types'

describe('vectorCriterionAdd', () => {
  let db: InMemoryPacketDatabase
  let fs: FileService
  let engine: PacketEngine

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    fs = createMockFs()
    engine = new PacketEngine(db, '.context', fs)
  })

  it('adds a solved criterion with pending mark by default', async () => {
    await engine.seed('crit-test', {
      problemVector: { current: 'broken', target: 'fixed', approach: 'debug' },
    })
    await engine.vectorCriterionAdd('crit-test', 'primary', 'Auth works')

    const content = await fs.read('.context/packets/active/crit-test/packet.md')
    expect(content).toContain('Auth works')
    expect(content).toContain('pending')
  })

  it('adds a fact criterion with established mark by default', async () => {
    await engine.seed('fact-test', {
      problemVector: { current: 'broken', target: 'fixed', approach: 'debug' },
    })
    await engine.vectorCriterionAdd('fact-test', 'primary', 'Sessions use cookies', 'fact')

    const content = await fs.read('.context/packets/active/fact-test/packet.md')
    expect(content).toContain('Sessions use cookies')
    expect(content).toContain('established')
  })

  it('adds with explicit mark', async () => {
    await engine.seed('mark-test', {
      problemVector: { current: 'X', target: 'Y', approach: 'Z' },
    })
    await engine.vectorCriterionAdd('mark-test', 'primary', 'Already proven thing', 'solved', 'proven')

    const content = await fs.read('.context/packets/active/mark-test/packet.md')
    expect(content).toContain('Already proven thing')
  })

  it('records mutation delta with JSON vector snapshot for criterion add', async () => {
    await engine.seed('delta-test', {
      problemVector: { current: 'X', target: 'Y', approach: 'Z' },
    })
    await engine.vectorCriterionAdd('delta-test', 'primary', 'New criterion')

    const deltas = await db.getDeltas('delta-test')
    const mutation = deltas.find(d =>
      d.type === 'mutation' && d.nodeId === 'vector:primary'
    )
    expect(mutation).toBeDefined()
    const parsed = JSON.parse(mutation!.content)
    expect(parsed.solvedCriteria).toHaveLength(1)
    expect(parsed.solvedCriteria[0].text).toBe('New criterion')
    expect(parsed.solvedCriteria[0].mark).toBe('pending')
  })

  it('throws when vector does not exist', async () => {
    await engine.seed('no-vec-test')
    await expect(
      engine.vectorCriterionAdd('no-vec-test', 'nonexistent', 'Test')
    ).rejects.toThrow('Vector "nonexistent" not found')
  })

  it('adds multiple criteria to same vector', async () => {
    await engine.seed('multi-test', {
      problemVector: { current: 'X', target: 'Y', approach: 'Z' },
    })
    await engine.vectorCriterionAdd('multi-test', 'primary', 'First criterion')
    await engine.vectorCriterionAdd('multi-test', 'primary', 'Second criterion')

    const content = await fs.read('.context/packets/active/multi-test/packet.md')
    expect(content).toContain('First criterion')
    expect(content).toContain('Second criterion')
  })

  it('adds fact with gap mark', async () => {
    await engine.seed('gap-test', {
      problemVector: { current: 'X', target: 'Y', approach: 'Z' },
    })
    await engine.vectorCriterionAdd('gap-test', 'primary', 'Unknown dependency', 'fact', 'gap')

    const content = await fs.read('.context/packets/active/gap-test/packet.md')
    expect(content).toContain('Unknown dependency')
    expect(content).toContain('gap')
  })
})

describe('vectorCriterionUpdate', () => {
  let db: InMemoryPacketDatabase
  let fs: FileService
  let engine: PacketEngine

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    fs = createMockFs()
    engine = new PacketEngine(db, '.context', fs)
  })

  it('criterionUpdate works after criterionAdd (criteria persisted in JSON deltas)', async () => {
    await engine.seed('update-test', {
      problemVector: { current: 'X', target: 'Y', approach: 'Z' },
    })
    await engine.vectorCriterionAdd('update-test', 'primary', 'Auth works')

    // criterionAdd now writes a full JSON snapshot delta, so update can find the criteria
    await engine.vectorCriterionUpdate('update-test', 'primary', 0, 'proven')

    const content = await fs.read('.context/packets/active/update-test/packet.md')
    expect(content).toContain('Auth works')
    expect(content).toContain('proven')
  })

  it('records mutation delta with full vector snapshot', async () => {
    await engine.seed('delta-update', {
      problemVector: { current: 'X', target: 'Y', approach: 'Z' },
    })
    await engine.vectorCriterionAdd('delta-update', 'primary', 'Test criterion')

    const deltas = await db.getDeltas('delta-update')
    const mutation = deltas.find(d =>
      d.type === 'mutation' && d.nodeId === 'vector:primary'
    )
    expect(mutation).toBeDefined()
    // Verify the delta is JSON with the full vector state including criteria
    const parsed = JSON.parse(mutation!.content)
    expect(parsed.solvedCriteria).toHaveLength(1)
    expect(parsed.solvedCriteria[0].text).toBe('Test criterion')
  })

  it('update records mutation delta with updated mark', async () => {
    await engine.seed('delta-upd2', {
      problemVector: { current: 'X', target: 'Y', approach: 'Z' },
    })
    await engine.vectorCriterionAdd('delta-upd2', 'primary', 'Test criterion')
    await engine.vectorCriterionUpdate('delta-upd2', 'primary', 0, 'proven')

    const deltas = await db.getDeltas('delta-upd2')
    // The last mutation should have proven mark
    const mutations = deltas.filter(d =>
      d.type === 'mutation' && d.nodeId === 'vector:primary'
    )
    const last = mutations[mutations.length - 1]
    const parsed = JSON.parse(last.content)
    expect(parsed.solvedCriteria[0].mark).toBe('proven')
  })

  it('throws for out-of-range index', async () => {
    await engine.seed('range-test', {
      problemVector: { current: 'X', target: 'Y', approach: 'Z' },
    })
    await engine.vectorCriterionAdd('range-test', 'primary', 'One')

    await expect(
      engine.vectorCriterionUpdate('range-test', 'primary', 5, 'proven')
    ).rejects.toThrow('out of range')
  })

  it('throws for negative index', async () => {
    await engine.seed('neg-test', {
      problemVector: { current: 'X', target: 'Y', approach: 'Z' },
    })
    await engine.vectorCriterionAdd('neg-test', 'primary', 'One')

    await expect(
      engine.vectorCriterionUpdate('neg-test', 'primary', -1, 'proven')
    ).rejects.toThrow('out of range')
  })

  it('throws when vector does not exist', async () => {
    await engine.seed('no-vec-update')
    await expect(
      engine.vectorCriterionUpdate('no-vec-update', 'nonexistent', 0, 'proven')
    ).rejects.toThrow('Vector "nonexistent" not found')
  })

  it('can update mark to failed', async () => {
    await engine.seed('fail-mark')

    await db.appendDelta('fail-mark', {
      nodeId: 'vector:primary',
      type: 'discovery',
      content: JSON.stringify({
        current: 'X', target: 'Y', approach: 'Z', state: 'active',
        solvedCriteria: [{ text: 'Flawed assumption', mark: 'pending' }],
      }),
    })
    await engine.materialize('fail-mark')

    await engine.vectorCriterionUpdate('fail-mark', 'primary', 0, 'failed')

    const content = await fs.read('.context/packets/active/fail-mark/packet.md')
    expect(content).toContain('failed')
  })

  it('can update fact mark from established to gap', async () => {
    await engine.seed('fact-update')

    await db.appendDelta('fact-update', {
      nodeId: 'vector:primary',
      type: 'discovery',
      content: JSON.stringify({
        current: 'X', target: 'Y', approach: 'Z', state: 'active',
        problemFacts: [{ text: 'A fact', mark: 'established' }],
      }),
    })
    await engine.materialize('fact-update')

    await engine.vectorCriterionUpdate('fact-update', 'primary', 0, 'gap', 'fact')

    const content = await fs.read('.context/packets/active/fact-update/packet.md')
    expect(content).toContain('gap')
  })
})
