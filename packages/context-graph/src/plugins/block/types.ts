import type { ExtractedItem } from '../../types'
import type { BlockParseError, BlockSourceRange } from '@context-towel/card-library'

export interface BlockItem extends ExtractedItem {
  blockType: string
  data: unknown
  raw: string
  range: BlockSourceRange
  errors?: BlockParseError[]
}
