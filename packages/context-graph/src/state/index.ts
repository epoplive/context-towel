// ============================================================================
// Context Graph State - Main Exports
// ============================================================================

// Store
export { useGraphStore, getStoreSnapshot, resetStore, clearPersistedState } from './store'
export type { StoreState, ViewLayoutState } from './store'

// Types
export type {
  ParsedDocContent,
  TaskItem,
  TocSection,
  ChecklistGroup,
  DiagramItem,
  Position,
  Dimensions,
  Viewport,
  ViewportDimensions,
  NodeDimensions,
  ContextMenuItem,
  ContextMenuState,
  PersistedState,
  DocumentSlice,
  UISlice,
  GraphSlice,
  TreeItem,
} from './slices'

// Layout utilities
export { layoutNodes, getDocType, getFolderType, buildNodeSizeMap } from './layoutUtils'

// Re-export types from project-settings for convenience
export type { ProjectSettings } from '../compat/project-settings'
