import { blockRegistry, parseMarkdownBlocks } from '@context-towel/card-library'
import type { ParseResult, SourceMatch } from '../../types'
import type { BlockItem } from './types'

const SKIP_BLOCK_TYPES = new Set(['task', 'checklist', 'diagram', 'log', 'toc', 'link'])

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getRegisteredBlockTypes = (): string[] =>
  blockRegistry
    .list()
    .map((def: any) => def.type as string)
    .filter((type: string) => type && !SKIP_BLOCK_TYPES.has(type))

export function detectBlocks(content: string): boolean {
  const types = getRegisteredBlockTypes()
  if (types.length === 0) return false
  const pattern = new RegExp('```(?:' + types.map(escapeRegExp).join('|') + ')\\b', 'm')
  return pattern.test(content)
}

export function parseBlocks(content: string, sourceFile: string): ParseResult<BlockItem> {
  const { blocks } = parseMarkdownBlocks(content, sourceFile)
  const items: BlockItem[] = []
  const rawMatches: SourceMatch[] = []

  for (const block of blocks) {
    if (SKIP_BLOCK_TYPES.has(block.type)) {
      continue
    }
    const range = block.source.range
    const id = [
      block.type,
      sourceFile,
      range.startLine ?? 0,
      range.startOffset ?? 0,
    ].join(':')

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
      rawMatches.push({
        start: range.startOffset,
        end: range.endOffset,
        startLine: range.startLine,
        endLine: range.endLine,
        content: block.source.raw,
      })
    }
  }

  return {
    pluginId: 'block',
    items,
    rawMatches,
  }
}
