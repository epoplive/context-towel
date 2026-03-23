// ============================================================================
// Comp Map Plugin Parser
// ============================================================================
//
// Parses <comp:map:NAME [uses="PARENT"]> blocks from markdown content.
// Each block contains symbol=expansion pairs, space-separated per line.

import { ParseResult, SourceMatch } from '../../types'
import { CompMapItem } from './types'

const COMP_MAP_RE = /<comp:map:(\w[\w-]*)(?:\s+uses="(\w[\w-]*)")?\s*>([\s\S]*?)<\/comp:map:\1>/g

/**
 * Detect if content contains comp:map blocks
 */
export function detectCompMaps(content: string): boolean {
  return /<comp:map:\w/i.test(content)
}

/**
 * Parse <comp:map:NAME> blocks from markdown content.
 */
export function parseCompMaps(content: string, sourceFile: string): ParseResult<CompMapItem> {
  const items: CompMapItem[] = []
  const rawMatches: SourceMatch[] = []

  COMP_MAP_RE.lastIndex = 0
  let mapIndex = 0
  let match: RegExpExecArray | null

  while ((match = COMP_MAP_RE.exec(content)) !== null) {
    const fullMatch = match[0]
    const mapId = match[1]
    const parentId = match[2] || undefined
    const body = match[3]

    const matchStart = match.index
    const beforeMatch = content.slice(0, matchStart)
    const startLine = beforeMatch.split('\n').length
    const endLine = startLine + fullMatch.split('\n').length - 1

    const symbols: Array<{ symbol: string; expansion: string }> = []
    for (const line of body.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const pairRe = /(\S+?)=(\S+)/g
      let pm: RegExpExecArray | null
      while ((pm = pairRe.exec(trimmed)) !== null) {
        symbols.push({ symbol: pm[1], expansion: pm[2] })
      }
    }

    items.push({
      id: `comp-map-${mapIndex}`,
      sourceFile,
      sourceLine: startLine,
      sourceEndLine: endLine,
      mapId,
      parentId,
      symbols,
    })

    rawMatches.push({
      start: matchStart,
      end: matchStart + fullMatch.length,
      startLine,
      endLine,
      content: fullMatch,
    })

    mapIndex++
  }

  return { pluginId: 'comp-map', items, rawMatches }
}
