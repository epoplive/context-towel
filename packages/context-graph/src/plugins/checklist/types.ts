// ============================================================================
// Checklist Plugin Types
// ============================================================================

import { ExtractedItem } from '../../types'

export interface ChecklistItem {
  text: string
  checked: boolean
}

export interface ChecklistGroup extends ExtractedItem {
  title: string           // Section heading where checklist was found
  items: ChecklistItem[]
  progress: number        // 0-100
}
