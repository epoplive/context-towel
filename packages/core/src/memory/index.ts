// Memory system - advanced memory subsystems

// Vector state
export type {
  EmbeddingVector,
  ProblemStateVector,
  ProblemStateMetadata,
  SolutionEstimate,
  SolutionMetadata,
  StepDelta,
  StepAction,
  Trajectory,
  TrajectoryOutcome,
  ProgressMetric,
} from './vector-state'
export {
  DEFAULT_EMBEDDING_DIM,
  zeroVector,
  vectorFrom,
  dot,
  norm,
  cosineSimilarity as vectorCosineSimilarity,
  euclideanDistance,
  addVectors,
  subtractVectors,
  scaleVector,
  normalizeVector,
  averageVectors,
  embedText,
  buildProblemState,
  buildSolutionEstimate,
  buildStepDelta,
  measureProgress,
  createTrajectory,
  appendStep,
  resolveTrajectory,
} from './vector-state'

// Keyframe-delta compression
export type {
  Keyframe,
  DeltaSequence,
  CompressedDelta,
  ReconstructedState,
  KeyframeDeltaConfig,
  KeyframeDeltaStore,
} from './keyframe-delta'
export {
  createStore,
  captureKeyframe,
  getLatestKeyframe,
  getLatestSequence,
  appendDelta,
  reconstruct,
  reconstructAtStep,
  needsKeyframe,
  measureQuality,
  compact,
  getStorageSize,
} from './keyframe-delta'

// Pattern prediction
export type {
  ExpectedStep,
  ExpectedTrajectory,
  Prediction,
  DeviationRecord,
  CompressionMetrics,
} from './pattern-prediction'
export {
  predict,
  computeDeviation,
  computeAllDeviations,
  calculateCompression,
  isUnknownPattern,
  extractPattern,
  reconstructTrajectory,
  verifyReconstruction,
} from './pattern-prediction'

// Pattern learning
export type {
  CapturedTrajectory,
  DeviationCluster,
  LearnedPattern,
  TrainingRecord,
  LearningConfig,
} from './pattern-learning'
export {
  captureTrajectory,
  clusterDeviations,
  extractPatterns,
  suggestCodebookUpdate,
  exportTrainingData,
  getLearningStats,
} from './pattern-learning'

// Session search
export type {
  SessionRecord,
  SearchResult,
  SearchOptions,
  StrategyTransfer,
  KnowledgeResult,
  VectorIndex,
} from './session-search'
export {
  InMemoryVectorIndex,
  buildSessionRecord,
  findSimilarProblems,
  findSimilarTrajectories,
  transferStrategy,
  retrieveKnowledge,
} from './session-search'

// Session tree
export type {
  SessionEntryType,
  SessionEntry,
  MessageEntry,
  ToolCallEntry,
  ToolResultEntry,
  CompactionEntry,
  BranchSummaryEntry,
  KeyframeEntry,
  SessionTreeNode,
  SessionTreeConfig,
} from './session-tree'
export {
  SessionTree,
  summarizeBranch,
} from './session-tree'
