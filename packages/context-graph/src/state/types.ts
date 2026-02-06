// ============================================================================
// Context Graph - State Types
// ============================================================================

import type { Node, Edge } from '@xyflow/react'
import type { TreeItem } from '../types'
// Import from /types directly to avoid circular dependency through plugin components
import type { TaskItem } from '../plugins/task/types'
import type { ChecklistGroup } from '../plugins/checklist/types'
import type { DiagramItem } from '../plugins/diagram/types'
import type { TocSection } from '../plugins/toc/types'
import type { LogSection } from '../plugins/log/types'
import type { ProjectSettings } from '../compat/project-settings'

// Re-export for convenience
export type { TreeItem }

// ----------------------------------------------------------------------------
// Type Aliases (backwards compat)
// ----------------------------------------------------------------------------

export type ParsedTask = TaskItem
export type DocumentSection = TocSection
export type MermaidDiagram = DiagramItem

// ----------------------------------------------------------------------------
// Document Types
// ----------------------------------------------------------------------------

export interface DocNode {
  id: string
  name: string
  path: string
  content?: string
  tasks?: ParsedTask[]
  type: 'core' | 'research' | 'skill' | 'spike' | 'folder' | 'other'
  isFolder: boolean
  loaded: boolean
}

export interface ParsedDocContent {
  content: string
  tasks: ParsedTask[]
  sections: DocumentSection[]
  checklists: ChecklistGroup[]
  diagrams: MermaidDiagram[]
  logs?: LogSection[]
}

// ----------------------------------------------------------------------------
// Layout Types
// ----------------------------------------------------------------------------

export interface ViewLayoutState {
  positions: Record<string, { x: number; y: number }>
  viewport?: { x: number; y: number; zoom: number }
}

export interface NodeDimensions {
  width: number
  height: number
}

export interface ViewportDimensions {
  width: number
  height: number
}

// ----------------------------------------------------------------------------
// Context Menu Types
// ----------------------------------------------------------------------------

export interface ContextMenuItem {
  label: string
  action: () => void
}

export interface ContextMenuState {
  x: number
  y: number
  nodeId: string
  nodeType: string
  items: ContextMenuItem[]
}

// ----------------------------------------------------------------------------
// Document Store Types
// ----------------------------------------------------------------------------

export interface DocumentState {
  projectPath: string | null
  treeItems: TreeItem[]
  docContents: Map<string, ParsedDocContent>
  projectSettings: ProjectSettings
}

export interface DocumentActions {
  setProjectPath: (path: string | null) => void
  setTreeItems: (items: TreeItem[]) => void
  setDocContent: (id: string, content: string) => void
  getDocContent: (id: string) => ParsedDocContent | undefined
  setProjectSettings: (settings: ProjectSettings) => void
  toggleCheckbox: (filePath: string, lineNumber: number, checkboxText: string) => Promise<boolean>
}

export type DocumentStore = DocumentState & DocumentActions

// ----------------------------------------------------------------------------
// View Store Types
// ----------------------------------------------------------------------------

export interface ViewState {
  // Selection
  selectedNodes: string[]
  expandedPanel: string | null
  quickPreviewNode: string | null

  // Focus
  focusedNode: string | null
  customFocusNodes: string[] | null

  // Folder display
  collapsedFolders: Set<string>
  treeWidgetFolders: Set<string>

  // Card scaling
  cardScale: number

  // Preview panel position
  previewPanelPosition: { x: number; y: number }
}

export interface ViewActions {
  // Selection
  selectNode: (id: string) => void
  closeNode: (id: string) => void
  setExpandedPanel: (id: string | null) => void
  setQuickPreviewNode: (id: string | null) => void
  openFullView: (id: string) => void

  // Focus
  setFocusedNode: (id: string | null, customNodes?: string[]) => void
  getFocusBreadcrumbs: () => string[]

  // Folder display
  toggleFolderCollapse: (id: string) => void
  toggleTreeWidget: (folderId: string) => void
  setTreeWidgetFolders: (folders: Set<string>) => void

  // Card scaling
  setCardScale: (scale: number) => void
  increaseCardScale: () => void
  decreaseCardScale: () => void

  // Preview panel position
  setPreviewPanelPosition: (position: { x: number; y: number }) => void
}

export type ViewStore = ViewState & ViewActions

// ----------------------------------------------------------------------------
// Layout Store Types
// ----------------------------------------------------------------------------

export interface LayoutState {
  // Viewport
  viewportDimensions: ViewportDimensions | null

  // Measured dimensions from React Flow
  measuredDimensions: Map<string, NodeDimensions>
  layoutNeedsMeasuredUpdate: boolean

  // Layout state per view
  layoutStates: Record<string, ViewLayoutState>

  // Computed nodes/edges (derived from document + view state)
  nodes: Node[]
  edges: Edge[]
}

export interface LayoutActions {
  // Viewport
  setViewportDimensions: (dims: ViewportDimensions) => void

  // Clear graph (for project switching)
  clearGraph: () => void

  // Position persistence
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void
  updateNodePositions: (positions: Record<string, { x: number; y: number }>) => void
  getViewLayoutState: () => ViewLayoutState | undefined
  clearViewLayout: (viewKey?: string) => void

  // Measured dimensions
  setMeasuredDimensions: (dimensions: Map<string, NodeDimensions>) => void
  updateMeasuredDimension: (nodeId: string, dims: NodeDimensions) => void

  // Layout
  rebuildGraph: (forceLayout?: boolean) => void
  relayoutWithMeasuredSizes: () => void
}

export type LayoutStore = LayoutState & LayoutActions

// ----------------------------------------------------------------------------
// Context Menu Store Types
// ----------------------------------------------------------------------------

export interface ContextMenuStoreState {
  contextMenu: ContextMenuState | null
}

export interface ContextMenuActions {
  showContextMenu: (x: number, y: number, nodeId: string, nodeType: string) => void
  closeContextMenu: () => void
}

export type ContextMenuStore = ContextMenuStoreState & ContextMenuActions

// ----------------------------------------------------------------------------
// Combined Graph Store (for backwards compat)
// ----------------------------------------------------------------------------

export type GraphStore = DocumentState & ViewState & LayoutState & ContextMenuStoreState &
  DocumentActions & ViewActions & LayoutActions & ContextMenuActions
