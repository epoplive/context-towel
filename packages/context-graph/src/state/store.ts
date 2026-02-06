// ============================================================================
// Context Graph State - Combined Store
// ============================================================================

import { createWithEqualityFn as create } from 'zustand/traditional'
import { persist, subscribeWithSelector, createJSONStorage } from 'zustand/middleware'
import { getWindowScopedStorage } from '../compat/windowStorage'

import {
  createDocumentSlice,
  createUISlice,
  createGraphSlice,
  type StoreState,
  type PersistedState,
  type Position,
  type ViewLayoutState,
} from './slices'

// Note: Plugin registration is done lazily via ensurePluginsRegistered()
// to avoid circular dependency (task/components.tsx imports useGraphStore)
// The plugins are registered on first use in DocumentGraph or via hooks.

// ----------------------------------------------------------------------------
// Storage Configuration
// ----------------------------------------------------------------------------

const STORAGE_VERSION = 5
const STORAGE_KEY = 'looking-glass-graph-state'

const persistConfig = {
  name: STORAGE_KEY,
  version: STORAGE_VERSION,
  storage: createJSONStorage(() => getWindowScopedStorage()),

  partialize: (state: StoreState): PersistedState => ({
    version: STORAGE_VERSION,
    focusedNode: state.focusedNode,
    customFocusNodes: state.customFocusNodes,
    selectedNodes: state.selectedNodes,
    expandedPanel: state.expandedPanel,
    expandedPanels: Array.from(state.expandedPanels),
    collapsedFolders: Array.from(state.collapsedFolders),
    treeWidgetFolders: Array.from(state.treeWidgetFolders),
    pinnedNodes: Array.from(state.pinnedNodes),
    lockedNodes: Array.from(state.lockedNodes),
    cardScale: state.cardScale,
    previewPanelPosition: state.previewPanelPosition,
    nodePositions: Object.fromEntries(state.nodePositions),
    viewport: state.viewport,
    layoutStates: state.layoutStates,
    taskBoardDefaults: state.taskBoardDefaults,
    taskBoardByList: state.taskBoardByList,
  }),

  merge: (persistedRaw: unknown, currentState: StoreState): StoreState => {
    const persisted = persistedRaw as PersistedState | undefined
    if (!persisted) return currentState
    const normalizedExpandedPanel =
      persisted.expandedPanel === 'graph' || persisted.expandedPanel === ''
        ? null
        : persisted.expandedPanel

    return {
      ...currentState,
      focusedNode: persisted.focusedNode ?? currentState.focusedNode,
      customFocusNodes: persisted.customFocusNodes ?? currentState.customFocusNodes,
      selectedNodes: persisted.selectedNodes ?? currentState.selectedNodes,
      expandedPanel: normalizedExpandedPanel !== undefined ? normalizedExpandedPanel : currentState.expandedPanel,
      cardScale: persisted.cardScale ?? currentState.cardScale,
      previewPanelPosition: persisted.previewPanelPosition ?? currentState.previewPanelPosition,
      expandedPanels: new Set(persisted.expandedPanels ?? []),
      collapsedFolders: new Set(persisted.collapsedFolders ?? []),
      treeWidgetFolders: new Set(persisted.treeWidgetFolders ?? []),
      pinnedNodes: new Set(persisted.pinnedNodes ?? []),
      lockedNodes: new Set(persisted.lockedNodes ?? []),
      nodePositions: new Map(Object.entries(persisted.nodePositions ?? {}) as [string, Position][]),
      viewport: persisted.viewport ?? currentState.viewport,
      layoutStates: persisted.layoutStates ?? currentState.layoutStates,
      taskBoardDefaults: persisted.taskBoardDefaults ?? currentState.taskBoardDefaults,
      taskBoardByList: persisted.taskBoardByList ?? currentState.taskBoardByList,
    }
  },

  migrate: (persistedState: unknown, version: number): PersistedState | Promise<PersistedState> => {
    const state = persistedState as PersistedState & { taskBoardPrefs?: PersistedState['taskBoardDefaults'] }
    const withDefaults = (defaults: PersistedState['taskBoardDefaults']) => ({
      focus: {
        view: defaults?.focus?.view ?? 'board',
        groupBy: defaults?.focus?.groupBy ?? 'none',
        columnCount: defaults?.focus?.columnCount ?? 1,
        dependencyHeight: defaults?.focus?.dependencyHeight ?? 360,
        dependencyCardWidth: defaults?.focus?.dependencyCardWidth ?? 190,
        dependencyScrollX: defaults?.focus?.dependencyScrollX ?? 0,
        dependencyScrollY: defaults?.focus?.dependencyScrollY ?? 0,
        dependencyWidth: defaults?.focus?.dependencyWidth ?? 0,
      },
      normal: {
        view: defaults?.normal?.view ?? 'list',
        groupBy: defaults?.normal?.groupBy ?? 'none',
        columnCount: defaults?.normal?.columnCount ?? 1,
        dependencyHeight: defaults?.normal?.dependencyHeight ?? 360,
        dependencyCardWidth: defaults?.normal?.dependencyCardWidth ?? 190,
        dependencyScrollX: defaults?.normal?.dependencyScrollX ?? 0,
        dependencyScrollY: defaults?.normal?.dependencyScrollY ?? 0,
        dependencyWidth: defaults?.normal?.dependencyWidth ?? 0,
      },
    })

    if (version === 0) {
      return {
        ...state,
        version: 5,
        selectedNodes: state.selectedNodes ?? [],
        taskBoardDefaults: withDefaults(state.taskBoardDefaults ?? state.taskBoardPrefs),
        taskBoardByList: state.taskBoardByList ?? {},
      }
    }
    if (version === 1) {
      return {
        ...state,
        version: 5,
        taskBoardDefaults: withDefaults(state.taskBoardDefaults ?? state.taskBoardPrefs),
        taskBoardByList: state.taskBoardByList ?? {},
      }
    }
    if (version === 2) {
      return {
        ...state,
        version: 5,
        taskBoardDefaults: withDefaults(state.taskBoardDefaults),
      }
    }
    if (version === 3) {
      return {
        ...state,
        version: 5,
        taskBoardDefaults: withDefaults(state.taskBoardDefaults),
      }
    }
    if (version === 4) {
      return {
        ...state,
        version: 5,
        pinnedNodes: state.pinnedNodes ?? [],
        lockedNodes: state.lockedNodes ?? [],
      }
    }
    return state
  },
}

// ----------------------------------------------------------------------------
// Combined Store
// ----------------------------------------------------------------------------

export const useGraphStore = create<StoreState>()(
  subscribeWithSelector(
    persist(
      (...args) => ({
        ...createDocumentSlice(...args),
        ...createUISlice(...args),
        ...createGraphSlice(...args),
      }),
      persistConfig
    )
  )
)

// ----------------------------------------------------------------------------
// Debounced Graph Sync
// ----------------------------------------------------------------------------

let syncTimeout: ReturnType<typeof setTimeout> | null = null
const SYNC_DEBOUNCE_MS = 100

useGraphStore.subscribe(
  (state) => ({
    treeItems: state.treeItems,
    docContents: state.docContents,
    focusedNode: state.focusedNode,
    collapsedFolders: state.collapsedFolders,
    treeWidgetFolders: state.treeWidgetFolders,
  }),
  (current, prev) => {
    if (syncTimeout) clearTimeout(syncTimeout)

    // Check if focus changed - needs full rebuild with layout
    const focusChanged = current.focusedNode !== prev.focusedNode

    syncTimeout = setTimeout(() => {
      const store = useGraphStore.getState()
      if (focusChanged) {
        // Clear layout state and force rebuild when focus changes
        store.clearViewLayout()
        store.rebuildGraph(true)
      } else {
        store.syncGraph()
      }
    }, SYNC_DEBOUNCE_MS)
  },
  {
    equalityFn: (a, b) => {
      return (
        a.treeItems === b.treeItems &&
        a.docContents === b.docContents &&
        a.focusedNode === b.focusedNode &&
        setsEqual(a.collapsedFolders, b.collapsedFolders) &&
        setsEqual(a.treeWidgetFolders, b.treeWidgetFolders)
      )
    },
  }
)

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const item of a) {
    if (!b.has(item)) return false
  }
  return true
}

// ----------------------------------------------------------------------------
// Utilities
// ----------------------------------------------------------------------------

export function getStoreSnapshot(): StoreState {
  return useGraphStore.getState()
}

export function resetStore(): void {
  const { nodePositions, viewport, layoutStates } = useGraphStore.getState()
  useGraphStore.setState({
    projectPath: null,
    treeItems: [],
    docContents: new Map(),
    contentHashes: new Map(),
    focusedNode: null,
    customFocusNodes: null,
    selectedNodes: [],
    quickPreviewNode: null,
    expandedPanels: new Set(),
    collapsedFolders: new Set(),
    treeWidgetFolders: new Set(),
    pinnedNodes: new Set(),
    lockedNodes: new Set(),
    cardScale: 1,
    previewPanelPosition: { x: 100, y: 100 },
    contextMenu: null,
    nodePositions,
    viewport,
    layoutStates,
    nodes: [],
    edges: [],
    nodeDimensions: new Map(),
  })
}

export function clearPersistedState(): void {
  const storage = typeof window !== 'undefined' ? getWindowScopedStorage() : null
  if (!storage || typeof storage.removeItem !== 'function') {
    return
  }
  storage.removeItem(STORAGE_KEY)
}

export type { StoreState, ViewLayoutState }
