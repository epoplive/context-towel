import { describe, it, expect, beforeEach } from 'vitest'
import { buildContextOutput, readActiveMarker } from '../../src/cli/context'
import { InMemoryPacketDatabase } from '../../src/storage/InMemoryPacketDatabase'
import { PacketEngine } from '../../src/PacketEngine'
import { createMockFs } from './helpers'
import type { FileService } from '../../src/types'

// ============================================================================
// Context Command Tests
// ============================================================================

describe('readActiveMarker', () => {
  it('returns null when no marker file exists', async () => {
    const reader = async () => { throw new Error('ENOENT') }
    const result = await readActiveMarker('/nonexistent/.context', reader)
    expect(result).toBeNull()
  })

  it('returns packet name from marker file', async () => {
    const reader = async () => 'my-packet'
    const result = await readActiveMarker('/project/.context', reader)
    expect(result).toBe('my-packet')
  })

  it('trims whitespace from marker content', async () => {
    const reader = async () => '  my-packet  \n'
    const result = await readActiveMarker('/project/.context', reader)
    expect(result).toBe('my-packet')
  })

  it('returns null for empty marker file', async () => {
    const reader = async () => '  \n'
    const result = await readActiveMarker('/project/.context', reader)
    expect(result).toBeNull()
  })
})

describe('buildContextOutput', () => {
  let db: InMemoryPacketDatabase
  let mockFs: FileService
  let engine: PacketEngine

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    mockFs = createMockFs()
    engine = new PacketEngine(db, '/test/.context', mockFs)
  })

  // Helper: create a reader that reads from our mock fs
  function readerFromMockFs(): (path: string) => Promise<string> {
    return (path: string) => mockFs.read(path)
  }

  it('returns null when packet file does not exist', async () => {
    const reader = async () => { throw new Error('ENOENT') }
    const result = await buildContextOutput('/test/.context', 'nonexistent', reader)
    expect(result).toBeNull()
  })

  it('outputs XML format with vectors', async () => {
    await engine.seed('test-packet', {
      problemVector: {
        current: 'broken auth',
        target: 'working JWT',
        approach: 'custom middleware',
      },
    })

    const output = await buildContextOutput('/test/.context', 'test-packet', readerFromMockFs())
    expect(output).not.toBeNull()
    expect(output).toContain('<context-packet name="test-packet"')
    expect(output).toContain('<vectors>')
    expect(output).toContain('primary [active]')
    expect(output).toContain('broken auth')
    expect(output).toContain('working JWT')
    expect(output).toContain('</context-packet>')
  })

  it('outputs XML format with nodes', async () => {
    await engine.seed('test-packet')
    await engine.nodeUpdate('test-packet', 'auth-check', 'active', 'validating JWT tokens')

    const output = await buildContextOutput('/test/.context', 'test-packet', readerFromMockFs())
    expect(output).toContain('<nodes>')
    expect(output).toContain('auth-check [active]')
    expect(output).toContain('</nodes>')
  })

  it('outputs XML format with recent deltas', async () => {
    await engine.seed('test-packet')
    await engine.deltaAppend('test-packet', 'auth', 'discovery', 'found the bug in middleware')

    const output = await buildContextOutput('/test/.context', 'test-packet', readerFromMockFs())
    expect(output).toContain('<recent')
    expect(output).toContain('[discovery]')
    expect(output).toContain('found the bug in middleware')
    expect(output).toContain('</recent>')
  })

  it('limits recent deltas to 3', async () => {
    await engine.seed('test-packet')
    for (let i = 0; i < 5; i++) {
      await engine.deltaAppend('test-packet', `node-${i}`, 'discovery', `unique-delta-${i}`)
    }

    const output = await buildContextOutput('/test/.context', 'test-packet', readerFromMockFs())
    expect(output).toContain('count="3"')
    // Should contain exactly 3 delta entries in <recent> (the first 3 from the
    // most-recent-first delta log, which may vary due to timestamp resolution)
    const recentMatch = output!.match(/<recent[^>]*>([\s\S]*?)<\/recent>/)
    expect(recentMatch).not.toBeNull()
    const recentLines = recentMatch![1].trim().split('\n').filter(l => l.trim())
    expect(recentLines).toHaveLength(3)
  })

  it('handles packet with no vectors or nodes gracefully', async () => {
    await engine.seed('empty-packet')

    const output = await buildContextOutput('/test/.context', 'empty-packet', readerFromMockFs())
    expect(output).toContain('<context-packet name="empty-packet"')
    // Should not have vectors or nodes sections (they're empty)
    expect(output).not.toContain('<vectors>')
    expect(output).not.toContain('<nodes>')
    expect(output).toContain('</context-packet>')
  })
})

describe('active marker lifecycle', () => {
  let db: InMemoryPacketDatabase
  let mockFs: FileService
  let engine: PacketEngine

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    mockFs = createMockFs()
    engine = new PacketEngine(db, '/test/.context', mockFs)
  })

  it('seed writes .context/active marker', async () => {
    await engine.seed('my-packet')

    const markerContent = await mockFs.read('/test/.context/active')
    expect(markerContent).toBe('my-packet')
  })

  it('archive removes .context/active marker when archiving active packet', async () => {
    await engine.seed('my-packet')
    expect(await mockFs.exists('/test/.context/active')).toBe(true)

    await engine.archive('my-packet')
    expect(await mockFs.exists('/test/.context/active')).toBe(false)
  })

  it('seed overwrites marker when creating second packet', async () => {
    await engine.seed('first')
    expect(await mockFs.read('/test/.context/active')).toBe('first')

    await engine.seed('second')
    expect(await mockFs.read('/test/.context/active')).toBe('second')
  })

  it('syncActiveMarker(null) removes marker', async () => {
    await engine.seed('my-packet')
    expect(await mockFs.exists('/test/.context/active')).toBe(true)

    await engine.syncActiveMarker(null)
    expect(await mockFs.exists('/test/.context/active')).toBe(false)
  })

  it('syncActiveMarker(null) is idempotent when no marker exists', async () => {
    await engine.syncActiveMarker(null)
    expect(await mockFs.exists('/test/.context/active')).toBe(false)
  })

  it('marker stays in sync with DB active state', async () => {
    await engine.seed('packet-a')
    expect(await db.getActivePacket()).toBe('packet-a')
    expect(await mockFs.read('/test/.context/active')).toBe('packet-a')

    await engine.seed('packet-b')
    expect(await db.getActivePacket()).toBe('packet-b')
    expect(await mockFs.read('/test/.context/active')).toBe('packet-b')

    await engine.archive('packet-b')
    expect(await db.getActivePacket()).toBeNull()
    expect(await mockFs.exists('/test/.context/active')).toBe(false)
  })
})
