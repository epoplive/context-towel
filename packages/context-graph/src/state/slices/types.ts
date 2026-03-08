// ============================================================================
// Context Graph State - Slice Types
// ============================================================================

import type { Node, Edge } from '@xyflow/react'
import type { StateCreator } from 'zustand'
import type { TreeItem } from '../../types'
import type { ProjectSettings } from '../../compat/project-settings'

// ----------------------------------------------------------------------------
// Re-export plugin types to avoid duplication
// Import from /types directly to avoid circular dependency through plugin components
// ----------------------------------------------------------------------------

import type { TocSection } from '../../plugins/toc/types'
import type { TaskItem, TaskStatus, TaskPriority, ChecklistItem } from '../../plugins/task/types'
import type { ChecklistGroup } from '../../plugins/checklist/types'
import type { DiagramItem } from '../../plugins/diagram/types'
import type { LogSection } from '../../plugins/log/types'
import type { LinkItem } from '../../plugins/link/types'
import type { ExtractedItem, ParseResult } from '../../types'

export type { TocSection, TaskItem, TaskStatus, TaskPriority, ChecklistItem, ChecklistGroup, DiagramItem, LogSection, LinkItem }

export interface ParsedDocContent {
  content: string
  sections: TocSection[]
  tasks: TaskItem[]
  checklists: ChecklistGroup[]
  diagrams: DiagramItem[]
  logs?: LogSection[]
  links?: LinkItem[]
  extractions?: Map<string, ParseResult<ExtractedItem>>
}

// ----------------------------------------------------------------------------
// Task Board Preferences
// ----------------------------------------------------------------------------

export type TaskBoardViewMode = 'list' | 'board' | 'dependency'
export type TaskBoardGroupBy = 'none' | 'status' | 'priority'

export interface TaskBoardPrefs {
  view: TaskBoardViewMode
  groupBy: TaskBoardGroupBy
  columnCount?: number
  dependencyHeight?: number
  dependencyCardWidth?: number
  dependencyScrollX?: number
  dependencyScrollY?: number
  dependencyWidth?: number
}

export interface TaskBoardPrefsByView {
  focus: TaskBoardPrefs
  normal: TaskBoardPrefs
}

export type TaskBoardPrefsByList = Record<string, TaskBoardPrefs>

// ----------------------------------------------------------------------------
// Position & Dimensions
// ----------------------------------------------------------------------------

export interface Position {
  x: number
  y: number
}

export interface Dimensions {
  width: number
  height: number
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export interface ViewportDimensions {
  width: number
  height: number
}

// Backwards compat alias
export type NodeDimensions = Dimensions

// ----------------------------------------------------------------------------
// Context Menu
// ----------------------------------------------------------------------------

export interface ContextMenuItem {
  label: string
  action: string
  icon?: string
  disabled?: boolean
  divider?: boolean
}

export interface ContextMenuState {
  x: number
  y: number
  nodeId: string
  nodeType: string
  items: ContextMenuItem[]
}

// ----------------------------------------------------------------------------
// View Layout State (for persistence)
// ----------------------------------------------------------------------------

export interface ViewLayoutState {
  positions: Record<string, Position>
}

// ----------------------------------------------------------------------------
// Persisted State
// ----------------------------------------------------------------------------

export interface PersistedState {
  version: number
  focusedNode: string | null
  customFocusNodes: string[] | null
  selectedNodes: string[]
  expandedPanel: string | null
  expandedPanels: string[]
  collapsedFolders: string[]
  treeWidgetFolders: string[]
  pinnedNodes?: string[]
  lockedNodes?: string[]
  cardScale: number
  previewPanelPosition: Position
  nodePositions: Record<string, Position>
  viewport: Viewport | null
  layoutStates: Record<string, ViewLayoutState>
  taskBoardDefaults?: TaskBoardPrefsByView
  taskBoardByList?: TaskBoardPrefsByList
  activePacketId?: string | null
}

// ----------------------------------------------------------------------------
// Document Slice
// ----------------------------------------------------------------------------

export interface DocumentState {
  projectPath: string | null
  projectSettings: ProjectSettings
  treeItems: TreeItem[]
  docContents: Map<string, ParsedDocContent>
  contentHashes: Map<string, string>
}

export interface DocumentActions {
  setProjectPath: (path: string | null) => void
  setProjectSettings: (settings: ProjectSettings) => void
  setTreeItems: (items: TreeItem[]) => void
  setDocContent: (id: string, content: string) => void
  /** Set document content from pre-parsed FileParserService data (avoids double-parsing) */
  setDocContentParsed: (id: string, data: import('../../compat/services').ParsedFileData) => void
  toggleCheckbox: (docId: string, checklistIndex: number, itemIndex: number, checked: boolean) => void
  clearDocuments: () => void
}

export type DocumentSlice = DocumentState & DocumentActions

// ----------------------------------------------------------------------------
// UI Slice
// ----------------------------------------------------------------------------

export interface UIState {
  focusedNode: string | null
  customFocusNodes: string[] | null
  selectedNodes: string[]
  quickPreviewNode: string | null
  expandedPanel: string | null
  expandedPanels: Set<string>
  collapsedFolders: Set<string>
  treeWidgetFolders: Set<string>
  pinnedNodes: Set<string>
  lockedNodes: Set<string>
  cardScale: number
  previewPanelPosition: Position
  contextMenu: ContextMenuState | null
  taskBoardDefaults: TaskBoardPrefsByView
  taskBoardByList: TaskBoardPrefsByList
  /** Currently active packet name (null = no packet active) */
  activePacketId: string | null
}

export interface UIActions {
  setFocusedNode: (id: string | null, customNodes?: string[] | null) => void
  getFocusBreadcrumbs: () => string[]
  selectNode: (id: string) => void
  setSelectedNodes: (ids: string[]) => void
  clearSelection: () => void
  setQuickPreviewNode: (id: string | null) => void
  openFullView: (id: string) => void
  closeNode: (id: string) => void
  setExpandedPanel: (id: string | null) => void
  togglePanel: (id: string) => void
  toggleFolderCollapse: (id: string) => void
  toggleTreeWidget: (folderId: string) => void
  setTreeWidgetFolders: (folders: Set<string>) => void
  togglePinnedNode: (id: string) => void
  setPinnedNodes: (nodes: Set<string>) => void
  toggleLockedNode: (id: string) => void
  setLockedNodes: (nodes: Set<string>) => void
  setCardScale: (scale: number) => void
  increaseCardScale: () => void
  decreaseCardScale: () => void
  setPreviewPanelPosition: (position: Position) => void
  showContextMenu: (x: number, y: number, nodeId: string, nodeType: string) => void
  closeContextMenu: () => void
  setTaskBoardPrefs: (taskListId: string, prefs: Partial<TaskBoardPrefs>) => void
  setActivePacketId: (id: string | null) => void
}

export type UISlice = UIState & UIActions

// ----------------------------------------------------------------------------
// Graph Slice
// ----------------------------------------------------------------------------

export interface GraphState {
  nodes: Node[]
  edges: Edge[]
  nodePositions: Map<string, Position>
  nodeDimensions: Map<string, Dimensions>
  viewport: Viewport | null
  viewportDimensions: ViewportDimensions | null
  layoutStates: Record<string, ViewLayoutState>
  measuredDimensions: Map<string, Dimensions>
  layoutNeedsMeasuredUpdate: boolean
}

export interface GraphActions {
  setNodePosition: (id: string, position: Position) => void
  setNodePositions: (positions: Map<string, Position>) => void
  setNodeDimension: (id: string, dimensions: Dimensions) => void
  setViewport: (viewport: Viewport) => void
  setViewportDimensions: (dims: ViewportDimensions) => void
  updateNodePosition: (nodeId: string, position: Position) => void
  updateNodePositions: (positions: Record<string, Position>) => void
  updateNode: (id: string, data: Partial<Node['data']>) => void
  updateNodes: (updates: Map<string, Partial<Node['data']>>) => void
  addNodes: (nodes: Node[]) => void
  removeNodes: (ids: string[]) => void
  setEdges: (edges: Edge[]) => void
  syncGraph: () => void
  rebuildGraph: (forceLayout?: boolean) => void
  clearGraph: () => void
  getViewLayoutState: () => ViewLayoutState | undefined
  clearViewLayout: (viewKey?: string) => void
  setMeasuredDimensions: (dimensions: Map<string, Dimensions>) => void
  updateMeasuredDimension: (nodeId: string, dims: Dimensions) => void
  relayoutWithMeasuredSizes: () => void
}

export type GraphSlice = GraphState & GraphActions

// ----------------------------------------------------------------------------
// Combined Store State
// ----------------------------------------------------------------------------

export type StoreState = DocumentSlice & UISlice & GraphSlice

// ----------------------------------------------------------------------------
// Slice Creator Type
// ----------------------------------------------------------------------------

export type SliceCreator<T> = StateCreator<StoreState, [], [], T>

// ----------------------------------------------------------------------------
// Node Diff Types (for delta updates)
// ----------------------------------------------------------------------------

export interface NodeDiff {
  added: Node[]
  removed: string[]
  updated: Map<string, Partial<Node>>
}

export interface EdgeDiff {
  added: Edge[]
  removed: string[]
}

// ----------------------------------------------------------------------------
// Node Data Types
// ----------------------------------------------------------------------------

export interface BaseNodeData {
  label: string
  cardScale?: number
}

export interface DocumentNodeData extends BaseNodeData {
  path: string
  type: 'core' | 'research' | 'spike' | 'other'
  tasks: TaskItem[]
  sections: TocSection[]
  checklists: ChecklistGroup[]
  loaded: boolean
  isFocused?: boolean
}

export interface FolderNodeData extends BaseNodeData {
  childCount: number
  type: 'core' | 'research' | 'archive' | 'other'
  isExpanded: boolean
}

export interface TocNodeData extends BaseNodeData {
  parentDocId: string
  docName: string
  sections: { title: string; level: number; sectionIndex: number; tasks?: number; tasksCompleted?: number }[]
}

export interface TaskListNodeData extends BaseNodeData {
  tasks: TaskItem[]
  parentDocId: string
}

export interface ChecklistNodeData extends BaseNodeData {
  group: ChecklistGroup
  parentDocId: string
}

export interface DiagramNodeData extends BaseNodeData {
  diagram: DiagramItem
  parentDocId: string
}

export interface FileTreeNodeData extends BaseNodeData {
  folderId: string
  basePath: string
  items: TreeItem[]
}

export type NodeData =
  | DocumentNodeData
  | FolderNodeData
  | TocNodeData
  | TaskListNodeData
  | ChecklistNodeData
  | DiagramNodeData
  | FileTreeNodeData

// Re-export TreeItem for convenience
export type { TreeItem }
