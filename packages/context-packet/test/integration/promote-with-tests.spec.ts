import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PacketEngine } from '../../src/PacketEngine'
import { InMemoryPacketDatabase } from '../../src/storage/InMemoryPacketDatabase'
import { createMockFs } from '../unit/helpers'

// Mock the testRunner module — we can't actually run vitest from within vitest.
// The mock replaces execSync-based test execution with controlled results.
vi.mock('../../src/testRunner.js', () => ({
  runTests: vi.fn(),
}))

import { runTests } from '../../src/testRunner.js'
import { runCommand } from '../../src/cli/commands.js'

const mockRunTests = vi.mocked(runTests)

function captureOutput(): { logs: string[]; restore: () => void } {
  const logs: string[] = []
  const originalLog = console.log
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '))
  }
  return { logs, restore: () => { console.log = originalLog } }
}

/**
 * Integration test: node promote auto-discovers connected test nodes via edges,
 * runs them, and records pass/fail deltas on the work node.
 *
 * Real: PacketEngine, InMemoryPacketDatabase, in-memory FileService, CLI command dispatch
 * Mocked: testRunner.runTests (can't invoke vitest recursively)
 */
describe('promote with auto-test-run (integration)', () => {
  let db: InMemoryPacketDatabase
  let fs: ReturnType<typeof createMockFs>
  let engine: PacketEngine

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    fs = createMockFs()
    engine = new PacketEngine(db, '.context', fs)
    mockRunTests.mockReset()
  })

  it('promote discovers connected test nodes and runs them', async () => {
    // Setup: seed → work node → test node → edge
    await engine.seed('promote-test')
    await db.setActivePacket('promote-test')
    await engine.nodeUpdate('promote-test', 'auth-work', 'active', 'Fix auth flow')
    await engine.nodeUpdate('promote-test', 'test-auth', 'active', 'Auth tests',
      undefined, 'test', 'tests/auth.spec.ts')
    await engine.edgeAdd('promote-test', 'test-auth', 'auth-work')

    // Configure mock: tests pass
    mockRunTests.mockReturnValue({
      results: [{ path: 'tests/auth.spec.ts', passed: 5, failed: 0, total: 5, summary: '5 passed', exitCode: 0 }],
      allPassed: true,
      totalPassed: 5,
      totalFailed: 0,
      summary: '5 tests passed across 1 files',
    })

    // Run promote via CLI
    const output = captureOutput()
    try {
      await runCommand(engine, db, ['node', 'promote', 'auth-work'])
    } finally {
      output.restore()
    }

    // Verify runTests was called with the test path
    expect(mockRunTests).toHaveBeenCalledWith(['tests/auth.spec.ts'], expect.any(String))

    // Verify CLI output includes test results
    const json = JSON.parse(output.logs[0])
    expect(json.status).toBe('promoted')
    expect(json.tests.allPassed).toBe(true)
    expect(json.tests.summary).toContain('5 tests passed')

    // Verify success delta was recorded on the work node
    const deltas = await db.getDeltas('promote-test')
    const testDelta = deltas.find(d => d.nodeId === 'auth-work' && d.content.includes('tests/auth.spec.ts'))
    expect(testDelta).toBeDefined()
    expect(testDelta!.type).toBe('success')
  })

  it('promote records failure delta when tests fail', async () => {
    await engine.seed('fail-test')
    await db.setActivePacket('fail-test')
    await engine.nodeUpdate('fail-test', 'work-1', 'active', 'Some work')
    await engine.nodeUpdate('fail-test', 'test-1', 'active', 'Tests',
      undefined, 'test', 'tests/thing.spec.ts')
    await engine.edgeAdd('fail-test', 'test-1', 'work-1')

    // Configure mock: tests fail
    mockRunTests.mockReturnValue({
      results: [{ path: 'tests/thing.spec.ts', passed: 2, failed: 3, total: 5, summary: '2 passed, 3 failed', exitCode: 1, firstFailure: 'Expected X' }],
      allPassed: false,
      totalPassed: 2,
      totalFailed: 3,
      summary: '2 passed, 3 failed across 1 files',
    })

    const output = captureOutput()
    try {
      await runCommand(engine, db, ['node', 'promote', 'work-1'])
    } finally {
      output.restore()
    }

    // Still promotes (tests are advisory, not blocking)
    const json = JSON.parse(output.logs[0])
    expect(json.status).toBe('promoted')
    expect(json.tests.allPassed).toBe(false)

    // Verify failure delta
    const deltas = await db.getDeltas('fail-test')
    const failDelta = deltas.find(d => d.nodeId === 'work-1' && d.type === 'failure')
    expect(failDelta).toBeDefined()
    expect(failDelta!.content).toContain('3 failed')
  })

  it('promote with --skip-tests skips test execution', async () => {
    await engine.seed('skip-test')
    await db.setActivePacket('skip-test')
    await engine.nodeUpdate('skip-test', 'work-1', 'active', 'Work')
    await engine.nodeUpdate('skip-test', 'test-1', 'active', 'Tests',
      undefined, 'test', 'tests/x.spec.ts')
    await engine.edgeAdd('skip-test', 'test-1', 'work-1')

    const output = captureOutput()
    try {
      await runCommand(engine, db, ['node', 'promote', 'work-1', '--skip-tests'])
    } finally {
      output.restore()
    }

    // runTests should NOT have been called
    expect(mockRunTests).not.toHaveBeenCalled()

    // Node still promoted
    const json = JSON.parse(output.logs[0])
    expect(json.status).toBe('promoted')
    expect(json.tests).toBeUndefined()
  })

  it('promote with no connected test nodes skips test execution', async () => {
    await engine.seed('no-tests')
    await db.setActivePacket('no-tests')
    await engine.nodeUpdate('no-tests', 'work-1', 'active', 'Work with no tests')

    const output = captureOutput()
    try {
      await runCommand(engine, db, ['node', 'promote', 'work-1'])
    } finally {
      output.restore()
    }

    expect(mockRunTests).not.toHaveBeenCalled()
    const json = JSON.parse(output.logs[0])
    expect(json.status).toBe('promoted')
    expect(json.tests).toBeUndefined()
  })

  it('promote with connected ref nodes (not test) does not run tests', async () => {
    await engine.seed('ref-only')
    await db.setActivePacket('ref-only')
    await engine.nodeUpdate('ref-only', 'work-1', 'active', 'Work')
    await engine.nodeUpdate('ref-only', 'ref-1', 'active', 'A ref',
      undefined, 'reference', '/docs/foo.md')
    await engine.edgeAdd('ref-only', 'ref-1', 'work-1')

    const output = captureOutput()
    try {
      await runCommand(engine, db, ['node', 'promote', 'work-1'])
    } finally {
      output.restore()
    }

    // Only test-type nodes trigger test runs
    expect(mockRunTests).not.toHaveBeenCalled()
  })

  it('promote runs multiple test nodes connected to same work node', async () => {
    await engine.seed('multi-test')
    await db.setActivePacket('multi-test')
    await engine.nodeUpdate('multi-test', 'work-1', 'active', 'Work')
    await engine.nodeUpdate('multi-test', 'test-a', 'active', 'Test A',
      undefined, 'test', 'tests/a.spec.ts')
    await engine.nodeUpdate('multi-test', 'test-b', 'active', 'Test B',
      undefined, 'test', 'tests/b.spec.ts')
    await engine.edgeAdd('multi-test', 'test-a', 'work-1')
    await engine.edgeAdd('multi-test', 'test-b', 'work-1')

    mockRunTests.mockReturnValue({
      results: [
        { path: 'tests/a.spec.ts', passed: 3, failed: 0, total: 3, summary: '3 passed', exitCode: 0 },
        { path: 'tests/b.spec.ts', passed: 2, failed: 0, total: 2, summary: '2 passed', exitCode: 0 },
      ],
      allPassed: true,
      totalPassed: 5,
      totalFailed: 0,
      summary: '5 tests passed across 2 files',
    })

    const output = captureOutput()
    try {
      await runCommand(engine, db, ['node', 'promote', 'work-1'])
    } finally {
      output.restore()
    }

    // Both test paths passed to runTests
    expect(mockRunTests).toHaveBeenCalledWith(
      expect.arrayContaining(['tests/a.spec.ts', 'tests/b.spec.ts']),
      expect.any(String),
    )

    // Two success deltas recorded (one per test result), plus the promotion delta
    const deltas = await db.getDeltas('multi-test')
    const testDeltas = deltas.filter(d =>
      d.nodeId === 'work-1' && d.type === 'success' && d.content.startsWith('Test tests/'))
    expect(testDeltas).toHaveLength(2)
  })
})
