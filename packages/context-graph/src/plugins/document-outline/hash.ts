// ============================================================================
// Content Hashing for Cache Invalidation
// ============================================================================

/**
 * Fast hash function for content comparison (djb2)
 */
export function hashContent(content: string): string {
  let hash = 5381
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) ^ content.charCodeAt(i)
  }
  // Convert to unsigned 32-bit and then to hex
  return (hash >>> 0).toString(16)
}

/**
 * Check if content has changed by comparing hashes
 */
export function hasContentChanged(
  newContent: string,
  cachedHash: string | undefined
): boolean {
  if (!cachedHash) return true
  return hashContent(newContent) !== cachedHash
}
