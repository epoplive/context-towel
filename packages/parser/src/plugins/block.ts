// ============================================================================
// Block Parser Plugin
// ============================================================================
//
// Parses fenced YAML blocks registered with the card-library's blockRegistry.
// Extracted from context-graph's plugins/block/parser.ts.
//
// Requires @context-towel/card-library to be installed. The plugin uses the
// global blockRegistry to discover registered block types at parse time, so
// callers must register their block types before parsing.

import { blockRegistry, parseMarkdownBlocks } from '@context-towel/card-library'
import type { ParseResult } from '../types'
import type { BlockItem } from '../types'

// These IDs are handled by their own dedicated parsers — skip them here.
const SKIP_BLOCK_TYPES = new Set(['task', 'checklist', 'diagram', 'log', 'toc', 'link'])

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function getRegisteredBlockTypes(): string[] {
  return blockRegistry
    .list()
    .map((def: { type: string }) => def.type)
    .filter((type) => type && !SKIP_BLOCK_TYPES.has(type))
}

// -------------------------------------------------------------------------- //
// Public API
// -------------------------------------------------------------------------- //

export function detectBlocks(content: string): boolean {
  const types = getRegisteredBlockTypes()
  if (types.length === 0) return false
  const pattern = new RegExp(
    '(?:`{3,}|~{3,})\\s*(?:' + types.map(escapeRegExp).join('|') + ')\\b',
    'im',
  )
  return pattern.test(content)
}

export function parseBlocks(content: string, sourceFile: string): ParseResult<BlockItem> {
  const { blocks } = parseMarkdownBlocks(content, sourceFile)
  const items: BlockItem[] = []
  const rawMatches: ParseResult['rawMatches'] = []

  for (const block of blocks) {
    if (SKIP_BLOCK_TYPES.has(block.type)) continue

    const range = block.source.range
    const id = [block.type, sourceFile, range.startLine ?? 0, range.startOffset ?? 0].join(':')

    items.push({
      id,
      sourceFile,
      sourceLine: range.startLine ?? undefined,
      sourceEndLine: range.endLine ?? undefined,
      blockType: block.type,
      data: block.data,
      raw: block.source.raw,
      range,
      errors: block.errors,
    })

    if (
      typeof range.startOffset === 'number' &&
      typeof range.endOffset === 'number' &&
      typeof range.startLine === 'number' &&
      typeof range.endLine === 'number'
    ) {
      rawMatches!.push({
        start: range.startOffset,
        end: range.endOffset,
        startLine: range.startLine,
        endLine: range.endLine,
        content: block.source.raw,
      })
    }
  }

  return { pluginId: 'block', items, rawMatches }
}

/** ParserPlugin descriptor for FileParserService registration */
export const blockParserPlugin = {
  id: 'block',
  extensions: ['.md', '.markdown', '.mdx'],
  detect: detectBlocks,
  parse: parseBlocks,
}

export type { BlockItem }
