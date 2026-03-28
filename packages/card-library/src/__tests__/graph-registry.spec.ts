import { describe, it, expect, beforeEach } from 'vitest'
import { GraphRegistry } from '../graph/GraphRegistry'
import type {
  NodeTypeDefinition,
  EdgeTypeDefinition,
  NodeRenderProps,
  DetectResult,
  ParseResult,
} from '../graph/types'
import { DEFAULT_LAYOUT_HINTS, DEFAULT_INTERACTIONS } from '../graph/types'

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeNodeType(overrides: Partial<NodeTypeDefinition> & { id: string }): NodeTypeDefinition {
  return {
    name: overrides.id,
    category: 'content',
    supportedContexts: ['card', 'inline'],
    components: {},
    ...overrides,
  }
}

function makeEdgeType(overrides: Partial<EdgeTypeDefinition> & { id: string }): EdgeTypeDefinition {
  return {
    name: overrides.id,
    style: { stroke: '#fff', strokeWidth: 1 },
    ...overrides,
  }
}

const DummyCard = (_props: NodeRenderProps) => null
const DummyNode = (_props: NodeRenderProps) => null
const DummyInline = (_props: NodeRenderProps) => null

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GraphRegistry', () => {
  let registry: GraphRegistry

  beforeEach(() => {
    registry = new GraphRegistry()
  })

  describe('node type registration', () => {
    it('registers and retrieves a node type', () => {
      const def = makeNodeType({ id: 'task' })
      registry.registerNodeType(def)

      expect(registry.hasNodeType('task')).toBe(true)
      expect(registry.getNodeType('task')).toBe(def)
      expect(registry.nodeTypeCount).toBe(1)
    })

    it('throws on duplicate registration', () => {
      registry.registerNodeType(makeNodeType({ id: 'task' }))
      expect(() => registry.registerNodeType(makeNodeType({ id: 'task' }))).toThrow(
        "Node type 'task' is already registered",
      )
    })

    it('registerOrReplace overwrites existing type', () => {
      const v1 = makeNodeType({ id: 'task', name: 'Task v1' })
      const v2 = makeNodeType({ id: 'task', name: 'Task v2' })

      registry.registerNodeType(v1)
      registry.registerOrReplaceNodeType(v2)

      expect(registry.getNodeType('task')!.name).toBe('Task v2')
      expect(registry.nodeTypeCount).toBe(1)
    })

    it('returns undefined for unknown type', () => {
      expect(registry.getNodeType('nonexistent')).toBeUndefined()
      expect(registry.hasNodeType('nonexistent')).toBe(false)
    })

    it('unregisters a type', () => {
      registry.registerNodeType(makeNodeType({ id: 'task' }))
      registry.unregisterNodeType('task')
      expect(registry.hasNodeType('task')).toBe(false)
      expect(registry.nodeTypeCount).toBe(0)
    })

    it('filters by category', () => {
      registry.registerNodeType(makeNodeType({ id: 'task', category: 'content' }))
      registry.registerNodeType(makeNodeType({ id: 'folder', category: 'structural' }))
      registry.registerNodeType(makeNodeType({ id: 'vector', category: 'metric' }))

      const content = registry.getNodeTypes({ category: 'content' })
      expect(content).toHaveLength(1)
      expect(content[0].id).toBe('task')

      const all = registry.getNodeTypes()
      expect(all).toHaveLength(3)
    })

    it('lists all node type IDs', () => {
      registry.registerNodeType(makeNodeType({ id: 'task' }))
      registry.registerNodeType(makeNodeType({ id: 'folder' }))
      expect(registry.listNodeTypeIds()).toEqual(['task', 'folder'])
    })
  })

  describe('edge type registration', () => {
    it('registers and retrieves an edge type', () => {
      const def = makeEdgeType({ id: 'structural' })
      registry.registerEdgeType(def)

      expect(registry.hasEdgeType('structural')).toBe(true)
      expect(registry.getEdgeType('structural')).toBe(def)
      expect(registry.edgeTypeCount).toBe(1)
    })

    it('throws on duplicate registration', () => {
      registry.registerEdgeType(makeEdgeType({ id: 'structural' }))
      expect(() => registry.registerEdgeType(makeEdgeType({ id: 'structural' }))).toThrow(
        "Edge type 'structural' is already registered",
      )
    })

    it('registerOrReplace overwrites existing type', () => {
      registry.registerEdgeType(makeEdgeType({ id: 'structural', name: 'v1' }))
      registry.registerOrReplaceEdgeType(makeEdgeType({ id: 'structural', name: 'v2' }))

      expect(registry.getEdgeType('structural')!.name).toBe('v2')
      expect(registry.edgeTypeCount).toBe(1)
    })

    it('unregisters an edge type', () => {
      registry.registerEdgeType(makeEdgeType({ id: 'structural' }))
      registry.unregisterEdgeType('structural')
      expect(registry.hasEdgeType('structural')).toBe(false)
    })

    it('lists all edge types', () => {
      registry.registerEdgeType(makeEdgeType({ id: 'structural' }))
      registry.registerEdgeType(makeEdgeType({ id: 'reference' }))
      const types = registry.getEdgeTypes()
      expect(types).toHaveLength(2)
    })
  })

  describe('component resolution', () => {
    it('resolves exact context match', () => {
      registry.registerNodeType(
        makeNodeType({
          id: 'task',
          components: { card: DummyCard, inline: DummyInline },
        }),
      )

      expect(registry.getComponent('task', 'card')).toBe(DummyCard)
      expect(registry.getComponent('task', 'inline')).toBe(DummyInline)
    })

    it('falls back graph-node → card → inline', () => {
      registry.registerNodeType(
        makeNodeType({
          id: 'task',
          components: { card: DummyCard },
        }),
      )

      // graph-node not defined, should fall back to card
      expect(registry.getComponent('task', 'graph-node')).toBe(DummyCard)
    })

    it('falls back graph-node → inline when card missing', () => {
      registry.registerNodeType(
        makeNodeType({
          id: 'task',
          components: { inline: DummyInline },
        }),
      )

      expect(registry.getComponent('task', 'graph-node')).toBe(DummyInline)
    })

    it('returns null when no component available', () => {
      registry.registerNodeType(
        makeNodeType({
          id: 'task',
          components: {},
        }),
      )

      expect(registry.getComponent('task', 'graph-node')).toBeNull()
    })

    it('returns null for unknown type', () => {
      expect(registry.getComponent('nonexistent', 'card')).toBeNull()
    })

    it('custom getComponent takes priority', () => {
      registry.registerNodeType(
        makeNodeType({
          id: 'task',
          components: { card: DummyCard },
          getComponent: (ctx) => (ctx === 'graph-node' ? DummyNode : null),
        }),
      )

      expect(registry.getComponent('task', 'graph-node')).toBe(DummyNode)
      // Falls back to components map when getComponent returns null
      expect(registry.getComponent('task', 'card')).toBe(DummyCard)
    })
  })

  describe('layout hints', () => {
    it('returns defaults when type has no hints', () => {
      registry.registerNodeType(makeNodeType({ id: 'task' }))
      const hints = registry.getLayoutHints('task')
      expect(hints).toEqual(DEFAULT_LAYOUT_HINTS)
    })

    it('merges partial hints with defaults', () => {
      registry.registerNodeType(
        makeNodeType({
          id: 'pill',
          layoutHints: { sizeCategory: 'pill', defaultWidth: 120, defaultHeight: 32 },
        }),
      )
      const hints = registry.getLayoutHints('pill')
      expect(hints.sizeCategory).toBe('pill')
      expect(hints.defaultWidth).toBe(120)
      expect(hints.defaultHeight).toBe(32)
      // Defaults preserved
      expect(hints.groupable).toBe(false)
      expect(hints.isContainer).toBe(false)
    })

    it('returns defaults for unknown type', () => {
      expect(registry.getLayoutHints('nonexistent')).toEqual(DEFAULT_LAYOUT_HINTS)
    })
  })

  describe('React Flow type maps', () => {
    it('builds node type map from registered types with graph-node components', () => {
      registry.registerNodeType(
        makeNodeType({
          id: 'task',
          components: { 'graph-node': DummyNode, card: DummyCard },
        }),
      )
      registry.registerNodeType(
        makeNodeType({
          id: 'note',
          components: { card: DummyCard }, // no graph-node, falls back to card
        }),
      )
      registry.registerNodeType(
        makeNodeType({
          id: 'empty',
          components: {}, // no components at all
        }),
      )

      const nodeTypes = registry.buildReactFlowNodeTypes()
      expect(Object.keys(nodeTypes)).toEqual(['task', 'note'])
      expect(nodeTypes['task']).toBe(DummyNode)
      expect(nodeTypes['note']).toBe(DummyCard)
    })

    it('builds edge type map from registered types with components', () => {
      const DummyEdge = () => null
      registry.registerEdgeType(makeEdgeType({ id: 'structural', component: DummyEdge as any }))
      registry.registerEdgeType(makeEdgeType({ id: 'reference' })) // no component

      const edgeTypes = registry.buildReactFlowEdgeTypes()
      expect(Object.keys(edgeTypes)).toEqual(['structural'])
    })
  })

  describe('parsing', () => {
    it('runs detect + parse on all types with parsers', () => {
      registry.registerNodeType(
        makeNodeType({
          id: 'task',
          detect: (content) => ({
            detected: content.includes('~~~task'),
            confidence: 1.0,
          }),
          parse: (content, sourceFile) => ({
            items: [{ id: 'task-1', sourceFile, data: { title: 'Test' } }],
            matches: [{ start: 0, end: 10, startLine: 1, endLine: 3, content: '~~~task' }],
          }),
        }),
      )

      registry.registerNodeType(
        makeNodeType({
          id: 'note',
          detect: (content) => ({ detected: false, confidence: 0 }),
          parse: () => ({ items: [], matches: [] }),
        }),
      )

      const results = registry.parseAll('~~~task\ntitle: Test\n~~~', 'test.md')
      expect(results.has('task')).toBe(true)
      expect(results.has('note')).toBe(false)
    })

    it('respects priority order', () => {
      const order: string[] = []

      registry.registerNodeType(
        makeNodeType({
          id: 'low-pri',
          priority: 1,
          detect: () => {
            order.push('low-pri')
            return { detected: false, confidence: 0 }
          },
          parse: () => ({ items: [], matches: [] }),
        }),
      )

      registry.registerNodeType(
        makeNodeType({
          id: 'high-pri',
          priority: 10,
          detect: () => {
            order.push('high-pri')
            return { detected: false, confidence: 0 }
          },
          parse: () => ({ items: [], matches: [] }),
        }),
      )

      registry.parseAll('content', 'test.md')
      expect(order).toEqual(['high-pri', 'low-pri'])
    })

    it('parseWith runs a specific parser', () => {
      registry.registerNodeType(
        makeNodeType({
          id: 'task',
          parse: (_content, sourceFile) => ({
            items: [{ id: 't1', sourceFile, data: {} }],
            matches: [],
          }),
        }),
      )

      const result = registry.parseWith('task', 'content', 'file.md') as ParseResult
      expect(result.items).toHaveLength(1)
    })
  })

  describe('clear', () => {
    it('removes all registrations', () => {
      registry.registerNodeType(makeNodeType({ id: 'task' }))
      registry.registerEdgeType(makeEdgeType({ id: 'structural' }))

      registry.clear()

      expect(registry.nodeTypeCount).toBe(0)
      expect(registry.edgeTypeCount).toBe(0)
    })
  })

  describe('defaults', () => {
    it('DEFAULT_LAYOUT_HINTS has expected shape', () => {
      expect(DEFAULT_LAYOUT_HINTS).toEqual({
        defaultWidth: 200,
        defaultHeight: 100,
        sizeCategory: 'standard',
        groupable: false,
        isContainer: false,
      })
    })

    it('DEFAULT_INTERACTIONS has expected shape', () => {
      expect(DEFAULT_INTERACTIONS.focus).toBe(true)
      expect(DEFAULT_INTERACTIONS.select).toBe('multi')
      expect(DEFAULT_INTERACTIONS.zoom).toBe(true)
      expect(DEFAULT_INTERACTIONS.drag).toBe(true)
    })
  })
})
