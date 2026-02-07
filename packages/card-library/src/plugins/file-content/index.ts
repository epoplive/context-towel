import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { FileContentCard } from './FileContentCard'
import type { FileContentData } from './types'

export type { FileContentData } from './types'
export { FileContentCard } from './FileContentCard'

export const fileContentBlockDefinition: BlockDefinition<FileContentData> = {
  type: 'file-content',
  name: 'File Content',
  schemaVersion: 1,
  components: {
    inline: FileContentCard,
    card: FileContentCard,
  },
}

export function registerFileContentBlock(): void {
  if (!blockRegistry.has('file-content')) {
    blockRegistry.register(fileContentBlockDefinition as any)
  }
}
