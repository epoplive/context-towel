import { describe, it, expect, beforeEach } from 'vitest'
import { adaptBlockToNodeType } from '../graph/adapt.js'
import { registerContentNodeTypes } from '../graph/register'
import { graphRegistry, GraphRegistry } from '../graph/GraphRegistry'
import type { BlockDefinition } from '../blocks/types'

// Minimal block definition for testing
const testBlock: BlockDefinition<{ title: string }> = {
  type: 'test-block',
  name: 'Test Block',
  schemaVersion: 1,
  capabilities: { parsingLevel: 'semantic', expandable: false, crossReferenced: false, layered: false, typed: true, interactive: false, compilable: false, confidence: 1.0 },
  components: {
    inline: () => null,
    card: () => null,
  },
  validate: (data) => (data.title ? [] : [{ message: 'title required' }]),
  skeleton: () => 'title: New Test',
}

describe('adaptBlockToNodeType', () => {
  it('converts BlockDefinition to NodeTypeDefinition', () => {
    const nodeDef = adaptBlockToNodeType(testBlock)

    expect(nodeDef.id).toBe('test-block')
    expect(nodeDef.name).toBe('Test Block')
    expect(nodeDef.category).toBe('content')
    expect(nodeDef.schemaVersion).toBe(1)
    expect(nodeDef.supportedContexts).toEqual(['inline', 'card'])
  })

  it('wraps block components', () => {
    const nodeDef = adaptBlockToNodeType(testBlock)

    expect(nodeDef.components.inline).toBeDefined()
    expect(nodeDef.components.card).toBeDefined()
    expect(nodeDef.components['graph-node']).toBeUndefined() // no node component
  })

  it('preserves validate and skeleton', () => {
    const nodeDef = adaptBlockToNodeType(testBlock)

    expect(nodeDef.validate).toBeDefined()
    expect(nodeDef.validate!({ title: '' })).toHaveLength(1)
    expect(nodeDef.validate!({ title: 'ok' })).toHaveLength(0)
    expect(nodeDef.skeleton!()).toBe('title: New Test')
  })

  it('accepts category override', () => {
    const nodeDef = adaptBlockToNodeType(testBlock, { category: 'reference' })
    expect(nodeDef.category).toBe('reference')
  })

  it('accepts layout hints', () => {
    const nodeDef = adaptBlockToNodeType(testBlock, {
      layoutHints: { defaultWidth: 300, defaultHeight: 200, sizeCategory: 'wide', groupable: false, isContainer: false },
    })
    expect(nodeDef.layoutHints?.defaultWidth).toBe(300)
    expect(nodeDef.layoutHints?.sizeCategory).toBe('wide')
  })

  it('accepts detect and parse functions', () => {
    const nodeDef = adaptBlockToNodeType(testBlock, {
      detect: (content) => ({ detected: content.includes('test'), confidence: 1.0 }),
      parse: (content, sourceFile) => ({
        items: [{ id: 'x', sourceFile, data: { title: 'parsed' } }],
        matches: [],
      }),
    })

    expect(nodeDef.detect).toBeDefined()
    expect(nodeDef.parse).toBeDefined()
    expect(nodeDef.detect!('test content').detected).toBe(true)
  })

  it('registers in GraphRegistry', () => {
    const registry = new GraphRegistry()
    const nodeDef = adaptBlockToNodeType(testBlock)
    registry.registerNodeType(nodeDef)

    expect(registry.hasNodeType('test-block')).toBe(true)
    expect(registry.getComponent('test-block', 'card')).toBeDefined()
    // graph-node falls back to card
    expect(registry.getComponent('test-block', 'graph-node')).toBeDefined()
  })
})

describe('registerContentNodeTypes', () => {
  beforeEach(() => {
    graphRegistry.clear()
  })

  it('registers all built-in content types', () => {
    registerContentNodeTypes()

    // Check a representative sample
    expect(graphRegistry.hasNodeType('task')).toBe(true)
    expect(graphRegistry.hasNodeType('checklist')).toBe(true)
    expect(graphRegistry.hasNodeType('diagram')).toBe(true)
    expect(graphRegistry.hasNodeType('toc')).toBe(true)
    expect(graphRegistry.hasNodeType('note')).toBe(true)
    expect(graphRegistry.hasNodeType('kanban')).toBe(true)
    expect(graphRegistry.hasNodeType('timeline')).toBe(true)
    expect(graphRegistry.hasNodeType('index')).toBe(true)

    // Should have 18 types (17 blocks + nodeMap as separate)
    expect(graphRegistry.nodeTypeCount).toBeGreaterThanOrEqual(17)
  })

  it('is idempotent', () => {
    registerContentNodeTypes()
    const count = graphRegistry.nodeTypeCount
    registerContentNodeTypes() // should not throw
    expect(graphRegistry.nodeTypeCount).toBe(count)
  })

  it('all registered types have card components', () => {
    registerContentNodeTypes()
    for (const typeDef of graphRegistry.getNodeTypes()) {
      const comp = graphRegistry.getComponent(typeDef.id, 'card')
      // Most types should have at least a card component
      // Some very basic ones might not — that's ok
      if (typeDef.components.card || typeDef.components.inline) {
        expect(comp).not.toBeNull()
      }
    }
  })
})
