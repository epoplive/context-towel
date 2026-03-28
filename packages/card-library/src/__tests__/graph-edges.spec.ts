import { describe, it, expect, beforeEach } from 'vitest'
import { GraphRegistry } from '../graph/GraphRegistry'
import {
  structuralEdge,
  referenceEdge,
  dependencyEdge,
  temporalEdge,
  attachmentEdge,
  dataFlowEdge,
  builtInEdgeTypes,
  registerBuiltInEdgeTypes,
} from '../graph/edges'
import { graphRegistry } from '../graph/GraphRegistry'

describe('Built-in Edge Types', () => {
  it('all have unique IDs', () => {
    const ids = builtInEdgeTypes.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all have required fields', () => {
    for (const edge of builtInEdgeTypes) {
      expect(edge.id).toBeTruthy()
      expect(edge.name).toBeTruthy()
      expect(edge.style).toBeDefined()
      expect(edge.style.stroke).toBeTruthy()
      expect(edge.style.strokeWidth).toBeGreaterThan(0)
    }
  })

  describe('edge style semantics', () => {
    it('structural edges are solid and muted', () => {
      expect(structuralEdge.style.strokeDasharray).toBeUndefined()
      expect(structuralEdge.style.opacity).toBeLessThan(1)
    })

    it('reference edges are dashed', () => {
      expect(referenceEdge.style.strokeDasharray).toBeTruthy()
    })

    it('dependency edges have arrows', () => {
      expect(dependencyEdge.style.markerEnd).toBe(true)
    })

    it('temporal edges are dotted', () => {
      expect(temporalEdge.style.strokeDasharray).toBeTruthy()
    })

    it('attachment edges are thin and subtle', () => {
      expect(attachmentEdge.style.strokeWidth).toBe(1)
      expect(attachmentEdge.style.opacity).toBeLessThan(0.5)
    })

    it('data-flow edges are animated with arrows', () => {
      expect(dataFlowEdge.style.animated).toBe(true)
      expect(dataFlowEdge.style.markerEnd).toBe(true)
    })
  })

  describe('registerBuiltInEdgeTypes', () => {
    beforeEach(() => {
      graphRegistry.clear()
    })

    it('registers all edge types into global registry', () => {
      registerBuiltInEdgeTypes()
      for (const edge of builtInEdgeTypes) {
        expect(graphRegistry.hasEdgeType(edge.id)).toBe(true)
      }
      expect(graphRegistry.edgeTypeCount).toBe(builtInEdgeTypes.length)
    })

    it('is idempotent — calling twice does not throw', () => {
      registerBuiltInEdgeTypes()
      expect(() => registerBuiltInEdgeTypes()).not.toThrow()
      expect(graphRegistry.edgeTypeCount).toBe(builtInEdgeTypes.length)
    })
  })

  describe('edge types in registry', () => {
    let registry: GraphRegistry

    beforeEach(() => {
      registry = new GraphRegistry()
      for (const edge of builtInEdgeTypes) {
        registry.registerEdgeType(edge)
      }
    })

    it('retrieves by ID', () => {
      expect(registry.getEdgeType('structural')).toBe(structuralEdge)
      expect(registry.getEdgeType('reference')).toBe(referenceEdge)
      expect(registry.getEdgeType('dependency')).toBe(dependencyEdge)
    })

    it('lists all', () => {
      const types = registry.getEdgeTypes()
      expect(types).toHaveLength(builtInEdgeTypes.length)
    })
  })
})
