import { memo, useCallback, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Cog,
  File,
  FileCode,
  FileImage,
  FileJson,
  FileText,
  Folder,
  Globe,
  LayoutGrid,
  Palette,
  Terminal,
} from 'lucide-react'

import type { ContextGraphTreeItemDTO } from '../../dto/contextGraphDTO'
import { layoutPrimitives } from '../../compat/layoutPrimitives'
import { EdgeHandles } from './EdgeHandles'
import { getCardScale, useFlowColors } from './colors'

type TreeItem = ContextGraphTreeItemDTO

export interface FileTreeNodeData {
  label: string              // Folder name
  folderId: string           // Folder ID (workspace root or nested folder)
  basePath: string           // Full path to folder
  items: TreeItem[]          // All descendants
  onItemClick?: (item: TreeItem) => void
  onItemContextMenu?: (e: React.MouseEvent, item: TreeItem) => void
  onToggleView?: () => void
  cardScale?: number
}

interface FileTreeNodeProps {
  data: FileTreeNodeData
  selected?: boolean
}

// Get file icon based on extension
function getFileIcon(filename: string, color: string): React.ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase()
  const iconProps = { size: 12, color }
  switch (ext) {
    case 'md': return <FileText {...iconProps} />
    case 'json': return <FileJson {...iconProps} />
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'rs':
    case 'py':
    case 'go':
    case 'c':
    case 'cpp':
    case 'java': return <FileCode {...iconProps} />
    case 'html': return <Globe {...iconProps} />
    case 'css':
    case 'scss':
    case 'less': return <Palette {...iconProps} />
    case 'yaml':
    case 'yml':
    case 'toml': return <Cog {...iconProps} />
    case 'sh':
    case 'bash':
    case 'zsh': return <Terminal {...iconProps} />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp': return <FileImage {...iconProps} />
    default: return <File {...iconProps} />
  }
}

export const FileTreeNode = memo(({ data, selected }: FileTreeNodeProps) => {
  const COLORS = useFlowColors()
  const scale = getCardScale(data)
  const scaleStyle = scale === 1
    ? {}
    : { transform: `scale(${scale})`, transformOrigin: 'top left' }
  const treeColor = COLORS.textSecondary
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const actionButtonStyle: React.CSSProperties = {
    border: 'none',
    background: `${treeColor}20`,
    color: treeColor,
    width: 18,
    height: 18,
    borderRadius: 4,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  }

  // Build tree structure from flat items
  const getChildren = useCallback((parentId: string): TreeItem[] => {
    const prefix = parentId ? parentId + '/' : data.basePath + '/'
    return data.items.filter(item => {
      // Item must start with prefix and not have additional slashes (direct child)
      if (!item.id.startsWith(prefix)) return false
      const remainder = item.id.slice(prefix.length)
      return !remainder.includes('/')
    })
  }, [data.items, data.basePath])

  // Get top-level items (direct children of the base folder)
  const topLevelItems = useCallback((): TreeItem[] => {
    const basePrefix = data.folderId + '/'
    return data.items.filter(item => {
      if (!item.id.startsWith(basePrefix)) return false
      const remainder = item.id.slice(basePrefix.length)
      return !remainder.includes('/')
    })
  }, [data.items, data.folderId])

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }, [])

  const renderItem = useCallback((item: TreeItem, depth: number): React.ReactNode => {
    const isExpanded = expandedFolders.has(item.id)
    const children = item.is_dir ? getChildren(item.id) : []

    return (
      <div key={item.id}>
        <div
          style={{
            ...layoutPrimitives.row,
            alignItems: 'center',
            gap: '4px',
            padding: '3px 6px',
            paddingLeft: `${6 + depth * 14}px`,
            cursor: 'pointer',
            borderRadius: '3px',
            fontSize: '10px',
            color: COLORS.text,
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (item.is_dir) {
              toggleFolder(item.id)
            } else {
              data.onItemClick?.(item)
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            data.onItemContextMenu?.(e, item)
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = COLORS.border
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          {item.is_dir ? (
            <>
              <span style={{
                color: COLORS.textMuted,
                width: '10px',
                ...layoutPrimitives.row,
                alignItems: 'center',
              }}>
                {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </span>
              <span style={{ color: COLORS.folder }}>
                {item.name}
              </span>
              <span style={{
                fontSize: '8px',
                color: COLORS.textMuted,
                marginLeft: 'auto',
              }}>
                {children.length}
              </span>
            </>
          ) : (
            <>
              <span style={{
                width: '14px',
                ...layoutPrimitives.row,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {getFileIcon(item.name, COLORS.textMuted)}
              </span>
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {item.name}
              </span>
            </>
          )}
        </div>

        {/* Render children if folder is expanded */}
        {item.is_dir && isExpanded && children.length > 0 && (
          <div>
            {children.map(child => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }, [expandedFolders, getChildren, toggleFolder, data.onItemClick, data.onItemContextMenu])

  const fileCount = data.items.filter(i => !i.is_dir).length
  const folderCount = data.items.filter(i => i.is_dir).length

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `2px solid ${selected ? treeColor : COLORS.border}`,
        borderRadius: '8px',
        padding: '10px',
        minWidth: '180px',
        maxWidth: '280px',
        cursor: 'default',
        ...scaleStyle,
      }}
    >
      <EdgeHandles color={treeColor} />

      {/* Header */}
      <div style={{
        ...layoutPrimitives.row,
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
        borderBottom: `1px solid ${COLORS.border}`,
        paddingBottom: '6px',
      }}>
        <span style={{ fontSize: '12px', ...layoutPrimitives.row, alignItems: 'center' }}><Folder size={14} /></span>
        <span style={{
          color: COLORS.text,
          fontSize: '12px',
          fontWeight: 600,
        }}>
          {data.label}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{
          color: COLORS.textMuted,
          fontSize: '9px',
        }}>
          {fileCount} files{folderCount > 0 && `, ${folderCount} folders`}
        </span>
        {data.onToggleView && (
          <button
            type="button"
            title="Show as Folder"
            style={actionButtonStyle}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              data.onToggleView?.()
            }}
          >
            <LayoutGrid size={10} />
          </button>
        )}
      </div>

      {/* Tree content */}
      <div style={{
        maxHeight: '300px',
        overflowY: 'auto',
      }}>
        {topLevelItems().map(item => renderItem(item, 0))}
        {topLevelItems().length === 0 && (
          <div style={{
            color: COLORS.textMuted,
            fontSize: '10px',
            fontStyle: 'italic',
            padding: '8px',
            textAlign: 'center',
          }}>
            Empty folder
          </div>
        )}
      </div>
    </div>
  )
})

