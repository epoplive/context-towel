import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { FileDiffCard } from './FileDiffCard'
import type { FileDiffData } from './types'

export type { FileDiffData, DiffHunk } from './types'
export { FileDiffCard } from './FileDiffCard'

export const fileDiffBlockDefinition: BlockDefinition<FileDiffData> = {
  type: 'file-diff',
  name: 'File Diff',
  schemaVersion: 1,
  components: {
    inline: FileDiffCard,
    card: FileDiffCard,
  },
}

export function registerFileDiffBlock(): void {
  if (!blockRegistry.has('file-diff')) {
    blockRegistry.register(fileDiffBlockDefinition as any)
  }
}
