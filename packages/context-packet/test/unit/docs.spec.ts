import { describe, it, expect, beforeEach } from 'vitest'
import { PacketEngine } from '../../src/PacketEngine'
import { InMemoryPacketDatabase } from '../../src/storage/InMemoryPacketDatabase'
import { createMockFs } from './helpers'
import { materializeDocs, generateRootIndex, generateSubsystemIndex } from '../../src/docs/materialize'
import { renderPatternAsHuman, renderSubsystemDocs } from '../../src/docs/render'
import type { FileService, PatternEntry } from '../../src/types'

// ── Helper ──────────────────────────────────────────────────────────────────

function makePattern(overrides: Partial<PatternEntry> & Pick<PatternEntry, 'subsystem' | 'content' | 'sourcePacket'>): PatternEntry {
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    confidence: 1,
    ...overrides,
  }
}

// ── materializeDocs ─────────────────────────────────────────────────────────

describe('materializeDocs', () => {
  let db: InMemoryPacketDatabase
  let fs: FileService

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    fs = createMockFs()
  })

  it('does nothing when no patterns exist', async () => {
    await materializeDocs(db, '.context', fs)

    // No files should have been written
    expect(await fs.exists('.context/docs')).toBe(false)
    expect(await fs.exists('.context/docs/index.md')).toBe(false)
  })

  it('creates root index and subsystem dir for a single subsystem', async () => {
    await db.writePattern({
      subsystem: 'auth',
      content: 'JWT middleware pattern',
      sourcePacket: 'packet-1',
    })

    await materializeDocs(db, '.context', fs)

    expect(await fs.exists('.context/docs')).toBe(true)
    expect(await fs.exists('.context/docs/index.md')).toBe(true)
    expect(await fs.exists('.context/docs/auth')).toBe(true)
    expect(await fs.exists('.context/docs/auth/index.md')).toBe(true)

    const rootContent = await fs.read('.context/docs/index.md')
    expect(rootContent).toContain('# System Documentation')
    expect(rootContent).toContain('auth')
    expect(rootContent).toContain('1 pattern')

    const authContent = await fs.read('.context/docs/auth/index.md')
    expect(authContent).toContain('# auth')
    expect(authContent).toContain('JWT middleware pattern')
  })

  it('creates directories for multiple subsystems', async () => {
    await db.writePattern({
      subsystem: 'auth',
      content: 'JWT middleware pattern',
      sourcePacket: 'packet-1',
    })
    await db.writePattern({
      subsystem: 'api',
      content: 'GraphQL resolver pattern',
      sourcePacket: 'packet-2',
    })

    await materializeDocs(db, '.context', fs)

    // Root index lists both
    const rootContent = await fs.read('.context/docs/index.md')
    expect(rootContent).toContain('api')
    expect(rootContent).toContain('auth')

    // Both subsystem dirs created
    expect(await fs.exists('.context/docs/auth/index.md')).toBe(true)
    expect(await fs.exists('.context/docs/api/index.md')).toBe(true)

    const apiContent = await fs.read('.context/docs/api/index.md')
    expect(apiContent).toContain('GraphQL resolver pattern')
  })

  it('includes ~~~node blocks in subsystem index', async () => {
    await db.writePattern({
      subsystem: 'auth',
      content: 'login_flow → validate → token_issue',
      sourcePacket: 'packet-1',
    })

    await materializeDocs(db, '.context', fs)

    const authContent = await fs.read('.context/docs/auth/index.md')
    expect(authContent).toContain('~~~node')
    expect(authContent).toContain('subsystem: auth')
    expect(authContent).toContain('login_flow')
    expect(authContent).toContain('~~~')
  })
})

// ── generateRootIndex ───────────────────────────────────────────────────────

describe('generateRootIndex', () => {
  it('lists subsystems alphabetically with stats', () => {
    const bySubsystem = new Map<string, PatternEntry[]>()
    bySubsystem.set('auth', [
      makePattern({ subsystem: 'auth', content: 'p1', sourcePacket: 's1', confidence: 3 }),
      makePattern({ subsystem: 'auth', content: 'p2', sourcePacket: 's2', confidence: 5 }),
    ])
    bySubsystem.set('api', [
      makePattern({ subsystem: 'api', content: 'p3', sourcePacket: 's3', confidence: 2 }),
    ])

    const result = generateRootIndex(bySubsystem)

    // api comes before auth alphabetically
    const apiIndex = result.indexOf('api')
    const authIndex = result.indexOf('auth')
    expect(apiIndex).toBeLessThan(authIndex)

    expect(result).toContain('2 patterns')
    expect(result).toContain('1 pattern,')  // singular for api
    expect(result).toContain('avg confidence 4.0')  // (3+5)/2
    expect(result).toContain('avg confidence 2.0')
  })
})

// ── generateSubsystemIndex ──────────────────────────────────────────────────

describe('generateSubsystemIndex', () => {
  it('sorts patterns by confidence descending', () => {
    const patterns = [
      makePattern({ subsystem: 'auth', content: 'low-conf', sourcePacket: 's1', confidence: 1 }),
      makePattern({ subsystem: 'auth', content: 'high-conf', sourcePacket: 's2', confidence: 5 }),
      makePattern({ subsystem: 'auth', content: 'mid-conf', sourcePacket: 's3', confidence: 3 }),
    ]

    const result = generateSubsystemIndex('auth', patterns)

    const highIndex = result.indexOf('high-conf')
    const midIndex = result.indexOf('mid-conf')
    const lowIndex = result.indexOf('low-conf')
    expect(highIndex).toBeLessThan(midIndex)
    expect(midIndex).toBeLessThan(lowIndex)
  })

  it('includes confidence and source in ~~~node blocks', () => {
    const patterns = [
      makePattern({ subsystem: 'auth', content: 'JWT flow', sourcePacket: 'packet-1', confidence: 3 }),
    ]

    const result = generateSubsystemIndex('auth', patterns)
    expect(result).toContain('confidence: 3')
    expect(result).toContain('source: packet-1')
  })
})

// ── renderPatternAsHuman ────────────────────────────────────────────────────

describe('renderPatternAsHuman', () => {
  it('renders AICCL format (raw ~~~node blocks)', () => {
    const patterns = [
      makePattern({ id: 'p1', subsystem: 'auth', content: 'JWT flow', sourcePacket: 'packet-1' }),
      makePattern({ id: 'p2', subsystem: 'auth', content: 'RBAC rules', sourcePacket: 'packet-2' }),
    ]

    const result = renderSubsystemDocs('auth', patterns, 'aiccl')
    expect(result).toContain('~~~node')
    expect(result).toContain('id: p1')
    expect(result).toContain('JWT flow')
    expect(result).toContain('id: p2')
    expect(result).toContain('RBAC rules')
  })

  it('renders human format with interpretation headers', () => {
    const pattern = makePattern({
      subsystem: 'auth',
      content: 'login → validate → issue_token',
      sourcePacket: 'packet-1',
      confidence: 3,
    })

    const result = renderPatternAsHuman(pattern)
    expect(result).toContain('## auth')
    expect(result).toContain('**Source:** packet-1')
    expect(result).toContain('**Confidence:** 3 validations')
    expect(result).toContain('### Logic')
    expect(result).toContain('login → validate → issue_token')
    expect(result).toContain('### Interpretation')
  })

  it('interprets AICCL symbols into human-readable text', () => {
    const pattern = makePattern({
      subsystem: 'auth',
      content: '∀ users → validate ∧ authorize\n✓ JWT approach\n💀 session-based',
      sourcePacket: 'packet-1',
    })

    const result = renderPatternAsHuman(pattern)
    expect(result).toContain('for all')
    expect(result).toContain('leads to')
    expect(result).toContain('and')
    expect(result).toContain('[PROVEN APPROACH]')
    expect(result).toContain('[FAILED APPROACH]')
  })

  it('handles single validation correctly (singular)', () => {
    const pattern = makePattern({
      subsystem: 'auth',
      content: 'test',
      sourcePacket: 'p1',
      confidence: 1,
    })

    const result = renderPatternAsHuman(pattern)
    expect(result).toContain('1 validation')
    expect(result).not.toContain('1 validations')
  })

  it('returns empty string for empty pattern list', () => {
    const result = renderSubsystemDocs('auth', [], 'human')
    expect(result).toBe('')
  })

  it('joins multiple human patterns with separator', () => {
    const patterns = [
      makePattern({ subsystem: 'auth', content: 'pattern-A', sourcePacket: 'p1' }),
      makePattern({ subsystem: 'auth', content: 'pattern-B', sourcePacket: 'p2' }),
    ]

    const result = renderSubsystemDocs('auth', patterns, 'human')
    expect(result).toContain('pattern-A')
    expect(result).toContain('---')
    expect(result).toContain('pattern-B')
  })
})

// ── Archive → Materialize flow ──────────────────────────────────────────────

describe('archive → materialize flow', () => {
  let db: InMemoryPacketDatabase
  let fs: FileService
  let engine: PacketEngine

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    fs = createMockFs()
    engine = new PacketEngine(db, '.context', fs)
  })

  it('creates docs from patterns extracted during archive', async () => {
    // 1. Create packet, add nodes, promote to success
    await engine.seed('feature-auth')
    await engine.nodeUpdate('feature-auth', 'jwt-middleware', 'success', 'JWT validation logic')
    await engine.nodeUpdate('feature-auth', 'rbac-check', 'success', 'Role-based access control')

    // 2. Archive extracts success nodes as patterns
    await engine.archive('feature-auth')

    // 3. Verify patterns exist
    const patterns = await db.getAllPatterns()
    expect(patterns.length).toBe(2)

    // 4. Materialize docs from patterns
    await engine.materializeDocs()

    // 5. Verify docs structure
    expect(await fs.exists('.context/docs/index.md')).toBe(true)
    expect(await fs.exists('.context/docs/jwt-middleware/index.md')).toBe(true)
    expect(await fs.exists('.context/docs/rbac-check/index.md')).toBe(true)

    const rootContent = await fs.read('.context/docs/index.md')
    expect(rootContent).toContain('jwt-middleware')
    expect(rootContent).toContain('rbac-check')

    const jwtContent = await fs.read('.context/docs/jwt-middleware/index.md')
    expect(jwtContent).toContain('JWT validation logic')
  })

  it('renderDocs returns AICCL for a subsystem', async () => {
    await engine.seed('feature-auth')
    await engine.nodeUpdate('feature-auth', 'jwt-middleware', 'success', 'JWT logic here')
    await engine.archive('feature-auth')

    const aiccl = await engine.renderDocs('jwt-middleware')
    expect(aiccl).toContain('~~~node')
    expect(aiccl).toContain('JWT logic here')
  })

  it('renderDocs returns human-readable for a subsystem', async () => {
    await engine.seed('feature-auth')
    await engine.nodeUpdate('feature-auth', 'jwt-middleware', 'success', 'JWT ∀ requests → validate')
    await engine.archive('feature-auth')

    const human = await engine.renderDocs('jwt-middleware', 'human')
    expect(human).toContain('## jwt-middleware')
    expect(human).toContain('### Logic')
    expect(human).toContain('### Interpretation')
    expect(human).toContain('for all')
  })
})

// ── Seed from patterns ──────────────────────────────────────────────────────

describe('seed from patterns', () => {
  let db: InMemoryPacketDatabase
  let fs: FileService
  let engine: PacketEngine

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    fs = createMockFs()
    engine = new PacketEngine(db, '.context', fs)
  })

  it('pre-loads existing patterns as initial nodes in new packet', async () => {
    // Write patterns directly to DB (simulating previous archives)
    await db.writePattern({
      subsystem: 'auth',
      content: 'JWT middleware pattern from previous work',
      sourcePacket: 'old-packet',
    })
    await db.writePattern({
      subsystem: 'api',
      content: 'GraphQL resolver pattern',
      sourcePacket: 'old-packet',
    })

    // Seed a new packet -- should pick up existing patterns
    await engine.seed('new-feature')

    // Verify the patterns appear as nodes in the new packet
    const content = await fs.read(engine.getPacketPath('new-feature'))
    expect(content).toContain('pattern:auth')
    expect(content).toContain('JWT middleware pattern from previous work')
    expect(content).toContain('pattern:api')
    expect(content).toContain('GraphQL resolver pattern')
  })

  it('seeds cleanly when no patterns exist', async () => {
    await engine.seed('fresh-packet')

    const content = await fs.read(engine.getPacketPath('fresh-packet'))
    expect(content).toContain('# Packet: fresh-packet')
    // No pattern: nodes should appear
    expect(content).not.toContain('pattern:')
  })
})

// ── Confidence accumulation ─────────────────────────────────────────────────

describe('confidence accumulation', () => {
  let db: InMemoryPacketDatabase
  let fs: FileService
  let engine: PacketEngine

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    fs = createMockFs()
    engine = new PacketEngine(db, '.context', fs)
  })

  it('increments confidence for existing patterns', async () => {
    // Write initial pattern
    const patternId = await db.writePattern({
      subsystem: 'auth',
      content: 'JWT flow',
      sourcePacket: 'packet-1',
    })

    let patterns = await db.findPatterns('auth')
    expect(patterns[0].confidence).toBe(1)

    // Increment confidence (simulates same subsystem discovered in another packet)
    await db.incrementConfidence(patternId)

    patterns = await db.findPatterns('auth')
    expect(patterns[0].confidence).toBe(2)

    // Increment again
    await db.incrementConfidence(patternId)

    patterns = await db.findPatterns('auth')
    expect(patterns[0].confidence).toBe(3)
  })

  it('confidence appears in materialized docs', async () => {
    const patternId = await db.writePattern({
      subsystem: 'auth',
      content: 'High confidence pattern',
      sourcePacket: 'packet-1',
    })
    await db.incrementConfidence(patternId)
    await db.incrementConfidence(patternId)

    await materializeDocs(db, '.context', fs)

    const authContent = await fs.read('.context/docs/auth/index.md')
    expect(authContent).toContain('confidence: 3')

    const rootContent = await fs.read('.context/docs/index.md')
    expect(rootContent).toContain('avg confidence 3.0')
  })
})
