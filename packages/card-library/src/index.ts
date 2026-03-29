// Card Library - Shared markdown card rendering
// Unified block plugin system: parse + validate + render + serialize

// --- Core types and theme ---
export type {
  BlockTypeId,
  DetailLevel,
  ParsingLevel,
  BlockSourceRange,
  BlockSource,
  BlockParseError,
  BlockCapabilities,
  BlockInstance,
  BlockDefinition,
  BlockRuntime,
  ThemeTokens,
  BlockRenderProps,
  BlockEditEvent,
  CardHost,
  HostApiAllowlistEntry,
  HostApiExecuteArgs,
  HostApiExecuteResult,
} from './blocks/types'

export { defaultTheme, BASIC_CAPABILITIES, resolveCapabilities, hasCapability } from './blocks/types'

// --- Registry ---
export { blockRegistry } from './blocks/registry'
export type { BlockRegistry } from './blocks/registry'

// --- Parse & Validate ---
export { registerCoreBlocks } from './blocks/core'
export { parseMarkdownBlocks } from './blocks/markdown'
export { validateBlockYaml } from './blocks/validation'

// --- Runtime ---
export { toJsonRuntime } from './blocks/adapter'
export { toRuntimeBlock, toRuntimeBlocks, applyRuntimePatches } from './blocks/runtime'
export type { RuntimePatch } from './blocks/runtime'

// --- Persistence ---
export {
  serializeBlockData,
  replaceBlockInMarkdown,
  updateBlockInMarkdown,
  applyRuntimePatchesToMarkdown,
} from './blocks/persist'
export type { BlockUpdate } from './blocks/types'
export { formatFencedCodeBlock, getFencePreferenceFromRaw } from './blocks/fences'
export type { FenceMarker, FencePreference } from './blocks/fences'

// --- Form block ---
export type { FormBlockData, FormResults, FormLastResult, ResultFieldMapping } from './blocks/form'

// --- Rendering ---
export { CardThemeProvider, useCardTheme } from './theme'
export type { CardThemeProviderProps } from './theme'
export { CardRenderer, CardListRenderer } from './CardRenderer'
export type { CardRendererProps, CardListRendererProps } from './CardRenderer'

// --- Plugins ---
export { registerTaskBlock, TaskCard, taskBlockDefinition } from './plugins/task'
export type { TaskData, TaskStatus, TaskPriority, ChecklistItem, LogEntry } from './plugins/task'
export { statusColors, priorityColors, statusLabels } from './plugins/task'

export { registerChecklistBlock, ChecklistCard, checklistBlockDefinition } from './plugins/checklist'
export type { ChecklistGroupData, ChecklistItemData } from './plugins/checklist'

export { registerDiagramBlock, DiagramCard, diagramBlockDefinition } from './plugins/diagram'
export type { DiagramData } from './plugins/diagram'
export { diagramTypeColors } from './plugins/diagram'

export { registerTocBlock, TocCard, tocBlockDefinition } from './plugins/toc'
export type { TocData, TocSectionData } from './plugins/toc'

export { registerNoteBlock, NoteCard, noteBlockDefinition } from './plugins/note'
export type { NoteData } from './plugins/note'
export { noteTypeColors } from './plugins/note'

export { registerRuleBlock, RuleCard, ruleBlockDefinition } from './plugins/rule'
export type { RuleData } from './plugins/rule'
export { ruleTypeColors } from './plugins/rule'

export { registerQuestionBlock, QuestionCard, questionBlockDefinition } from './plugins/question'
export type { QuestionBlockData, QuestionOption, Question } from './plugins/question'

export { registerFormBlock, FormCard, formBlockDefinition } from './plugins/form'

export { registerCommandResultBlock, CommandResultCard, commandResultBlockDefinition } from './plugins/command-result'
export type { CommandResultData } from './plugins/command-result'

export { registerFileContentBlock, FileContentCard, fileContentBlockDefinition } from './plugins/file-content'
export type { FileContentData } from './plugins/file-content'

export { registerFileDiffBlock, FileDiffCard, fileDiffBlockDefinition } from './plugins/file-diff'
export type { FileDiffData, DiffHunk } from './plugins/file-diff'

export { registerFileListBlock, FileListCard, fileListBlockDefinition } from './plugins/file-list'
export type { FileListData, FileListMatch } from './plugins/file-list'

export { registerNodeBlock, registerNodeMapBlock, NodeCard, nodeBlockDefinition, nodeMapBlockDefinition } from './plugins/node'
export type { NodeBlockData, NodeMapBlockData, NodeState, ZoomLayer } from './plugins/node'
export { nodeStateColors, zoomLayerLabels } from './plugins/node'

export { registerKanbanBlock, KanbanCard, kanbanBlockDefinition } from './plugins/kanban'
export type { KanbanData, KanbanTask, KanbanGroupBy, KanbanTaskStatus, KanbanTaskPriority } from './plugins/kanban'
export { KANBAN_STATUS_LABELS, KANBAN_PRIORITY_LABELS, KANBAN_STATUS_COLORS, KANBAN_PRIORITY_COLORS } from './plugins/kanban'

export {
  registerDependencyGraphBlock,
  DependencyGraphCard,
  dependencyGraphBlockDefinition,
} from './plugins/dependency-graph'
export type {
  DepGraphData,
  DepGraphTask,
  DepGraphTaskStatus,
  DepGraphTaskPriority,
} from './plugins/dependency-graph'
export { DEP_STATUS_COLORS, DEP_PRIORITY_COLORS, DEP_STATUS_LABELS } from './plugins/dependency-graph'

export { registerTimelineBlock, TimelineCard, timelineBlockDefinition } from './plugins/timeline'
export type { TimelineData, TimelinePhase, TimelineTask, TimelineStatus } from './plugins/timeline'
export { TIMELINE_STATUS_LABELS, TIMELINE_STATUS_COLORS, parseDateMs, formatDateLabel } from './plugins/timeline'

export { registerIndexBlock, IndexCard, indexBlockDefinition, EntityRegistry, parseIndexBlock, serializeIndexBlock, FileRefResolver } from './plugins/index'
export { EntityRefChip, FileRefChip, EntityRegistryContext, useEntityRegistry, entityTypeColors as indexEntityColors, ENTITY_ID_PATTERN } from './plugins/index'
export { ExpandableFileContent, ExpandableRefChip } from './plugins/index'
export type {
  EntityType, EntityEntry, FileEntry, PipelineEntry, ContextLinkEntry,
  FileRef, PipelineStep, EntityRegistryData, IndexBlockData, IndexSection, IndexLayer, ExpandableMarker,
  ResolvedFileRef, FileReader, EntityRefChipProps, FileRefChipProps,
  IndexCardProps, ExpandableFileRefProps, ExpandableRefChipProps,
} from './plugins/index'
export { ENTITY_PREFIXES, LAYER_TYPES, LAYER_REFS, parseEntityId, parseFileRef } from './plugins/index'

// --- Graph System (unified node/edge registry, layout, interactions) ---
export {
  // Registry
  GraphRegistry,
  graphRegistry,
  // Defaults
  DEFAULT_LAYOUT_HINTS,
  DEFAULT_INTERACTIONS,
  // Adapter + registration
  adaptBlockToNodeType,
  registerContentNodeTypes,
  registerPacketNodeTypes,
  registerPacketNodeTypeStubs,
  packetNodeStubs,
  registerAllBuiltInTypes,
  // Graph contexts
  DocsGraphContext,
  PacketGraphContext,
  PlanGraphContext,
  createGraphContext,
  withLayout,
  // Store
  createGraphStore,
  // Canvas (requires @xyflow/react)
  GraphCanvas,
  // Layout utilities
  resolveCollisions,
  estimateNodeSize,
  buildNodeSizeMap,
  DEFAULT_NODE_SIZES,
  FALLBACK_NODE_SIZE,
  MindmapLayout,
  createFocusLayout,
  // Built-in edge types
  structuralEdge,
  referenceEdge,
  dependencyEdge,
  temporalEdge,
  attachmentEdge,
  dataFlowEdge,
  builtInEdgeTypes,
  registerBuiltInEdgeTypes,
} from './graph'

export type {
  // Render
  RenderContext,
  NodeRenderProps,
  SizeCategory,
  LayoutHints,
  // Node types
  NodeTypeDefinition,
  NodeCategory,
  DetectResult,
  ParseResult as GraphParseResult,
  ParsedItem,
  SourceMatch,
  // Edge types
  EdgeTypeDefinition,
  EdgeStyle,
  EdgeData,
  // Layout
  LayoutStrategy,
  LayoutCapabilities,
  LayoutNode,
  LayoutEdge,
  LayoutViewport,
  LayoutPosition,
  LayoutDimensions,
  LayoutResult,
  // Interactions
  InteractionConfig,
  ContextMenuItem,
  ContextMenuFactory,
  // Graph context
  GraphContextConfig,
  // Store types
  GraphStoreState,
  GraphNode,
  GraphEdge,
  GraphViewport,
  ContextMenuState,
  // Canvas types
  GraphCanvasProps,
  // Adapter types
  AdaptBlockOptions,
} from './graph'

// --- Pipeline Card Types ---
export { CompetitorCard, competitorBlockDefinition, registerCompetitorBlock } from './plugins/competitor'
export type { CompetitorBlockData } from './plugins/competitor'
export { PatternCard, patternBlockDefinition, registerPatternBlock } from './plugins/pattern'
export type { PatternBlockData } from './plugins/pattern'
export { SitePageCard, SitePageGraphNode, sitePageBlockDefinition, registerSitePageBlock } from './plugins/sitepage'
export type { SitePageBlockData } from './plugins/sitepage'

export { ComponentCard, componentBlockDefinition, registerComponentBlock } from './plugins/component'
export type { ComponentBlockData } from './plugins/component'
export { ColorTokenCard, colorTokenBlockDefinition, registerColorTokenBlock } from './plugins/color-token'
export type { ColorTokenBlockData } from './plugins/color-token'
export { TypographyCard, typographyBlockDefinition, registerTypographyBlock } from './plugins/typography'
export type { TypographyBlockData } from './plugins/typography'

// --- Document Viewer ---
export { DocumentTOC, buildTocEntries } from './viewer'
export type { DocumentTOCProps, TocEntry, TocBuilderOptions } from './viewer'

// --- Shared Components ---
export { CopyButton } from './components/CopyButton'
export { CodeBlock } from './components/CodeBlock'

import { registerTaskBlock as _regTask } from './plugins/task'
import { registerChecklistBlock as _regChecklist } from './plugins/checklist'
import { registerDiagramBlock as _regDiagram } from './plugins/diagram'
import { registerTocBlock as _regToc } from './plugins/toc'
import { registerNoteBlock as _regNote } from './plugins/note'
import { registerRuleBlock as _regRule } from './plugins/rule'
import { registerQuestionBlock as _regQuestion } from './plugins/question'
import { registerFormBlock as _regForm } from './plugins/form'
import { registerCommandResultBlock as _regCommandResult } from './plugins/command-result'
import { registerFileContentBlock as _regFileContent } from './plugins/file-content'
import { registerFileDiffBlock as _regFileDiff } from './plugins/file-diff'
import { registerFileListBlock as _regFileList } from './plugins/file-list'
import { registerNodeBlock as _regNode, registerNodeMapBlock as _regNodeMap } from './plugins/node'
import { registerKanbanBlock as _regKanban } from './plugins/kanban'
import { registerDependencyGraphBlock as _regDepGraph } from './plugins/dependency-graph'
import { registerTimelineBlock as _regTimeline } from './plugins/timeline'
import { registerIndexBlock as _regIndex } from './plugins/index'
import { registerCompetitorBlock as _regCompetitor } from './plugins/competitor'
import { registerPatternBlock as _regPattern } from './plugins/pattern'
import { registerSitePageBlock as _regSitePage } from './plugins/sitepage'
import { registerColorTokenBlock as _regColorToken } from './plugins/color-token'
import { registerTypographyBlock as _regTypography } from './plugins/typography'
import { registerComponentBlock as _regComponent } from './plugins/component'

/** Register all card library plugins at once */
export function registerAllCardPlugins(): void {
  _regTask()
  _regChecklist()
  _regDiagram()
  _regToc()
  _regNote()
  _regRule()
  _regQuestion()
  _regForm()
  _regCommandResult()
  _regFileContent()
  _regFileDiff()
  _regFileList()
  _regNode()
  _regNodeMap()
  _regKanban()
  _regDepGraph()
  _regTimeline()
  _regIndex()
  _regCompetitor()
  _regPattern()
  _regSitePage()
  _regColorToken()
  _regTypography()
  _regComponent()
}
