import type { ExtractedItem } from '../../types'

/**
 * An entity extracted from an ```index block in a markdown document.
 * Each entity becomes a node in the graph.
 */
export interface IndexEntityItem extends ExtractedItem {
  /** Entity ID (F1, S1, I1, PF1, CS1, DS1, CL1) */
  entityId: string
  /** Entity type */
  entityType: 'file' | 'system' | 'interface' | 'problem' | 'pipeline' | 'snippet' | 'doc' | 'link'
  /** Human name */
  name: string
  /** Description */
  description?: string
  /** Number of file references */
  refCount: number
  /** For context links: IDs of linked entities */
  linkedIds?: string[]
  /** For pipelines: step descriptions */
  steps?: Array<{ fileId: string; description: string }>
}
