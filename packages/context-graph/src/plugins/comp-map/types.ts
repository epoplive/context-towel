// ============================================================================
// Comp Map Plugin Types
// ============================================================================

import { ExtractedItem } from '../../types'

export interface CompMapItem extends ExtractedItem {
  mapId: string
  parentId?: string
  symbols: Array<{ symbol: string; expansion: string }>
}
