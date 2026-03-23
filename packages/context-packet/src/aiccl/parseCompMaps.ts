// ============================================================================
// AICCL Comp Map Parser — Parses <comp:map:NAME> and <comp:NAME> blocks
// ============================================================================

import type { CompMap, CompBlock } from './types.js'

// ── Comp Map Parsing ────────────────────────────────────────────────────────

const COMP_MAP_RE = /<comp:map:(\w[\w-]*)(?:\s+uses="(\w[\w-]*)")?\s*>([\s\S]*?)<\/comp:map:\1>/g

/**
 * Parse `<comp:map:NAME [uses="PARENT"]>` blocks from content.
 * Each line inside: `symbol=expansion` pairs, space-separated.
 */
export function parseCompMaps(content: string): CompMap[] {
  const maps: CompMap[] = []
  COMP_MAP_RE.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = COMP_MAP_RE.exec(content)) !== null) {
    const id = match[1]
    const parentId = match[2] || undefined
    const body = match[3]
    const symbols = new Map<string, string>()

    for (const line of body.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Parse space-separated symbol=expansion pairs
      const pairRe = /(\S+?)=(\S+)/g
      let pm: RegExpExecArray | null
      while ((pm = pairRe.exec(trimmed)) !== null) {
        symbols.set(pm[1], pm[2])
      }
    }

    maps.push({ id, parentId, symbols })
  }

  return maps
}

// ── Comp Block Parsing ──────────────────────────────────────────────────────

const COMP_BLOCK_RE = /<comp:(\w[\w-]*)(?::(\w[\w-]*))?\s*>([\s\S]*?)<\/comp:\1>/g

/**
 * Parse `<comp:NAME[:LAYER]>` container blocks.
 * These are semantic scope markers — content is opaque.
 */
export function parseCompBlocks(content: string): CompBlock[] {
  const blocks: CompBlock[] = []
  COMP_BLOCK_RE.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = COMP_BLOCK_RE.exec(content)) !== null) {
    const id = match[1]
    // Skip map blocks — they're handled by parseCompMaps
    if (content.slice(match.index, match.index + 15).includes('comp:map:')) continue

    const layer = match[2] || undefined
    const blockContent = match[3].trim()

    // Find map references in the body (symbols that match known maps)
    const mapRefs: string[] = []
    const mapRefRe = /maps?:\s*([\w,\s-]+)/i
    const refMatch = blockContent.match(mapRefRe)
    if (refMatch) {
      mapRefs.push(...refMatch[1].split(',').map(s => s.trim()).filter(Boolean))
    }

    blocks.push({ id, layer, content: blockContent, mapRefs })
  }

  return blocks
}

// ── Symbol Resolution ───────────────────────────────────────────────────────

/**
 * Resolve a single symbol by walking the map inheritance chain.
 * Returns the expansion string, or the original symbol if not found.
 */
export function resolveSymbol(
  symbol: string,
  maps: CompMap[],
  startMapId?: string,
): string {
  const mapIndex = new Map<string, CompMap>()
  for (const m of maps) mapIndex.set(m.id, m)

  const visited = new Set<string>()

  function walkChain(mapId: string): string | null {
    if (visited.has(mapId)) return null // cycle protection
    visited.add(mapId)

    const map = mapIndex.get(mapId)
    if (!map) return null

    const expansion = map.symbols.get(symbol)
    if (expansion) return expansion

    // Walk parent chain
    if (map.parentId) {
      return walkChain(map.parentId)
    }

    return null
  }

  // If a specific map is given, start there
  if (startMapId) {
    const result = walkChain(startMapId)
    if (result) return result
  }

  // Otherwise search all maps (last defined wins if ambiguous)
  for (let i = maps.length - 1; i >= 0; i--) {
    visited.clear()
    const result = walkChain(maps[i].id)
    if (result) return result
  }

  return symbol
}

/**
 * Expand all known symbols in a text string.
 * Replaces each symbol with its resolved expansion.
 */
export function resolveAllSymbols(text: string, maps: CompMap[]): string {
  const table = buildSymbolTable(maps)
  let result = text

  // Sort symbols by length descending to avoid partial matches
  const sortedSymbols = [...table.keys()].sort((a, b) => b.length - a.length)

  for (const symbol of sortedSymbols) {
    const expansion = table.get(symbol)!
    // Only replace standalone occurrences (not inside words)
    // Use a simple approach: replace all occurrences
    result = result.split(symbol).join(expansion)
  }

  return result
}

/**
 * Build a complete resolved symbol table from all maps,
 * resolving inheritance chains.
 */
export function buildSymbolTable(maps: CompMap[]): Map<string, string> {
  const table = new Map<string, string>()
  const mapIndex = new Map<string, CompMap>()
  for (const m of maps) mapIndex.set(m.id, m)

  // Topological order: process parents before children
  const processed = new Set<string>()
  const processing = new Set<string>()

  function processMap(id: string): void {
    if (processed.has(id)) return
    if (processing.has(id)) return // cycle
    processing.add(id)

    const map = mapIndex.get(id)
    if (!map) return

    // Process parent first
    if (map.parentId) {
      processMap(map.parentId)
    }

    // Inherit parent symbols
    if (map.parentId) {
      const parent = mapIndex.get(map.parentId)
      if (parent) {
        for (const [sym, exp] of parent.symbols) {
          if (!map.symbols.has(sym)) {
            table.set(sym, exp)
          }
        }
      }
    }

    // Apply this map's symbols (overrides inherited)
    for (const [sym, exp] of map.symbols) {
      table.set(sym, exp)
    }

    processing.delete(id)
    processed.add(id)
  }

  for (const m of maps) {
    processMap(m.id)
  }

  return table
}
