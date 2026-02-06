import type { ExtractedItem } from '../../types'

export type LinkKind = 'wiki' | 'markdown'

export interface LinkItem extends ExtractedItem {
  kind: LinkKind
  target: string
  text?: string
}
