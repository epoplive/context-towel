import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ConnectionMode,
  SelectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useContextGraphController } from '../hooks/useContextGraphController'
import { useGraphStore } from '../state/store'
import { scopeManager } from '../compat/keybindings'
import { FullscreenModal, type CodeViewerComponent, type FullscreenModalState } from '@context-towel/markdown'
import { nodeTypes, edgeTypes } from './FlowNodes'
import { GraphControlPanel } from './document-graph/GraphControlPanel'
import { QuickPreview } from './document-graph/QuickPreview'
import { buildNodesWithHandlers } from './document-graph/nodesWithHandlers'
import { useDocumentGraphHandlers } from './document-graph/useDocumentGraphHandlers'
import { useGraphNavigation } from './document-graph/useGraphNavigation'
import { FocusBreadcrumbs } from './document-graph/panels/FocusBreadcrumbs'
import { GraphControlPopovers } from './document-graph/panels/GraphControlPopovers'
import { GraphContextMenu } from './document-graph/panels/GraphContextMenu'
import { DocumentPanels } from './document-graph/panels/DocumentPanels'
import { SelectionPanel } from './document-graph/panels/SelectionPanel'
import {
  getBaseName,
  getParentDir,
  normalizeFsPath,
  normalizeRootPath,
  remapTreeItems,
  type GraphRoot,
} from './document-graph/paths'
import type { TreeItem } from '../types'
import { useTheme, useMermaidTheme, Editor } from '../compat/design-system'
import { useWindowVisibility } from '../compat/useWindowVisibility'
import { layoutPrimitives } from '../compat/layoutPrimitives'
import type { ThemeTokens } from '@context-towel/card-library'
import {
  ProjectSettings,
  getContextFolderPath,
  getWorkspaceFolderId,
  matchesFolderId,
  normalizeProjectSettings,
} from '../compat/project-settings'
import { getDocType, getFolderType } from '../state/layoutUtils'

export interface DocumentGraphProps {
  projectPath?: string
  projectSettings?: ProjectSettings
  onOpenFile?: (filePath: string, lineNumber?: number) => void
  activeProblem?: string | null
  onSelectProblem?: (problemFilePath: string) => void
  graphRoots?: GraphRoot[]
  scopeId?: string
  isVisible?: boolean
  CodeViewer?: CodeViewerComponent
}

export type { GraphRoot } from './document-graph/paths'

export function DocumentGraph({
  projectPath,
  projectSettings,
  onOpenFile,
  graphRoots: providedGraphRoots,
  scopeId,
  isVisible = true,
  CodeViewer,
}: DocumentGraphProps) {
  const { colors, typography, radius, isDark } = useTheme()
  const controller = useContextGraphController()
  const { isHidden } = useWindowVisibility()
  const isActive = isVisible && !isHidden

  // Initialize mermaid with current theme (re-initializes on theme change)
  useMermaidTheme()

  // Allow the host to supply its own Monaco wrapper. Fall back to the internal
  // compat Editor so the extracted graph can run standalone.
  const ResolvedCodeViewer = CodeViewer ?? Editor

  const markdownTheme = useMemo<ThemeTokens>(() => ({
    bgPrimary: colors.bgPrimary,
    bgSecondary: colors.bgSecondary,
    bgTertiary: colors.bgTertiary,
    borderPrimary: colors.borderPrimary,
    borderSecondary: colors.borderSecondary,
    textPrimary: colors.textPrimary,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    textInverse: colors.textInverse,
    accent: colors.accent,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    fontMono: typography.fontFamily.mono,
    fontSans: typography.fontFamily.sans,
    radius: radius.md,
  }), [colors, typography, radius])

  // Store state
  const {
    treeItems,
    docContents,
    selectedNodes,
    expandedPanel,
    quickPreviewNode,
    focusedNode,
    customFocusNodes,
    collapsedFolders,
    pinnedNodes,
    lockedNodes,
    cardScale,
    contextMenu,
    nodes: storeNodes,
    edges: storeEdges,
    setProjectPath,
    setTreeItems,
    setDocContentParsed,
    setProjectSettings,
    closeNode,
    setExpandedPanel,
    toggleFolderCollapse,
    toggleTreeWidget,
    rebuildGraph,
    setQuickPreviewNode,
    openFullView,
    setFocusedNode,
    getFocusBreadcrumbs,
    updateNodePosition,
    increaseCardScale,
    decreaseCardScale,
    setViewportDimensions,
    showContextMenu,
    closeContextMenu,
    previewPanelPosition,
    setPreviewPanelPosition,
    clearViewLayout,
    setMeasuredDimensions,
    togglePinnedNode,
    toggleLockedNode,
    setPinnedNodes,
    setLockedNodes,
  } = useGraphStore()

  const resolvedSettings = useMemo(() => normalizeProjectSettings(projectSettings), [projectSettings])
  const [externalRoots, setExternalRoots] = useState<GraphRoot[]>([])
  const [pendingLinkOpen, setPendingLinkOpen] = useState<{ path: string; action: 'panel' | 'preview' } | null>(null)
  const baseFolders = useMemo(() => ([
    resolvedSettings.folders.working,
    resolvedSettings.folders.docs,
    resolvedSettings.folders.archive,
  ] as const).map(folder => folder?.trim()).filter((value): value is string => Boolean(value)), [resolvedSettings])
  const computedGraphRoots = useMemo<GraphRoot[]>(() => {
    if (!projectPath) return []
    const roots = new Map<string, GraphRoot>()

    const addRootEntry = (id: string, path: string) => {
      const normalizedPath = normalizeRootPath(path)
      if (!normalizedPath || roots.has(normalizedPath)) return
      roots.set(normalizedPath, {
        id,
        path: normalizedPath,
        baseName: getBaseName(normalizedPath),
      })
    }

    baseFolders.forEach(folder => {
      addRootEntry(getWorkspaceFolderId(folder), getContextFolderPath(projectPath, folder))
    })
    externalRoots.forEach(root => {
      addRootEntry(root.id, root.path)
    })

    return Array.from(roots.values())
  }, [projectPath, baseFolders, externalRoots])
  const resolvedGraphRoots = useMemo<GraphRoot[]>(
    () => providedGraphRoots ?? computedGraphRoots,
    [providedGraphRoots, computedGraphRoots]
  )
  const viewScopeKey = useMemo(
    () => scopeId ?? projectPath ?? null,
    [scopeId, projectPath]
  )
  const rootItemsRef = useRef<Map<string, TreeItem[]>>(new Map())
  const rootByPathRef = useRef<Map<string, GraphRoot>>(new Map())
  const treeItemsRef = useRef<TreeItem[]>([])

  useEffect(() => {
    treeItemsRef.current = treeItems
  }, [treeItems])

  const loadParsedDoc = useCallback(async (item: TreeItem) => {
    if (item.is_dir) return
    const cached = controller.getCachedFile(item.path)
    const parsed = cached ?? await controller.loadParsedFile(item.path)
    if (parsed) {
      setDocContentParsed(item.id, parsed)
    }
  }, [controller, setDocContentParsed])

  const addExternalRootForPath = useCallback((targetPath: string) => {
    const normalized = normalizeFsPath(targetPath)
    const rootPath = normalizeRootPath(getParentDir(normalized))
    if (!rootPath) return
    setExternalRoots(prev => {
      if (prev.some(root => normalizeRootPath(root.path) === rootPath)) return prev
      return [
        ...prev,
        {
          id: getWorkspaceFolderId(rootPath),
          path: rootPath,
          baseName: getBaseName(rootPath),
        },
      ]
    })
  }, [])

  const findRootForPath = useCallback((path: string): GraphRoot | null => {
    let match: GraphRoot | null = null
    rootByPathRef.current.forEach((root) => {
      if (path === root.path || path.startsWith(`${root.path}/`)) {
        if (!match || root.path.length > match.path.length) {
          match = root
        }
      }
    })
    return match
  }, [])

  // Store React Flow instance ref for fitView
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reactFlowInstance = useRef<any>(null)

  // Container ref for viewport dimension tracking
  const containerRef = useRef<HTMLDivElement>(null)

  // Track viewport dimensions for ELK aspect ratio layout
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setViewportDimensions({ width, height })
        }
      }
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [setViewportDimensions])

  // Auto-fit view when focus mode changes
  const prevFocusedNode = useRef(focusedNode)
  useEffect(() => {
    if (!isActive) return
    if (focusedNode !== prevFocusedNode.current) {
      prevFocusedNode.current = focusedNode
      setIsZoomedToNode(false) // Reset zoom state when focus changes
      // Delay to allow layout to complete
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, duration: 300 })
      }, 150)
    }
  }, [focusedNode, isActive])

  // React Flow state (synced from store)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Fullscreen modal state - rendered at this level to escape Panel clipping
  const [fullscreenState, setFullscreenState] = useState<FullscreenModalState>({ open: false, type: null, content: '' })
  const handleFullscreen = useCallback((state: FullscreenModalState) => setFullscreenState(state), [])
  const closeFullscreen = useCallback(() => setFullscreenState({ open: false, type: null, content: '' }), [])

  // Multi-select state for custom focus views
  const [multiSelectedNodes, setMultiSelectedNodes] = useState<string[]>([])

  // Track which section to show in popover (for section node clicks)
  const [previewSectionIndex, setPreviewSectionIndex] = useState(0)

  // Track if graph container is focused (for subtle visual indicator)
  const [isGraphFocused, setIsGraphFocused] = useState(false)

  // Track keyboard navigation state
  const [keyboardSelectedIndex, setKeyboardSelectedIndex] = useState(-1)
  const [isZoomedToNode, setIsZoomedToNode] = useState(false)

  const [docTypeFilters, setDocTypeFilters] = useState<Record<'core' | 'research' | 'spike' | 'other', boolean>>({
    core: true,
    research: true,
    spike: true,
    other: true,
  })
  const [showLegend, setShowLegend] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showAllLinks, setShowAllLinks] = useState(false)
  const [showIgnored, setShowIgnored] = useState(false)
  const [showPinned, setShowPinned] = useState(false)
  const [ignoredNodes, setIgnoredNodes] = useState<string[]>([])

  const docTypeOptions = useMemo(() => ([
    { key: 'core' as const, label: 'Core', color: colors.graphCore },
    { key: 'research' as const, label: 'Docs', color: colors.graphResearch },
    { key: 'spike' as const, label: 'Archive', color: colors.graphSpike },
    { key: 'other' as const, label: 'Other', color: colors.textSecondary },
  ]), [colors])

  useGraphNavigation({
    reactFlowInstance,
    quickPreviewNode,
    nodes,
    setNodes,
    keyboardSelectedIndex,
    setKeyboardSelectedIndex,
    isZoomedToNode,
    setIsZoomedToNode,
    increaseCardScale,
    decreaseCardScale,
  })

  // Sync store nodes/edges to React Flow, preserving measured dimensions and object identity
  const docTypeMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getDocType>>()
    treeItems.forEach((item) => {
      map.set(item.id, getDocType(item.id, resolvedSettings))
    })
    return map
  }, [treeItems, resolvedSettings])

  const resolveNodeDocType = useCallback((node: Node): ReturnType<typeof getDocType> | null => {
    const rawType = node.data?.type as string | undefined
    if (rawType) {
      if (rawType === 'archive') return 'spike'
      if (rawType === 'core' || rawType === 'research' || rawType === 'spike' || rawType === 'other') {
        return rawType
      }
    }
    const parentDocId = node.data?.parentDocId as string | undefined
    if (parentDocId && docTypeMap.has(parentDocId)) {
      return docTypeMap.get(parentDocId) ?? null
    }
    const baseId = node.id.split('#')[0]
    if (docTypeMap.has(baseId)) {
      return docTypeMap.get(baseId) ?? null
    }
    return null
  }, [docTypeMap])

  const ignoredEntries = useMemo(() => ignoredNodes.map((id) => {
    const item = treeItems.find(entry => entry.id === id)
    return {
      id,
      label: item?.name ?? id,
    }
  }), [ignoredNodes, treeItems])

  const pinnedEntries = useMemo(() => Array.from(pinnedNodes).map((id) => {
    const item = treeItems.find(entry => entry.id === id)
    return {
      id,
      label: item?.name ?? id,
    }
  }), [pinnedNodes, treeItems])

  const filteredStoreNodes = useMemo(() => {
    const hasFilters = Object.values(docTypeFilters).some(value => !value)
    const hasIgnored = ignoredNodes.length > 0
    if (!hasFilters && !hasIgnored) return storeNodes

    const ignoredSet = new Set(ignoredNodes)
    return storeNodes.filter((node) => {
      if (ignoredSet.has(node.id)) return false
      for (const ignored of ignoredSet) {
        if (ignored && node.id.startsWith(`${ignored}/`)) return false
      }
      const parentDocId = node.data?.parentDocId as string | undefined
      if (parentDocId && ignoredSet.has(parentDocId)) return false
      if (pinnedNodes.has(node.id)) return true
      if (parentDocId && pinnedNodes.has(parentDocId)) return true
      const docType = resolveNodeDocType(node)
      if (!docType) return true
      return docTypeFilters[docType]
    })
  }, [docTypeFilters, ignoredNodes, pinnedNodes, resolveNodeDocType, storeNodes])

  const filteredStoreEdges = useMemo(() => {
    const nodeIds = new Set(filteredStoreNodes.map(node => node.id))
    const isFocusMode = Boolean(focusedNode || (customFocusNodes && customFocusNodes.length > 0))
    const allowAllLinks = showAllLinks || isFocusMode
    return storeEdges.filter(edge => {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return false
      if (edge.data?.edgeType !== 'link') return true
      if (allowAllLinks) return true

      const sourceWorking = matchesFolderId(edge.source, resolvedSettings.folders.working)
      const targetWorking = matchesFolderId(edge.target, resolvedSettings.folders.working)
      return sourceWorking && !targetWorking
    })
  }, [filteredStoreNodes, storeEdges, focusedNode, customFocusNodes, showAllLinks, resolvedSettings])

  const contextMenuItems = useMemo(() => {
    if (!contextMenu) return []

    const item = treeItems.find(entry => entry.id === contextMenu.nodeId)
    const isDir = item?.is_dir ?? false
    const isFile = Boolean(item && !item.is_dir)
    const nodeType = contextMenu.nodeType
    const isPinned = pinnedNodes.has(contextMenu.nodeId)
    const isLocked = lockedNodes.has(contextMenu.nodeId)
    const isIgnored = ignoredNodes.includes(contextMenu.nodeId)
    const folderType = isDir ? getFolderType(contextMenu.nodeId, resolvedSettings) : null
    const isWorkingFolder = folderType === 'core'

    const canOpenEditor = isFile && Boolean(onOpenFile)
    const canOpenPanel = isFile
    const canCollapse = isDir && nodeType === 'folder'
    const canTreeWidget = isDir && nodeType === 'folder' && !isWorkingFolder
    const canExpandFolder = nodeType === 'filetree'

    const mapped = contextMenu.items.flatMap(menuItem => {
      if (menuItem.divider) return [menuItem]
      switch (menuItem.action) {
        case 'openEditor':
          return canOpenEditor ? [menuItem] : []
        case 'openPanel':
          return canOpenPanel ? [menuItem] : []
        case 'collapse':
          return canCollapse ? [menuItem] : []
        case 'treeWidget':
          return canTreeWidget ? [menuItem] : []
        case 'expandFolder':
          return canExpandFolder ? [menuItem] : []
        default:
          return [menuItem]
      }
    }).map(menuItem => {
      if (menuItem.divider) return menuItem
      let label = menuItem.label
      if (menuItem.action === 'pin') label = isPinned ? 'Unpin' : 'Pin'
      if (menuItem.action === 'lock') label = isLocked ? 'Unlock position' : 'Lock position'
      if (menuItem.action === 'ignore') label = isIgnored ? 'Unignore' : 'Ignore'
      if (menuItem.action === 'collapse') label = collapsedFolders.has(contextMenu.nodeId) ? 'Expand' : 'Collapse'
      if (menuItem.action === 'expandFolder') label = 'Show as Folder'
      return { ...menuItem, label }
    })

    const compact: typeof mapped = []
    mapped.forEach(menuItem => {
      if (menuItem.divider) {
        if (compact.length === 0 || compact[compact.length - 1].divider) return
        compact.push(menuItem)
      } else {
        compact.push(menuItem)
      }
    })
    if (compact.length > 0 && compact[compact.length - 1].divider) {
      compact.pop()
    }

    return compact
  }, [
    contextMenu,
    treeItems,
    pinnedNodes,
    lockedNodes,
    ignoredNodes,
    onOpenFile,
    resolvedSettings,
    collapsedFolders,
  ])

  useEffect(() => {
    setNodes(currentNodes => {
      const newIds = new Set(filteredStoreNodes.map(n => n.id))
      const currentIds = new Set(currentNodes.map(n => n.id))

      // Check if structure actually changed
      const structureChanged = newIds.size !== currentIds.size ||
        [...newIds].some(id => !currentIds.has(id))

      if (!structureChanged) {
        // Structure same - only update nodes that actually changed
        let hasChanges = false
        const result = currentNodes.map(currentNode => {
          const storeNode = storeNodes.find(n => n.id === currentNode.id)
          if (!storeNode) return currentNode

          // Check if node data or position changed
          const dataChanged = currentNode.data !== storeNode.data
          const posChanged = currentNode.position.x !== storeNode.position.x ||
                            currentNode.position.y !== storeNode.position.y

          if (dataChanged || posChanged) {
            hasChanges = true
            return {
              ...currentNode, // Keep ReactFlow's internal state including measured
              data: storeNode.data,
              position: storeNode.position,
            }
          }
          return currentNode // Keep exact same object reference
        })
        return hasChanges ? result : currentNodes
      }

      // Structure changed - rebuild but preserve measured from current nodes
      const measuredMap = new Map(currentNodes.map(n => [n.id, n.measured]))
      return filteredStoreNodes.map(node => ({
        ...node,
        measured: measuredMap.get(node.id) ?? node.measured,
      }))
    })
    setEdges(filteredStoreEdges)
  }, [filteredStoreNodes, filteredStoreEdges, setNodes, setEdges])

  // Auto-relayout after nodes get measured (first render)
  const hasRelayoutedRef = useRef(false)
  useEffect(() => {
    if (!isActive) return
    if (hasRelayoutedRef.current) return
    if (nodes.length === 0) return

    // Check if most nodes have measurements
    const measuredCount = nodes.filter(n => n.measured?.width && n.measured?.height).length
    if (measuredCount < nodes.length * 0.8) return  // Wait for 80% to be measured

    // Collect measurements and trigger relayout
    const measured = new Map<string, { width: number; height: number }>()
    nodes.forEach(node => {
      if (node.measured?.width && node.measured?.height) {
        measured.set(node.id, { width: node.measured.width, height: node.measured.height })
      }
    })

    if (measured.size > 0) {
      hasRelayoutedRef.current = true
      setMeasuredDimensions(measured)
      // Small delay to let state update
      setTimeout(() => rebuildGraph(true), 50)
    }
  }, [nodes, setMeasuredDimensions, rebuildGraph, isActive])

  // Reset relayout flag when view changes
  useEffect(() => {
    hasRelayoutedRef.current = false
  }, [focusedNode, viewScopeKey])

  // Sync project path into the store
  useEffect(() => {
    if (!viewScopeKey) return
    setProjectPath(viewScopeKey)
  }, [setProjectPath, viewScopeKey])

  // Load tree and hydrate parsed markdown from background cache
  useEffect(() => {
    if (!isActive) return
    rootItemsRef.current = new Map()
    rootByPathRef.current = new Map(resolvedGraphRoots.map(root => [root.path, root]))

    if (resolvedGraphRoots.length === 0) {
      setTreeItems([])
      return
    }

    // Load all graph roots and set up watching via FileParserService
    const loadGraphRoots = async () => {
      await controller.ensureParsersRegistered()

      for (const root of resolvedGraphRoots) {
        try {
          // Load file tree structure
          const items = await controller.getFileTree(root.path)
          const currentRoot = rootByPathRef.current.get(root.path)
          if (!currentRoot) continue
          const remapped = remapTreeItems(items, currentRoot)
          rootItemsRef.current.set(root.path, remapped)
          const merged: TreeItem[] = []
          const seen = new Set<string>()
          rootItemsRef.current.forEach((rootItems) => {
            rootItems.forEach((item) => {
              if (seen.has(item.id)) return
              seen.add(item.id)
              merged.push(item)
            })
          })
          merged.sort((a, b) => a.id.localeCompare(b.id))
          setTreeItems(merged)

          for (const item of remapped) {
            if (!item.is_dir && item.path.endsWith('.md')) {
              await loadParsedDoc(item)
            }
          }
        } catch (err) {
          console.error('Failed to load graph root:', root.path, err)
        }
      }
    }
    loadGraphRoots()
  }, [controller, resolvedGraphRoots, setTreeItems, loadParsedDoc, isActive])

  // Cleanup handled by the graphRoots effect above

  useEffect(() => {
    setProjectSettings(resolvedSettings)
  }, [resolvedSettings, setProjectSettings])

  // Handle file changes - FileParserService handles modified files,
  // controller watch handles tree structure changes (created/removed)
  useEffect(() => {
    if (!isActive) return
    if (resolvedGraphRoots.length === 0) return

    const cleanupFns: Array<() => void> = []
    let disposed = false

    // Subscribe to FileParserService for content updates
    // subscribeAll() handles all efficiency concerns (debounce, caching, etc.)
    // and gives us pre-parsed data - no re-reading or re-parsing needed
    for (const root of resolvedGraphRoots) {
      const unsub = controller.subscribeParsedRoot(root.path, (filePath, parsedData) => {
        const item = treeItemsRef.current.find(t => t.path === filePath)
        if (item && !item.is_dir) {
          setDocContentParsed(item.id, parsedData)
        }
      })
      cleanupFns.push(unsub)
    }

    // Use controller watch for tree structure changes (created/removed)
    const watchPaths = resolvedGraphRoots.map(r => r.path)
    const handleTreeChange = async (event: { type: string; path: string }) => {
      if (event.type !== 'created' && event.type !== 'removed') return

      const root = findRootForPath(event.path)
      if (!root) return

      try {
        const items = await controller.getFileTree(root.path)
        const currentRoot = rootByPathRef.current.get(root.path)
        if (!currentRoot) return
        const remapped = remapTreeItems(items, currentRoot)
        rootItemsRef.current.set(root.path, remapped)
        const merged: TreeItem[] = []
        const seen = new Set<string>()
        rootItemsRef.current.forEach((rootItems) => {
          rootItems.forEach((item) => {
            if (seen.has(item.id)) return
            seen.add(item.id)
            merged.push(item)
          })
        })
        merged.sort((a, b) => a.id.localeCompare(b.id))
        setTreeItems(merged)

        // Auto-load new markdown files
        for (const item of remapped) {
          if (!item.is_dir && item.path.endsWith('.md')) {
            await loadParsedDoc(item)
          }
        }
      } catch (err) {
        console.error('Failed to reload tree after file change:', err)
      }
    }

    controller.watchTreePaths(watchPaths, 'document-graph-tree', handleTreeChange)
      .then(unwatch => {
        if (disposed) {
          unwatch()
          return
        }
        cleanupFns.push(unwatch)
      })
      .catch((err) => console.error('[DocumentGraph] Failed to watch graph roots:', err))

    return () => {
      disposed = true
      for (const fn of cleanupFns) {
        fn()
      }
    }
  }, [controller, resolvedGraphRoots, findRootForPath, setTreeItems, loadParsedDoc, setDocContentParsed, isActive])

  // Legacy IPC response handler removed - all operations now use direct Tauri calls

  const {
    handleNodeClick,
    handleNodeDragStop,
    handleNodeContextMenu,
    handleSelectionChange,
    handleFocusSelection,
    handleClearSelection,
    handleTocSectionClick,
    handlePreviewNode,
    handleFocusNode,
    handleLinkAction,
    handleContextMenuAction,
  } = useDocumentGraphHandlers({
    reactFlowInstance,
    treeItems,
    treeItemsRef,
    loadParsedDoc,
    openFullView,
    setQuickPreviewNode,
    setPreviewSectionIndex,
    pendingLinkOpen,
    setPendingLinkOpen,
    toggleFolderCollapse,
    lockedNodes,
    updateNodePosition,
    showContextMenu,
    setMultiSelectedNodes,
    multiSelectedNodes,
    setFocusedNode,
    setNodes,
    isZoomedToNode,
    setIsZoomedToNode,
    onOpenFile,
    addExternalRootForPath,
    toggleTreeWidget,
    collapsedFolders,
    closeContextMenu,
    setIgnoredNodes,
    togglePinnedNode,
    toggleLockedNode,
    storeNodes,
  })

  // Add handlers and cardScale to nodes (clicks handled by ReactFlow)
  const nodesWithHandlers = buildNodesWithHandlers(nodes, {
    cardScale,
    lockedNodes,
    collapsedFolders,
    onOpenFile,
    handleTocSectionClick,
    showContextMenu,
    toggleTreeWidget,
    toggleFolderCollapse,
    handleLinkAction,
    handlePreviewNode,
    handleFocusNode,
  })

  if (!viewScopeKey) {
    return (
      <div style={{ padding: '20px', color: colors.textMuted }}>
        Select a project to view documentation
      </div>
    )
  }

  return (
    <div style={{ ...layoutPrimitives.fillColumn, background: colors.bgPrimary }}>
      {/* Graph Panel */}
      <div style={{
        ...layoutPrimitives.fillColumn,
        flex: 1,
        borderBottom: `1px solid ${colors.borderPrimary}`,
        height: '100%',
      }}>
        <div
          ref={containerRef}
          data-graph-container
          style={{
            ...layoutPrimitives.fill,
            outline: 'none',
            boxShadow: isGraphFocused ? `inset 0 0 0 1px ${colors.borderFocus}` : 'none',
            transition: 'box-shadow 0.15s ease',
            position: 'relative', // For absolute positioning of QuickPreview
          }}
          tabIndex={0}
          onFocus={() => {
            scopeManager.push('graph')
            setIsGraphFocused(true)
          }}
          onBlur={() => {
            scopeManager.remove('graph')
            setIsGraphFocused(false)
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div style={{ position: 'absolute', inset: 0 }}>
            <ReactFlow
              nodes={nodesWithHandlers}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              onNodeDragStop={handleNodeDragStop}
              onNodeContextMenu={handleNodeContextMenu}
              onPaneClick={() => { setQuickPreviewNode(null); closeContextMenu() }}
              onInit={(instance) => { reactFlowInstance.current = instance }}
              onSelectionChange={handleSelectionChange}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              connectionMode={ConnectionMode.Loose}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.1}
              maxZoom={2}
              selectionOnDrag={true}
              selectNodesOnDrag={true}
              selectionKeyCode="Shift"
              multiSelectionKeyCode="Shift"
              panOnScroll={true}
              panOnDrag={true}
              zoomOnDoubleClick={false}
              deleteKeyCode={null}
              selectionMode={SelectionMode.Partial}
              disableKeyboardA11y={true}
              style={{ ...layoutPrimitives.fill }}
            >
              <Background color={colors.borderPrimary} gap={20} />
              <Controls style={{ background: colors.bgSecondary, border: `1px solid ${colors.borderPrimary}` }} />
	              <GraphControlPanel
                onRelayout={() => {
                  // Collect measured dimensions from current nodes
                  const instance = reactFlowInstance.current
                  if (instance) {
                    const rfNodes = instance.getNodes()
                    const measured = new Map<string, { width: number; height: number }>()
                    rfNodes.forEach((node: Node) => {
                      if (node.measured?.width && node.measured?.height) {
                        measured.set(node.id, {
                          width: node.measured.width,
                          height: node.measured.height,
                        })
                      }
                    })
                    if (measured.size > 0) {
                      setMeasuredDimensions(measured)
                    }
                  }
                  clearViewLayout()
                  rebuildGraph(true)
                }}
                onFitView={() => reactFlowInstance.current?.fitView({ padding: 0.2, duration: 200 })}
                nodeCount={nodes.length}
                onToggleLegend={() => {
                  setShowLegend(prev => !prev)
                  setShowFilters(false)
                  setShowIgnored(false)
                  setShowPinned(false)
                }}
                onToggleFilters={() => {
                  setShowFilters(prev => !prev)
                  setShowLegend(false)
                  setShowIgnored(false)
                  setShowPinned(false)
                }}
                onToggleIgnored={() => {
                  setShowIgnored(prev => !prev)
                  setShowLegend(false)
                  setShowFilters(false)
                  setShowPinned(false)
                }}
                onTogglePinned={() => {
                  setShowPinned(prev => !prev)
                  setShowLegend(false)
                  setShowFilters(false)
                  setShowIgnored(false)
                }}
                isLegendOpen={showLegend}
                isFiltersOpen={showFilters}
                isPinnedOpen={showPinned}
                ignoredCount={ignoredNodes.length}
	                pinnedCount={pinnedNodes.size}
	              >
                  <GraphControlPopovers
                    showLegend={showLegend}
                    showFilters={showFilters}
                    showIgnored={showIgnored}
                    showPinned={showPinned}
                    docTypeOptions={docTypeOptions}
                    docTypeFilters={docTypeFilters}
                    setDocTypeFilters={setDocTypeFilters}
                    showAllLinks={showAllLinks}
                    setShowAllLinks={setShowAllLinks}
                    onResetFilters={() => setDocTypeFilters({ core: true, research: true, spike: true, other: true })}
                    ignoredEntries={ignoredEntries}
                    onRestoreIgnored={(id) => setIgnoredNodes(prev => prev.filter(entryId => entryId !== id))}
                    onRestoreAllIgnored={() => setIgnoredNodes([])}
                    pinnedEntries={pinnedEntries}
                    lockedNodes={lockedNodes}
                    onFocusPinned={(id) => setFocusedNode(id)}
                    onUnpin={togglePinnedNode}
                    onToggleLock={toggleLockedNode}
                    onClearPins={() => {
                      setLockedNodes(new Set())
                      setPinnedNodes(new Set())
                    }}
                  />
	              </GraphControlPanel>
              {/* Focus Mode Breadcrumbs - rendered last so it's on top */}
              {(focusedNode || customFocusNodes) && (
                <FocusBreadcrumbs
                  focusedNode={focusedNode || ''}
                  breadcrumbs={getFocusBreadcrumbs()}
                  customFocusCount={customFocusNodes?.length}
                  onExitFocus={() => setFocusedNode(null)}
                  onFocusNode={(id) => id === 'CLAUDE.md' ? setFocusedNode(null) : setFocusedNode(id)}
                />
              )}
              <MiniMap
                style={{ background: colors.bgPrimary, border: `1px solid ${colors.borderPrimary}` }}
                nodeColor={(node) => {
                  if (node.type === 'folder') return colors.graphFolder
                  return colors.accent
                }}
                pannable
                zoomable
              />
              {/* Selection Panel for multi-select */}
              <SelectionPanel
                selectedCount={multiSelectedNodes.length}
                onFocusSelection={handleFocusSelection}
                onClearSelection={handleClearSelection}
              />
                <GraphContextMenu contextMenu={contextMenu} items={contextMenuItems} onAction={handleContextMenuAction} />
	            </ReactFlow>
          </div>
          {/* Quick Preview Popover - rendered outside ReactFlow for proper mouse handling */}
          {quickPreviewNode && (() => {
            const item = treeItems.find(t => t.id === quickPreviewNode)
            const content = docContents.get(quickPreviewNode)
            if (!item) return null
            const docType = getDocType(item.id, resolvedSettings)
            return (
              <QuickPreview
                name={item.name}
                type={docType}
                isFile={!item.is_dir}
                tasks={content?.tasks}
                content={content?.content}
                sections={content?.sections}
                checklists={content?.checklists}
                diagrams={content?.diagrams}
                sourceFile={item.path}
                onClose={() => {
                  setQuickPreviewNode(null)
                  setPreviewSectionIndex(0)
                }}
                onOpenFull={!item.is_dir ? () => openFullView(quickPreviewNode) : undefined}
                onEdit={onOpenFile ? () => onOpenFile(item.path) : undefined}
                onFullscreen={handleFullscreen}
                CodeViewer={ResolvedCodeViewer}
                onFocus={() => {
                  setFocusedNode(quickPreviewNode)
                  setQuickPreviewNode(null)
                }}
                initialSectionIndex={previewSectionIndex}
                position={previewPanelPosition}
                onPositionChange={setPreviewPanelPosition}
              />
            )
          })()}
        </div>
      </div>

      <DocumentPanels
        selectedNodes={selectedNodes}
        treeItems={treeItems}
        docContents={docContents}
        expandedPanel={expandedPanel}
        setExpandedPanel={setExpandedPanel}
        closeNode={closeNode}
        onOpenFile={onOpenFile}
        resolvedSettings={resolvedSettings}
        loadParsedDoc={loadParsedDoc}
        onFullscreen={handleFullscreen}
        CodeViewer={ResolvedCodeViewer}
      />

      {/* Fullscreen Modal - rendered at top level outside all Panels to escape clipping */}
      <FullscreenModal
        state={fullscreenState}
        onClose={closeFullscreen}
        theme={markdownTheme}
        isDark={isDark}
        CodeViewer={ResolvedCodeViewer}
        uiColors={{ bgOverlay: colors.bgOverlay, buttonBg: colors.buttonBg }}
      />
    </div>
  )
}
