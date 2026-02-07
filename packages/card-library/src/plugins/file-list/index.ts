import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { FileListCard } from './FileListCard'
import type { FileListData } from './types'

export type { FileListData, FileListMatch } from './types'
export { FileListCard } from './FileListCard'

export const fileListBlockDefinition: BlockDefinition<FileListData> = {
  type: 'file-list',
  name: 'File List',
  schemaVersion: 1,
  components: {
    inline: FileListCard,
    card: FileListCard,
  },
}

export function registerFileListBlock(): void {
  if (!blockRegistry.has('file-list')) {
    blockRegistry.register(fileListBlockDefinition as any)
  }
}
