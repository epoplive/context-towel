// ============================================================================
// Context Packet Types — Types for the packet system
// ============================================================================

// ── File Service (kept for PacketManager compatibility) ────────────────────

/** Minimal file system interface for packet operations */
export interface FileService {
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
  mkdir(dirPath: string): Promise<void>
  list(dirPath: string): Promise<{ name: string; path: string; is_dir: boolean }[]>
  remove(filePath: string): Promise<void>
}

// ── Legacy types (kept for PacketManager compatibility, Phase 3 removes) ───

/** Metadata about a packet, stored in the state file */
export interface PacketMetadata {
  name: string
  createdAt: string
  updatedAt: string
  planFileRef?: string
  tags?: string[]
  /** Maps task ID → source file path for bidirectional sync */
  taskSources?: Record<string, string>
}

/** State file tracking active packet and metadata index */
export interface PacketState {
  activePacket: string | null
  packets: Record<string, PacketMetadata>
}

/** A snapshot entry from version history */
export interface SnapshotEntry {
  timestamp: string
  path: string
}

/** Options for version history snapshots */
export interface SnapshotOptions {
  /** Minimum seconds between snapshots (default: 30) */
  debounceSeconds?: number
}

// ── v2 Types ───────────────────────────────────────────────────────────────

export type VersionTrigger = 'delta' | 'keyframe' | 'collapse'
export type DeltaType = 'discovery' | 'failure' | 'success' | 'promotion' | 'collapse' | 'mutation'
export type NodeState = 'active' | 'success' | 'failed'
export type NodeType = 'work' | 'reference' | 'test' | 'diagram'
export type ZoomLayer = 'continent' | 'region' | 'district' | 'street' | 'ground'

export interface PacketVersion {
  id: string
  packetName: string
  timestamp: number
  trigger: VersionTrigger
  content: string
  deltaFromPrev?: string
}

export interface DeltaEntry {
  id: string
  packetName: string
  timestamp: number
  nodeId?: string
  type: DeltaType
  content: string
}

export interface KeyframeEntry {
  id: string
  packetName: string
  timestamp: number
  triggerNodeId: string
  content: string
}

export interface PatternEntry {
  id: string
  subsystem: string
  codebase?: string
  content: string
  sourcePacket: string
  createdAt: number
  updatedAt: number
  confidence: number
}

export interface PacketMeta {
  name: string
  createdAt: number
  updatedAt: number
  activePacket?: boolean
  planFileRef?: string
  tags?: string[]
}

export interface PacketEdge {
  id: string
  packetName: string
  sourceNode: string
  targetNode: string
  createdAt: number
}

export interface ProblemVector {
  current: string
  target: string
  approach: string
}

export interface CreatePacketOptions {
  planFileRef?: string
  seedTasks?: string[]
  problemVector?: ProblemVector
}
