// ============================================================================
// Context Graph Feature - Main Entry Point
// ============================================================================

// Types
export * from './types'

// DTOs
export type { ContextGraphTreeItemDTO } from './dto/contextGraphDTO'

// Controller
export { createContextGraphController } from './controller/ContextGraphController'
export type { ContextGraphController } from './controller/ContextGraphController'

// Panels
export { ContextGraphPanel } from './components/ContextGraphPanel'

// Plugin system
export {
  pluginRegistry,
  registerBuiltinPlugins,
  parseDocument,
  toContextMarkdown,
  // Plugins
  taskPlugin,
  checklistPlugin,
  diagramPlugin,
  tocPlugin,
  logPlugin,
  linkPlugin,
} from './plugins'

// Plugin types
export type {
  ParserPlugin,
  ContextOptions,
  WidgetProps,
  TaskItem,
  TaskStatus,
  TaskPriority,
  ChecklistGroup,
  ChecklistItem,
  DiagramItem,
  TocSection,
  LogSection,
  LogEntry,
  LinkItem,
  LinkKind,
} from './plugins'

// Helper functions
export {
  getStatusColor,
  getPriorityColor,
  getDiagramTypeColor,
} from './plugins'

// Widget components (from plugins)
export {
  InlineTaskCard,
  DetailedTaskCard,
  TaskNode,
  FullTaskNode,
  TaskListNode,
  ChecklistNode,
  DiagramNode,
  TOCNode,
} from './plugins'

// Document outline components
export {
  MiniDocOutline,
  hashContent,
  hasContentChanged,
} from './plugins/document-outline'

export type {
  MiniDocOutlineProps,
  OutlineSection,
  OutlineCounts,
  TaskOutlineItem,
  DocumentOutlineData,
} from './plugins/document-outline'

export type {
  TaskNodeData,
  FullTaskNodeData,
  TaskListNodeData,
  ChecklistNodeData,
  DiagramNodeData,
  TOCNodeData,
  TOCSectionItem,
} from './plugins'

// State management
export {
  useGraphStore,
  getStoreSnapshot,
  resetStore,
  clearPersistedState,
  layoutNodes,
  getDocType,
  getFolderType,
  buildNodeSizeMap,
} from './state'

export type {
  StoreState,
  ViewLayoutState,
  NodeDimensions,
  ViewportDimensions,
  ParsedDocContent,
  Position,
  Dimensions,
  Viewport,
  ContextMenuItem,
  ContextMenuState,
} from './state'

// Backwards compat alias
export { useGraphStore as useWorkspaceStore } from './state'

// Context generation
export {
  generateClaudeMd,
  generateAgentsMd,
  generateStateSnapshot,
  buildWorkspaceStateFromGraph,
  syncInstructionFiles,
  createInstructionAutoWriter,
  syncClaudeTasks,
  createTaskAutoWriter,
  FRAMEWORK_RULES,
  FRAMEWORK_START_MARKER,
  FRAMEWORK_END_MARKER,
  FOCUS_START_MARKER,
  FOCUS_END_MARKER,
} from './context'

export type {
  GeneratorOptions,
  InstructionTarget,
  InstructionWriterDeps,
  TaskSyncDeps,
  TaskSyncResult,
  ClaudeTaskRecord,
} from './context'

// Components
export {
  DocumentGraph,
  FolderNode,
  DocumentNode,
  FileTreeNode,
  FloatingEdge,
  nodeTypes,
  edgeTypes,
} from './components'

// Views
export { ContextGraphView } from './views/ContextGraphView'
export { ContextTasksView } from './views/ContextTasksView'

export type { ContextTasksViewProps } from './views/ContextTasksView'

export type {
  FolderNodeData,
  DocumentNodeData,
  FileTreeNodeData,
} from './components'

// Hooks for parsed content
export {
  useContextTasks,
  useContextChecklists,
  useContextDiagrams,
  useContextToc,
  useContextLogs,
  useAllContextParsing,
  useContextGraphController,
} from './hooks'

export type {
  UseContextTasksResult,
  UseAllContextParsingResult,
} from './hooks'

// FileParserService adapter
export {
  registerContextGraphParsers,
  unregisterContextGraphParsers,
  getContextGraphParserIds,
} from './plugins/fileParserAdapter'
