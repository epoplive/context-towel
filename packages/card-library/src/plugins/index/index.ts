import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition, BlockParseError } from '../../blocks/types'
import { IndexCard } from './IndexCard'
import { parseIndexBlock, serializeIndexBlock } from './parser'
import type { IndexBlockData } from './types'

export { IndexCard } from './IndexCard'
export { EntityRefChip, FileRefChip, EntityRegistryContext, useEntityRegistry, entityTypeColors, ENTITY_ID_PATTERN } from './EntityRefChip'
export type { EntityRefChipProps, FileRefChipProps } from './EntityRefChip'
export { parseIndexBlock, EntityRegistry, serializeIndexBlock } from './parser'
export { FileRefResolver } from './resolver'
export type { ResolvedFileRef, FileReader } from './resolver'
export type {
  EntityType,
  EntityEntry,
  FileEntry,
  PipelineEntry,
  ContextLinkEntry,
  FileRef,
  PipelineStep,
  EntityRegistryData,
  IndexBlockData,
  IndexSection,
  ExpandableMarker,
} from './types'
export {
  ENTITY_PREFIXES,
  parseEntityId,
  parseFileRef,
} from './types'

export const indexBlockDefinition: BlockDefinition<IndexBlockData> = {
  type: 'index',
  name: 'Index',
  schemaVersion: 1,
  components: {
    inline: IndexCard,
    card: IndexCard,
  },
  validate(data: IndexBlockData): BlockParseError[] {
    const errors: BlockParseError[] = []

    // Check for duplicate IDs (shouldn't happen from parser, but validate)
    const ids = new Set<string>()
    for (const id of data.registry.entities.keys()) {
      if (ids.has(id)) {
        errors.push({ message: `Duplicate entity ID: ${id}` })
      }
      ids.add(id)
    }

    // Check that file references point to known F-IDs
    for (const entity of data.registry.entities.values()) {
      for (const ref of entity.refs) {
        if (ref.fileId.startsWith('F') && !data.registry.files.has(ref.fileId)) {
          errors.push({
            message: `Entity ${entity.id} references unknown file ID: ${ref.fileId}`,
          })
        }
      }
    }

    return errors
  },
  serialize(data: IndexBlockData): string {
    return serializeIndexBlock(data)
  },
  toContextMarkdown(blocks) {
    if (blocks.length === 0) return ''
    const lines: string[] = ['## Codebase Index']

    for (const block of blocks) {
      if (!block.data) continue
      const { registry } = block.data

      // Summarize by type
      const byType = new Map<string, number>()
      for (const e of registry.entities.values()) {
        byType.set(e.type, (byType.get(e.type) || 0) + 1)
      }

      for (const [type, count] of byType) {
        lines.push(`- ${count} ${type}${count !== 1 ? 's' : ''}`)
      }
    }

    return lines.join('\n')
  },
}

/** Register the index block plugin */
export function registerIndexBlock(): void {
  blockRegistry.registerOrReplace(indexBlockDefinition as BlockDefinition)
}
