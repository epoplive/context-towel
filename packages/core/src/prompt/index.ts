// Prompt management system - implements PromptManagementPort from @dm/felix-runtime

// Types
export type {
  PromptBlockPriority,
  BlockOptions,
  PromptBlock,
  PromptManagementPort,
} from './types.js'

export { PRIORITY_WEIGHTS } from './types.js'

// Core state manager
export { PromptBlockStateManager } from './prompt-block-state.js'

// Composition / assembly
export { PromptComposer } from './prompt-composition.js'

// Port implementation (main entry point)
export { PromptManager } from './prompt-port.js'
