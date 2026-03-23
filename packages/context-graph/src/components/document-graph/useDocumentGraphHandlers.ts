import type { Node, OnSelectionChangeFunc } from '@xyflow/react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useCallback, useEffect, useRef } from 'react'

import type { TreeItem } from '../../types'
import { normalizeFsPath } from './paths'
import { fileService } from '../../compat/services'
import { useGraphStore } from '../../state/store'

export type PendingLinkOpen = { path: string; action: 'panel' | 'preview' } | null

export interface UseDocumentGraphHandlersArgs {
  reactFlowInstance: MutableRefObject<any>
  treeItems: TreeItem[]
  treeItemsRef: MutableRefObject<TreeItem[]>
  loadParsedDoc: (item: TreeItem) => void | Promise<void>
  openFullView: (nodeId: string) => void
  setQuickPreviewNode: (nodeId: string | null) => void
  setPreviewSectionIndex: Dispatch<SetStateAction<number>>
  pendingLinkOpen: PendingLinkOpen
  setPendingLinkOpen: Dispatch<SetStateAction<PendingLinkOpen>>
  toggleFolderCollapse: (nodeId: string) => void
  lockedNodes: Set<string>
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void
  showContextMenu: (x: number, y: number, nodeId: string, nodeType: string) => void
  setMultiSelectedNodes: Dispatch<SetStateAction<string[]>>
  multiSelectedNodes: string[]
  setFocusedNode: (nodeId: string | null, customNodes?: string[] | null) => void
  setNodes: Dispatch<SetStateAction<Node[]>>
  isZoomedToNode: boolean
  setIsZoomedToNode: Dispatch<SetStateAction<boolean>>
  onOpenFile?: (filePath: string, lineNumber?: number) => void
  addExternalRootForPath: (path: string) => void
  toggleTreeWidget: (nodeId: string) => void
  collapsedFolders: Set<string>
  closeContextMenu: () => void
  setIgnoredNodes: Dispatch<SetStateAction<string[]>>
  togglePinnedNode: (nodeId: string) => void
  toggleLockedNode: (nodeId: string) => void
  storeNodes: Node[]
}

export function useDocumentGraphHandlers({
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
}: UseDocumentGraphHandlersArgs) {
  // Track last click time for manual double-click detection.
  const lastClickTime = useRef<number>(0)
  const lastClickNode = useRef<string | null>(null)

  // Single unified click handler - detects double clicks manually
  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const now = Date.now()
    const isDoubleClick = (now - lastClickTime.current < 300) && (lastClickNode.current === node.id)

    lastClickTime.current = now
    lastClickNode.current = node.id

    // Double-click: toggle zoom (zoom to node or zoom back out)
    if (isDoubleClick) {
      setQuickPreviewNode(null)
      const instance = reactFlowInstance.current
      if (!instance) return

      if (isZoomedToNode) {
        // Zoom back to fit all nodes
        instance.fitView({ padding: 0.2, duration: 300 })
        setIsZoomedToNode(false)
      } else {
        // Zoom with node's top edge at top of viewport
        const internalNode = instance.getInternalNode(node.id)
        const zoom = 1.3
        const viewportHeight = instance.getViewport().zoom > 0
          ? window.innerHeight / zoom
          : 600

        if (internalNode?.measured?.width && internalNode?.measured?.height) {
          const centerX = internalNode.internals.positionAbsolute.x + internalNode.measured.width / 2
          // Offset Y so node top appears near viewport top with padding
          const centerY = internalNode.internals.positionAbsolute.y + (viewportHeight / 2) - 80
          instance.setCenter(centerX, centerY, { zoom, duration: 300 })
        } else {
          const centerY = node.position.y + (viewportHeight / 2) - 80
          instance.setCenter(node.position.x + 100, centerY, { zoom, duration: 300 })
        }
        setIsZoomedToNode(true)
      }
      return
    }

    // Single click behavior depends on node type

    // Folder: toggle on single click
    if (node.type === 'folder') {
      toggleFolderCollapse(node.id)
      return
    }

    // Breakout node types (not documents) - single click does nothing
    const breakoutTypes = ['toc', 'tasklist', 'checklist', 'diagram', 'link-card']
    if (breakoutTypes.includes(node.type || '')) {
      return
    }

    // Document nodes: no single-click preview (use Preview button instead)
    if (node.type === 'document' || node.type === 'filetree' || node.type === 'workingdoc') {
      return
    }
  }, [toggleFolderCollapse, setQuickPreviewNode, treeItems, loadParsedDoc, isZoomedToNode])

  // Save node position when dragging ends
  const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    if (lockedNodes.has(node.id)) return
    updateNodePosition(node.id, { x: Math.round(node.position.x), y: Math.round(node.position.y) })
  }, [lockedNodes, updateNodePosition])

  // Right-click context menu
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    showContextMenu(event.clientX, event.clientY, node.id, node.type || 'document')
  }, [showContextMenu])

  // Track multi-selection changes
  const handleSelectionChange: OnSelectionChangeFunc = useCallback(({ nodes: selectedNodes }) => {
    setMultiSelectedNodes(selectedNodes.map(n => n.id))
  }, [])

  // Focus on selected nodes (custom multi-select focus)
  const handleFocusSelection = useCallback(() => {
    if (multiSelectedNodes.length < 2) return
    // Set focus to the first selected node, store will include all selected
    setFocusedNode(multiSelectedNodes[0], multiSelectedNodes)
    setMultiSelectedNodes([])
  }, [multiSelectedNodes, setFocusedNode])

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setMultiSelectedNodes([])
    // Clear ReactFlow selection by setting all nodes to selected: false
    setNodes(nodes => nodes.map(n => ({ ...n, selected: false })))
  }, [setNodes])

  // Handler for TOC section clicks
  const handleTocSectionClick = useCallback((parentDocId: string, sectionIndex: number) => {
    // Open the parent document popover with section index
    setQuickPreviewNode(parentDocId)
    setPreviewSectionIndex(sectionIndex)
    // Ensure document content is loaded
    const item = treeItems.find(t => t.id === parentDocId)
    if (item) {
      void loadParsedDoc(item)
    }
  }, [treeItems, loadParsedDoc, setQuickPreviewNode])

  const handlePreviewNode = useCallback((nodeId: string) => {
    setQuickPreviewNode(nodeId)
    setPreviewSectionIndex(0)
    const item = treeItems.find(t => t.id === nodeId)
    if (item) {
      void loadParsedDoc(item)
    }
  }, [setQuickPreviewNode, setPreviewSectionIndex, treeItems, loadParsedDoc])

  useEffect(() => {
    if (!pendingLinkOpen) return
    const normalizedTarget = normalizeFsPath(pendingLinkOpen.path)
    const item = treeItemsRef.current.find(t => normalizeFsPath(t.path) === normalizedTarget)
    if (!item) return
    if (pendingLinkOpen.action === 'panel') {
      openFullView(item.id)
    } else {
      handlePreviewNode(item.id)
    }
    setPendingLinkOpen(null)
  }, [pendingLinkOpen, openFullView, handlePreviewNode])

  const handleFocusNode = useCallback((nodeId: string) => {
    setFocusedNode(nodeId)
  }, [setFocusedNode])

  const handleLinkAction = useCallback((
    link: { targetId?: string; targetPath?: string },
    action: 'preview' | 'panel' | 'editor' | 'follow'
  ) => {
    const targetId = link.targetId
    const targetPath = link.targetPath

    if (targetId) {
      if (action === 'preview') {
        handlePreviewNode(targetId)
        return
      }
      if (action === 'panel') {
        openFullView(targetId)
        return
      }
      if (action === 'editor') {
        openFullView(targetId)
        return
      }
      return
    }

    if (!targetPath) return

    if (action === 'follow') {
      addExternalRootForPath(targetPath)
      return
    }
    if (action === 'preview') {
      addExternalRootForPath(targetPath)
      setPendingLinkOpen({ path: targetPath, action: 'preview' })
      return
    }
    if (action === 'panel') {
      addExternalRootForPath(targetPath)
      setPendingLinkOpen({ path: targetPath, action: 'panel' })
      return
    }
    if (action === 'editor') {
      onOpenFile?.(targetPath)
    }
  }, [handlePreviewNode, openFullView, onOpenFile, addExternalRootForPath, setPendingLinkOpen])

  // Handle context menu actions
  const handleContextMenuAction = useCallback((action: string, nodeId: string, _nodeType: string) => {
    closeContextMenu()
    switch (action) {
      case 'openPanel':
        openFullView(nodeId)
        break
      case 'focus':
        setFocusedNode(nodeId)
        break
      case 'collapse':
        toggleFolderCollapse(nodeId)
        break
      case 'treeWidget':
        // Toggle tree widget display for this folder
        toggleTreeWidget(nodeId)
        break
      case 'openEditor':
        openFullView(nodeId)
        break
      case 'expandFolder':
        toggleTreeWidget(nodeId)
        if (collapsedFolders.has(nodeId)) {
          toggleFolderCollapse(nodeId)
        }
        break
      case 'ignore':
        setIgnoredNodes((prev) => (
          prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]
        ))
        break
      case 'pin':
        togglePinnedNode(nodeId)
        break
      case 'lock':
        toggleLockedNode(nodeId)
        break
      case 'createPacket': {
        const item = treeItems.find(t => t.id === nodeId)
        if (!item) break
        const name = item.name.replace(/\.md$/, '').replace(/\s+/g, '-').toLowerCase()
        const store = useGraphStore.getState()
        const root = store.projectPath || ''
        if (!root) break
        const packetDir = `${root}/.context/packets/active`
        const packetPath = `${packetDir}/${name}.md`
        const markerPath = `${root}/.context/active`
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
        const template = `# Packet: ${name}\n\n## Whiteboard\n<!-- Add mermaid diagrams here -->\n\n## Problem Vectors\n<!-- No active problem vectors -->\n\n## AICCL\n<!-- No AICCL nodes -->\n\n## Delta Log\n- \`${now}\` **discovery** [init]: Seeded from ${item.name}\n\n## Linked\n- Plan: \`${item.path}\`\n`
        fileService.mkdir(packetDir).then(() =>
          fileService.write(packetPath, template)
        ).then(() =>
          fileService.write(markerPath, name)
        ).then(() => {
          store.setActivePacketId(name)
          store.setPacketPanelOpen(true)
        }).catch(err => {
          console.error('[DocumentGraph] Failed to create packet:', err)
        })
        break
      }
    }
  }, [
    closeContextMenu,
    openFullView,
    setFocusedNode,
    toggleFolderCollapse,
    toggleTreeWidget,
    collapsedFolders,
    treeItems,
    onOpenFile,
    togglePinnedNode,
    toggleLockedNode,
    storeNodes,
    addExternalRootForPath,
    setPendingLinkOpen,
  ])

  return {
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
  }
}

