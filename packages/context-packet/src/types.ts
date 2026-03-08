// ============================================================================
// Context Packet Types — Minimal types for the markdown-first packet system
// ============================================================================

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

/** Minimal file system interface for packet operations */
export interface FileService {
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
  mkdir(dirPath: string): Promise<void>
  list(dirPath: string): Promise<{ name: string; path: string; is_dir: boolean }[]>
  remove(filePath: string): Promise<void>
}

/** Problem vector extracted from a packet */
export interface ProblemVector {
  current: string
  target: string
  approach: string
}

/** Options for creating a new packet */
export interface CreatePacketOptions {
  planFileRef?: string
  seedTasks?: string
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
