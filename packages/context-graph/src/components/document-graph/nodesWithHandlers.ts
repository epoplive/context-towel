import type { Node } from '@xyflow/react'
import type { MouseEvent as ReactMouseEvent } from 'react'

export interface BuildNodesWithHandlersArgs {
  cardScale: number
  lockedNodes: Set<string>
  collapsedFolders: Set<string>
  onOpenFile?: (filePath: string, lineNumber?: number) => void
  handleTocSectionClick: (parentDocId: string, sectionIndex: number) => void
  showContextMenu: (x: number, y: number, nodeId: string, nodeType: string) => void
  toggleTreeWidget: (folderId: string) => void
  toggleFolderCollapse: (id: string) => void
  handleLinkAction: (link: { targetId?: string; targetPath?: string }, action: 'preview' | 'panel' | 'editor' | 'follow') => void
  handlePreviewNode: (nodeId: string) => void
  handleFocusNode: (nodeId: string) => void
}

export function buildNodesWithHandlers(nodes: Node[], args: BuildNodesWithHandlersArgs): Node[] {
  const {
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
  } = args

  return nodes.map(node => {
    const baseData = {
      ...node.data,
      cardScale, // Pass scale to all nodes
    }

    if (node.type === 'toc') {
      const parentDocId = node.data?.parentDocId as string
      return {
        ...node,
        draggable: !lockedNodes.has(node.id),
        data: {
          ...baseData,
          onSectionClick: (sectionIndex: number) => handleTocSectionClick(parentDocId, sectionIndex),
        },
      }
    }
    if (node.type === 'filetree') {
      return {
        ...node,
        draggable: !lockedNodes.has(node.id),
        data: {
          ...baseData,
          onItemClick: (_item: { id: string; name: string; path: string; is_dir: boolean }) => {
            // No single-click preview for tree items (use context menu / buttons)
          },
          onItemContextMenu: (e: ReactMouseEvent, item: { id: string; name: string; path: string; is_dir: boolean }) => {
            e.preventDefault()
            // Show context menu for tree items
            showContextMenu(e.clientX, e.clientY, item.id, item.is_dir ? 'treeitem-folder' : 'treeitem-file')
          },
          onToggleView: () => {
            toggleTreeWidget(node.id)
            if (collapsedFolders.has(node.id)) {
              toggleFolderCollapse(node.id)
            }
          },
        },
      }
    }
    if (node.type === 'link-card') {
      return {
        ...node,
        draggable: !lockedNodes.has(node.id),
        data: {
          ...baseData,
          onLinkAction: handleLinkAction,
        },
      }
    }
    const isDocCard = node.type === 'document' || node.type === 'workingdoc'
    return {
      ...node,
      draggable: !lockedNodes.has(node.id),
      data: {
        ...baseData,
        onEdit: node.data?.path ? () => onOpenFile?.(node.data.path as string) : undefined,
        onPreview: isDocCard ? () => handlePreviewNode(node.id) : undefined,
        onFocus: isDocCard ? () => handleFocusNode(node.id) : undefined,
      },
    }
  })
}

