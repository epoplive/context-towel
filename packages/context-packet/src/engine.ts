/**
 * Engine-only entry point — no card-library dependency.
 *
 * Use this when you need PacketEngine + storage but don't need
 * task-sync (which requires @context-towel/card-library).
 *
 * import { PacketEngine, MikroOrmPacketDatabase } from '@context-towel/context-packet/engine'
 */

// Types
export type {
  VersionTrigger,
  DeltaType,
  NodeState,
  NodeType,
  ZoomLayer,
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

// Storage
export type { PacketDatabase } from './storage/PacketDatabase.js'
export { InMemoryPacketDatabase } from './storage/InMemoryPacketDatabase.js'
export { MikroOrmPacketDatabase } from './storage/MikroOrmPacketDatabase.js'
export { packetEntities } from './storage/entities.js'

// Document storage
export type { DocStore } from './storage/DocStore.js'
export { FsDocStore } from './storage/FsDocStore.js'

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

// Workflow
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
  StageStatus,
  GateEvalContext,
} from './workflow.js'
