// ============================================================================
// Context Graph State - Graph Slice
// ============================================================================

import type { GraphSlice, SliceCreator, StoreState } from './types'
import { layoutNodes } from '../layoutUtils'
import { buildGraphFromState, getViewKey } from './graph/graphBuilder'

// ----------------------------------------------------------------------------
// Slice Creator
// ----------------------------------------------------------------------------

export const createGraphSlice: SliceCreator<GraphSlice> = (set, get) => ({
  // Initial state
  nodes: [],
  edges: [],
  nodePositions: new Map(),
  nodeDimensions: new Map(),
  viewport: null,
  viewportDimensions: null,
  layoutStates: {},
  measuredDimensions: new Map(),
  layoutNeedsMeasuredUpdate: false,

  // Position Management
  setNodePosition: (id, pos) => {
    set(state => {
      const nodePositions = new Map(state.nodePositions).set(id, pos)
      const nodes = state.nodes.map(n =>
        n.id === id ? { ...n, position: pos } : n
      )
      return { nodePositions, nodes }
    })
  },

  setNodePositions: (positions) => {
    set(state => {
      const nodePositions = new Map([...state.nodePositions, ...positions])
      const nodes = state.nodes.map(n => {
        const pos = positions.get(n.id)
        return pos ? { ...n, position: pos } : n
      })
      return { nodePositions, nodes }
    })
  },

  setNodeDimension: (id, dim) => {
    set(state => ({
      nodeDimensions: new Map(state.nodeDimensions).set(id, dim),
    }))
  },

  setViewport: (viewport) => {
    set({ viewport })
  },

  setViewportDimensions: (dims) => {
    set({ viewportDimensions: dims })
  },

  updateNodePosition: (nodeId, position) => {
    const state = get()
    const { focusedNode, projectPath, layoutStates } = state
    const viewKey = getViewKey(projectPath, focusedNode)

    const currentViewState = layoutStates[viewKey] || { positions: {} }
    const newPositions = { ...currentViewState.positions, [nodeId]: position }
    const newLayoutStates = {
      ...layoutStates,
      [viewKey]: { ...currentViewState, positions: newPositions }
    }

    // Only update layoutStates for persistence - don't touch nodes array
    // ReactFlow already has the correct position, updating nodes would trigger
    // a sync that desyncs ReactFlow's internal node registry
    set({ layoutStates: newLayoutStates })
  },

  updateNodePositions: (positions) => {
    const state = get()
    const { focusedNode, projectPath, layoutStates } = state
    const viewKey = getViewKey(projectPath, focusedNode)

    const currentViewState = layoutStates[viewKey] || { positions: {} }
    const newPositions = { ...currentViewState.positions, ...positions }
    const newLayoutStates = {
      ...layoutStates,
      [viewKey]: { ...currentViewState, positions: newPositions }
    }

    set({ layoutStates: newLayoutStates })
  },

  updateNode: (id, data) => {
    set(state => ({
      nodes: state.nodes.map(n =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    }))
  },

  updateNodes: (updates) => {
    set(state => ({
      nodes: state.nodes.map(n => {
        const update = updates.get(n.id)
        return update ? { ...n, data: { ...n.data, ...update } } : n
      }),
    }))
  },

  addNodes: (newNodes) => {
    set(state => {
      const nodePositions = state.nodePositions
      const nodesWithPositions = newNodes.map(n => {
        const savedPos = nodePositions.get(n.id)
        return savedPos ? { ...n, position: savedPos } : n
      })
      return { nodes: [...state.nodes, ...nodesWithPositions] }
    })
  },

  removeNodes: (ids) => {
    const idSet = new Set(ids)
    set(state => ({
      nodes: state.nodes.filter(n => !idSet.has(n.id)),
      edges: state.edges.filter(e => !idSet.has(e.source) && !idSet.has(e.target)),
    }))
  },

  setEdges: (edges) => {
    set({ edges })
  },

  syncGraph: () => {
    get().rebuildGraph(false)
  },

  rebuildGraph: (forceLayout = false) => {
    const state = get()
    const { viewportDimensions, measuredDimensions, nodes: existingNodes, layoutStates, focusedNode, customFocusNodes, projectPath } = state

    const { nodes: flowNodes, edges: structuralEdges } = buildGraphFromState(state)

    // Get saved positions from layoutStates
    const viewKey = getViewKey(projectPath, focusedNode)
    const savedViewState = layoutStates[viewKey]
    const savedPositions = savedViewState?.positions || {}

    // Check if node IDs changed
    const existingIds = new Set(existingNodes.map(n => n.id))
    const newIds = new Set(flowNodes.map(n => n.id))
    const sameStructure = existingIds.size === newIds.size &&
      [...existingIds].every(id => newIds.has(id))

    if (sameStructure && !forceLayout && existingNodes.length > 0) {
      // CRITICAL: Preserve node object identity to keep ReactFlow's measured dimensions
      // Only update data and position on existing nodes, don't replace objects
      const newDataMap = new Map(flowNodes.map(n => [n.id, n.data]))

      let hasChanges = false
      const updatedNodes = existingNodes.map(node => {
        const newData = newDataMap.get(node.id)
        const savedPos = savedPositions[node.id] as { x: number; y: number } | undefined

        // Check if data actually changed (shallow compare)
        const dataChanged = newData && JSON.stringify(node.data) !== JSON.stringify(newData)
        const posChanged = savedPos && (node.position.x !== savedPos.x || node.position.y !== savedPos.y)

        if (dataChanged || posChanged) {
          hasChanges = true
          return {
            ...node,
            data: newData || node.data,
            position: savedPos || node.position,
          }
        }
        return node // Keep same object reference if nothing changed
      })

      // Only set state if something actually changed
      if (hasChanges || structuralEdges.length !== state.edges.length) {
        set({ nodes: updatedNodes, edges: structuralEdges })
      }
    } else {
      const useFocusLayout = focusedNode && !customFocusNodes
      const layoutedNodes = layoutNodes(
        flowNodes,
        structuralEdges,
        viewportDimensions,
        useFocusLayout ? focusedNode : null,
        measuredDimensions
      )
      // Only apply saved positions if NOT force-layouting
      const finalNodes = forceLayout ? layoutedNodes : layoutedNodes.map(node => {
        const savedPos = savedPositions[node.id] as { x: number; y: number } | undefined
        return savedPos ? { ...node, position: savedPos } : node
      })
      set({ nodes: finalNodes, edges: structuralEdges })
    }
  },

  clearGraph: () => {
    set({ nodes: [], edges: [], measuredDimensions: new Map() })
  },

  getViewLayoutState: () => {
    const state = get()
    const { focusedNode, projectPath, layoutStates } = state
    const viewKey = getViewKey(projectPath, focusedNode)
    return layoutStates[viewKey]
  },

  clearViewLayout: (viewKey) => {
    const state = get()
    const { focusedNode, projectPath, layoutStates } = state
    const key = viewKey ?? getViewKey(projectPath, focusedNode)
    const { [key]: _, ...remaining } = layoutStates
    set({ layoutStates: remaining })
  },

  setMeasuredDimensions: (dimensions) => {
    set({ measuredDimensions: dimensions })
  },

  updateMeasuredDimension: (nodeId, dims) => {
    set(state => {
      const newDimensions = new Map(state.measuredDimensions)
      newDimensions.set(nodeId, dims)
      return { measuredDimensions: newDimensions }
    })
  },

  relayoutWithMeasuredSizes: () => {
    const state = get()
    const { focusedNode, projectPath, layoutStates } = state
    const viewKey = getViewKey(projectPath, focusedNode)
    const { [viewKey]: _, ...remaining } = layoutStates
    set({ layoutStates: remaining, layoutNeedsMeasuredUpdate: false })
    get().rebuildGraph(true)
  },
})

// Selectors
export const graphSelectors = {
  selectNodes: (state: StoreState) => state.nodes,
  selectEdges: (state: StoreState) => state.edges,
  selectNodeById: (id: string) => (state: StoreState) => state.nodes.find(n => n.id === id),
  selectNodePosition: (id: string) => (state: StoreState) => state.nodePositions.get(id),
  selectNodeDimension: (id: string) => (state: StoreState) => state.nodeDimensions.get(id),
  selectViewport: (state: StoreState) => state.viewport,
  selectNodeCount: (state: StoreState) => state.nodes.length,
  selectEdgeCount: (state: StoreState) => state.edges.length,
}
