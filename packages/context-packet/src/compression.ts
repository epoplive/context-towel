// ============================================================================
// Version Compression — Keyframe/delta compression for packet versions
// ============================================================================

/** Configuration for version compression */
export interface VersionCompressionConfig {
  /** Keyframe interval — every Nth version is stored as a keyframe (default: 10) */
  keyframeInterval: number
  /** Max total versions to keep per packet (default: 50) */
  maxVersionsPerPacket: number
}

export const DEFAULT_COMPRESSION_CONFIG: VersionCompressionConfig = {
  keyframeInterval: 10,
  maxVersionsPerPacket: 50,
}

/**
 * Determine if the next version should be a keyframe (full content stored,
 * never pruned) based on how many deltas have accumulated since the last
 * keyframe.
 */
export function needsKeyframe(
  deltasSinceLastKeyframe: number,
  config: VersionCompressionConfig,
): boolean {
  return deltasSinceLastKeyframe >= config.keyframeInterval
}
