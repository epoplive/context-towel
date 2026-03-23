// ============================================================================
// AICCL Domain Types — Proof-assistant types for the compilation pipeline
// ============================================================================
//
// These extend the existing packet types (NodeContent, NodeState, ZoomLayer).
// They don't replace anything — they add the proof-assistant layer on top.

import type { NodeState, ZoomLayer } from '../types.js'

// ── Compression Maps ────────────────────────────────────────────────────────

/** A symbol compression table: symbol → expansion, with optional inheritance */
export interface CompMap {
  id: string
  parentId?: string
  symbols: Map<string, string>
}

/** A semantic container block: <comp:NAME[:LAYER]> ... </comp:NAME> */
export interface CompBlock {
  id: string
  layer?: string
  content: string
  mapRefs: string[]
}

// ── Proof System ────────────────────────────────────────────────────────────

export type CriterionState = 'pending' | 'proven' | 'failed'

/** A verifiable criterion in the solved state */
export interface ProofCriterion {
  id: string
  text: string
  state: CriterionState
  /** Node ID that proves this criterion */
  proofRef?: string
}

/** What "done" looks like — decomposed into verifiable criteria */
export interface SolvedState {
  criteria: ProofCriterion[]
}

/** Where we are — established facts and identified gaps */
export interface ProblemState {
  facts: ProofCriterion[]
  gaps: ProofCriterion[]
}

/** A proof step node — extends the existing NodeContent concept */
export interface ProofStep {
  id: string
  state: NodeState
  layer?: ZoomLayer
  subsystem?: string
  claim: string
  body: string
  derivesFrom: string[]
  proves: string[]
}

export type DependencyRelation = 'derives' | 'proves' | 'blocks' | 'uses'

/** An edge between nodes in the proof graph */
export interface NodeDependency {
  source: string
  target: string
  relation: DependencyRelation
}
