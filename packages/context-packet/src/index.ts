// Types
export type {
  PacketMetadata,
  PacketState,
  FileService,
  ProblemVector,
  CreatePacketOptions,
  SnapshotEntry,
  SnapshotOptions,
} from './types'

// Storage
export { FilePacketStore } from './storage/FilePacketStore'

// Packet Manager
export { PacketManager } from './PacketManager'

// Injection
export {
  extractProblemVector,
  formatProblemVectorSummary,
  injectPacketIntoContent,
  removePacketSection,
  PACKET_SECTION_START,
  PACKET_SECTION_END,
} from './injection'

// Template
export { generatePacketTemplate } from './template'

// AI Instructions
export { PACKET_WORKFLOW_INSTRUCTIONS, generateWorkflowSection } from './instructions'

// Task Sync
export type { TaskSyncData, TaskSyncResult } from './task-sync'
export {
  serializeTaskBlock,
  findTaskBlockById,
  extractTaskBlocks,
  buildTaskSourceMap,
  syncTaskToSourceFile,
} from './task-sync'
