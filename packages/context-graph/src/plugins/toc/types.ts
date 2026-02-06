// ============================================================================
// TOC (Table of Contents) Plugin Types
// ============================================================================

import { ExtractedItem } from '../../types'

export interface SectionCounts {
  tasks: number
  tasksCompleted: number
  checklists: number
  checklistsCompleted: number
}

export interface TocSection extends ExtractedItem {
  title: string
  level: number           // Heading level (1-6)
  content: string         // Content under this heading
  children: TocSection[]  // Nested sections
  counts: SectionCounts   // Task/checklist counts for this section
}
