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
  nodePlugin,
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
  NodeItem,
  NodeState,
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
  getNodeStateColor,
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
  NodeNode,
  TOCNode,
} from './plugins'

// Task board (store-free)
export { TaskBoardView } from './plugins/task/components/board/TaskBoardView'
export type { TaskBoardViewProps } from './plugins/task/components/board/TaskBoardView'
export { TaskDependencyView } from './plugins/task/components/board/TaskDependencyView'
export type { TaskBoardGroupBy, TaskBoardPrefs } from './state/slices'

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
  NodeNodeData,
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
  injectPacketIntoContent,
  removePacketSection,
  FRAMEWORK_RULES,
  FRAMEWORK_START_MARKER,
  FRAMEWORK_END_MARKER,
  FOCUS_START_MARKER,
  FOCUS_END_MARKER,
  PACKET_SECTION_START,
  PACKET_SECTION_END,
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

// Packet workspace
export { PacketWorkspace } from './components/PacketWorkspace'
export type { PacketWorkspaceProps, SessionLogEntry } from './components/PacketWorkspace'

// Packet panel
export { PacketPanel } from './components/packet/PacketPanel'
export type { PacketPanelProps } from './components/packet/PacketPanel'
export { usePacketPanel } from './hooks/usePacketPanel'
export type { UsePacketPanelResult, NodeSummary } from './hooks/usePacketPanel'
export type { ProblemVectorEntry, DeltaLogEntry, PacketSection } from './components/packet/parsePacketContent'
export {
  parsePacketSections,
  parseProblemVectors,
  parseDeltaLog,
} from './components/packet/parsePacketContent'

// Generic workspace board
export { WorkspaceBoard } from './components/WorkspaceBoard'
export type { WorkspaceBoardProps, WorkspaceContentItem, WorkspaceHistoryEntry } from './components/WorkspaceBoard'

// Packet service
export {
  configurePacketService,
  resetPacketService,
  noopPacketService,
} from './compat/services'
export type { PacketServiceInterface } from './compat/services'
