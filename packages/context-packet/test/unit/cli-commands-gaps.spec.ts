import { describe, it, expect, beforeEach, vi } from 'vitest'
import { runCommand } from '../../src/cli/commands'
import { PacketEngine } from '../../src/PacketEngine'
import { InMemoryPacketDatabase } from '../../src/storage/InMemoryPacketDatabase'
import { createMockFs } from './helpers'
import type { FileService } from '../../src/types'

/**
 * Behavior-locking tests for CLI command handlers that previously lacked coverage:
 * - handleSlice
 * - handleCompile (status, verify, aiccl)
 * - handleCapture
 * - vector criterion add/update via CLI
 */
describe('CLI: slice command', () => {
  let db: InMemoryPacketDatabase
  let fs: FileService
  let engine: PacketEngine
  let output: string[]

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    fs = createMockFs()
    engine = new PacketEngine(db, '.context', fs)
    output = []
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      output.push(args.map(String).join(' '))
    })
  })

  it('slices packet for specified nodes', async () => {
    await engine.seed('slice-test')
    await engine.nodeUpdate('slice-test', 'work-a', 'active', 'Work A')
    await engine.nodeUpdate('slice-test', 'work-b', 'active', 'Work B')

    await runCommand(engine, db, ['slice', '--nodes', 'work-a'])
    expect(output.length).toBeGreaterThan(0)
    // Output should contain markdown for the sliced node
    expect(output.join('\n')).toContain('work-a')
  })

  it('throws when --nodes not provided', async () => {
    await engine.seed('slice-err')
    await expect(
      runCommand(engine, db, ['slice'])
    ).rejects.toThrow('slice requires --nodes')
  })

  it('treats empty --nodes value as boolean flag (no throw)', async () => {
    // When passed ['slice', '--nodes', ''], filter(Boolean) strips the empty string
    // before handleSlice sees it, so --nodes becomes a boolean flag with value 'true'.
    // handleSlice then tries to slice for node id 'true' — which succeeds with empty output.
    await engine.seed('slice-empty')
    // Does NOT throw — this documents the actual behavior
    await runCommand(engine, db, ['slice', '--nodes', ''])
  })
})

describe('CLI: compile command', () => {
  let db: InMemoryPacketDatabase
  let fs: FileService
  let engine: PacketEngine
  let output: string[]

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    fs = createMockFs()
    engine = new PacketEngine(db, '.context', fs)
    output = []
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      output.push(args.map(String).join(' '))
    })
  })

  it('compile status outputs JSON with coverage metrics', async () => {
    await engine.seed('compile-status', {
      problemVector: { current: 'X', target: 'Y', approach: 'Z' },
    })
    await engine.nodeUpdate('compile-status', 'step-1', 'active', 'A step')

    await runCommand(engine, db, ['compile', 'status'])
    const json = JSON.parse(output.join(''))
    expect(json).toHaveProperty('vectors')
    expect(json).toHaveProperty('nodes')
    expect(json).toHaveProperty('criteria')
    expect(json).toHaveProperty('coverage')
    expect(json.nodes.total).toBeGreaterThan(0)
  })

  it('compile verify outputs human-readable markdown', async () => {
    await engine.seed('compile-verify', {
      problemVector: { current: 'X', target: 'Y', approach: 'Z' },
    })

    await runCommand(engine, db, ['compile', 'verify'])
    const text = output.join('\n')
    expect(text).toContain('## Compilation Summary')
    expect(text).toContain('**Vectors:**')
    expect(text).toContain('### Solved Criteria')
    expect(text).toContain('### Problem Facts')
    expect(text).toContain('### Proof Steps')
    expect(text).toContain('### Coverage:')
  })

  it('compile aiccl throws when packet not readable from filesystem', async () => {
    // compileToAiccl uses real filesystem (defaultReader) when called via CLI.
    // The test engine writes to mock fs, so compileToAiccl can't read the packet.
    // This tests the error path. The successful path is tested in cli-context.spec.ts
    // where compileToAiccl is called directly with a mock reader.
    await engine.seed('compile-aiccl', {
      problemVector: { current: 'X', target: 'Y', approach: 'Z' },
    })

    await expect(
      runCommand(engine, db, ['compile', 'aiccl'])
    ).rejects.toThrow('Failed to compile packet')
  })

  it('compile throws for unknown subcommand', async () => {
    await engine.seed('compile-unknown')
    await expect(
      runCommand(engine, db, ['compile', 'bogus'])
    ).rejects.toThrow('Unknown compile subcommand: bogus')
  })

  it('compile throws when no subcommand given', async () => {
    await engine.seed('compile-none')
    await expect(
      runCommand(engine, db, ['compile'])
    ).rejects.toThrow('compile requires a subcommand')
  })
})

describe('CLI: capture command', () => {
  let db: InMemoryPacketDatabase
  let fs: FileService
  let engine: PacketEngine
  let output: string[]

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    fs = createMockFs()
    engine = new PacketEngine(db, '.context', fs)
    output = []
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      output.push(args.map(String).join(' '))
    })
  })

  it('routes file changes to work nodes via reference edges', async () => {
    await engine.seed('capture-test')
    await engine.nodeUpdate('capture-test', 'work-1', 'active', 'Work')
    await engine.nodeUpdate('capture-test', 'ref-1', 'active', 'Ref',
      undefined, 'reference', 'src/auth.ts')
    await engine.edgeAdd('capture-test', 'ref-1', 'work-1')

    await runCommand(engine, db, ['capture', '--files', 'src/auth.ts'])
    const json = JSON.parse(output.join(''))
    expect(json.status).toBe('captured')
    expect(json.filesRouted).toBe(1)
  })

  it('capture with commit info records evidence', async () => {
    await engine.seed('capture-commit')
    await engine.nodeUpdate('capture-commit', 'work-1', 'active', 'Work')
    await engine.nodeUpdate('capture-commit', 'ref-1', 'active', 'Ref',
      undefined, 'reference', 'src/app.ts')
    await engine.edgeAdd('capture-commit', 'ref-1', 'work-1')

    await runCommand(engine, db, [
      'capture', '--files', 'src/app.ts',
      '--commit', 'abc123', '--message', 'fix: something',
    ])
    const json = JSON.parse(output.join(''))
    expect(json.status).toBe('captured')
    expect(json.filesRouted).toBe(1)

    // Verify mutation delta was recorded with commit info
    const deltas = await db.getDeltas('capture-commit')
    const mutation = deltas.find(d => d.type === 'mutation' && d.content.includes('abc123'))
    expect(mutation).toBeDefined()
  })

  it('capture throws when --files not provided', async () => {
    await engine.seed('capture-err')
    await expect(
      runCommand(engine, db, ['capture'])
    ).rejects.toThrow('capture requires --files')
  })

  it('capture with no matching files routes 0', async () => {
    await engine.seed('capture-none')
    await engine.nodeUpdate('capture-none', 'work-1', 'active', 'Work')

    await runCommand(engine, db, ['capture', '--files', 'unrelated.ts'])
    const json = JSON.parse(output.join(''))
    expect(json.filesRouted).toBe(0)
  })
})

describe('CLI: vector criterion commands', () => {
  let db: InMemoryPacketDatabase
  let fs: FileService
  let engine: PacketEngine
  let output: string[]

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    fs = createMockFs()
    engine = new PacketEngine(db, '.context', fs)
    output = []
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      output.push(args.map(String).join(' '))
    })
  })

  it('vector criterion add via CLI adds solved criterion', async () => {
    await engine.seed('vec-crit', {
      problemVector: { current: 'broken', target: 'fixed', approach: 'debug' },
    })

    await runCommand(engine, db, [
      'vector', 'criterion', 'add', 'primary',
      '--text', 'Auth tokens refresh automatically',
    ])
    const json = JSON.parse(output.join(''))
    expect(json.status).toBe('added')

    const content = await fs.read('.context/packets/active/vec-crit.md')
    expect(content).toContain('Auth tokens refresh automatically')
  })

  it('vector criterion add with --type fact adds problem fact', async () => {
    await engine.seed('vec-fact', {
      problemVector: { current: 'broken', target: 'fixed', approach: 'debug' },
    })

    await runCommand(engine, db, [
      'vector', 'criterion', 'add', 'primary',
      '--text', 'Sessions expire after 15 min',
      '--type', 'fact',
    ])
    const json = JSON.parse(output.join(''))
    expect(json.status).toBe('added')
  })

  it('vector criterion update via CLI changes mark', async () => {
    await engine.seed('vec-update', {
      problemVector: { current: 'broken', target: 'fixed', approach: 'debug' },
    })
    await engine.vectorCriterionAdd('vec-update', 'primary', 'Test criterion')

    await runCommand(engine, db, [
      'vector', 'criterion', 'update', 'primary', '0',
      '--mark', 'proven',
    ])
    const json = JSON.parse(output.join(''))
    expect(json.status).toBe('updated')
  })
})
