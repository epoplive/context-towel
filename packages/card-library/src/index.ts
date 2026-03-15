// Card Library - Shared markdown card rendering
// Unified block plugin system: parse + validate + render + serialize

// --- Core types and theme ---
export type {
  BlockTypeId,
  DetailLevel,
  BlockSourceRange,
  BlockSource,
  BlockParseError,
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

export { defaultTheme } from './blocks/types'

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
}
