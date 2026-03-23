import type { ParseResult, SourceMatch } from '../../types'
import type { IndexEntityItem } from './types'
import {
  parseIndexBlock,
  type ContextLinkEntry,
  type PipelineEntry,
} from '@context-towel/card-library'

/** Detect if content contains an ```index block */
export function detectIndex(content: string): boolean {
  return /```index\b/.test(content)
}

/** Parse all ```index blocks and extract entities as graph items */
export function parseIndex(content: string, sourceFile: string): ParseResult<IndexEntityItem> {
  const items: IndexEntityItem[] = []
  const rawMatches: SourceMatch[] = []

  // Find all ```index blocks
  const blockPattern = /```index\n([\s\S]*?)```/g
  let match: RegExpExecArray | null

  while ((match = blockPattern.exec(content)) !== null) {
    const blockContent = match[1]
    const startOffset = match.index
    const endOffset = startOffset + match[0].length

    // Calculate line numbers
    const before = content.slice(0, startOffset)
    const startLine = before.split('\n').length
    const endLine = startLine + match[0].split('\n').length - 1

    rawMatches.push({
      start: startOffset,
      end: endOffset,
      startLine,
      endLine,
      content: match[0],
    })

    // Parse the index block content
    const indexData = parseIndexBlock(blockContent)

    // Convert each entity to a graph item
    for (const entity of indexData.registry.entities.values()) {
      const item: IndexEntityItem = {
        id: `${sourceFile}:${entity.id}`,
        sourceFile,
        sourceLine: startLine,
        sourceEndLine: endLine,
        entityId: entity.id,
        entityType: entity.type,
        name: entity.name,
        description: entity.description,
        refCount: entity.refs.length,
      }

      // Add type-specific data
      if (entity.type === 'link') {
        item.linkedIds = (entity as ContextLinkEntry).linkedIds
      }
      if (entity.type === 'pipeline') {
        item.steps = (entity as PipelineEntry).steps
      }

      items.push(item)
    }
  }

  return {
    pluginId: 'entity-index',
    items,
    rawMatches,
  }
}
