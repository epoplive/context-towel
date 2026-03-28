import { describe, it, expect } from 'vitest'
import { createGraphStore } from '../graph/GraphStore'
import type { GraphNode, GraphEdge } from '../graph/GraphStore'

describe('GraphStore', () => {
  const makeNode = (id: string, type = 'task'): GraphNode => ({
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: id },
  })

  const makeEdge = (source: string, target: string): GraphEdge => ({
    id: `${source}-${target}`,
    source,
    target,
    edgeType: 'structural',
  })

  describe('initialization', () => {
    it('creates store with defaults', () => {
      const store = createGraphStore()
      const state = store.getState()

      expect(state.nodes).toEqual([])
      expect(state.edges).toEqual([])
      expect(state.cardScale).toBe(1.0)
      expect(state.selectedNodes).toEqual([])
      expect(state.focusedNode).toBeNull()
      expect(state.contextMenu).toBeNull()
    })

    it('accepts initial state', () => {
      const nodes = [makeNode('a'), makeNode('b')]
      const edges = [makeEdge('a', 'b')]
      const store = createGraphStore({ nodes, edges, cardScale: 0.8 })
      const state = store.getState()

      expect(state.nodes).toHaveLength(2)
      expect(state.edges).toHaveLength(1)
      expect(state.cardScale).toBe(0.8)
    })
  })

  describe('node actions', () => {
    it('setNodes replaces all nodes', () => {
      const store = createGraphStore()
      store.getState().setNodes([makeNode('x')])
      expect(store.getState().nodes).toHaveLength(1)
    })

    it('updateNodePosition updates specific node', () => {
      const store = createGraphStore({ nodes: [makeNode('a'), makeNode('b')] })
      store.getState().updateNodePosition('a', { x: 100, y: 200 })

      expect(store.getState().nodes[0].position).toEqual({ x: 100, y: 200 })
      expect(store.getState().nodes[1].position).toEqual({ x: 0, y: 0 })
    })

    it('updateNodeData merges data', () => {
      const store = createGraphStore({ nodes: [makeNode('a')] })
      store.getState().updateNodeData('a', { status: 'done' })

      expect(store.getState().nodes[0].data).toEqual({ label: 'a', status: 'done' })
    })
  })

  describe('selection', () => {
    it('selectNode adds to selection', () => {
      const store = createGraphStore()
      store.getState().selectNode('a')
      store.getState().selectNode('b')

      expect(store.getState().selectedNodes).toEqual(['a', 'b'])
    })

    it('selectNode is idempotent', () => {
      const store = createGraphStore()
      store.getState().selectNode('a')
      store.getState().selectNode('a')

      expect(store.getState().selectedNodes).toEqual(['a'])
    })

    it('clearSelection empties selection', () => {
      const store = createGraphStore()
      store.getState().selectNode('a')
      store.getState().clearSelection()

      expect(store.getState().selectedNodes).toEqual([])
    })

    it('setSelectedNodes replaces selection', () => {
      const store = createGraphStore()
      store.getState().selectNode('a')
      store.getState().setSelectedNodes(['x', 'y'])

      expect(store.getState().selectedNodes).toEqual(['x', 'y'])
    })
  })

  describe('focus', () => {
    it('setFocusedNode sets and clears', () => {
      const store = createGraphStore()
      store.getState().setFocusedNode('a')
      expect(store.getState().focusedNode).toBe('a')

      store.getState().setFocusedNode(null)
      expect(store.getState().focusedNode).toBeNull()
    })
  })

  describe('pin/lock', () => {
    it('togglePinNode toggles pin state', () => {
      const store = createGraphStore()
      store.getState().togglePinNode('a')
      expect(store.getState().pinnedNodes.has('a')).toBe(true)

      store.getState().togglePinNode('a')
      expect(store.getState().pinnedNodes.has('a')).toBe(false)
    })

    it('toggleLockNode toggles lock state', () => {
      const store = createGraphStore()
      store.getState().toggleLockNode('a')
      expect(store.getState().lockedNodes.has('a')).toBe(true)

      store.getState().toggleLockNode('a')
      expect(store.getState().lockedNodes.has('a')).toBe(false)
    })
  })

  describe('scale', () => {
    it('setCardScale clamps to range', () => {
      const store = createGraphStore()
      store.getState().setCardScale(5.0)
      expect(store.getState().cardScale).toBe(2.0)

      store.getState().setCardScale(-1.0)
      expect(store.getState().cardScale).toBe(0.1)
    })

    it('increaseCardScale increments by 0.1', () => {
      const store = createGraphStore({ cardScale: 1.0 })
      store.getState().increaseCardScale()
      expect(store.getState().cardScale).toBeCloseTo(1.1)
    })

    it('decreaseCardScale decrements by 0.1', () => {
      const store = createGraphStore({ cardScale: 1.0 })
      store.getState().decreaseCardScale()
      expect(store.getState().cardScale).toBeCloseTo(0.9)
    })
  })

  describe('context menu', () => {
    it('shows and closes', () => {
      const store = createGraphStore()
      store.getState().showContextMenu({
        x: 100,
        y: 200,
        nodeId: 'a',
        nodeType: 'task',
        items: [{ label: 'Delete', action: 'delete' }],
      })

      expect(store.getState().contextMenu).not.toBeNull()
      expect(store.getState().contextMenu!.nodeId).toBe('a')

      store.getState().closeContextMenu()
      expect(store.getState().contextMenu).toBeNull()
    })
  })

  describe('measurements', () => {
    it('setMeasuredDimension adds single measurement', () => {
      const store = createGraphStore()
      store.getState().setMeasuredDimension('a', { width: 300, height: 150 })
      expect(store.getState().measuredDimensions.get('a')).toEqual({ width: 300, height: 150 })
    })

    it('setMeasuredDimensions replaces all measurements', () => {
      const store = createGraphStore()
      const dims = new Map([['a', { width: 100, height: 50 }]])
      store.getState().setMeasuredDimensions(dims)
      expect(store.getState().measuredDimensions).toBe(dims)
    })
  })

  describe('viewport', () => {
    it('setViewport updates viewport', () => {
      const store = createGraphStore()
      store.getState().setViewport({ x: 10, y: 20, zoom: 1.5 })
      expect(store.getState().viewport).toEqual({ x: 10, y: 20, zoom: 1.5 })
    })

    it('setViewportDimensions updates dimensions', () => {
      const store = createGraphStore()
      store.getState().setViewportDimensions({ width: 1920, height: 1080 })
      expect(store.getState().viewportDimensions).toEqual({ width: 1920, height: 1080 })
    })
  })
})
