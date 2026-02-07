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
export type { BlockUpdate } from './blocks/persist'

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
}
