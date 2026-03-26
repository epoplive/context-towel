// ============================================================================
// PacketDatabase — Storage interface for the v2 packet system
// ============================================================================

import type {
  PacketVersion,
  DeltaEntry,
  KeyframeEntry,
  PatternEntry,
  PacketMeta,
  PacketEdge,
  VersionTrigger,
} from '../types.js'

export interface PacketDatabase {
  // ── Version snapshots ──────────────────────────────────────────────────

  /** Write a new version snapshot for a packet. Returns the version ID. */
  writeVersion(packetName: string, trigger: VersionTrigger, content: string, delta?: string): Promise<string>

  /** Get versions for a packet, newest first. Optional limit. */
  getVersions(packetName: string, limit?: number): Promise<PacketVersion[]>

  /** Get a single version by ID. */
  getVersion(id: string): Promise<PacketVersion | null>

  /** Get the most recent version for a packet. */
  getLatestVersion(packetName: string): Promise<PacketVersion | null>

  /** Delete a specific version by ID. */
  deleteVersion(id: string): Promise<void>

  /**
   * Prune versions for a packet, keeping the most recent `keepCount` versions.
   * Keyframe and collapse versions are always retained regardless of keepCount.
   * Returns the number of versions deleted.
   */
  pruneVersions(packetName: string, keepCount: number): Promise<number>

  // ── Delta log ──────────────────────────────────────────────────────────

  /** Append a delta entry. Returns the delta ID. */
  appendDelta(packetName: string, entry: Omit<DeltaEntry, 'id' | 'packetName' | 'timestamp'>): Promise<string>

  /** Get all deltas for a packet, optionally since a timestamp. */
  getDeltas(packetName: string, since?: number): Promise<DeltaEntry[]>

  /** Get all deltas for a specific node in a packet. */
  getDeltasForNode(packetName: string, nodeId: string): Promise<DeltaEntry[]>

  /**
   * Delete all deltas for a specific node in a packet that occurred before a
   * given timestamp. Used to prune source deltas after collapse/promote writes
   * a keyframe.  Returns the number of deltas deleted.
   */
  deleteDeltasBeforeForNode(packetName: string, nodeId: string, beforeTimestamp: number): Promise<number>

  // ── Keyframes ──────────────────────────────────────────────────────────

  /** Write a keyframe snapshot. Returns the keyframe ID. */
  writeKeyframe(packetName: string, triggerNodeId: string, content: string): Promise<string>

  /** Get all keyframes for a packet. */
  getKeyframes(packetName: string): Promise<KeyframeEntry[]>

  /** Get the most recent keyframe for a packet. */
  getLatestKeyframe(packetName: string): Promise<KeyframeEntry | null>

  // ── Patterns ───────────────────────────────────────────────────────────

  /** Write a new pattern entry. Returns the pattern ID. */
  writePattern(pattern: Omit<PatternEntry, 'id' | 'createdAt' | 'updatedAt' | 'confidence'>): Promise<string>

  /** Find patterns by subsystem, optionally filtered by codebase. */
  findPatterns(subsystem: string, codebase?: string): Promise<PatternEntry[]>

  /** Get all patterns across all subsystems. */
  getAllPatterns(): Promise<PatternEntry[]>

  /** Increment the confidence score for a pattern. */
  incrementConfidence(patternId: string): Promise<void>

  // ── Edges ─────────────────────────────────────────────────────────────

  /** Add an edge between two nodes. Returns the edge ID. */
  addEdge(packetName: string, sourceNode: string, targetNode: string): Promise<string>

  /** Remove an edge between two nodes. */
  removeEdge(packetName: string, sourceNode: string, targetNode: string): Promise<void>

  /** Get all edges connected to a node (as source or target). */
  getEdgesForNode(packetName: string, nodeId: string): Promise<PacketEdge[]>

  /** Get all edges in a packet. */
  getAllEdges(packetName: string): Promise<PacketEdge[]>

  // ── Packet metadata ────────────────────────────────────────────────────

  /** Get metadata for a packet by name. */
  getPacketMeta(name: string): Promise<PacketMeta | null>

  /** Set or update metadata fields for a packet. Creates if not exists. */
  setPacketMeta(name: string, meta: Partial<PacketMeta>): Promise<void>

  /** List all packet metadata records. */
  listPackets(): Promise<PacketMeta[]>

  /** Delete a packet and all associated data (versions, deltas, keyframes). */
  deletePacket(name: string): Promise<void>

  /** Get the name of the currently active packet, or null. */
  getActivePacket(): Promise<string | null>

  /** Set the active packet by name, or null to clear. */
  setActivePacket(name: string | null): Promise<void>
}
