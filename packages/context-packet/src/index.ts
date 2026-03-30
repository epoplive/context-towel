// Types — v2
export type {
  VersionTrigger,
  DeltaType,
  NodeState,
  NodeType,
  PacketVersion,
  DeltaEntry,
  KeyframeEntry,
  PatternEntry,
  PacketMeta,
  PacketEdge,
  ProblemVector,
  CreatePacketOptions,
  FileService,
} from './types.js'

// Storage — v2
export type { PacketDatabase } from './storage/PacketDatabase.js'
export { InMemoryPacketDatabase } from './storage/InMemoryPacketDatabase.js'
export { SqljsPacketDatabase } from './storage/SqljsPacketDatabase.js'

// Engine
export { PacketEngine } from './PacketEngine.js'

// Compression
export type { VersionCompressionConfig } from './compression.js'
export { DEFAULT_COMPRESSION_CONFIG, needsKeyframe } from './compression.js'

// Template
export { generatePacketMarkdown } from './template.js'
export type {
  ProblemVectorState,
  NodeContent,
  GeneratePacketOptions,
  CriterionMark,
  FactMark,
  VectorCriterion,
  VectorFact,
} from './template.js'

// Injection
export {
  extractProblemVectors,
  formatInjectionContent,
  injectPacketIntoContent,
  removePacketSection,
  PACKET_SECTION_START,
  PACKET_SECTION_END,
} from './injection.js'

// Instructions
export { PACKET_WORKFLOW_INSTRUCTIONS, generateWorkflowSection } from './instructions.js'

// Context extraction
export { buildContext, buildContextOutput, readActiveMarker } from './cli/context.js'
export type { FileReader, ContextOutputOptions } from './cli/context.js'

// Document storage abstraction
export type { DocStore } from './storage/DocStore.js'
export { FsDocStore } from './storage/FsDocStore.js'

// MikroORM storage (requires @mikro-orm/core as peer dep)
// Consumers with MikroORM import these directly:
//   import { MikroOrmPacketDatabase, packetEntities } from '@context-towel/context-packet/storage/MikroOrmPacketDatabase'
// Not re-exported from main index to avoid requiring @mikro-orm/core for all consumers.

// Workflow schema
export {
  parseWorkflow,
  evaluateWorkflow,
  evaluateGate,
} from './workflow.js'
export type {
  WorkflowSchema,
  WorkflowStage,
  WorkflowGate,
  WorkflowOutput,
  WorkflowStructureEntry,
  FormatDefinition,
  FormatValidationResult,
  StageStatus,
  GateEvalContext,
} from './workflow.js'

// Docs — documentation layer
export { materializeDocs, generateRootIndex, generateSubsystemIndex } from './docs/materialize.js'
export { renderPatternAsHuman, renderSubsystemDocs } from './docs/render.js'

// Task sync (keep for now)
export type { TaskSyncData, TaskSyncResult } from './task-sync.js'
export {
  serializeTaskBlock,
  findTaskBlockById,
  extractTaskBlocks,
  buildTaskSourceMap,
  syncTaskToSourceFile,
} from './task-sync.js'
