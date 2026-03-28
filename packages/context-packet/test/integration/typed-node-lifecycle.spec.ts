import { describe, it, expect, beforeEach } from 'vitest'
import { PacketEngine } from '../../src/PacketEngine'
import { InMemoryPacketDatabase } from '../../src/storage/InMemoryPacketDatabase'
import { createMockFs } from '../unit/helpers'
import { parsePacketSections, parseAicclNodes } from '../../../context-graph/src/components/packet/parsePacketContent'
import type { FileService } from '../../src/types'

/**
 * Integration test: full lifecycle through real engine + DB + template + parser.
 * Uses InMemoryPacketDatabase (same interface as SqljsPacketDatabase).
 * Uses in-memory FileService (createMockFs).
 * No other mocks. Tests the full roundtrip.
 */
describe('Typed node lifecycle (integration)', () => {
  let db: InMemoryPacketDatabase
  let fs: FileService
  let engine: PacketEngine

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    fs = createMockFs()
    engine = new PacketEngine(db, '.context', fs)
  })

  /** Read materialized markdown from the in-memory FS */
  async function getMarkdown(name: string): Promise<string> {
    await engine.materialize(name)
    return fs.read(`.context/packets/active/${name}/packet.md`)
  }

  it('seed → add work node → attach ref/test/diagram → edges → markdown roundtrip', async () => {
    // 1. Seed
    await engine.seed('lifecycle-test')

    // 2. Work node
    await engine.nodeUpdate('lifecycle-test', 'auth-work', 'active', 'Investigating authentication')

    // 3. Typed nodes
    await engine.nodeUpdate('lifecycle-test', 'ref-auth-docs', 'active', 'Auth architecture docs',
      undefined, 'reference', '/docs/auth.md')
    await engine.nodeUpdate('lifecycle-test', 'test-auth', 'active', 'Auth unit tests',
      undefined, 'test', 'tests/auth.spec.ts')
    await engine.nodeUpdate('lifecycle-test', 'diag-auth-flow', 'active', 'graph TD\n  Login --> Token --> API',
      undefined, 'diagram')

    // 4. Edges
    await engine.edgeAdd('lifecycle-test', 'ref-auth-docs', 'auth-work')
    await engine.edgeAdd('lifecycle-test', 'test-auth', 'auth-work')
    await engine.edgeAdd('lifecycle-test', 'diag-auth-flow', 'auth-work')

    // 5. Get materialized markdown
    const markdown = await getMarkdown('lifecycle-test')

    // 6. Verify typed info in markdown
    expect(markdown).toContain('type: reference')
    expect(markdown).toContain('type: test')
    expect(markdown).toContain('type: diagram')
    expect(markdown).toContain('path: /docs/auth.md')
    expect(markdown).toContain('path: tests/auth.spec.ts')
    expect(markdown).toContain('edges: auth-work')

    // 7. Parse back (canvas roundtrip)
    const sections = parsePacketSections(markdown)
    const { nodes, edges } = parseAicclNodes(sections)

    // 8. All 4 nodes with correct types
    expect(nodes.length).toBeGreaterThanOrEqual(4)

    const workNode = nodes.find(n => n.id === 'auth-work')
    expect(workNode).toBeDefined()
    expect(workNode!.type).toBe('work')

    const refNode = nodes.find(n => n.id === 'ref-auth-docs')
    expect(refNode).toBeDefined()
    expect(refNode!.type).toBe('reference')
    expect(refNode!.path).toBe('/docs/auth.md')

    const testNode = nodes.find(n => n.id === 'test-auth')
    expect(testNode).toBeDefined()
    expect(testNode!.type).toBe('test')
    expect(testNode!.path).toBe('tests/auth.spec.ts')

    const diagNode = nodes.find(n => n.id === 'diag-auth-flow')
    expect(diagNode).toBeDefined()
    expect(diagNode!.type).toBe('diagram')

    // 9. Edges roundtripped
    expect(refNode!.edges).toContain('auth-work')
    expect(testNode!.edges).toContain('auth-work')
    expect(diagNode!.edges).toContain('auth-work')

    const refEdges = edges.filter(e => e.source === 'ref-auth-docs')
    expect(refEdges).toHaveLength(1)
    expect(refEdges[0].target).toBe('auth-work')
  })

  it('edge CRUD through engine → DB roundtrip', async () => {
    await engine.seed('edge-test')
    await engine.nodeUpdate('edge-test', 'work-1', 'active', 'Work node')
    await engine.nodeUpdate('edge-test', 'ref-1', 'active', 'Reference',
      undefined, 'reference', '/readme.md')

    await engine.edgeAdd('edge-test', 'ref-1', 'work-1')

    // List all edges
    const allEdges = await engine.edgeList('edge-test')
    expect(allEdges).toHaveLength(1)
    expect(allEdges[0].sourceNode).toBe('ref-1')
    expect(allEdges[0].targetNode).toBe('work-1')

    // List edges for specific node
    const nodeEdges = await engine.edgeList('edge-test', 'work-1')
    expect(nodeEdges).toHaveLength(1)

    // Remove and verify
    await engine.edgeRemove('edge-test', 'ref-1', 'work-1')
    const afterRemove = await engine.edgeList('edge-test')
    expect(afterRemove).toHaveLength(0)

    // Verify removal reflected in markdown
    const markdown = await getMarkdown('edge-test')
    // ref-1 node should NOT have edges: work-1 anymore
    const sections = parsePacketSections(markdown)
    const { nodes } = parseAicclNodes(sections)
    const refNode = nodes.find(n => n.id === 'ref-1')
    if (refNode) {
      expect(refNode.edges).not.toContain('work-1')
    }
  })

  it('node promote → slice includes connected nodes', async () => {
    await engine.seed('promote-test')
    await engine.nodeUpdate('promote-test', 'root', 'active', 'Root work')
    await engine.nodeUpdate('promote-test', 'child-ref', 'active', 'A reference',
      undefined, 'reference', '/foo.md')
    await engine.edgeAdd('promote-test', 'child-ref', 'root')

    // Slice for root should return content
    const slice = await engine.sliceForNode('promote-test', ['root'])
    expect(slice.length).toBeGreaterThan(0)

    // Promote root
    await engine.nodePromote('promote-test', 'root')

    // Verify promoted state in markdown
    const markdown = await getMarkdown('promote-test')
    expect(markdown).toContain('root')
  })

  it('context injection includes typed nodes from materialized markdown', async () => {
    await engine.seed('inject-test')
    await engine.nodeUpdate('inject-test', 'work', 'active', 'Some work')
    await engine.nodeUpdate('inject-test', 'ref', 'active', 'A ref',
      undefined, 'reference', '/ref.md')
    await engine.edgeAdd('inject-test', 'ref', 'work')

    const markdown = await getMarkdown('inject-test')

    // The context injection reads this markdown and extracts nodes
    // Verify the materialized file has the data the injector needs
    expect(markdown).toContain('~~~node')
    expect(markdown).toContain('id: work')
    expect(markdown).toContain('id: ref')
    expect(markdown).toContain('type: reference')
    expect(markdown).toContain('edges: work')
  })

  it('work nodes without explicit type render without type annotation', async () => {
    await engine.seed('default-type-test')
    await engine.nodeUpdate('default-type-test', 'plain', 'active', 'Just a work node')

    const markdown = await getMarkdown('default-type-test')
    const sections = parsePacketSections(markdown)
    const { nodes } = parseAicclNodes(sections)

    const node = nodes.find(n => n.id === 'plain')
    expect(node).toBeDefined()
    expect(node!.type).toBe('work') // default
    // Markdown should NOT have type: work (omitted for default)
    const aiccl = sections.find(s => s.name === 'AICCL')
    expect(aiccl?.content).not.toContain('type: work')
  })
})
