// ============================================================================
// Context Graph State - UI Slice
// ============================================================================

import type { UISlice, SliceCreator, ContextMenuItem } from './types'

// Default context menu items based on node type
function getContextMenuItems(nodeType: string): ContextMenuItem[] {
  const base: ContextMenuItem[] = [
    { label: 'Open in Panel', action: 'openPanel', icon: 'panel' },
    { label: 'Focus', action: 'focus', icon: 'focus' },
    { label: 'Pin/Unpin', action: 'pin', icon: 'pin' },
    { label: 'Lock/Unlock', action: 'lock', icon: 'lock' },
    { label: 'Ignore', action: 'ignore', icon: 'hide' },
  ]

  if (nodeType === 'folder') {
    return [
      ...base,
      { label: 'divider', action: '', divider: true },
      { label: 'Collapse', action: 'collapse', icon: 'collapse' },
      { label: 'Show as Tree', action: 'treeWidget', icon: 'tree' },
    ]
  }

  if (nodeType === 'document') {
    return [
      ...base,
      { label: 'divider', action: '', divider: true },
      { label: 'Open in Editor', action: 'openEditor', icon: 'edit' },
    ]
  }

  if (nodeType === 'filetree') {
    return [
      { label: 'Expand Folder', action: 'expandFolder', icon: 'expand' },
      { label: 'Focus', action: 'focus', icon: 'focus' },
    ]
  }

  if (nodeType === 'treeitem-file') {
    return [
      { label: 'Open in Editor', action: 'openEditor', icon: 'edit' },
      { label: 'Open in Panel', action: 'openPanel', icon: 'panel' },
      { label: 'divider', action: '', divider: true },
      { label: 'Focus', action: 'focus', icon: 'focus' },
      { label: 'Pin/Unpin', action: 'pin', icon: 'pin' },
      { label: 'Ignore', action: 'ignore', icon: 'hide' },
    ]
  }

  if (nodeType === 'treeitem-folder') {
    return [
      { label: 'Focus', action: 'focus', icon: 'focus' },
      { label: 'Pin/Unpin', action: 'pin', icon: 'pin' },
      { label: 'Ignore', action: 'ignore', icon: 'hide' },
    ]
  }

  if (nodeType === 'link-stub') {
    return [
      { label: 'Follow Link', action: 'followLink', icon: 'link' },
      { label: 'Open Preview', action: 'openLinkPreview', icon: 'visible' },
      { label: 'Open in Panel', action: 'openLinkPanel', icon: 'panel' },
      { label: 'Open in Editor', action: 'openLinkEditor', icon: 'edit' },
    ]
  }

  return base
}

export const createUISlice: SliceCreator<UISlice> = (set, get) => ({
  // Initial state
  focusedNode: null,
  customFocusNodes: null,
  selectedNodes: [],
  quickPreviewNode: null,
  expandedPanel: null,
  expandedPanels: new Set(),
  collapsedFolders: new Set(),
  treeWidgetFolders: new Set(),
  pinnedNodes: new Set(),
  lockedNodes: new Set(),
  cardScale: 1,
  previewPanelPosition: { x: 100, y: 100 },
  contextMenu: null,
  taskBoardDefaults: {
    focus: {
      view: 'board',
      groupBy: 'none',
      columnCount: 1,
      dependencyHeight: 360,
      dependencyCardWidth: 190,
      dependencyScrollX: 0,
      dependencyScrollY: 0,
      dependencyWidth: 0,
    },
    normal: {
      view: 'list',
      groupBy: 'none',
      columnCount: 1,
      dependencyHeight: 360,
      dependencyCardWidth: 190,
      dependencyScrollX: 0,
      dependencyScrollY: 0,
      dependencyWidth: 0,
    },
  },
  taskBoardByList: {},

  // Actions
  setFocusedNode: (id, customNodes = null) => {
    set({
      focusedNode: id,
      customFocusNodes: customNodes,
      quickPreviewNode: null,
    })
  },

  getFocusBreadcrumbs: () => {
    const { focusedNode, treeItems } = get() as { focusedNode: string | null; treeItems: { id: string }[] }
    if (!focusedNode) return []

    const breadcrumbs: string[] = ['CLAUDE.md']
    const parts = focusedNode.split('/')

    for (let i = 1; i <= parts.length; i++) {
      const ancestorId = parts.slice(0, i).join('/')
      if (treeItems.some(item => item.id === ancestorId)) {
        if (!breadcrumbs.includes(ancestorId)) {
          breadcrumbs.push(ancestorId)
        }
      }
    }

    if (!breadcrumbs.includes(focusedNode)) {
      breadcrumbs.push(focusedNode)
    }

    return breadcrumbs
  },

  selectNode: (id) => {
    const { selectedNodes } = get()
    if (selectedNodes.includes(id)) {
      set({ selectedNodes: selectedNodes.filter(n => n !== id) })
    } else {
      set({ selectedNodes: [...selectedNodes, id] })
    }
  },

  setSelectedNodes: (ids) => {
    set({ selectedNodes: ids })
  },

  clearSelection: () => {
    set({ selectedNodes: [] })
  },

  setQuickPreviewNode: (id) => {
    set({ quickPreviewNode: id })
  },

  openFullView: (id) => {
    set(state => {
      const next = new Set(state.expandedPanels)
      next.add(id)
      // Also add to selectedNodes so it shows in the accordion
      const nextSelected = state.selectedNodes.includes(id)
        ? state.selectedNodes
        : [...state.selectedNodes, id]
      return {
        expandedPanels: next,
        expandedPanel: id,
        selectedNodes: nextSelected,
        quickPreviewNode: null, // Close preview when opening full view
      }
    })
  },

  closeNode: (id) => {
    set(state => {
      const next = new Set(state.expandedPanels)
      next.delete(id)
      const nextSelected = state.selectedNodes.filter(nodeId => nodeId !== id)
      const newExpandedPanel = state.expandedPanel === id
        ? (next.size > 0 ? Array.from(next)[next.size - 1] : null)
        : state.expandedPanel
      return {
        expandedPanels: next,
        expandedPanel: newExpandedPanel,
        selectedNodes: nextSelected,
        quickPreviewNode: state.quickPreviewNode === id ? null : state.quickPreviewNode,
      }
    })
  },

  setExpandedPanel: (id) => {
    set({ expandedPanel: id })
  },

  togglePanel: (id) => {
    set(state => {
      const next = new Set(state.expandedPanels)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return {
        expandedPanels: next,
        expandedPanel: next.has(id) ? id : (next.size > 0 ? Array.from(next)[0] : null),
      }
    })
  },

  toggleFolderCollapse: (id) => {
    set(state => {
      const next = new Set(state.collapsedFolders)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return { collapsedFolders: next }
    })
  },

  toggleTreeWidget: (folderId) => {
    set(state => {
      const next = new Set(state.treeWidgetFolders)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return { treeWidgetFolders: next }
    })
  },

  setTreeWidgetFolders: (folders) => {
    set({ treeWidgetFolders: folders })
  },

  togglePinnedNode: (id) => {
    set(state => {
      const next = new Set(state.pinnedNodes)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return { pinnedNodes: next }
    })
  },

  setPinnedNodes: (nodes) => {
    set({ pinnedNodes: nodes })
  },

  toggleLockedNode: (id) => {
    set(state => {
      const next = new Set(state.lockedNodes)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return { lockedNodes: next }
    })
  },

  setLockedNodes: (nodes) => {
    set({ lockedNodes: nodes })
  },

  setCardScale: (scale) => {
    set({ cardScale: Math.max(0.5, Math.min(2, scale)) })
  },

  increaseCardScale: () => {
    set(state => ({ cardScale: Math.min(2, state.cardScale + 0.1) }))
  },

  decreaseCardScale: () => {
    set(state => ({ cardScale: Math.max(0.5, state.cardScale - 0.1) }))
  },

  setPreviewPanelPosition: (position) => {
    set({ previewPanelPosition: position })
  },

  showContextMenu: (x, y, nodeId, nodeType) => {
    set({
      contextMenu: {
        x,
        y,
        nodeId,
        nodeType,
        items: getContextMenuItems(nodeType),
      },
    })
  },

  closeContextMenu: () => {
    set({ contextMenu: null })
  },

  setTaskBoardPrefs: (taskListId, prefs) => {
    set(state => ({
      taskBoardByList: {
        ...state.taskBoardByList,
        [taskListId]: { ...state.taskBoardByList[taskListId], ...prefs },
      },
    }))
  },
})

// Selectors
export const uiSelectors = {
  selectFocusedNode: (state: { focusedNode: string | null }) => state.focusedNode,
  selectCustomFocusNodes: (state: { customFocusNodes: string[] | null }) => state.customFocusNodes,
  selectSelectedNodes: (state: { selectedNodes: string[] }) => state.selectedNodes,
  selectQuickPreviewNode: (state: { quickPreviewNode: string | null }) => state.quickPreviewNode,
  selectExpandedPanel: (state: { expandedPanel: string | null }) => state.expandedPanel,
  selectExpandedPanels: (state: { expandedPanels: Set<string> }) => state.expandedPanels,
  selectCollapsedFolders: (state: { collapsedFolders: Set<string> }) => state.collapsedFolders,
  selectTreeWidgetFolders: (state: { treeWidgetFolders: Set<string> }) => state.treeWidgetFolders,
  selectPinnedNodes: (state: { pinnedNodes: Set<string> }) => state.pinnedNodes,
  selectLockedNodes: (state: { lockedNodes: Set<string> }) => state.lockedNodes,
  selectCardScale: (state: { cardScale: number }) => state.cardScale,
  selectPreviewPanelPosition: (state: { previewPanelPosition: { x: number; y: number } }) => state.previewPanelPosition,
  selectContextMenu: (state: { contextMenu: import('./types').ContextMenuState | null }) => state.contextMenu,
  selectIsPanelExpanded: (id: string) => (state: { expandedPanels: Set<string> }) => state.expandedPanels.has(id),
  selectIsFolderCollapsed: (id: string) => (state: { collapsedFolders: Set<string> }) => state.collapsedFolders.has(id),
  selectIsTreeWidget: (id: string) => (state: { treeWidgetFolders: Set<string> }) => state.treeWidgetFolders.has(id),
  selectIsNodeSelected: (id: string) => (state: { selectedNodes: string[] }) => state.selectedNodes.includes(id),
}
