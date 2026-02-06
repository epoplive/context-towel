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
export type { FormBlockData } from './blocks/form'

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

import { registerTaskBlock as _regTask } from './plugins/task'
import { registerChecklistBlock as _regChecklist } from './plugins/checklist'
import { registerDiagramBlock as _regDiagram } from './plugins/diagram'
import { registerTocBlock as _regToc } from './plugins/toc'

/** Register all card library plugins at once */
export function registerAllCardPlugins(): void {
  _regTask()
  _regChecklist()
  _regDiagram()
  _regToc()
}
