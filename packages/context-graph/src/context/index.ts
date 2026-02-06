// ============================================================================
// Context Module - Export context generation utilities
// ============================================================================

export {
  generateClaudeMd,
  generateAgentsMd,
  generateStateSnapshot,
  FOCUS_START_MARKER,
  FOCUS_END_MARKER,
} from './generator'

export type { GeneratorOptions } from './generator'

export {
  buildWorkspaceStateFromGraph,
  syncInstructionFiles,
  createInstructionAutoWriter,
} from './autoWriter'

export type { InstructionTarget, InstructionWriterDeps } from './autoWriter'

export {
  syncClaudeTasks,
  createTaskAutoWriter,
} from './taskSync'

export type { TaskSyncDeps, TaskSyncResult, ClaudeTaskRecord } from './taskSync'

export {
  FRAMEWORK_RULES,
  FRAMEWORK_START_MARKER,
  FRAMEWORK_END_MARKER,
} from './frameworkRules'
