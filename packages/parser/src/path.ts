// ============================================================================
// Path utilities
// ============================================================================
//
// Copied verbatim from LG's file-parser-core/path.ts.

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function matchesPathPattern(filePath: string, pattern: string | RegExp): boolean {
  return typeof pattern === 'string' ? filePath.startsWith(pattern) : pattern.test(filePath)
}
