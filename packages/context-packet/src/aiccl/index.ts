// ============================================================================
// AICCL Module — Proof-assistant domain types and parsers
// ============================================================================

export type {
  CompMap,
  CompBlock,
  CriterionState,
  ProofCriterion,
  SolvedState,
  ProblemState,
  ProofStep,
  DependencyRelation,
  NodeDependency,
} from './types.js'

export {
  parseCompMaps,
  parseCompBlocks,
  resolveSymbol,
  resolveAllSymbols,
  buildSymbolTable,
} from './parseCompMaps.js'
