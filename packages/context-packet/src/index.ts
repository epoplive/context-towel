// Types — v2
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

// Instructions (keep, Phase 5 rewrites)
export { PACKET_WORKFLOW_INSTRUCTIONS, generateWorkflowSection } from './instructions.js'

// Context extraction + AICCL compilation
export { compileToAiccl, buildContextOutput, readActiveMarker } from './cli/context.js'
export type { FileReader, ContextOutputOptions } from './cli/context.js'

// AICCL — proof-assistant domain types and parsers
export type {
  CompMap,
  CompBlock,
  CriterionState as AicclCriterionState,
  ProofCriterion,
  SolvedState,
  ProblemState,
  ProofStep,
  DependencyRelation,
  NodeDependency,
} from './aiccl/index.js'
export {
  parseCompMaps,
  parseCompBlocks,
  resolveSymbol,
  resolveAllSymbols,
  buildSymbolTable,
} from './aiccl/index.js'

// Docs — AICCL documentation layer
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
