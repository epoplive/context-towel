import { describe, it, expect, beforeEach } from 'vitest'
import { buildContextOutput, readActiveMarker, compileToAiccl } from '../../src/cli/context'
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

  it('outputs edge graph for connected nodes', async () => {
    await engine.seed('edge-packet')
    await engine.nodeUpdate('edge-packet', 'work-1', 'active', 'Auth work')
    await engine.nodeUpdate('edge-packet', 'ref-docs', 'active', 'Auth docs',
      undefined, 'reference', '/docs/auth.md')
    await engine.edgeAdd('edge-packet', 'ref-docs', 'work-1')

    const output = await buildContextOutput('/test/.context', 'edge-packet', readerFromMockFs())
    expect(output).toContain('<edges>')
    expect(output).toContain('ref-docs → work-1')
    expect(output).toContain('</edges>')
  })

  it('outputs reference pointers grouped by work node', async () => {
    await engine.seed('ref-packet')
    await engine.nodeUpdate('ref-packet', 'work-1', 'active', 'Auth work')
    await engine.nodeUpdate('ref-packet', 'ref-1', 'active', 'Docs',
      undefined, 'reference', '/docs/auth.md')
    await engine.nodeUpdate('ref-packet', 'ref-2', 'active', 'More docs',
      undefined, 'reference', '/docs/tokens.md')
    await engine.edgeAdd('ref-packet', 'ref-1', 'work-1')
    await engine.edgeAdd('ref-packet', 'ref-2', 'work-1')

    const output = await buildContextOutput('/test/.context', 'ref-packet', readerFromMockFs())
    expect(output).toContain('<references>')
    expect(output).toContain('work-1: /docs/auth.md, /docs/tokens.md')
    expect(output).toContain('</references>')
  })

  it('outputs test status per work node', async () => {
    await engine.seed('test-status-packet')
    await engine.nodeUpdate('test-status-packet', 'work-1', 'active', 'Auth work')
    // test-1: promoted → state = success
    await engine.nodeUpdate('test-status-packet', 'test-1', 'active', 'Auth tests',
      undefined, 'test', 'tests/auth.spec.ts')
    await engine.nodePromote('test-status-packet', 'test-1')
    // test-2: failed → state = failed
    await engine.nodeUpdate('test-status-packet', 'test-2', 'active', 'Token tests',
      undefined, 'test', 'tests/token.spec.ts')
    await engine.nodeFail('test-status-packet', 'test-2', 'ran tests', 'timeout on retry logic')
    await engine.edgeAdd('test-status-packet', 'test-1', 'work-1')
    await engine.edgeAdd('test-status-packet', 'test-2', 'work-1')

    const output = await buildContextOutput('/test/.context', 'test-status-packet', readerFromMockFs())
    expect(output).toContain('<test-status>')
    expect(output).toContain('auth.spec.ts [pass]')
    expect(output).toContain('token.spec.ts [fail]')
    expect(output).toContain('</test-status>')
  })

  it('includes resume instructions for context clear', async () => {
    await engine.seed('resume-packet')
    const output = await buildContextOutput('/test/.context', 'resume-packet', readerFromMockFs())
    expect(output).toContain('RESUMING FROM CONTEXT CLEAR')
    expect(output).toContain('Continue from the active nodes')
  })

  it('focused output includes connected nodes at summary level', async () => {
    await engine.seed('focus-packet')
    await engine.nodeUpdate('focus-packet', 'work-1', 'active', 'Main work')
    await engine.nodeUpdate('focus-packet', 'ref-1', 'active', 'A reference',
      undefined, 'reference', '/docs/ref.md')
    await engine.edgeAdd('focus-packet', 'ref-1', 'work-1')

    const output = await buildContextOutput('/test/.context', 'focus-packet', readerFromMockFs(), { focusNodes: ['work-1'] })
    expect(output).toContain('work-1 [active]')
    expect(output).toContain('ref-1 [active] (reference): (connected)')
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

// ============================================================================
// Active-Node-Aware Injection Tests
// ============================================================================

describe('active-node-aware injection', () => {
  let db: InMemoryPacketDatabase
  let mockFs: FileService
  let engine: PacketEngine

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    mockFs = createMockFs()
    engine = new PacketEngine(db, '/test/.context', mockFs)
  })

  function readerFromMockFs(): (path: string) => Promise<string> {
    return (path: string) => mockFs.read(path)
  }

  it('marks active node with * prefix and includes full body', async () => {
    await engine.seed('aware-test')
    await engine.nodeUpdate('aware-test', 'auth-work', 'active', 'Investigating auth middleware token refresh logic')

    const output = await buildContextOutput('/test/.context', 'aware-test', readerFromMockFs(), {
      activeNode: 'auth-work',
    })
    expect(output).toContain('* auth-work [active]')
    expect(output).toContain('Investigating auth middleware')
  })

  it('shows edge-connected neighbors at medium detail', async () => {
    await engine.seed('neighbor-test')
    await engine.nodeUpdate('neighbor-test', 'work-main', 'active', 'Main auth work')
    await engine.nodeUpdate('neighbor-test', 'ref-docs', 'active', 'Auth documentation',
      undefined, 'reference', '/docs/auth.md')
    await engine.nodeUpdate('neighbor-test', 'test-auth', 'active', 'Auth integration tests',
      undefined, 'test', 'tests/auth.spec.ts')
    await engine.edgeAdd('neighbor-test', 'ref-docs', 'work-main')
    await engine.edgeAdd('neighbor-test', 'test-auth', 'work-main')

    const output = await buildContextOutput('/test/.context', 'neighbor-test', readerFromMockFs(), {
      activeNode: 'work-main',
    })
    // Active node gets * prefix
    expect(output).toContain('* work-main [active]')
    // Neighbors get type info (medium detail)
    expect(output).toContain('ref-docs [active] (reference: /docs/auth.md)')
    expect(output).toContain('test-auth [active] (test: tests/auth.spec.ts)')
  })

  it('shows unconnected nodes at minimal detail (id + state only)', async () => {
    await engine.seed('minimal-test')
    await engine.nodeUpdate('minimal-test', 'active-work', 'active', 'Working on this')
    await engine.nodeUpdate('minimal-test', 'other-work', 'active', 'Unrelated work that should be minimal')

    const output = await buildContextOutput('/test/.context', 'minimal-test', readerFromMockFs(), {
      activeNode: 'active-work',
    })
    expect(output).toContain('* active-work [active]')
    // Unconnected node: just id + state, no body text
    const nodeLines = output!.split('\n').filter(l => l.includes('other-work'))
    expect(nodeLines.length).toBeGreaterThan(0)
    expect(nodeLines[0]).toMatch(/other-work \[active\]/)
    // Should NOT contain the full body of the unconnected node
    expect(nodeLines[0]).not.toContain('Unrelated work')
  })

  it('condenses resolved nodes into a resolved: line', async () => {
    await engine.seed('resolved-test')
    await engine.nodeUpdate('resolved-test', 'work-done', 'active', 'This is done')
    await engine.nodePromote('resolved-test', 'work-done')
    await engine.nodeUpdate('resolved-test', 'work-active', 'active', 'Still working on this')

    const output = await buildContextOutput('/test/.context', 'resolved-test', readerFromMockFs(), {
      activeNode: 'work-active',
    })
    expect(output).toContain('* work-active [active]')
    expect(output).toContain('resolved: work-done')
  })

  it('handles bidirectional edge discovery for neighbors', async () => {
    await engine.seed('bidir-test')
    await engine.nodeUpdate('bidir-test', 'work-a', 'active', 'Work A')
    await engine.nodeUpdate('bidir-test', 'work-b', 'active', 'Work B')
    // Edge from B→A, so A should see B as neighbor when A is active
    await engine.edgeAdd('bidir-test', 'work-b', 'work-a')

    const output = await buildContextOutput('/test/.context', 'bidir-test', readerFromMockFs(), {
      activeNode: 'work-a',
    })
    expect(output).toContain('* work-a [active]')
    // work-b connected to work-a via edge, should show as neighbor (not minimal)
    const bLine = output!.split('\n').find(l => l.includes('work-b'))
    expect(bLine).toBeDefined()
    expect(bLine).toContain('work-b [active]')
    expect(bLine).toContain('Work B')
  })
})

// ============================================================================
// AICCL Compilation Tests
// ============================================================================

describe('compileToAiccl', () => {
  let db: InMemoryPacketDatabase
  let mockFs: FileService
  let engine: PacketEngine

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    mockFs = createMockFs()
    engine = new PacketEngine(db, '/test/.context', mockFs)
  })

  function readerFromMockFs(): (path: string) => Promise<string> {
    return (path: string) => mockFs.read(path)
  }

  it('returns null when packet file does not exist', async () => {
    const result = await compileToAiccl('/nonexistent/.context', 'nope',
      async () => { throw new Error('ENOENT') })
    expect(result).toBeNull()
  })

  it('compiles a packet with vectors and nodes', async () => {
    await engine.seed('compile-test', {
      problemVector: {
        current: 'broken auth',
        target: 'working JWT',
        approach: 'custom middleware',
      },
    })
    await engine.nodeUpdate('compile-test', 'auth-work', 'active', 'Fix auth tokens')

    const result = await compileToAiccl('/test/.context', 'compile-test', readerFromMockFs())
    expect(result).not.toBeNull()
    expect(result!.aiccl).toContain('<context-packet name="compile-test"')
    expect(result!.aiccl).toContain('broken auth')
    expect(result!.aiccl).toContain('auth-work')
    expect(result!.aiccl).toContain('AICCL compilation')
    expect(result!.tokenEstimate).toBeGreaterThan(0)
  })

  it('includes token reduction percentage in compilation comment', async () => {
    await engine.seed('token-test', {
      problemVector: {
        current: 'large packet with detailed description of the current state',
        target: 'compressed output that preserves essential information',
        approach: 'AICCL compilation with active-node awareness and progressive detail',
      },
    })
    // Add several nodes with substantial body text to make the packet big
    for (let i = 0; i < 10; i++) {
      await engine.nodeUpdate('token-test', `work-${i}`, 'active',
        `Working on thing ${i}. This is a detailed description of the work being done. It includes multiple sentences to simulate real packet content with meaningful body text that would appear in production use cases.`)
    }

    const result = await compileToAiccl('/test/.context', 'token-test', readerFromMockFs())
    expect(result).not.toBeNull()
    // The AICCL comment should include a reduction percentage (may be negative for small packets)
    expect(result!.aiccl).toMatch(/AICCL compilation: \d+ tokens/)
    expect(result!.aiccl).toMatch(/% reduction from \d+ human tokens/)
    expect(result!.tokenEstimate).toBeGreaterThan(0)
  })

  it('compiles with active-node awareness when specified', async () => {
    await engine.seed('active-compile')
    await engine.nodeUpdate('active-compile', 'focus-node', 'active', 'This is the main work area')
    await engine.nodeUpdate('active-compile', 'other-node', 'active', 'Background stuff')

    const result = await compileToAiccl('/test/.context', 'active-compile', readerFromMockFs(), 'focus-node')
    expect(result).not.toBeNull()
    // Active node should have * prefix in compiled output
    expect(result!.aiccl).toContain('* focus-node [active]')
  })

  it('compiles with edge and reference info', async () => {
    await engine.seed('edge-compile')
    await engine.nodeUpdate('edge-compile', 'main-work', 'active', 'Core implementation')
    await engine.nodeUpdate('edge-compile', 'ref-source', 'active', 'Source file',
      undefined, 'reference', 'src/service.ts')
    await engine.edgeAdd('edge-compile', 'ref-source', 'main-work')

    const result = await compileToAiccl('/test/.context', 'edge-compile', readerFromMockFs())
    expect(result).not.toBeNull()
    expect(result!.aiccl).toContain('<edges>')
    expect(result!.aiccl).toContain('ref-source → main-work')
    expect(result!.aiccl).toContain('<references>')
    expect(result!.aiccl).toContain('main-work: src/service.ts')
  })

  it('includes resolved nodes in condensed format', async () => {
    await engine.seed('resolved-compile')
    await engine.nodeUpdate('resolved-compile', 'done-work', 'active', 'Finished task')
    await engine.nodePromote('resolved-compile', 'done-work')
    await engine.nodeUpdate('resolved-compile', 'active-work', 'active', 'Still going')

    const result = await compileToAiccl('/test/.context', 'resolved-compile', readerFromMockFs())
    expect(result).not.toBeNull()
    expect(result!.aiccl).toContain('resolved: done-work')
    expect(result!.aiccl).toContain('active-work [active]')
  })
})
