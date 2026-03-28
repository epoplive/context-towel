import { describe, it, expect } from 'vitest'
import {
  DocsGraphContext,
  PacketGraphContext,
  PlanGraphContext,
  createGraphContext,
  withLayout,
} from '../graph/contexts'
import type { LayoutStrategy, GraphContextConfig } from '../graph/types'

describe('Built-in Graph Contexts', () => {
  describe('DocsGraphContext', () => {
    it('has correct ID and name', () => {
      expect(DocsGraphContext.id).toBe('docs')
      expect(DocsGraphContext.name).toBe('Documentation Graph')
    })

    it('includes document node types', () => {
      expect(DocsGraphContext.nodeTypes).toContain('folder')
      expect(DocsGraphContext.nodeTypes).toContain('document')
      expect(DocsGraphContext.nodeTypes).toContain('toc')
      expect(DocsGraphContext.nodeTypes).toContain('diagram')
    })

    it('uses structural edge type', () => {
      expect(DocsGraphContext.edgeTypes).toEqual(['structural'])
    })

    it('supports focus and context menu', () => {
      expect(DocsGraphContext.interactions.focus).toBe(true)
      expect(DocsGraphContext.interactions.contextMenu).toBe(true)
      expect(DocsGraphContext.interactions.pin).toBe(true)
    })

    it('uses MindmapLayout', () => {
      expect(DocsGraphContext.layout.id).toBe('mindmap')
    })
  })

  describe('PacketGraphContext', () => {
    it('includes packet node types', () => {
      expect(PacketGraphContext.nodeTypes).toContain('vector')
      expect(PacketGraphContext.nodeTypes).toContain('gap')
      expect(PacketGraphContext.nodeTypes).toContain('delta-timeline')
      expect(PacketGraphContext.nodeTypes).toContain('criterion')
    })

    it('uses attachment and reference edges', () => {
      expect(PacketGraphContext.edgeTypes).toContain('attachment')
      expect(PacketGraphContext.edgeTypes).toContain('reference')
      expect(PacketGraphContext.edgeTypes).toContain('dependency')
    })

    it('has single select mode', () => {
      expect(PacketGraphContext.interactions.select).toBe('single')
    })
  })

  describe('PlanGraphContext', () => {
    it('includes task-oriented node types', () => {
      expect(PlanGraphContext.nodeTypes).toContain('task')
      expect(PlanGraphContext.nodeTypes).toContain('checklist')
    })

    it('uses dependency edges', () => {
      expect(PlanGraphContext.edgeTypes).toContain('dependency')
    })

    it('disables drag', () => {
      expect(PlanGraphContext.interactions.drag).toBe(false)
    })
  })
})

describe('createGraphContext', () => {
  it('extends a base context with overrides', () => {
    const custom = createGraphContext(DocsGraphContext, {
      id: 'custom-docs',
      name: 'Custom Docs',
      nodeTypes: ['folder', 'document'],
    })

    expect(custom.id).toBe('custom-docs')
    expect(custom.name).toBe('Custom Docs')
    expect(custom.nodeTypes).toEqual(['folder', 'document'])
    // Inherited
    expect(custom.edgeTypes).toEqual(['structural'])
    expect(custom.interactions.focus).toBe(true)
  })

  it('merges interaction overrides', () => {
    const custom = createGraphContext(DocsGraphContext, {
      id: 'no-pin',
      interactions: { ...DocsGraphContext.interactions, pin: false },
    })

    expect(custom.interactions.pin).toBe(false)
    // Other interactions preserved
    expect(custom.interactions.focus).toBe(true)
  })
})

describe('withLayout', () => {
  it('injects a layout strategy', () => {
    const customLayout: LayoutStrategy = {
      id: 'custom',
      name: 'Custom Layout',
      capabilities: { focus: false, collapse: false, layers: false, incremental: false },
      compute: (nodes) => ({
        positions: new Map(nodes.map(n => [n.id, { x: 0, y: 0 }])),
      }),
    }

    const config = withLayout(DocsGraphContext, customLayout)
    expect(config.layout).toBe(customLayout)
    expect(config.id).toBe(DocsGraphContext.id) // rest preserved
  })

  it('injects focus layout separately', () => {
    const mainLayout: LayoutStrategy = {
      id: 'main',
      name: 'Main',
      capabilities: { focus: false, collapse: false, layers: false, incremental: false },
      compute: () => ({ positions: new Map() }),
    }
    const focusLayout: LayoutStrategy = {
      id: 'focus',
      name: 'Focus',
      capabilities: { focus: true, collapse: false, layers: false, incremental: false },
      compute: () => ({ positions: new Map() }),
    }

    const config = withLayout(DocsGraphContext, mainLayout, focusLayout)
    expect(config.layout).toBe(mainLayout)
    expect(config.focusLayout).toBe(focusLayout)
  })
})
