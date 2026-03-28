/**
 * GraphStore — unified Zustand store for graph state.
 *
 * Manages nodes, edges, viewport, selection, focus, and interaction state.
 * Can be used standalone or injected into GraphCanvas.
 */

import { createStore, type StoreApi } from 'zustand/vanilla'
import type {
  LayoutPosition,
  LayoutDimensions,
  ContextMenuItem,
} from './types'

// ─── State ────────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string
  type: string
  position: LayoutPosition
  data: Record<string, unknown>
  pinned?: boolean
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  edgeType: string
  data?: Record<string, unknown>
}

export interface GraphViewport {
  x: number
  y: number
  zoom: number
}

export interface ContextMenuState {
  x: number
  y: number
  nodeId: string
  nodeType: string
  items: ContextMenuItem[]
}

export interface GraphStoreState {
  // ─── Data ───────────────────────────────────────────────────
  nodes: GraphNode[]
  edges: GraphEdge[]

  // ─── Viewport ───────────────────────────────────────────────
  viewport: GraphViewport
  viewportDimensions: LayoutDimensions

  // ─── Selection & Focus ──────────────────────────────────────
  selectedNodes: string[]
  focusedNode: string | null
  pinnedNodes: Set<string>
  lockedNodes: Set<string>

  // ─── Measurements ───────────────────────────────────────────
  measuredDimensions: Map<string, LayoutDimensions>

  // ─── UI ─────────────────────────────────────────────────────
  cardScale: number
  contextMenu: ContextMenuState | null
  quickPreviewNode: string | null

  // ─── Actions ────────────────────────────────────────────────
  setNodes: (nodes: GraphNode[]) => void
  setEdges: (edges: GraphEdge[]) => void
  updateNodePosition: (id: string, position: LayoutPosition) => void
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void

  setViewport: (viewport: GraphViewport) => void
  setViewportDimensions: (dims: LayoutDimensions) => void

  selectNode: (id: string) => void
  setSelectedNodes: (ids: string[]) => void
  clearSelection: () => void
  setFocusedNode: (id: string | null) => void
  togglePinNode: (id: string) => void
  toggleLockNode: (id: string) => void

  setMeasuredDimension: (id: string, dims: LayoutDimensions) => void
  setMeasuredDimensions: (dims: Map<string, LayoutDimensions>) => void

  setCardScale: (scale: number) => void
  increaseCardScale: () => void
  decreaseCardScale: () => void
  showContextMenu: (menu: ContextMenuState) => void
  closeContextMenu: () => void
  setQuickPreviewNode: (id: string | null) => void
}

// ─── Store Factory ────────────────────────────────────────────────────────────

export function createGraphStore(
  initialState?: Partial<Pick<GraphStoreState, 'nodes' | 'edges' | 'cardScale'>>,
): StoreApi<GraphStoreState> {
  return createStore<GraphStoreState>((set) => ({
    // Initial state
    nodes: initialState?.nodes ?? [],
    edges: initialState?.edges ?? [],
    viewport: { x: 0, y: 0, zoom: 1 },
    viewportDimensions: { width: 1200, height: 800 },
    selectedNodes: [],
    focusedNode: null,
    pinnedNodes: new Set(),
    lockedNodes: new Set(),
    measuredDimensions: new Map(),
    cardScale: initialState?.cardScale ?? 1.0,
    contextMenu: null,
    quickPreviewNode: null,

    // Actions
    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),

    updateNodePosition: (id, position) =>
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
      })),

    updateNodeData: (id, data) =>
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
        ),
      })),

    setViewport: (viewport) => set({ viewport }),
    setViewportDimensions: (viewportDimensions) => set({ viewportDimensions }),

    selectNode: (id) =>
      set((s) => ({
        selectedNodes: s.selectedNodes.includes(id)
          ? s.selectedNodes
          : [...s.selectedNodes, id],
      })),

    setSelectedNodes: (ids) => set({ selectedNodes: ids }),
    clearSelection: () => set({ selectedNodes: [] }),
    setFocusedNode: (id) => set({ focusedNode: id }),

    togglePinNode: (id) =>
      set((s) => {
        const next = new Set(s.pinnedNodes)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return { pinnedNodes: next }
      }),

    toggleLockNode: (id) =>
      set((s) => {
        const next = new Set(s.lockedNodes)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return { lockedNodes: next }
      }),

    setMeasuredDimension: (id, dims) =>
      set((s) => {
        const next = new Map(s.measuredDimensions)
        next.set(id, dims)
        return { measuredDimensions: next }
      }),

    setMeasuredDimensions: (dims) => set({ measuredDimensions: dims }),

    setCardScale: (scale) => set({ cardScale: Math.max(0.1, Math.min(2.0, scale)) }),
    increaseCardScale: () =>
      set((s) => ({ cardScale: Math.min(2.0, s.cardScale + 0.1) })),
    decreaseCardScale: () =>
      set((s) => ({ cardScale: Math.max(0.1, s.cardScale - 0.1) })),

    showContextMenu: (menu) => set({ contextMenu: menu }),
    closeContextMenu: () => set({ contextMenu: null }),
    setQuickPreviewNode: (id) => set({ quickPreviewNode: id }),
  }))
}
